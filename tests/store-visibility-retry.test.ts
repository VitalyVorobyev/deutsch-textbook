/**
 * `withVisibilityRetry` (src/lib/store.ts) exists because a stalled IndexedDB promise used
 * to be a silent, permanent hang: `grade()` in FlashcardSession awaited `setCardState`
 * ahead of every UI update, and CurriculumPath's data-fetch never distinguished "still
 * reading" from "confirmed empty" — WebKit is documented to stall IDB transactions opened
 * in a backgrounded tab. This file pins the wrapper's own contract directly, plus one
 * real-IndexedDB round trip through the actual `getCardStates`/`setCardState` it now wraps
 * (fake-indexeddb, added for exactly this — P20-3: the test environment previously had no
 * IndexedDB at all, so store.ts's real `getStore()` path had zero coverage).
 *
 * `timeoutMs` is a parameter on `withVisibilityRetry` (default ~4s in production) purely so
 * these tests can exercise the retry path in milliseconds rather than waiting on a real
 * multi-second timer.
 */
import { describe, expect, test } from 'bun:test';
import 'fake-indexeddb/auto';

function fireVisible() {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('withVisibilityRetry', () => {
  test('a stalled first attempt is superseded by the retry fired on visibilitychange', async () => {
    let calls = 0;
    const { withVisibilityRetry } = await import('../src/lib/store');
    const op = () => {
      calls++;
      // First call: the stall — a promise that never settles on its own, the worst case
      // (a real WebKit background stall usually clears eventually; this proves the wrapper
      // does not depend on that ever happening).
      if (calls === 1) return new Promise<string>(() => {});
      return Promise.resolve('second attempt settled');
    };

    const settled = withVisibilityRetry(op, 20);
    await Bun.sleep(40); // past the 20ms timeout — the wrapper is now listening
    expect(calls).toBe(1); // no retry fired yet — visibilitychange hasn't happened
    fireVisible();

    expect(await settled).toBe('second attempt settled');
    expect(calls).toBe(2);
  });

  test('a fast attempt settles on its own — no retry ever fires', async () => {
    let calls = 0;
    const { withVisibilityRetry } = await import('../src/lib/store');
    const op = () => {
      calls++;
      return Promise.resolve('fast');
    };

    expect(await withVisibilityRetry(op, 20)).toBe('fast');
    await Bun.sleep(40);
    fireVisible(); // no-op: already settled, the listener was never armed
    expect(calls).toBe(1);
  });

  test('a stalled write is idempotent across two attempts — the whole point of trusting it', async () => {
    // setCardState's real op writes one full value per card id; a stale first attempt
    // landing after a retry already settled the caller must write the identical value,
    // never a different one. Model that contract directly on the wrapper.
    const { withVisibilityRetry } = await import('../src/lib/store');
    const writes: string[] = [];
    let calls = 0;
    const op = () => {
      calls++;
      writes.push('same-value');
      if (calls === 1) return new Promise<void>(() => {});
      return Promise.resolve();
    };

    const settled = withVisibilityRetry(op, 20);
    await Bun.sleep(40);
    fireVisible();
    await settled;

    expect(writes).toEqual(['same-value', 'same-value']);
  });

  test('rejects if the winning attempt rejects', async () => {
    const { withVisibilityRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      if (calls === 1) return new Promise<string>(() => {});
      return Promise.reject(new Error('still broken'));
    };

    const settled = withVisibilityRetry(op, 20);
    await Bun.sleep(40);
    fireVisible();
    await expect(settled).rejects.toThrow('still broken');
  });
});

describe('the store path, decomposed (CI-safe)', () => {
  // The full round trip below is quarantined on CI (see its comment for the
  // evidence), so the composition it exercises is pinned here piece by piece,
  // in the exact shapes store.ts uses: the profile gate re-decided against a
  // staged registry, the per-profile database opened via dbNameFor, and reads
  // and the read-modify-write going through withVisibilityRetry at the
  // production timeout.
  test('profile gate + per-profile DB + wrapped read/update, in store.ts shapes', async () => {
    localStorage.setItem(
      'da:profiles',
      JSON.stringify([{ id: 'decomposed-test', label: 'Decomposed' }]),
    );
    localStorage.setItem('da:profile', 'decomposed-test');
    const { __resetProfileStateCacheForTests, resolveProfileState, dbNameFor } = await import(
      '../src/lib/profile'
    );
    __resetProfileStateCacheForTests();
    expect(await resolveProfileState()).toBe('ready');

    const { withVisibilityRetry } = await import('../src/lib/store');
    const { createStore, get, update } = await import('idb-keyval');
    const s = createStore(dbNameFor('decomposed-test'), 'progress');
    expect(await withVisibilityRetry(async () => (await get('cards', s)) ?? {})).toEqual({});
    await withVisibilityRetry(async () =>
      update<Record<string, string>>('cards', (m) => ({ ...(m ?? {}), c1: 'v1' }), s),
    );
    expect(await withVisibilityRetry(async () => get('cards', s))).toEqual({ c1: 'v1' });
  });
});

describe('withVisibilityRetry wraps the real store.ts path (fake-indexeddb, P20-3)', () => {
  // Quarantined on CI (2026-08-12): on ubuntu runners this composition dies at
  // bun test's 5000ms budget with a promise that never settles, while every
  // ingredient passes there in milliseconds — raw fake-indexeddb, a fresh
  // IDBFactory, idb-keyval get/set/update, the getStore body rebuilt inline,
  // and the same op through withVisibilityRetry at the production timeout
  // (PR #179's diagnostic-ladder runs). The hang point even moved between runs
  // (getCardStates once, setCardState later) — a scheduling race in the
  // fake-indexeddb/bun event loop on Linux, not app logic; macOS passes every
  // time on the same bun version (1.3.14). Decomposed CI coverage lives above;
  // revisit on bun upgrades (docs/backlog.md).
  test.skipIf(!!process.env.CI)(
    'getCardStates/setCardState round-trip through the real getStore()',
    async () => {
      // A profile must exist before getStore() proceeds past the first-run
      // park. Staging localStorage is not enough on its own:
      // resolveProfileState() memoizes module-wide, and an earlier test file
      // (platform-dependent file order) can reach it with an empty registry
      // and pin 'first-run' — this test then parks forever. Reset the memo
      // after staging so the decision is re-taken against THIS registry.
      localStorage.setItem(
        'da:profiles',
        JSON.stringify([{ id: 'retry-wrapper-test', label: 'Retry Wrapper Test' }]),
      );
      localStorage.setItem('da:profile', 'retry-wrapper-test');
      const { __resetProfileStateCacheForTests, resolveProfileState } = await import(
        '../src/lib/profile'
      );
      __resetProfileStateCacheForTests();
      // If this ever reports 'first-run', the park would otherwise show up as
      // an opaque 5s timeout — fail here with the real reason instead.
      expect(await resolveProfileState()).toBe('ready');

      const { getCardStates, setCardState } = await import('../src/lib/store');
      const card = {
        due: '2026-08-10T00:00:00.000Z',
        stability: 12,
        difficulty: 5,
        elapsed_days: 3,
        scheduled_days: 7,
        learning_steps: 0,
        reps: 4,
        lapses: 1,
        state: 2,
      };

      expect(await getCardStates()).toEqual({});
      await setCardState('c1', card);
      expect((await getCardStates())['c1']).toMatchObject(card);
    },
  );
});
