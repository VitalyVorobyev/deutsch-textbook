/**
 * The client's sync loop, driven against the **real Worker**.
 *
 * `globalThis.fetch` is routed into `worker/index.ts` over the D1/R2 fakes, and
 * only `src/lib/store.ts` is replaced — with an in-memory store that merges
 * using the real `src/lib/snapshot-merge.ts`. So the round trip under test is
 * the shipping one: gzip, conditional PUT, 412, pull, merge, retry.
 *
 * This exists because the conflict path is the one place where a plausible
 * implementation loses a learner's day of work, and no server-side test can see
 * it: every request in the losing sequence is individually correct.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  mergeAttempts,
  mergeCards,
  mergeFeedback,
  mergeSessions,
  mergeTopics,
} from '../src/lib/snapshot-merge';
import type { Attempt, ProgressSnapshot } from '../src/lib/store';
import worker from '../worker/index';
import { makeEnv, seedUser } from './worker-fakes';

const ORIGIN = 'https://deutsch.vitavision.dev';

// ---------------------------------------------------------------------------
// An in-memory stand-in for the IndexedDB store
// ---------------------------------------------------------------------------

function emptySnapshot(): ProgressSnapshot {
  return {
    version: 7,
    exportedAt: new Date(0).toISOString(),
    attempts: [],
    cards: {},
    sessions: [],
    topics: {},
    feedback: {},
  };
}

let local: ProgressSnapshot = emptySnapshot();

function attempt(id: string, ts: number): Attempt {
  return {
    setId: 'a1/artikel',
    itemId: id,
    itemType: 'cloze',
    itemRevision: 1,
    correct: true,
    given: 'der',
    ts,
  };
}

mock.module('../src/lib/store', () => ({
  exportSnapshot: async (profile?: string): Promise<ProgressSnapshot> => ({
    ...local,
    profile,
    exportedAt: new Date().toISOString(),
  }),
  mergeSnapshot: async (incoming: unknown) => {
    const snapshot = incoming as ProgressSnapshot;
    local = {
      ...local,
      attempts: mergeAttempts(local.attempts, snapshot.attempts),
      cards: mergeCards(local.cards, snapshot.cards),
      sessions: mergeSessions(local.sessions, snapshot.sessions),
      topics: mergeTopics(local.topics, snapshot.topics),
      feedback: mergeFeedback(local.feedback, snapshot.feedback),
    };
  },
  localDateString: () => '2026-08-03',
}));

// Imported after the mock so the dynamic import inside syncNow resolves to it.
const { bindActiveProfile, forgetSession, readSyncState, syncNow, SYNC_STATE_KEY } = await import(
  '../src/lib/sync-remote'
);

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

let env: never;
let cookie = '';

/** Runs after each routed response — the seam the race test uses to interleave a second device. */
let afterResponse: ((method: string) => Promise<void>) | null = null;

/** Route the client's same-origin fetch into the Worker, carrying the session cookie. */
function routeFetchToWorker(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const request = new Request(new URL(path, ORIGIN), init);
    // happy-dom drops Cookie/Origin from a Request init (see worker-fakes.ts).
    request.headers.set('cookie', cookie);
    request.headers.set('origin', ORIGIN);
    const response = await worker.fetch(request, env);
    await afterResponse?.((init?.method ?? 'GET').toUpperCase());
    return response;
  }) as typeof fetch;
}

/** A second device writing straight through the API, against whatever etag is current. */
async function otherDeviceWrites(snapshot: ProgressSnapshot): Promise<void> {
  const head = new Request(`${ORIGIN}/api/sync/snapshot`);
  head.headers.set('cookie', cookie);
  const current = await worker.fetch(head, env);
  const etag = current.headers.get('etag');

  const gz = new Blob([JSON.stringify(snapshot)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const put = new Request(`${ORIGIN}/api/sync/snapshot`, {
    method: 'PUT',
    body: await new Response(gz).arrayBuffer(),
  });
  put.headers.set('cookie', cookie);
  put.headers.set('origin', ORIGIN);
  if (etag) put.headers.set('if-match', etag);
  else put.headers.set('if-none-match', '*');
  const result = await worker.fetch(put, env);
  if (result.status !== 204) throw new Error(`other device write failed: ${result.status}`);
}

beforeEach(async () => {
  afterResponse = null;
  local = emptySnapshot();
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'vitaly', label: 'Vitaly' }]));
  localStorage.setItem('da:profile', 'vitaly');
  env = makeEnv();
  const seeded = await seedUser(env, { email: 'lerner@example.com' });
  cookie = seeded.cookie;
  forgetSession();
  routeFetchToWorker();
  bindActiveProfile(seeded.userId);
});

/** What the account currently holds, decoded — the assertion the learner cares about. */
async function remoteSnapshot(): Promise<ProgressSnapshot> {
  const response = await worker.fetch(
    (() => {
      const request = new Request(`${ORIGIN}/api/sync/snapshot`);
      request.headers.set('cookie', cookie);
      return request;
    })(),
    env,
  );
  const stream = new Blob([await response.arrayBuffer()])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as ProgressSnapshot;
}

const ids = (snapshot: { attempts: Attempt[] }) => snapshot.attempts.map((a) => a.itemId).sort();

// ---------------------------------------------------------------------------

describe('syncNow', () => {
  test('a first sync uploads what this device holds', async () => {
    local.attempts = [attempt('a', 1)];

    const outcome = await syncNow();
    expect(outcome).toMatchObject({ state: 'ok', pushed: true });
    expect(ids(await remoteSnapshot())).toEqual(['a']);
    expect(readSyncState().etag).toBeTruthy();
  });

  test('an unchanged device does not re-upload', async () => {
    local.attempts = [attempt('a', 1)];
    await syncNow();

    const second = await syncNow();
    expect(second).toMatchObject({ state: 'ok', pushed: false, pulled: false });
  });

  test('a device with no local history pulls the account state', async () => {
    local.attempts = [attempt('a', 1)];
    await syncNow();

    // A second device: same account, empty local store, no etag.
    local = emptySnapshot();
    localStorage.removeItem(SYNC_STATE_KEY);
    bindActiveProfile((await import('../src/lib/sync-remote')).readSyncState().accountId ?? '');
    localStorage.setItem(
      SYNC_STATE_KEY,
      JSON.stringify({ accountId: undefined, profileId: 'vitaly' }),
    );

    const outcome = await syncNow();
    expect(outcome).toMatchObject({ state: 'ok', pulled: true });
    expect(ids(local)).toEqual(['a']);
  });

  test('a write that lands before our pull is merged', async () => {
    local.attempts = [attempt('mine-1', 1)];
    await syncNow();

    await otherDeviceWrites({
      ...emptySnapshot(),
      attempts: [attempt('mine-1', 1), attempt('theirs', 2)],
    });

    local.attempts = [...local.attempts, attempt('mine-2', 3)];
    expect(await syncNow()).toMatchObject({ state: 'ok', pulled: true, pushed: true });
    expect(ids(await remoteSnapshot())).toEqual(['mine-1', 'mine-2', 'theirs']);
    expect(ids(local)).toEqual(['mine-1', 'mine-2', 'theirs']);
  });

  /**
   * The regression this file exists for: a write that lands **between** our pull
   * and our push.
   *
   * Our GET is a 304 — nothing had changed when we asked — so our PUT carries a
   * now-stale `If-Match` and loses with 412. The tempting fix is to adopt the
   * etag the 412 hands back and retry. That retry succeeds, and it silently
   * deletes the other device's day: the second pull is a 304 against the *new*
   * etag, so the merge never happens and our body overwrites theirs.
   *
   * The race is forced rather than hoped for — an accidental interleaving is not
   * a test.
   */
  test('a write that lands mid-sync is merged, not overwritten', async () => {
    local.attempts = [attempt('mine-1', 1)];
    await syncNow();

    local.attempts = [...local.attempts, attempt('mine-2', 3)];

    // Fire the other device's write immediately after our first GET returns.
    let raced = false;
    afterResponse = async (method) => {
      if (raced || method !== 'GET') return;
      raced = true;
      await otherDeviceWrites({
        ...emptySnapshot(),
        attempts: [attempt('mine-1', 1), attempt('theirs', 2)],
      });
    };

    const outcome = await syncNow();
    afterResponse = null;

    expect(raced).toBe(true);
    expect(outcome).toMatchObject({ state: 'ok', pushed: true });
    // Nothing lost in either direction.
    expect(ids(await remoteSnapshot())).toEqual(['mine-1', 'mine-2', 'theirs']);
    expect(ids(local)).toEqual(['mine-1', 'mine-2', 'theirs']);
  });

  /**
   * Offline is not a failure state — it is the ordinary state of a laptop on a
   * train. Two things must hold: the attempt is kept locally, and coming back
   * online must not need a restart.
   *
   * The second one is the trap. `getSession` memoizes per page load, and in the
   * desktop shell a "page load" lasts as long as the app is open — so caching a
   * probe that merely failed to complete would stop the device syncing for the
   * rest of the session.
   */
  test('offline reports an error and recovers on its own when the network returns', async () => {
    local.attempts = [attempt('a', 1)];

    const online = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    const offline = await syncNow();
    expect(offline.state).not.toBe('ok');
    // The learner's work is untouched; nothing was dropped to make the sync fit.
    expect(ids(local)).toEqual(['a']);

    globalThis.fetch = online;
    // No forgetSession(), no reload: exactly what a returning connection looks like.
    expect(await syncNow()).toMatchObject({ state: 'ok', pushed: true });
    expect(ids(await remoteSnapshot())).toEqual(['a']);
  });

  test('a pending account reports pending and uploads nothing', async () => {
    env = makeEnv();
    const pending = await seedUser(env, { status: 'pending' });
    cookie = pending.cookie;
    forgetSession();
    localStorage.removeItem(SYNC_STATE_KEY);
    bindActiveProfile(pending.userId);
    local.attempts = [attempt('a', 1)];

    expect(await syncNow()).toEqual({ state: 'pending' });
  });

  test('an unbound profile syncs nothing at all', async () => {
    localStorage.removeItem(SYNC_STATE_KEY);
    local.attempts = [attempt('a', 1)];
    expect(await syncNow()).toEqual({ state: 'off', reason: 'unbound' });
  });

  test('a profile bound to a different local profile does not sync', async () => {
    localStorage.setItem('da:profile', 'jemand-anders');
    expect(await syncNow()).toEqual({ state: 'off', reason: 'unbound' });
  });
});
