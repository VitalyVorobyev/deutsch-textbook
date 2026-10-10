/**
 * The Leben-in-Deutschland trainer's pure logic (src/lib/lid.ts, ADR 0021): the mock draw, the
 * two pass marks, idempotent grading, the practice queue and the readiness facts. Store, journal
 * and snapshot wiring are tests/lid-progress.test.ts.
 */
import { describe, expect, test } from 'bun:test';
import { LID_EXAM, type LidOptionKey, type LidQuestion } from '@da/schema/lid';
import {
  applyLidAnswer,
  applyLidExam,
  drawMockExam,
  EMPTY_LID_STATE,
  lidExamAnswers,
  lidMistakes,
  lidReadiness,
  mulberry32,
  planLidPractice,
  planLidScopedPractice,
  scoreMock,
  shouldShuffleOptions,
  type LidAnswer,
  type LidExamRun,
  type LidState,
} from '../src/lib/lid';
import { applyGradeAt, Rating } from '../src/lib/srs';
import type { StoredCard } from '../src/lib/store';

const DAY = 86_400_000;

function question(id: string, answers: Partial<LidQuestion['answers']> = {}): LidQuestion {
  const general = id.startsWith('general-');
  const [, num] = /-(\d+)$/.exec(id)!;
  return {
    id,
    officialNumber: Number(num),
    scope: general ? 'general' : 'state',
    stateCode: general ? null : id.slice(0, 2),
    bamfInternalId: id,
    sourcePage: 1,
    question: `Frage ${id}`,
    answers: { a: 'eins', b: 'zwei', c: 'drei', d: 'vier', ...answers },
    solution: 'a',
    images: [],
  };
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');
const GENERAL = Array.from({ length: 300 }, (_, i) => question(`general-${pad(i + 1, 3)}`));
const BAYERN = Array.from({ length: 10 }, (_, i) => question(`BY-${pad(i + 1, 2)}`));
const BERLIN = Array.from({ length: 10 }, (_, i) => question(`BE-${pad(i + 1, 2)}`));
const BANK = { questions: [...GENERAL, ...BAYERN, ...BERLIN] };

const answer = (q: string, correct: boolean, ts: number, over: Partial<LidAnswer> = {}): LidAnswer => ({
  q, chosen: correct ? 'a' : 'b', correct, ts, mode: 'practice', bank: 'test', ...over,
});

const replay = (state: LidState, ...answers: LidAnswer[]) => answers.reduce(applyLidAnswer, state);

describe('drawMockExam', () => {
  test('draws 30 distinct general questions and 3 distinct questions of the chosen state', () => {
    const items = drawMockExam(BANK, 'BY', mulberry32(7));
    expect(items).toHaveLength(LID_EXAM.questions);
    expect(new Set(items).size).toBe(33);
    expect(items.filter((id) => id.startsWith('general-'))).toHaveLength(30);
    expect(items.filter((id) => id.startsWith('BY-'))).toHaveLength(3);
    expect(items.some((id) => id.startsWith('BE-'))).toBe(false);
  });

  test('the same seed gives the same draw; different seeds differ', () => {
    expect(drawMockExam(BANK, 'BY', mulberry32(42))).toEqual(drawMockExam(BANK, 'BY', mulberry32(42)));
    expect(drawMockExam(BANK, 'BY', mulberry32(42))).not.toEqual(drawMockExam(BANK, 'BY', mulberry32(43)));
  });

  test('50 seeds never break the counts, and the state questions do not sit in fixed slots', () => {
    const statePositions = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const items = drawMockExam(BANK, 'BY', mulberry32(seed));
      expect(items).toHaveLength(33);
      expect(new Set(items).size).toBe(33);
      const state = items.flatMap((id, at) => (id.startsWith('BY-') ? [at] : []));
      expect(state).toHaveLength(3);
      expect(items.filter((id) => id.startsWith('general-'))).toHaveLength(30);
      for (const at of state) statePositions.add(at);
    }
    // Placed at random, not appended: over 50 draws they land well beyond the last three slots.
    expect(statePositions.size).toBeGreaterThan(10);
  });

  test('throws rather than draw a short exam', () => {
    expect(() => drawMockExam({ questions: [...GENERAL.slice(0, 29), ...BAYERN] }, 'BY', mulberry32(1))).toThrow('30 general');
    expect(() => drawMockExam({ questions: [...GENERAL, ...BAYERN.slice(0, 2)] }, 'BY', mulberry32(1))).toThrow('BY');
    expect(() => drawMockExam(BANK, 'HH', mulberry32(1))).toThrow('HH');
  });
});

describe('scoreMock — two different pass marks, never merged', () => {
  const items = drawMockExam(BANK, 'BY', mulberry32(3));
  const solutions = Object.fromEntries(BANK.questions.map((q) => [q.id, q.solution])) as Record<string, LidOptionKey>;
  const answering = (right: number) =>
    Object.fromEntries(items.map((id, at) => [id, at < right ? 'a' : 'c'])) as Record<string, LidOptionKey>;

  test.each([
    [0, false, false],
    [14, false, false],
    [15, false, true],
    [16, false, true],
    [17, true, true],
    [18, true, true],
    [33, true, true],
  ])('%i correct → Einbürgerung %p, Orientierungskurs %p', (right, einbuergerung, orientierung) => {
    expect(scoreMock(items, answering(right), solutions)).toEqual({
      correct: right,
      passEinbuergerung: einbuergerung,
      passOrientierungskurs: orientierung,
    });
  });

  test('an unanswered item counts 0, whether null or absent', () => {
    const answers: Record<string, LidOptionKey | null> = answering(17);
    answers[items[0]!] = null;
    delete answers[items[1]!];
    expect(scoreMock(items, answers, solutions)).toEqual({
      correct: 15, passEinbuergerung: false, passOrientierungskurs: true,
    });
  });

  test('an item without an answer key throws instead of scoring as wrong', () => {
    expect(() => scoreMock(['general-999'], {}, solutions)).toThrow('general-999');
  });
});

describe('applyLidAnswer / applyLidExam', () => {
  const ts = Date.parse('2026-10-10T09:00:00Z');

  test('grades a new answer into its own card and appends it', () => {
    const state = applyLidAnswer(EMPTY_LID_STATE, answer('general-001', true, ts));
    expect(state.answers).toHaveLength(1);
    expect(state.cards['general-001']!.reps).toBe(1);
    expect(state.cards['general-001']).toEqual(applyGradeAt(undefined, Rating.Good, ts));
    expect(EMPTY_LID_STATE).toEqual({ cards: {}, answers: [], exams: [] }); // never mutated
  });

  test('a replay of a landed answer is a no-op: same object, one rep', () => {
    const once = applyLidAnswer(EMPTY_LID_STATE, answer('general-001', true, ts));
    const twice = applyLidAnswer(once, answer('general-001', true, ts));
    expect(twice).toBe(once);
    expect(twice.cards['general-001']!.reps).toBe(1);
    expect(twice.answers).toHaveLength(1);
  });

  test('a wrong answer grades Again', () => {
    const state = applyLidAnswer(EMPTY_LID_STATE, answer('general-001', false, ts));
    expect(state.cards['general-001']).toEqual(applyGradeAt(undefined, Rating.Again, ts));
  });

  test('an older answer arriving late is logged in order but does not regrade a newer card', () => {
    const later = applyLidAnswer(EMPTY_LID_STATE, answer('general-001', true, ts + DAY));
    const both = applyLidAnswer(later, answer('general-001', false, ts));
    expect(both.answers.map((a) => a.ts)).toEqual([ts, ts + DAY]);
    expect(both.cards['general-001']).toBe(later.cards['general-001']);
  });

  test('a mock run is recorded once by id', () => {
    const run = mockRun('run-1', ts, 20);
    const once = applyLidExam(EMPTY_LID_STATE, run);
    expect(applyLidExam(once, run)).toBe(once);
    expect(once.exams).toEqual([run]);
    expect(once.answers).toEqual([]);
    expect(once.cards).toEqual({});
  });

  test('lidExamAnswers gives one exam-mode answer per item; unanswered is wrong', () => {
    const run = mockRun('run-1', ts, 0);
    run.answers = { [run.items[0]!]: 'a', [run.items[1]!]: 'b', [run.items[2]!]: null };
    const solutions = Object.fromEntries(BANK.questions.map((q) => [q.id, q.solution])) as Record<string, LidOptionKey>;
    const answers = lidExamAnswers(run, solutions);
    expect(answers).toHaveLength(33);
    expect(answers.every((a) => a.mode === 'exam' && a.ts === run.submittedAt && a.bank === run.bank)).toBe(true);
    expect(answers.slice(0, 4).map((a) => [a.chosen, a.correct])).toEqual([
      ['a', true], ['b', false], [null, false], [null, false],
    ]);
  });
});

function mockRun(id: string, submittedAt: number, correct: number): LidExamRun {
  return {
    id, state: 'BY', bank: 'test', startedAt: submittedAt - 30 * 60_000, submittedAt,
    items: drawMockExam(BANK, 'BY', mulberry32(submittedAt % 1000)), answers: {}, correct, timedOut: false,
  };
}

describe('planLidPractice', () => {
  const now = new Date('2026-10-10T12:00:00');
  const ids = ['general-005', 'general-001', 'general-003', 'general-002', 'general-004'];

  function card(due: number, introducedAt?: string): StoredCard {
    return {
      due: new Date(due).toISOString(), stability: 1, difficulty: 5, elapsed_days: 0,
      scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2,
      last_review: new Date(due - DAY).toISOString(), ...(introducedAt ? { introducedAt } : {}),
    };
  }

  test('due questions first, most overdue first; not-yet-due ones are left out', () => {
    const state: LidState = {
      ...EMPTY_LID_STATE,
      cards: {
        'general-004': card(now.getTime() - DAY),
        'general-001': card(now.getTime() - 3 * DAY),
        'general-003': card(now.getTime() + DAY),
      },
    };
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 10 }))
      .toEqual(['general-001', 'general-004', 'general-005', 'general-002']);
  });

  test('new questions follow the given teaching order, capped by what today has left', () => {
    const today = '2026-10-10';
    const state: LidState = {
      ...EMPTY_LID_STATE,
      // Introduced today and not due yet: they spend the allowance without entering the queue.
      cards: { 'general-099': card(now.getTime() + DAY, today), 'general-098': card(now.getTime() + DAY, today) },
    };
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 5 }))
      .toEqual(['general-005', 'general-001', 'general-003']);
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 2 })).toEqual([]);
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 1 })).toEqual([]);
  });

  test('questions first met in a mock exam today do not spend the practice allowance', () => {
    const today = '2026-10-10';
    const examAnswer = (q: string) => ({
      q, chosen: 'a' as const, correct: false, ts: now.getTime() - 1000, mode: 'exam' as const, bank: 'v',
    });
    const state: LidState = {
      ...EMPTY_LID_STATE,
      cards: { 'general-099': card(now.getTime() + DAY, today), 'general-098': card(now.getTime() + DAY, today) },
      answers: [examAnswer('general-099'), examAnswer('general-098')],
    };
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 2 })).toEqual(['general-005', 'general-001']);
  });

  test('a card introduced on another day does not spend today', () => {
    const state: LidState = { ...EMPTY_LID_STATE, cards: { 'general-099': card(now.getTime() + DAY, '2026-10-09') } };
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 2 })).toEqual(['general-005', 'general-001']);
  });

  test('limit trims the tail, so new questions are dropped before due ones', () => {
    const state: LidState = { ...EMPTY_LID_STATE, cards: { 'general-002': card(now.getTime() - DAY) } };
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 10, limit: 2 }))
      .toEqual(['general-002', 'general-005']);
    expect(planLidPractice({ questionIds: ids, state, now, newPerDay: 10, limit: 0 })).toEqual([]);
  });
});

describe('planLidScopedPractice — a lesson drill deals every question', () => {
  const now = new Date('2026-10-10T12:00:00');
  const t = now.getTime();
  const ids = Array.from({ length: 8 }, (_, i) => `general-${pad(i + 1, 3)}`);

  function card(due: number, introducedAt?: string): StoredCard {
    return {
      due: new Date(due).toISOString(), stability: 1, difficulty: 5, elapsed_days: 0,
      scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2,
      last_review: new Date(due - DAY).toISOString(), ...(introducedAt ? { introducedAt } : {}),
    };
  }

  test('wrong last first (most recent first), then never answered in teaching order, then the rest by due date', () => {
    const answered = replay(
      EMPTY_LID_STATE,
      answer('general-002', false, t - 3 * DAY), // wrong, the older miss
      answer('general-004', false, t - 2 * DAY),
      answer('general-006', false, t - DAY), // wrong, the newest miss
      answer('general-004', true, t - DAY + 1), // corrected since: no longer a mistake
      answer('BY-01', false, t), // a miss outside the lesson stays outside it
    );
    const state: LidState = {
      ...answered,
      cards: {
        ...answered.cards,
        'general-004': card(t + 5 * DAY),
        'general-007': card(t - 2 * DAY), // overdue
        'general-008': card(t + DAY), // not due yet — a drill deals it all the same
      },
    };
    expect(planLidScopedPractice({ questionIds: ids, state, now })).toEqual([
      'general-006', 'general-002',
      'general-001', 'general-003', 'general-005',
      'general-007', 'general-008', 'general-004',
    ]);
  });

  test('no daily allowance: every never-answered question is dealt, however many today has introduced', () => {
    const lesson = Array.from({ length: 40 }, (_, i) => `general-${pad(i + 101, 3)}`);
    const today = '2026-10-10';
    const cards = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`general-${pad(i + 201, 3)}`, card(t + DAY, today)]),
    );
    const state: LidState = { ...EMPTY_LID_STATE, cards };
    expect(planLidPractice({ questionIds: lesson, state, now, newPerDay: 15 })).toEqual([]);
    expect(planLidScopedPractice({ questionIds: lesson, state, now })).toEqual(lesson);
  });

  test('a repeated id is dealt once, and due-date ties keep the given order', () => {
    const state: LidState = {
      ...EMPTY_LID_STATE,
      cards: { 'general-003': card(t), 'general-001': card(t), 'general-002': card(t - DAY) },
    };
    expect(planLidScopedPractice({ questionIds: ['general-003', 'general-001', 'general-003', 'general-002'], state, now }))
      .toEqual(['general-002', 'general-003', 'general-001']);
  });

  test('an empty scope is an empty queue', () => {
    expect(planLidScopedPractice({ questionIds: [], state: EMPTY_LID_STATE, now })).toEqual([]);
  });
});

describe('lidMistakes', () => {
  const t = Date.parse('2026-10-01T10:00:00Z');
  const state = replay(
    EMPTY_LID_STATE,
    answer('general-001', false, t),
    answer('general-002', false, t + 1),
    answer('general-001', true, t + 2), // corrected since
    answer('general-003', true, t + 3),
    answer('general-003', false, t + 4),
    answer('BY-01', false, t + 5),
  );

  test('lists questions whose most recent answer was wrong, most recent first', () => {
    expect(lidMistakes(state)).toEqual(['BY-01', 'general-003', 'general-002']);
  });

  test('restricts to the given questions', () => {
    expect(lidMistakes(state, ['general-002', 'general-001'])).toEqual(['general-002']);
  });
});

describe('shouldShuffleOptions', () => {
  test('false when the options name numbered pictures', () => {
    expect(shouldShuffleOptions(question('general-021', { a: 'Bild 1', b: 'Bild 2', c: 'Bild 3', d: 'Bild 4' }))).toBe(false);
  });

  test('true for text options, including ones that merely mention a picture', () => {
    expect(shouldShuffleOptions(question('general-001'))).toBe(true);
    expect(shouldShuffleOptions(question('general-002', { a: 'Bild 12' }))).toBe(true);
    expect(shouldShuffleOptions(question('general-003', { a: 'Das Bild 1 zeigt' }))).toBe(true);
  });
});

describe('lidReadiness — facts, no probability', () => {
  const t = Date.parse('2026-10-01T10:00:00Z');
  const ids = ['general-001', 'general-002', 'general-003', 'general-004'];

  test('counts seen, last-two-correct, due, mistakes and the last ten mocks', () => {
    let state = replay(
      EMPTY_LID_STATE,
      answer('general-001', true, t),
      answer('general-001', true, t + DAY), // two correct
      answer('general-002', false, t),
      answer('general-002', true, t + DAY), // last two: wrong, right
      answer('general-003', true, t), // only one answer
      answer('general-099', true, t), // outside the scope
      answer('general-099', true, t + DAY),
    );
    for (let i = 0; i < 12; i++) state = applyLidExam(state, mockRun(`run-${i}`, t + i * DAY, 10 + i));

    const readiness = lidReadiness(state, ids, new Date(t + 30 * DAY));
    expect(readiness).toMatchObject({ total: 4, seen: 3, lastTwoCorrect: 1, due: 3, mistakes: 0 });
    expect(readiness.exams).toHaveLength(10);
    expect(readiness.exams[0]).toEqual({ submittedAt: t + 2 * DAY, correct: 12 });
    expect(readiness.exams.at(-1)).toEqual({ submittedAt: t + 11 * DAY, correct: 21 });
    expect(readiness).not.toHaveProperty('probability');
  });

  test('due is read against now', () => {
    const state = replay(EMPTY_LID_STATE, answer('general-001', false, t));
    expect(lidReadiness(state, ids, new Date(t)).due).toBe(0);
    expect(lidReadiness(state, ids, new Date(t + DAY)).due).toBe(1);
    expect(lidReadiness(state, ids, new Date(t + DAY)).mistakes).toBe(1);
  });
});
