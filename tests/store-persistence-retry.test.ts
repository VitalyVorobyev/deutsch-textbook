/**
 * `withPersistenceRetry` (src/lib/store.ts) is the write half of ADR 0016, amended by ADR 0019.
 *
 * The gap this file closes, stated so it cannot pass by accident: the wrapper rejects with
 * `StoreStallError` at its deadline and then DROPS any attempt that settles afterwards
 * (`if (settled) return`). But idb-keyval resolves on `transaction.oncomplete`, so a resolve is
 * a COMMIT — the write is on disk. The caller never learned that, so `journalRemove` never ran,
 * and `PersistenceAlert` claimed "N Antworten noch nicht gespeichert" about data that had
 * landed, for the rest of the profile's life. That is the banner in the 2026-09-15 report:
 * a count frozen at 2 in an app that was otherwise grading normally.
 *
 * `withReadRetry` already had the late-settle branch (ADR 0018) — it records a recovery and
 * drops the value, which is right for a read, where the value is worthless once nobody waits.
 * For a write the value is worthless too, but the FACT that it committed is not.
 *
 * `schedule`/`deadlineMs` are parameters purely so these run in milliseconds instead of waiting
 * on the real 12 s/30 s/45 s production values.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
});
afterEach(() => {
  localStorage.clear();
});

describe('withPersistenceRetry late settle', () => {
  test('an attempt that settles after the deadline calls onLateSettle with its value', async () => {
    const { withPersistenceRetry, StoreStallError } = await import('../src/lib/store');
    let release: ((v: string) => void) | undefined;
    const op = () => new Promise<string>((res) => { release = res; });
    const late: string[] = [];

    const settled = withPersistenceRetry(op, {
      surface: 'grade',
      schedule: [],
      deadlineMs: 30,
      onLateSettle: (v) => late.push(v),
    });
    await expect(settled).rejects.toBeInstanceOf(StoreStallError);

    release!('committed');
    await Bun.sleep(10);
    expect(late).toEqual(['committed']);
  });

  test('a late settle is recorded as a recovery under the write surface', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    const { readStallLog } = await import('../src/lib/stall-log');
    let release: ((v: string) => void) | undefined;

    const settled = withPersistenceRetry(() => new Promise<string>((res) => { release = res; }), {
      surface: 'grade',
      schedule: [],
      deadlineMs: 30,
    });
    await settled.catch(() => {});

    const afterStall = readStallLog();
    expect(afterStall).toHaveLength(1);
    expect(afterStall[0]!.surface).toBe('grade');
    expect(afterStall[0]!.recoveredAfterMs).toBeUndefined();

    release!('committed');
    await Bun.sleep(10);
    expect(readStallLog()[0]!.recoveredAfterMs).toBeGreaterThanOrEqual(0);
  });

  test('a late REJECTION does not call onLateSettle — the write did not land', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    let fail: ((e: unknown) => void) | undefined;
    const late: unknown[] = [];

    const settled = withPersistenceRetry(() => new Promise<string>((_r, rej) => { fail = rej; }), {
      surface: 'grade',
      schedule: [],
      deadlineMs: 30,
      onLateSettle: (v) => late.push(v),
    });
    await settled.catch(() => {});

    fail!(new Error('aborted'));
    await Bun.sleep(10);
    expect(late).toEqual([]);
  });

  test('onLateSettle fires at most once even when two late attempts resolve', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    const releases: ((v: string) => void)[] = [];
    const late: string[] = [];

    const settled = withPersistenceRetry(
      () => new Promise<string>((res) => { releases.push(res); }),
      { surface: 'grade', schedule: [10], deadlineMs: 40, onLateSettle: (v) => late.push(v) },
    );
    await settled.catch(() => {});

    expect(releases.length).toBeGreaterThanOrEqual(2);
    for (const r of releases) r('committed');
    await Bun.sleep(10);
    expect(late).toEqual(['committed']);
  });

  test('a fast write settles normally, logging no stall and firing no late settle', async () => {
    const { withPersistenceRetry } = await import('../src/lib/store');
    const { readStallLog } = await import('../src/lib/stall-log');
    const late: string[] = [];

    expect(
      await withPersistenceRetry(() => Promise.resolve('fast'), {
        surface: 'grade',
        schedule: [20],
        deadlineMs: 200,
        onLateSettle: (v) => late.push(v),
      }),
    ).toBe('fast');
    await Bun.sleep(40);
    expect(readStallLog()).toEqual([]);
    expect(late).toEqual([]);
  });
});
