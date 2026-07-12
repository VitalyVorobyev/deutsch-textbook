import { describe, expect, test } from 'bun:test';
import { checkpointOutcomeResults, type CheckpointItemRef } from '../src/lib/checkpoint';
import { levelPathDone, levelRemaining, type TopicContext, type TopicNode } from '../src/lib/mastery';
import type { Attempt } from '../src/lib/store';

const SET = 'a1/checkpoint-a1';

const items: CheckpointItemRef[] = [
  { id: 'hoeren-1', type: 'listen', outcomes: ['zeit-uhrzeit-verstehen'] },
  { id: 'lesen-1', type: 'mc', outcomes: ['wohnen-anzeige-verstehen', 'stadt-schilder-verstehen'] },
  { id: 'cloze-1', type: 'cloze', outcomes: ['akkusativ-artikel'] },
  { id: 'schreiben-1', type: 'write', outcomes: ['wohnen-beschreiben'] },
];

const modes = {
  'zeit-uhrzeit-verstehen': 'listening',
  'wohnen-anzeige-verstehen': 'reading',
  'stadt-schilder-verstehen': 'reading',
  'akkusativ-artikel': 'writing',
  'wohnen-beschreiben': 'writing',
};

const attempt = (itemId: string, ts: number, over: Partial<Attempt> = {}): Attempt => ({
  setId: SET, itemId, itemType: 'mc', correct: true, given: 'x', ts, ...over,
});

describe('checkpointOutcomeResults', () => {
  test('null while the checkpoint has never been attempted', () => {
    expect(checkpointOutcomeResults(items, [attempt('x', 1, { setId: 'a1/other' })], SET)).toBeNull();
  });

  test('the latest attempt per item wins in both directions', () => {
    const redeemed = checkpointOutcomeResults(
      items,
      [attempt('hoeren-1', 1, { correct: false }), attempt('hoeren-1', 2)],
      SET,
    )!;
    expect(redeemed.score).toBe(1);
    const regressed = checkpointOutcomeResults(
      items,
      [attempt('hoeren-1', 1), attempt('hoeren-1', 2, { correct: false })],
      SET,
    )!;
    expect(regressed.score).toBe(0);
    expect(regressed.answered).toBe(1);
    expect(regressed.lastTs).toBe(2);
  });

  test('write items count as activity but never as score or total', () => {
    const summary = checkpointOutcomeResults(
      items,
      [attempt('schreiben-1', 5, { itemType: 'write', evidence: 'practice' })],
      SET,
    )!;
    expect(summary.total).toBe(3);
    expect(summary.answered).toBe(0);
    expect(summary.score).toBe(0);
    expect(summary.lastTs).toBe(5);
  });

  test('outcomes roll up per mode; a two-outcome item feeds both outcomes', () => {
    const summary = checkpointOutcomeResults(
      items,
      [attempt('lesen-1', 1), attempt('cloze-1', 2, { correct: false })],
      SET,
      modes,
    )!;
    expect(summary.byMode.map((group) => group.mode)).toEqual(['listening', 'reading', 'writing']);
    const reading = summary.byMode.find((group) => group.mode === 'reading')!;
    expect(reading.outcomes.map((o) => [o.outcome, o.score, o.answered, o.items])).toEqual([
      ['wohnen-anzeige-verstehen', 1, 1, 1],
      ['stadt-schilder-verstehen', 1, 1, 1],
    ]);
    const writing = summary.byMode.find((group) => group.mode === 'writing')!;
    // wohnen-beschreiben is referenced only by the write item, so it never
    // becomes a scored row — write stays unverified practice evidence.
    expect(writing.outcomes).toEqual([
      { outcome: 'akkusativ-artikel', score: 0, answered: 1, items: 1 },
    ]);
  });

  test('partial credit flows through parts-weighted scoring', () => {
    const summary = checkpointOutcomeResults(
      items,
      [attempt('cloze-1', 1, { correct: false, correctParts: 2, totalParts: 4 })],
      SET,
    )!;
    expect(summary.score).toBe(0.5);
    expect(summary.answered).toBe(1);
  });
});

// The Heute card unlocks the level checkpoint with levelNodes.every(pathDone).
// Before pathDone that gate was lessonCompleted, so a learner who had mastered
// every A1 topic never saw the checkpoint once a practice set had grown.
describe('level checkpoint gate', () => {
  const topic = (id: string, itemIds: string[]): TopicNode => ({
    id, path: `/topics/a1/${id}`, level: 'A1', kind: 'grammar',
    title_de: id, title_en: id, title_ru: id, prerequisites: [],
    exerciseSets: [`a1/${id}`], vocabIds: [], readingIds: [],
    primaryPractice: { setId: `a1/${id}`, itemIds },
  });
  const mastery = (setId: string): Attempt[] => {
    const day1 = new Date(2026, 0, 1, 10).getTime();
    const day2 = new Date(2026, 0, 2, 10).getTime();
    return [0, 1, 2, 3]
      .map((n) => attempt(`done-${n}`, day1 + n, { setId }))
      .concat(attempt('done-4', day2, { setId }));
  };

  test('mastering every topic unlocks the checkpoint even after a set grew', () => {
    // Both topics gained an item ("fresh") the learner has never answered.
    const nodes = [
      topic('erste-schritte', ['done-0', 'done-1', 'done-2', 'done-3', 'done-4', 'fresh']),
      topic('akkusativ', ['done-0', 'done-1', 'done-2', 'done-3', 'done-4', 'fresh']),
    ];
    const ctx: TopicContext = {
      attempts: [...mastery('a1/erste-schritte'), ...mastery('a1/akkusativ')],
      cards: {},
      topics: {},
    };
    expect(levelPathDone('A1', nodes, ctx)).toBe(true);
    expect(levelRemaining('A1', nodes, ctx)).toBe(0);
  });

  test('one unfinished topic keeps the checkpoint locked', () => {
    const nodes = [
      topic('erste-schritte', ['done-0', 'done-1', 'done-2', 'done-3', 'done-4']),
      topic('akkusativ', ['a', 'b']),
    ];
    const ctx: TopicContext = { attempts: mastery('a1/erste-schritte'), cards: {}, topics: {} };
    expect(levelPathDone('A1', nodes, ctx)).toBe(false);
    expect(levelRemaining('A1', nodes, ctx)).toBe(1);
  });
});
