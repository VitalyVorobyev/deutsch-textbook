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

describe('withPersistenceRetry', () => {
  // The difference from withVisibilityRetry, whose contract is pinned above and unchanged:
  // retries fire on a TIMER (a stall while the window stays visible — the desktop failure
  // mode — never produces a visibilitychange), and silence has a deadline: past it the
  // caller gets StoreStallError instead of waiting forever. Requires an idempotent op.
  test('a stalled first attempt is superseded by a timed retry, no visibility event needed', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      if (calls === 1) return new Promise<string>(() => {});
      return Promise.resolve('timed retry settled');
    };

    const settled = withPersistenceRetry(op, { schedule: [20], deadlineMs: 500 });
    expect(await settled).toBe('timed retry settled');
    expect(calls).toBe(2);
  });

  test('a fast attempt settles on its own — no retry ever fires', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      return Promise.resolve('fast');
    };
    expect(await withPersistenceRetry(op, { schedule: [20], deadlineMs: 500 })).toBe('fast');
    await Bun.sleep(40);
    expect(calls).toBe(1);
  });

  test('every attempt stalled → rejects with StoreStallError at the deadline', async () => {
    const { withPersistenceRetry, StoreStallError } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      return new Promise<void>(() => {});
    };
    const settled = withPersistenceRetry(op, { schedule: [10, 20], deadlineMs: 60 });
    await expect(settled).rejects.toBeInstanceOf(StoreStallError);
    expect(calls).toBe(3); // initial + both scheduled retries were attempted first
  });

  test('the visibility retry still composes on top of the timer', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      if (calls < 3) return new Promise<string>(() => {});
      return Promise.resolve('visibility attempt settled');
    };
    // One timed retry stalls too; the visibilitychange fires the third attempt.
    const settled = withPersistenceRetry(op, { schedule: [10], deadlineMs: 1000 });
    await Bun.sleep(30);
    fireVisible();
    expect(await settled).toBe('visibility attempt settled');
  });
});

describe('runCardIdMigration (the marker that keeps it off the critical path)', () => {
  // The A1 rename used to read the whole `cards` blob — 784 KB for a real learner — on
  // EVERY store open, awaited by the first caller of the page, with no deadline and no
  // retry of its own. Under the `Promise.all` every load surface uses, that one leg
  // hanging hung the whole screen; and for anyone whose ids were already renamed it was
  // a no-op every single time (0 of the 174 mapped ids were present in the learner's 824
  // cards when this was measured). It is now out of `getStore()` entirely, with one owner
  // (PersistenceAlert, once per launch, after the profile gate) — un-awaiting it inside
  // `getStore` would have fixed the hang and kept the other half: an unobserved
  // transaction opened by whichever code path happens to touch the store first.
  //
  // What is pinned here is the marker, which is what makes "once" true: only a SUCCESSFUL
  // pass retires the repair, so a stall cannot skip it forever.
  const fakeHandle = (impl: () => Promise<void>) =>
    ((_mode: IDBTransactionMode, _cb: unknown) => impl()) as unknown as Parameters<
      typeof import('../src/lib/store').runCardIdMigration
    >[1];

  test('a successful pass sets the marker, and the next launch does no read at all', async () => {
    localStorage.setItem('da:profiles', JSON.stringify([{ id: 'mig-ok', label: 'Mig' }]));
    const { runCardIdMigration } = await import('../src/lib/store');
    let opens = 0;
    const handle = fakeHandle(async () => {
      opens += 1;
    });

    await runCardIdMigration('mig-ok', handle);
    expect(opens).toBe(1);
    expect(localStorage.getItem('da:cardid-migrated:mig-ok')).toBe('1');

    await runCardIdMigration('mig-ok', handle);
    expect(opens).toBe(1);
  });

  test('a failed or stalled pass leaves the marker unset, so it is retried next launch', async () => {
    localStorage.setItem('da:profiles', JSON.stringify([{ id: 'mig-fail', label: 'Mig' }]));
    const { runCardIdMigration } = await import('../src/lib/store');
    let opens = 0;
    const failing = fakeHandle(async () => {
      opens += 1;
      throw new Error('IndexedDB unavailable');
    });

    // It must not reject: nothing is waiting on this, and a repair that throws into a
    // fire-and-forget call site is an unhandled rejection, not a signal.
    await runCardIdMigration('mig-fail', failing);
    expect(localStorage.getItem('da:cardid-migrated:mig-fail')).toBeNull();

    await runCardIdMigration('mig-fail', failing);
    expect(opens).toBe(2);
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
