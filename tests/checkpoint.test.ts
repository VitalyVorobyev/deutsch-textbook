import { describe, expect, test } from 'bun:test';
import { checkpointOutcomeResults, type CheckpointItemRef } from '../src/lib/checkpoint';
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
