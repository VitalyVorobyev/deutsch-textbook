/**
 * The journal's OWN storage can fail, and before ADR 0019 that failure was indistinguishable
 * from a stalled IndexedDB.
 *
 * `writeOps` (src/lib/write-journal.ts) swallowed its failure with a bare `catch {}` and the
 * comment "the journal is a safety net, never a blocker" — right about not throwing, wrong about
 * staying quiet. A localStorage that refuses the write makes `journalAppend` AND `journalRemove`
 * both no-op, so `PersistenceAlert`'s count freezes at whatever it held: new answers never join
 * it, confirmed ones never leave. "The count is stuck at N — it neither grows nor clears" is
 * exactly that signature, and no amount of repairing the IndexedDB side moves it.
 *
 * Driven by making the SERIALIZATION fail rather than by stubbing `localStorage.setItem`. Both
 * land in the one `catch` this pins, and the stub does not: happy-dom's Storage is a proxy that
 * memoizes the method it hands out, so a patched `Storage.prototype.setItem` cannot be restored
 * within the process and would leave every later test file writing into a throwing store.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { journalAppend, journalPending, journalWriteBlocked } from '../src/lib/write-journal';
import { Rating } from '../src/lib/srs';

afterEach(() => {
  localStorage.clear();
});

describe('a journal write that fails is named, never swallowed', () => {
  test('a write the journal cannot persist raises the flag, and still does not throw', () => {
    // A BigInt is the cheapest value `JSON.stringify` refuses, standing in for the storage
    // saying no. The branch under test is the same one a QuotaExceededError takes.
    const unserializable = {
      kind: 'grade',
      cardId: 'x::card::de-x',
      grade: Rating.Good,
      ts: 1n,
    } as unknown as Parameters<typeof journalAppend>[0];

    journalAppend(unserializable); // a safety net may never be the thing that throws
    expect(journalWriteBlocked()).toBe(true);
    expect(journalPending()).toEqual([]);
  });

  test('the flag clears as soon as a write succeeds again', () => {
    journalAppend({ kind: 'grade', cardId: 'y::card::de-x', grade: Rating.Good, ts: 2 });
    expect(journalWriteBlocked()).toBe(false);
    expect(journalPending()).toHaveLength(1);
  });
});
