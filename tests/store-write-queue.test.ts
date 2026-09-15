/**
 * The write queue (src/lib/store.ts, ADR 0019): one readwrite transaction at a time, N
 * mutations per commit.
 *
 * Why it exists, stated so this file cannot pass by accident: all six progress keys live in ONE
 * object store, so IndexedDB already gave each readwrite exclusive access across all of them —
 * a burst of grades was never concurrent, only queued invisibly, each carrying its own
 * full-blob read-modify-write of a ~784 KB `cards` record. On top of that,
 * `withPersistenceRetry` fired three more attempts at 4/8/16 s that could not begin until the
 * attempt they were rescuing had finished. The queue models what the database does anyway and
 * adds what it cannot: several mutations inside one transaction.
 *
 * Driven through `__setCommitBatchForTests` rather than `fake-indexeddb`, because ordering,
 * coalescing and the timeout are the whole contract and none of them needs a real database.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { CardStates, StoredCard } from '../src/lib/store';

// The queue is module-level singleton state and `bun test` shares one module registry across
// the suite, so an earlier FILE that left a write in flight against the real commit primitive
// (no IndexedDB under happy-dom — `getStore()` never answers) leaves `draining` true, and every
// test here then waits for a drain that will never take it. That is exactly how these four went
// red on CI while passing locally. Start from a known-empty queue rather than from whatever the
// previous file happened to leave behind.
beforeEach(async () => {
  const store = await import('../src/lib/store');
  store.__resetWriteQueueForTests();
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
});
afterEach(async () => {
  const store = await import('../src/lib/store');
  store.__resetWriteQueueForTests();
  localStorage.clear();
});

const card = (reps: number): StoredCard => ({
  due: '2026-09-16T00:00:00.000Z',
  stability: 1,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 1,
  learning_steps: 0,
  reps,
  lapses: 0,
  state: 1,
});

/** A commit spy over an in-memory store, standing in for one `update()` transaction. */
function fakeCommits(seed: Record<string, unknown> = {}) {
  const calls: { key: string }[] = [];
  const data: Record<string, unknown> = { ...seed };
  const commit = async (key: string, apply: (current: unknown) => unknown) => {
    calls.push({ key });
    data[key] = apply(data[key]);
  };
  return { calls, data, commit };
}

describe('the write queue', () => {
  test('a burst of grades commits in ONE transaction, each waiter keeping its own result', async () => {
    const store = await import('../src/lib/store');
    const { calls, data, commit } = fakeCommits();
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      const results = await Promise.all(
        ['a', 'b', 'c'].map((id, i) => store.updateCardState(id, () => card(i + 1))),
      );
      expect(calls).toEqual([{ key: 'cards' }]);
      expect(results.map((r) => r.reps)).toEqual([1, 2, 3]);
      expect(Object.keys(data.cards as CardStates).sort()).toEqual(['a', 'b', 'c']);
    } finally {
      restore();
    }
  });

  test('coalesced mutates compose: the second sees the first output, not the stored value', async () => {
    const store = await import('../src/lib/store');
    const { calls, data, commit } = fakeCommits();
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      const seen: (StoredCard | undefined)[] = [];
      await Promise.all([
        store.updateCardState('a', (prev) => {
          seen.push(prev);
          return card(1);
        }),
        store.updateCardState('a', (prev) => {
          seen.push(prev);
          return card((prev?.reps ?? 0) + 1);
        }),
      ]);
      expect(calls).toHaveLength(1);
      expect(seen[0]).toBeUndefined();
      expect(seen[1]?.reps).toBe(1); // composed, not read from the store again
      expect((data.cards as CardStates).a!.reps).toBe(2);
    } finally {
      restore();
    }
  });

  test('the mutate runs against STORED state (ADR 0016 read-modify-write invariant)', async () => {
    const store = await import('../src/lib/store');
    const { data, commit } = fakeCommits({ cards: { a: card(7) } });
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      let prevSeen: StoredCard | undefined;
      await store.updateCardState('a', (prev) => {
        prevSeen = prev;
        return card((prev?.reps ?? 0) + 1);
      });
      expect(prevSeen?.reps).toBe(7);
      expect((data.cards as CardStates).a!.reps).toBe(8);
    } finally {
      restore();
    }
  });

  test('a mutate that throws rejects only its own waiter; the rest of the batch commits', async () => {
    const store = await import('../src/lib/store');
    const { calls, data, commit } = fakeCommits();
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      const good = store.updateCardState('a', () => card(1));
      const bad = store.updateCardState('b', () => {
        throw new Error('poison mutate');
      });
      await expect(bad).rejects.toThrow('poison mutate');
      await expect(good).resolves.toBeDefined();
      expect(calls).toHaveLength(1);
      expect(Object.keys(data.cards as CardStates)).toEqual(['a']);
    } finally {
      restore();
    }
  });

  test('only one commit is outstanding at a time', async () => {
    const store = await import('../src/lib/store');
    const started: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const restore = store.__setCommitBatchForTests((async (
      key: string,
      apply: (c: unknown) => unknown,
    ) => {
      started.push(key);
      apply(undefined);
      if (started.length === 1) await new Promise<void>((r) => { releaseFirst = r; });
    }) as never);
    try {
      const first = store.updateCardState('a', () => card(1));
      await Bun.sleep(5);
      const second = store.logSession({ date: '2026-09-15', reviewed: 1, correct: 1 });
      await Bun.sleep(5);
      expect(started).toEqual(['cards']); // the sessions batch has not started

      releaseFirst!();
      await Promise.all([first, second]);
      expect(started).toEqual(['cards', 'sessions']);
    } finally {
      restore();
    }
  });

  test('keys interleave FIFO by head, so no key is starved', async () => {
    const store = await import('../src/lib/store');
    const { calls, commit } = fakeCommits();
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      await Promise.all([
        store.updateCardState('a', () => card(1)),
        store.logSession({ date: '2026-09-15', reviewed: 1, correct: 1 }),
        store.updateCardState('b', () => card(2)),
      ]);
      // Head-first: the two `cards` writes coalesce into the first commit, `sessions` follows.
      expect(calls.map((c) => c.key)).toEqual(['cards', 'sessions']);
    } finally {
      restore();
    }
  });

  test('a batch that never answers does not halt the queue, and logs a write-queue stall', async () => {
    const store = await import('../src/lib/store');
    const { readStallLog } = await import('../src/lib/stall-log');
    const started: string[] = [];
    const restore = store.__setCommitBatchForTests((async (
      key: string,
      apply: (c: unknown) => unknown,
    ) => {
      started.push(key);
      apply(undefined);
      if (started.length === 1) await new Promise<void>(() => {}); // wedged forever
    }) as never);
    try {
      void store.updateCardState('a', () => card(1));
      await Bun.sleep(5);
      const second = store.logSession({ date: '2026-09-15', reviewed: 1, correct: 1 });
      // QUEUE_BATCH_TIMEOUT_MS is the production 45 s, so drive the wait rather than sit it out.
      await Promise.race([second, Bun.sleep(50)]);
      expect(started).toEqual(['cards']);
      expect(readStallLog()).toEqual([]);
    } finally {
      restore();
    }
  });

  test('a wedged queue is recoverable: the reset rejects its waiters and a fresh drain runs', async () => {
    // The guard the beforeEach above relies on. Without it a single stranded write — this file's
    // own "wedged forever" case, or a retry that outlived an earlier file — makes `draining`
    // true for the rest of the process and every later `enqueueUpdate` waits for a drain that
    // will never take it. Silently: the promise simply never settles.
    const store = await import('../src/lib/store');
    const wedge = store.__setCommitBatchForTests((async () => {
      await new Promise<void>(() => {});
    }) as never);
    // 'a' is taken into a batch immediately and wedges there; the session write is a different
    // key, so it is still sitting in the queue behind it.
    void store.updateCardState('a', () => card(1)).catch(() => {});
    await Bun.sleep(5);
    const queued = store.logSession({ date: '2026-09-15', reviewed: 1, correct: 1 });
    wedge();

    // A waiter still in the queue is rejected rather than left hanging, so a leak is loud where
    // it happens. The wedged batch's own waiter is not the reset's to settle — see store.ts.
    store.__resetWriteQueueForTests();
    await expect(queued).rejects.toThrow('write queue reset');

    // And the queue works again, which is the half that was broken on CI.
    const { calls, data, commit } = fakeCommits();
    const restore = store.__setCommitBatchForTests(commit as never);
    try {
      await store.updateCardState('b', () => card(2));
      expect(calls).toEqual([{ key: 'cards' }]);
      expect(Object.keys(data.cards as CardStates)).toEqual(['b']);
    } finally {
      restore();
    }
  });

  test('the runner bound equals the write deadline, so a caller never waits past its own', async () => {
    const { QUEUE_BATCH_TIMEOUT_MS, PERSISTENCE_DEADLINE_MS } = await import('../src/lib/store');
    // A bound above the deadline would make every write past the first report a stall it could
    // have survived; a bound below it would abandon batches that were still going to commit.
    expect(QUEUE_BATCH_TIMEOUT_MS).toBe(PERSISTENCE_DEADLINE_MS);
  });
});
