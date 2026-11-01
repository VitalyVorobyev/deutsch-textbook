/** The Prüfen inbox's line diff: shortest edit scripts, and the cap for a rewritten file. */
import { describe, expect, test } from 'bun:test';
import { diffLines } from '../apps/redaktion/src/diff';

const apply = (ops: NonNullable<ReturnType<typeof diffLines>>) => ({
  before: ops.filter((op) => op.type !== 'add').map((op) => op.text),
  after: ops.filter((op) => op.type !== 'del').map((op) => op.text),
});

describe('diffLines', () => {
  test('reproduces both sides and changes only what changed', () => {
    const a = ['topic: dativ', 'role: practice', 'items:', '  - id: eins', '  - id: zwei'];
    const b = [
      'topic: dativ',
      'role: practice',
      'items:',
      '  - id: eins',
      '  - id: drei',
      '  - id: zwei',
    ];
    const ops = diffLines(a, b)!;
    expect(apply(ops)).toEqual({ before: a, after: b });
    expect(ops.filter((op) => op.type !== 'same')).toEqual([{ type: 'add', text: '  - id: drei' }]);
  });

  test('a replaced line is one deletion and one addition', () => {
    const ops = diffLines(['a', 'b', 'c'], ['a', 'x', 'c'])!;
    expect(
      ops
        .filter((op) => op.type !== 'same')
        .map((op) => op.type)
        .sort(),
    ).toEqual(['add', 'del']);
    expect(apply(ops)).toEqual({ before: ['a', 'b', 'c'], after: ['a', 'x', 'c'] });
  });

  test('empty sides and identical sides', () => {
    expect(diffLines([], ['a'])).toEqual([{ type: 'add', text: 'a' }]);
    expect(diffLines(['a'], [])).toEqual([{ type: 'del', text: 'a' }]);
    expect(diffLines(['a', 'b'], ['a', 'b'])!.every((op) => op.type === 'same')).toBe(true);
  });

  test('a wholesale rewrite past the cap says so instead of diffing', () => {
    const a = Array.from({ length: 1500 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 1500 }, (_, i) => `b${i}`);
    expect(diffLines(a, b)).toBeUndefined();
  });
});
