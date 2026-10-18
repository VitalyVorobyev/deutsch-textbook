/**
 * The Leben-in-Deutschland trainer's persistence (ADR 0009): its own `lid` store key written
 * through the ADR 0006 journal, snapshot v8, and the merge. The pure logic is tests/lid.test.ts.
 *
 * The store is driven through `__setCommitBatchForTests` with an in-memory map — the same seam
 * tests/progress-transition.test.ts uses — so nothing here opens an IndexedDB. Every drain is
 * awaited to completion and the seam is restored after each test: `bun test` runs every file in
 * one process, and a leaked override would rewrite another file's writes.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LidOptionKey } from '@da/schema/lid';
import * as store from '../src/lib/store';
import * as journal from '../src/lib/write-journal';
import { __resetProfileStateCacheForTests } from '../src/lib/profile';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import { snapshotWouldShrink } from '../src/lib/syncdir';
import { writeSnapshot } from '../scripts/progress-pull';
import {
  applyLidAnswer,
  applyLidExam,
  EMPTY_LID_STATE,
  lidExamAnswers,
  mergeLid,
  type LidAnswer,
  type LidExamRun,
  type LidState,
} from '../src/lib/lid';
import { applyGradeAt, Rating } from '../src/lib/srs';

const T = Date.parse('2026-10-10T09:00:00Z');
const DAY = 86_400_000;

let db: Map<string, unknown>;
let restore: (() => void) | undefined;
const dirs: string[] = [];

beforeEach(() => {
  store.__resetWriteQueueForTests();
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'lid-test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'lid-test');
  __resetProfileStateCacheForTests();
  db = new Map();
  restore = store.__setCommitBatchForTests(async (key, apply) => {
    db.set(key, apply(db.get(key)));
  });
});

afterEach(() => {
  restore?.();
  restore = undefined;
  store.__resetWriteQueueForTests();
  localStorage.clear();
  __resetProfileStateCacheForTests();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const answer = (
  q: string,
  correct: boolean,
  ts: number,
  over: Partial<LidAnswer> = {},
): LidAnswer => ({
  q,
  chosen: correct ? 'a' : 'b',
  correct,
  ts,
  mode: 'practice',
  bank: 'test',
  ...over,
});

const ITEMS = [
  ...Array.from({ length: 30 }, (_, i) => `general-${String(i + 1).padStart(3, '0')}`),
  'BY-01',
  'BY-02',
  'BY-03',
];
const SOLUTIONS = Object.fromEntries(ITEMS.map((id) => [id, 'a'])) as Record<string, LidOptionKey>;

function run(id: string, submittedAt: number): LidExamRun {
  const answers = Object.fromEntries(
    ITEMS.map((q, at) => [q, at < 20 ? 'a' : at < 30 ? 'c' : null]),
  ) as Record<string, LidOptionKey | null>;
  return {
    id,
    state: 'BY',
    bank: 'test',
    startedAt: submittedAt - 40 * 60_000,
    submittedAt,
    items: ITEMS,
    answers,
    correct: 20,
    timedOut: false,
  };
}

const lid = () => db.get('lid') as LidState;

describe('journal replay is idempotent for both LiD op kinds', () => {
  test('a LiD answer replayed after it landed is a no-op', async () => {
    const a = answer('general-001', true, T);
    await journal.logLidAnswerDurably(a);
    expect(journal.journalPending()).toEqual([]);
    const landed = lid();
    expect(landed.answers).toEqual([a]);
    expect(landed.cards['general-001']).toEqual(applyGradeAt(undefined, Rating.Good, T));

    // The page died after the commit and before the journal entry was removed.
    journal.journalAppend({ kind: 'lid-answer', answer: a });
    const result = await journal.replayJournal();
    expect(result).toEqual({ replayed: 1, poisoned: 0, failed: 0 });
    expect(lid()).toBe(landed);
    expect(lid().cards['general-001']!.reps).toBe(1);
    expect(journal.journalPending()).toEqual([]);
  });

  test('a mock submission journals the run and one exam answer per item; a replay changes nothing', async () => {
    const mock = run('mock-1', T);
    const answers = lidExamAnswers(mock, SOLUTIONS);
    await journal.logLidExamDurably(mock, answers);
    expect(journal.journalPending()).toEqual([]);
    const landed = lid();
    expect(landed.exams).toEqual([mock]);
    expect(landed.answers).toHaveLength(33);
    expect(landed.answers.every((a) => a.mode === 'exam')).toBe(true);
    // A missed or unanswered mock question is scheduled for review all the same.
    expect(landed.cards['BY-01']).toEqual(applyGradeAt(undefined, Rating.Again, T));
    expect(landed.cards['general-030']).toEqual(applyGradeAt(undefined, Rating.Again, T));
    expect(landed.cards['general-001']).toEqual(applyGradeAt(undefined, Rating.Good, T));

    journal.journalAppend({ kind: 'lid-exam', run: mock });
    for (const a of answers) journal.journalAppend({ kind: 'lid-answer', answer: a });
    await journal.replayJournal();
    expect(lid()).toBe(landed);
    expect(Object.values(lid().cards).every((card) => card.reps === 1)).toBe(true);
    expect(journal.journalPending()).toEqual([]);
  });

  test('a stalled mock submission keeps the run and every answer pending, and replays them all', async () => {
    restore?.();
    restore = store.__setCommitBatchForTests(async () => {
      throw new DOMException('storage unavailable', 'AbortError');
    });
    const mock = run('mock-2', T);
    await journal.logLidExamDurably(mock, lidExamAnswers(mock, SOLUTIONS));
    const pending = journal.journalPending();
    expect(pending).toHaveLength(34);
    expect(pending[0]).toEqual({ kind: 'lid-exam', run: mock });
    expect(pending.slice(1).every((op) => op.kind === 'lid-answer')).toBe(true);
    expect(journal.journalPoisoned()).toEqual([]);

    restore();
    restore = store.__setCommitBatchForTests(async (key, apply) => {
      db.set(key, apply(db.get(key)));
    });
    await journal.replayJournal();
    expect(journal.journalPending()).toEqual([]);
    expect(lid().exams).toEqual([mock]);
    expect(lid().answers).toHaveLength(33);
  });

  test('op keys name the new kinds', () => {
    const a = answer('BY-04', false, T);
    expect(journal.journalOpKey({ kind: 'lid-answer', answer: a })).toBe(`lid-answer|BY-04|${T}`);
    expect(journal.journalOpKey({ kind: 'lid-exam', run: run('mock-3', T) })).toBe(
      'lid-exam|mock-3',
    );
  });
});

describe('LiD answers never touch cards or attempts', () => {
  test('practice and mock answers write only the lid key, and mark only LiD as seen', async () => {
    await journal.logLidAnswerDurably(answer('general-001', true, T));
    const mock = run('mock-4', T + DAY);
    await journal.logLidExamDurably(mock, lidExamAnswers(mock, SOLUTIONS));
    expect([...db.keys()]).toEqual(['lid']);
    // A LiD-only learner's empty vocabulary store is real; marking `cards` seen would make every
    // card surface render it as a stalled read.
    expect(journal.hasSeenData('lid')).toBe(true);
    expect(journal.hasSeenData('cards')).toBe(false);
    expect(journal.hasSeenData('attempts')).toBe(false);
  });

  test('a merge files LiD state under lid and leaves cards and attempts as they were', async () => {
    const card = applyGradeAt(undefined, Rating.Good, T);
    const attempt = {
      setId: 'a1/x',
      itemId: 'i',
      itemType: 'mc',
      correct: true,
      given: 'a',
      ts: T,
    };
    db.set('cards', { 'deck::Wort::de-x': card });
    db.set('attempts', [attempt]);
    const incoming = applyLidAnswer(EMPTY_LID_STATE, answer('general-002', true, T));
    await store.mergeSnapshot({
      version: 8,
      exportedAt: new Date(T).toISOString(),
      attempts: [],
      cards: {},
      sessions: [],
      topics: {},
      feedback: {},
      lid: incoming,
    });
    expect(db.get('cards')).toEqual({ 'deck::Wort::de-x': card });
    expect(db.get('attempts')).toEqual([attempt]);
    expect(lid()).toEqual(incoming);
  });
});

describe('snapshot v8', () => {
  const v7 = {
    version: 7,
    exportedAt: '2026-10-09T18:00:00.000Z',
    profile: 'Vitaly',
    attempts: [
      {
        setId: 'a2/x',
        itemId: 'one',
        itemType: 'translate',
        itemRevision: 1,
        correct: true,
        given: 'Gut.',
        ts: 1,
      },
    ],
    cards: { 'deck::Wort::de-x': applyGradeAt(undefined, Rating.Good, T) },
    sessions: [{ date: '2026-10-09', reviewed: 3, trained: 4, ts: 2 }],
    topics: { dativ: { readAt: 5 } },
    goal: { topicId: 'dativ', setAt: 6 },
    feedback: { berlin: { artifactId: 'berlin', useful: true, ts: 7 } },
  };

  test('v7 migrates to v8 with an empty lid and nothing else changed', () => {
    expect(parseProgressSnapshot(v7)).toEqual({
      ...v7,
      version: 8,
      lid: { cards: {}, answers: [], exams: [] },
    });
  });

  test('a v7 file cannot smuggle LiD state past the version it claims', () => {
    const stray = { ...v7, lid: applyLidAnswer(EMPTY_LID_STATE, answer('general-001', true, T)) };
    expect(parseProgressSnapshot(stray).lid).toEqual({ cards: {}, answers: [], exams: [] });
  });

  test('a v8 snapshot round-trips, and a v8 file without lid reads as empty', () => {
    let state = applyLidAnswer(EMPTY_LID_STATE, answer('general-001', false, T));
    state = applyLidAnswer(state, answer('general-001', true, T + DAY));
    const mock = run('mock-5', T + 2 * DAY);
    state = lidExamAnswers(mock, SOLUTIONS).reduce(applyLidAnswer, applyLidExam(state, mock));
    const snapshot = { ...v7, version: 8 as const, lid: state };
    const parsed = parseProgressSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed).toEqual(snapshot);
    expect(parseProgressSnapshot(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);

    const { lid: _lid, ...withoutLid } = snapshot;
    expect(parseProgressSnapshot(withoutLid).lid).toEqual({ cards: {}, answers: [], exams: [] });
  });

  test('malformed LiD state rejects the snapshot', () => {
    const bad = (lid: unknown) => () => parseProgressSnapshot({ ...v7, version: 8, lid });
    expect(
      bad({
        cards: {},
        answers: [
          { q: 'general-001', chosen: 'e', correct: true, ts: 1, mode: 'practice', bank: 't' },
        ],
        exams: [],
      }),
    ).toThrow();
    expect(bad({ cards: {}, answers: [], exams: [{ id: 'x' }] })).toThrow();
    expect(bad({ cards: { q: { reps: 1 } }, answers: [], exams: [] })).toThrow();
  });

  test('a v7 file followed by a v8 file of the same day is not a shrink', () => {
    const v8 = {
      ...v7,
      version: 8,
      lid: applyLidAnswer(EMPTY_LID_STATE, answer('general-001', true, T)),
    };
    expect(snapshotWouldShrink(JSON.stringify(v7), JSON.stringify(v8))).toBe(false);

    const dir = mkdtempSync(join(tmpdir(), 'da-lid-'));
    dirs.push(dir);
    const target = join(dir, '2026-10-10.json');
    writeFileSync(target, JSON.stringify(v7));
    expect(writeSnapshot(target, JSON.stringify(v8), v8.attempts.length)).toBe('written');
    expect(JSON.parse(readFileSync(target, 'utf8')).version).toBe(8);
  });
});

describe('mergeLid', () => {
  const a1 = answer('general-001', true, T);
  const a2 = answer('general-002', false, T + 2);
  const b1 = answer('general-003', true, T + 1);

  test('unions answers by q|ts in time order, exams by id, and keeps the more advanced card', () => {
    const early = applyLidAnswer(EMPTY_LID_STATE, a1);
    const left = applyLidExam(applyLidAnswer(early, a2), run('mock-a', T + 5));
    const later = applyLidAnswer(early, answer('general-001', true, T + DAY));
    const right = applyLidExam(
      applyLidExam(applyLidAnswer(later, b1), run('mock-a', T + 5)),
      run('mock-b', T + 3),
    );

    const merged = mergeLid(left, right);
    expect(merged.answers.map((a) => `${a.q}@${a.ts - T}`)).toEqual([
      'general-001@0',
      'general-003@1',
      'general-002@2',
      `general-001@${DAY}`,
    ]);
    expect(merged.exams.map((e) => e.id)).toEqual(['mock-b', 'mock-a']);
    expect(merged.cards['general-001']).toBe(later.cards['general-001']);
    expect(merged.cards['general-001']!.reps).toBe(2);
    expect(Object.keys(merged.cards).sort()).toEqual(['general-001', 'general-002', 'general-003']);

    // Either direction, and again: the same state.
    expect(mergeLid(right, left)).toEqual(merged);
    expect(mergeLid(merged, right)).toEqual(merged);
    expect(mergeLid(merged, EMPTY_LID_STATE)).toEqual(merged);
  });
});
