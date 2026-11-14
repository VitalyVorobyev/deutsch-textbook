import { describe, expect, test } from 'bun:test';
import { openingSet, workedSets } from '../src/lib/exercise-path';

const sets = [
  { id: 'a2/x', itemIds: ['a', 'b'] },
  { id: 'a2/x-transfer', itemIds: ['c'] },
  { id: 'a2/x-lesen', itemIds: ['d', 'e'] },
];
const attempt = (setId: string, itemId: string) => ({ setId, itemId });

describe('workedSets', () => {
  test('a set is worked through once every one of its items has an attempt', () => {
    const worked = workedSets(sets, [
      attempt('a2/x', 'a'),
      attempt('a2/x', 'b'),
      attempt('a2/x-lesen', 'd'),
    ]);
    expect([...worked]).toEqual(['a2/x']);
  });

  test('an attempt counts only in its own set, and a wrong answer counts as worked', () => {
    // item `c` answered inside another set says nothing about a2/x-transfer
    expect(workedSets(sets, [attempt('a2/x', 'c')]).size).toBe(0);
    expect(
      workedSets(sets, [{ ...attempt('a2/x-transfer', 'c'), correct: false }]).has('a2/x-transfer'),
    ).toBe(true);
  });

  test('a set with no items is never worked through', () => {
    expect(workedSets([{ id: 'empty', itemIds: [] }], []).size).toBe(0);
  });
});

describe('openingSet', () => {
  test('opens on the first set that is not worked through', () => {
    expect(openingSet(sets, new Set())).toBe('a2/x');
    expect(openingSet(sets, new Set(['a2/x']))).toBe('a2/x-transfer');
    expect(openingSet(sets, new Set(['a2/x', 'a2/x-lesen']))).toBe('a2/x-transfer');
  });

  test('opens on the first set when all are worked through, and on nothing without sets', () => {
    expect(openingSet(sets, new Set(sets.map((set) => set.id)))).toBe('a2/x');
    expect(openingSet([], new Set())).toBeUndefined();
  });
});
