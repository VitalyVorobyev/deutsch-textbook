/**
 * The in-session retry after "Again" (`src/lib/requeue.ts`): the next retrieval is delayed by
 * how nearly the word was known, and every further miss shortens the delay. The counts are
 * heuristics; what these tests hold is the shape — unfamiliar < partial, halving, a floor, and
 * a classification that the first miss fixes for the rest of the session.
 */
import { describe, expect, test } from 'bun:test';
import { State } from 'ts-fsrs';
import {
  AGAIN_GAP_MIN,
  AGAIN_GAP_PARTIAL,
  AGAIN_GAP_UNFAMILIAR,
  recordMiss,
  requeueAfter,
  type MissRecord,
} from '../src/lib/requeue';
import type { StoredCard } from '../src/lib/store';
import type { AnswerVerdict } from '../src/lib/typing';

const stored = (state: State): StoredCard =>
  ({ state, due: '2026-10-10T00:00:00.000Z', stability: 3, difficulty: 5, reps: 4, lapses: 0 }) as unknown as StoredCard;
const wrong: AnswerVerdict = { kind: 'wrong' };

function gaps(prior: StoredCard | undefined, verdict: AnswerVerdict | null, n: number): number[] {
  let rec: MissRecord | undefined;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = recordMiss(rec, prior, verdict);
    out.push(next.gap);
    rec = next;
  }
  return out;
}

describe('recordMiss', () => {
  test('a word not retrieved at all comes back after the short gap, halving to the floor', () => {
    expect(gaps(undefined, wrong, 4)).toEqual([AGAIN_GAP_UNFAMILIAR, 4, AGAIN_GAP_MIN, AGAIN_GAP_MIN]);
    expect(gaps(stored(State.Learning), null, 1)).toEqual([AGAIN_GAP_UNFAMILIAR]);
  });

  test('a lapse of a learned word, or a near miss, gets the long gap', () => {
    expect(gaps(stored(State.Review), null, 5)).toEqual([AGAIN_GAP_PARTIAL, 25, 13, 6, AGAIN_GAP_MIN]);
    expect(gaps(stored(State.Relearning), wrong, 1)).toEqual([AGAIN_GAP_PARTIAL]);
    expect(gaps(undefined, { kind: 'umlaut' }, 1)).toEqual([AGAIN_GAP_PARTIAL]);
    expect(gaps(undefined, { kind: 'article', article: 'die', noun: 'Frau', givenArticle: 'der' }, 1)).toEqual([
      AGAIN_GAP_PARTIAL,
    ]);
  });

  test('the first miss fixes the class: the Relearning state it causes does not upgrade the second', () => {
    const first = recordMiss(undefined, undefined, wrong);
    const second = recordMiss(first, stored(State.Relearning), wrong);
    expect(second).toEqual({ base: AGAIN_GAP_UNFAMILIAR, misses: 2, gap: 4 });
  });
});

describe('requeueAfter', () => {
  test('inserts the card after `gap` others', () => {
    expect(requeueAfter(['a', 'b', 'c', 'd', 'e'], 'x', 3)).toEqual(['a', 'b', 'c', 'x', 'd', 'e']);
  });

  test('puts it last when fewer cards remain than the gap, and alone when none do', () => {
    expect(requeueAfter(['a', 'b'], 'x', AGAIN_GAP_PARTIAL)).toEqual(['a', 'b', 'x']);
    expect(requeueAfter([], 'x', AGAIN_GAP_UNFAMILIAR)).toEqual(['x']);
  });
});
