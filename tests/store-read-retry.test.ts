/**
 * `withReadRetry` (src/lib/store.ts) is the read half of ADR 0016's write repair, added by
 * ADR 0018.
 *
 * The gap it closes, stated so this file cannot pass by accident: writes got timed retries
 * (`withPersistenceRetry`) and reads got a deadline plus `withVisibilityRetry`, whose only
 * trigger is `visibilitychange`. A stall while the desktop window stays visible therefore
 * had no automatic recovery at all — the learner's only mechanism was a retry button, and on
 * the one surface that had neither a deadline nor a button (Themen) the page said "loading
 * your progress" forever while 824 cards and 3919 attempts sat in the store.
 *
 * Three properties are pinned here, plus the stall-log side effect that turns the next
 * occurrence into evidence:
 *
 * 1. a stalled first attempt is superseded by a TIMED retry, with no visibility event;
 * 2. all attempts stalled → `StoreStallError` at the deadline, so a caller can render an
 *    error rather than wait;
 * 3. an attempt that settles AFTER the deadline resolves nobody (the caller has already
 *    been rejected) but is recorded as a recovery — "the store unstuck itself" and "the
 *    store never answered" are different bugs.
 *
 * `schedule`/`deadlineMs` are parameters purely so these run in milliseconds instead of
 * waiting on the real 2 s/5 s/10 s production values.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

function fireVisible() {
  document.dispatchEvent(new Event('visibilitychange'));
}

// The stall log is keyed on the active profile, which is read from localStorage.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
});
afterEach(() => {
  localStorage.clear();
});

describe('withReadRetry', () => {
  test('a stalled first attempt is superseded by a timed retry, no visibility event needed', async () => {
    const { withReadRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      if (calls === 1) return new Promise<string>(() => {});
      return Promise.resolve('timed retry settled');
    };

    const settled = withReadRetry(op, { schedule: [20], deadlineMs: 500 });
    expect(await settled).toBe('timed retry settled');
    expect(calls).toBe(2);
  });

  test('a fast attempt settles on its own — no retry ever fires', async () => {
    const { withReadRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      return Promise.resolve('fast');
    };
    expect(await withReadRetry(op, { schedule: [20], deadlineMs: 500 })).toBe('fast');
    await Bun.sleep(40);
    expect(calls).toBe(1);
  });

  test('a rejecting read is not retried — only silence is', async () => {
    // A read that says "no" has answered. Retrying it would turn one real error into
    // three, and the deadline exists for silence, not for failure.
    const { withReadRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      return Promise.reject(new Error('NotFoundError'));
    };
    await expect(withReadRetry(op, { schedule: [10], deadlineMs: 200 })).rejects.toThrow(
      'NotFoundError',
    );
    await Bun.sleep(30);
    expect(calls).toBe(1);
  });

  test('every attempt stalled → rejects with StoreStallError at the deadline', async () => {
    const { withReadRetry, StoreStallError } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      return new Promise<void>(() => {});
    };
    const settled = withReadRetry(op, { schedule: [10, 20], deadlineMs: 60 });
    await expect(settled).rejects.toBeInstanceOf(StoreStallError);
    expect(calls).toBe(3); // initial + both scheduled retries were attempted first
  });

  test('the visibility retry still composes on top of the timer', async () => {
    const { withReadRetry } = await import('../src/lib/store');
    let calls = 0;
    const op = () => {
      calls++;
      if (calls < 3) return new Promise<string>(() => {});
      return Promise.resolve('visibility attempt settled');
    };
    const settled = withReadRetry(op, { schedule: [10], deadlineMs: 1000 });
    await Bun.sleep(30);
    fireVisible();
    expect(await settled).toBe('visibility attempt settled');
  });

  test('a deadline rejection is written to the stall log, with the surface that waited', async () => {
    const { withReadRetry } = await import('../src/lib/store');
    const { readStallLog } = await import('../src/lib/stall-log');
    await expect(
      withReadRetry(() => new Promise<void>(() => {}), {
        surface: 'themen',
        schedule: [],
        deadlineMs: 30,
      }),
    ).rejects.toThrow();

    const log = readStallLog();
    expect(log).toHaveLength(1);
    expect(log[0].surface).toBe('themen');
    expect(log[0].attempts).toBe(1);
    expect(log[0].waitedMs).toBeGreaterThanOrEqual(20);
    expect(log[0].recoveredAfterMs).toBeUndefined();
  });

  test('an attempt that settles after the deadline is recorded as a recovery, not resolved', async () => {
    const { withReadRetry } = await import('../src/lib/store');
    const { readStallLog } = await import('../src/lib/stall-log');
    let release: ((v: string) => void) | undefined;
    const op = () =>
      new Promise<string>((res) => {
        release = res;
      });

    const settled = withReadRetry(op, { surface: 'heute', schedule: [], deadlineMs: 30 });
    await expect(settled).rejects.toThrow();
    // The read comes back long after nobody is waiting for it.
    release!('late');
    await Bun.sleep(10);

    const log = readStallLog();
    expect(log).toHaveLength(1);
    expect(log[0].surface).toBe('heute');
    expect(log[0].recoveredAfterMs).toBeGreaterThanOrEqual(20);
  });
});
