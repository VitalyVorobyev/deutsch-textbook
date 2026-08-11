/**
 * P25-9: `b1/erfahrungen-erzaehlen:uebersetzen-waehrend-regen` was dealt and failed nine
 * sessions running (band 1 re-dealing a failed item on the same footing every time) while
 * the eight never-seen items of `b1/drill-temporal-nebensatz`, sharing its focus tag, sat
 * untouched in band 3. These tests pin the fix directly on `buildSession`: a "fossilizing"
 * item (its last two attempts both wrong) with a never-seen same-focus sibling in the pool
 * is demoted — the siblings take its band-1 slot, and it drops to the end of the priority
 * list, after band 3 and before broad retrieval.
 *
 * Every pool here lives under one topic id, so `interleaveByTopic`'s single-group path
 * (there is nothing else to interleave against) preserves the priority-band order exactly —
 * these tests can pin positions in the returned queue directly, without a same-topic
 * conflict ever entering the picture.
 */
import { describe, expect, test } from 'bun:test';
import { buildSession, type TrainingSet } from '../src/lib/training';
import type { Attempt } from '../src/lib/store';
import type { ExerciseItem } from '../src/lib/schemas';

const NOW = 1_780_000_000_000;
const HOUR = 3_600_000;

const item = (id: string, focus?: string): ExerciseItem =>
  ({ id, type: 'mc', outcomes: [], preview: false, prompt: '?', options: ['a', 'b'], correct: 0, focus }) as ExerciseItem;

const set = (ids: [string, string | undefined][]): TrainingSet => ({
  setId: 's1',
  topicId: 't1',
  title_de: 't1',
  level: 'A1',
  role: 'practice',
  items: ids.map(([id, focus]) => item(id, focus)),
});

const attempt = (itemId: string, correct: boolean, ts: number, focus?: string): Attempt =>
  ({ setId: 's1', itemId, itemType: 'mc', correct, given: '', ts, focus }) as Attempt;

describe('P25-9: fossilizing band-1 items yield to their never-seen same-focus siblings', () => {
  test('a fossilizing item with untried same-focus siblings: siblings dealt first, it drops last', () => {
    const sets = [set([['A', 'foo'], ['B1', 'foo'], ['B2', 'foo'], ['C', 'bar']])];
    // Three consecutive wrongs on A — fossilizing, and only 3 attempts on 'foo' so the
    // tag itself never crosses the weak-focus threshold (minAttempts 4) and cannot pull
    // B1/B2 into the weak-focus band instead of untried.
    const attempts = [
      attempt('A', false, NOW - 3 * HOUR, 'foo'),
      attempt('A', false, NOW - 2 * HOUR, 'foo'),
      attempt('A', false, NOW - 1 * HOUR, 'foo'),
    ];
    const queue = buildSession(sets, 4, attempts);

    expect(queue).toHaveLength(4);
    expect(new Set(queue.slice(0, 2).map((q) => q.item.id))).toEqual(new Set(['B1', 'B2']));
    expect(queue[2]!.item.id).toBe('C');
    expect(queue[3]!.item.id).toBe('A');
  });

  test('a single recent wrong (not two consecutive) keeps band-1 behavior exactly', () => {
    const sets = [set([['A', 'foo'], ['B', 'foo']])];
    const attempts = [attempt('A', false, NOW - HOUR, 'foo')];
    const queue = buildSession(sets, 2, attempts);

    expect(queue).toHaveLength(2);
    expect(queue[0]!.item.id).toBe('A'); // still leads — not demoted
    expect(queue[1]!.item.id).toBe('B');
  });

  test('a fossilizing item with NO untried same-focus sibling stays in band 1', () => {
    const sets = [set([['A', 'foo'], ['C', 'bar']])];
    // Exactly two consecutive wrongs — the ">= 2" boundary.
    const attempts = [
      attempt('A', false, NOW - 2 * HOUR, 'foo'),
      attempt('A', false, NOW - 1 * HOUR, 'foo'),
    ];
    const queue = buildSession(sets, 2, attempts);

    expect(queue).toHaveLength(2);
    expect(queue[0]!.item.id).toBe('A'); // no 'foo' sibling to promote — retry is all there is
    expect(queue[1]!.item.id).toBe('C');
  });
});
