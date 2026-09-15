/**
 * The write journal (src/lib/write-journal.ts) is the safety net under every progress
 * write: journaled synchronously to localStorage BEFORE the IndexedDB attempt starts,
 * removed after it settles, replayed on the next launch when it never did. The desktop
 * forensics that motivated it (docs/adrs/0016-durable-progress-writes.md): whole
 * sessions' writes silently never landed — 2026-08-19 has no daily backup at all —
 * while the UI advanced normally.
 *
 * Replay safety rests on two idempotency guarantees pinned here:
 *   - `applyGradeAt` (srs.ts): the `last_review >= ts` guard makes N applications of
 *     one grade identical to one — a retry or replay of a write that landed is a no-op;
 *   - `logAttempt` (store.ts): dedupes by the merge key `setId|itemId|ts` inside its
 *     read-modify-write, exercised through the real store below (fake-indexeddb).
 */
import { afterEach, describe, expect, test } from 'bun:test';
import 'fake-indexeddb/auto';
import {
  JOURNAL_CAP,
  journalAppend,
  journalOpKey,
  journalOverflowed,
  journalPending,
  journalRemove,
  type JournalOp,
} from '../src/lib/write-journal';
import { applyGradeAt, Rating } from '../src/lib/srs';
import type { NewAttempt } from '../src/lib/store';

afterEach(() => {
  localStorage.clear();
});

const attempt = (itemId: string, ts: number): NewAttempt => ({
  setId: 'a1/test-set',
  itemId,
  itemType: 'translate',
  itemRevision: 1,
  correct: true,
  given: 'x',
  ts,
});

const gradeOp = (cardId: string, ts: number): JournalOp => ({
  kind: 'grade',
  cardId,
  grade: Rating.Good,
  ts,
});

describe('applyGradeAt idempotency (the ts-guard replay safety rests on)', () => {
  test('applying the same grade at the same ts twice yields the identical card, one rep', () => {
    const ts = Date.parse('2026-08-26T10:00:00.000Z');
    const once = applyGradeAt(undefined, Rating.Good, ts);
    const twice = applyGradeAt(once, Rating.Good, ts);
    expect(twice).toBe(once); // returned unchanged, not merely equal
    expect(once.reps).toBe(1);
  });

  test('an earlier journaled grade replayed over a later real one is a no-op', () => {
    const t1 = Date.parse('2026-08-26T10:00:00.000Z');
    const t2 = Date.parse('2026-08-26T10:05:00.000Z');
    const afterLater = applyGradeAt(applyGradeAt(undefined, Rating.Good, t1), Rating.Good, t2);
    // Replay of the t1 op after t2 already landed: guard sees last_review >= t1.
    const replayed = applyGradeAt(afterLater, Rating.Again, t1);
    expect(replayed).toBe(afterLater);
  });

  test('a later grade on top of an earlier one does apply', () => {
    const t1 = Date.parse('2026-08-26T10:00:00.000Z');
    const t2 = Date.parse('2026-08-26T10:05:00.000Z');
    const first = applyGradeAt(undefined, Rating.Good, t1);
    const second = applyGradeAt(first, Rating.Good, t2);
    expect(second.reps).toBe(2);
  });
});

describe('journal round trip', () => {
  test('append → pending → remove, keyed by op identity', () => {
    const opA: JournalOp = { kind: 'attempt', attempt: attempt('i1', 1000) };
    const opB = gradeOp('deck::wort::x-de', 2000);
    journalAppend(opA);
    journalAppend(opB);
    expect(journalPending()).toHaveLength(2);

    journalRemove(opA);
    const left = journalPending();
    expect(left).toHaveLength(1);
    expect(journalOpKey(left[0]!)).toBe(journalOpKey(opB));

    journalRemove(opB);
    expect(journalPending()).toEqual([]);
  });

  test('removing one op leaves a same-card op at a different ts untouched', () => {
    const op1 = gradeOp('deck::wort::x-de', 1000);
    const op2 = gradeOp('deck::wort::x-de', 2000);
    journalAppend(op1);
    journalAppend(op2);
    journalRemove(op1);
    expect(journalPending().map(journalOpKey)).toEqual([journalOpKey(op2)]);
  });

  test('overflow keeps the newest ops and raises the flag rather than dropping silently', () => {
    for (let i = 0; i < JOURNAL_CAP + 5; i++) journalAppend(gradeOp('c', i));
    const pending = journalPending();
    expect(pending).toHaveLength(JOURNAL_CAP);
    expect((pending[0] as { ts: number }).ts).toBe(5); // oldest five dropped
    expect(journalOverflowed()).toBe(true);
  });
});

describe('replay through the real store (fake-indexeddb)', () => {
  // Same CI quarantine as the store round-trip suite (P25-13): the fake-indexeddb/bun
  // event loop races on Linux runners; the journal logic itself is covered above.
  test.skipIf(!!process.env.CI)(
    'a journaled grade replays into the store once, and a second replay is a no-op',
    async () => {
      localStorage.setItem(
        'da:profiles',
        JSON.stringify([{ id: 'journal-test', label: 'Journal Test' }]),
      );
      localStorage.setItem('da:profile', 'journal-test');
      const { __resetProfileStateCacheForTests, resolveProfileState } = await import(
        '../src/lib/profile'
      );
      __resetProfileStateCacheForTests();
      expect(await resolveProfileState()).toBe('ready');

      const { getCardStates, getAttempts } = await import('../src/lib/store');
      const { replayJournal } = await import('../src/lib/write-journal');

      const ts = Date.now();
      journalAppend({ kind: 'grade', cardId: 'deck::wort::x-de', grade: Rating.Good, ts });
      journalAppend({ kind: 'attempt', attempt: attempt('i1', ts) });
      journalAppend({ kind: 'attempt', attempt: attempt('i1', ts) }); // duplicate op

      const first = await replayJournal();
      expect(first.failed).toBe(0);
      expect(journalPending()).toEqual([]);

      const cards = await getCardStates();
      expect(cards['deck::wort::x-de']?.reps).toBe(1);
      // The duplicate attempt op deduped inside logAttempt's read-modify-write.
      expect((await getAttempts()).filter((a) => a.itemId === 'i1')).toHaveLength(1);

      // Replaying the same ops again (as if the removal had been lost) changes nothing.
      journalAppend({ kind: 'grade', cardId: 'deck::wort::x-de', grade: Rating.Again, ts });
      journalAppend({ kind: 'attempt', attempt: attempt('i1', ts) });
      await replayJournal();
      expect((await getCardStates())['deck::wort::x-de']?.reps).toBe(1);
      expect((await getAttempts()).filter((a) => a.itemId === 'i1')).toHaveLength(1);
    },
  );
});

/**
 * ADR 0019: the three ways a journal entry could outlive the write it describes, each of which
 * pinned `PersistenceAlert` at a count that could never fall. Driven through the REAL store
 * path — `__setCommitBatchForTests` stands in for the IndexedDB transaction — because the bug
 * lived in the seam between the retry wrapper and the journal, and a fake journal would not
 * have it.
 */
describe('a journal entry never outlives its own write', () => {
  const ts = Date.parse('2026-09-15T08:00:00.000Z');

  test('a grade whose write lands AFTER the deadline is removed from the journal', async () => {
    const store = await import('../src/lib/store');
    const { gradeCardDurably } = await import('../src/lib/write-journal');

    let release: (() => void) | undefined;
    const restore = store.__setCommitBatchForTests((async (
      _key: string,
      apply: (c: unknown) => unknown,
    ) => {
      await new Promise<void>((r) => { release = r; });
      apply(undefined);
    }) as never);

    try {
      const graded = gradeCardDurably('deck::wort::de-x', Rating.Good, ts, {
        schedule: [],
        deadlineMs: 30,
      });
      await Bun.sleep(60);
      // The deadline has passed: the write is journaled and the alert would be red.
      expect(journalPending()).toHaveLength(1);
      expect(await graded).toBeNull();

      release!();
      await Bun.sleep(20);
      // The transaction committed after all. Before ADR 0019 this entry stayed forever and the
      // banner claimed "noch nicht gespeichert" about a card that was on disk.
      expect(journalPending()).toEqual([]);
    } finally {
      restore();
    }
  });

  test('an op that can never be applied is quarantined, and the ops behind it still replay', async () => {
    const store = await import('../src/lib/store');
    const { journalAppend, journalPoisoned, replayJournal } = await import(
      '../src/lib/write-journal'
    );

    journalAppend(gradeOp('poison::card::de-x', ts));
    journalAppend(gradeOp('healthy::card::de-x', ts + 1));

    let calls = 0;
    const restore = store.__setCommitBatchForTests((async (
      _key: string,
      apply: (c: unknown) => unknown,
    ) => {
      calls += 1;
      // Not a stall — a rejection the store will repeat identically at every future launch.
      if (calls === 1) throw new TypeError('unserializable value');
      apply(undefined);
    }) as never);

    try {
      const result = await replayJournal();
      expect(result.poisoned).toBe(1);
      expect(result.replayed).toBe(1);
      expect(result.failed).toBe(0);
      // Neither op is left to block the next launch, and the bad one is kept, not destroyed.
      expect(journalPending()).toEqual([]);
      expect(journalPoisoned()).toHaveLength(1);
      expect(journalPoisoned()[0]!.error).toContain('unserializable value');
    } finally {
      restore();
    }
  });

  test('a stalled replay stops and REPORTS, rather than swallowing its error', async () => {
    const store = await import('../src/lib/store');
    const { journalAppend, replayJournal } = await import('../src/lib/write-journal');

    journalAppend(gradeOp('a::card::de-x', ts));
    journalAppend(gradeOp('b::card::de-x', ts + 1));

    // Wedged, but releasable: a commit left hanging forever would hold the single-flight queue
    // for its full 45 s bound and stall whatever test file bun runs next — the very behaviour
    // `QUEUE_BATCH_TIMEOUT_MS` bounds in production.
    const releases: (() => void)[] = [];
    const restore = store.__setCommitBatchForTests((async () => {
      await new Promise<void>((r) => releases.push(r));
    }) as never);
    try {
      const result = await replayJournal({ schedule: [], deadlineMs: 30 });
      expect(result.replayed).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.error).toBeInstanceOf(store.StoreStallError);
      expect(journalPending()).toHaveLength(2);
    } finally {
      for (const r of releases) r();
      await Bun.sleep(10);
      restore();
    }
  });

});
