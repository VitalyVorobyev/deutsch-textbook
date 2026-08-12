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

// DIAGNOSTIC LADDER (temporary, CI-only investigation): the round-trip below
// times out at 5000ms on Linux CI and passes on macOS, with the profile-state
// precondition already asserted. These stages isolate WHICH layer stalls on
// CI: the fake-indexeddb global, a fresh factory, or idb-keyval. Each stage
// has its own 5s budget, so one CI run bisects the stack. Removed once the
// culprit is pinned.
describe('diagnostic ladder for the CI stall', () => {
  test('stage 1: raw round trip on the global fake-indexeddb', async () => {
    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('diag-global-db', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put('v', 'k');
        tx.oncomplete = () => {
          const tx2 = open.result.transaction('kv', 'readonly');
          const req = tx2.objectStore('kv').get('k');
          req.onsuccess = () => (req.result === 'v' ? resolve() : reject(new Error('bad value')));
          req.onerror = () => reject(req.error);
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    console.log(`stage 1 (global) done in ${Date.now() - t0}ms`);
  });

  test('stage 2: raw round trip on a FRESH IDBFactory', async () => {
    const { IDBFactory } = await import('fake-indexeddb');
    const fresh = new IDBFactory();
    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      const open = fresh.open('diag-fresh-db', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put('v', 'k');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
    console.log(`stage 2 (fresh factory) done in ${Date.now() - t0}ms`);
  });

  test('stage 3: idb-keyval get/set through createStore on the global', async () => {
    const { createStore, get, set } = await import('idb-keyval');
    const t0 = Date.now();
    const s = createStore('diag-keyval-db', 'kv');
    await set('k', 'v', s);
    expect(await get('k', s)).toBe('v');
    console.log(`stage 3 (idb-keyval) done in ${Date.now() - t0}ms`);
  });
});

describe('withVisibilityRetry wraps the real store.ts path (fake-indexeddb, P20-3)', () => {
  test('getCardStates/setCardState round-trip through the real getStore()', async () => {
    // A profile must exist before getStore() proceeds past the first-run park
    // (store.ts:30-46, untouched by this change). Staging localStorage is not
    // enough on its own: resolveProfileState() memoizes module-wide, and on CI
    // (Linux test-file order) an earlier file reaches it with an empty registry
    // and pins 'first-run' — this test then parked forever and timed out, while
    // passing locally under macOS file order. Reset the memo after staging so
    // the decision is re-taken against THIS registry.
    localStorage.setItem(
      'da:profiles',
      JSON.stringify([{ id: 'retry-wrapper-test', label: 'Retry Wrapper Test' }]),
    );
    localStorage.setItem('da:profile', 'retry-wrapper-test');
    const { __resetProfileStateCacheForTests, resolveProfileState } = await import(
      '../src/lib/profile'
    );
    __resetProfileStateCacheForTests();
    // If this ever reports 'first-run', the park would otherwise show up as an
    // opaque 5s timeout — fail here with the real reason instead.
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
  });
});
