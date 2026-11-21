import { describe, expect, test } from 'bun:test';
import { openingSet, setsOpenedPast, workedSets } from '../src/lib/exercise-path';

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

describe('setsOpenedPast', () => {
  test('names the worked sets the path skipped to reach the set it opened on', () => {
    // the learner finished the Grundübung; an extension set added later is where the path opens
    const worked = new Set(['a2/x']);
    const open = openingSet(sets, worked);
    expect(open).toBe('a2/x-transfer');
    expect(setsOpenedPast(sets, worked, open).map((set) => set.id)).toEqual(['a2/x']);

    const both = new Set(['a2/x', 'a2/x-transfer']);
    expect(setsOpenedPast(sets, both, openingSet(sets, both)).map((set) => set.id)).toEqual([
      'a2/x',
      'a2/x-transfer',
    ]);
  });

  test('says nothing when the path opens on its first set', () => {
    expect(setsOpenedPast(sets, new Set(), openingSet(sets, new Set()))).toEqual([]);
    // all worked through: the path opens on the first set again
    const all = new Set(sets.map((set) => set.id));
    expect(setsOpenedPast(sets, all, openingSet(sets, all))).toEqual([]);
  });

  test('says nothing for a set the path did not skip to, or one it does not know', () => {
    // a2/x is not worked, so a2/x-lesen was chosen, not opened on
    expect(setsOpenedPast(sets, new Set(['a2/x-transfer']), 'a2/x-lesen')).toEqual([]);
    expect(setsOpenedPast(sets, new Set(['a2/x']), 'a2/elsewhere')).toEqual([]);
    expect(setsOpenedPast(sets, new Set(['a2/x']), undefined)).toEqual([]);
  });
});
