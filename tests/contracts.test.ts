import { describe, expect, test } from 'bun:test';
import { getCurriculum } from '../src/lib/curriculum';
import { attemptScore, verifiedOnly } from '../src/lib/scoring';
import { isValidSnapshot, sanitizeAttempts, type Attempt } from '../src/lib/store';

describe('scoring and curriculum contracts', () => {
  test('partial credit is clamped and practice is excluded', () => {
    expect(attemptScore({ correct: false, correctParts: 5, totalParts: 6 })).toBeCloseTo(5 / 6);
    expect(attemptScore({ correct: false, correctParts: 9, totalParts: 6 })).toBe(1);
    expect(attemptScore({ correct: true, evidence: 'practice' })).toBe(0);
    expect(verifiedOnly([{ correct: true }, { correct: true, evidence: 'practice' }])).toHaveLength(1);
  });

  test('the real spine respects prerequisites and deepening order', () => {
    const curriculum = getCurriculum();
    const position = new Map(curriculum.spine.map((id, index) => [id, index]));
    const outcomes = new Set<string>();
    for (const node of curriculum.nodes) {
      for (const prerequisite of node.prerequisites)
        expect(position.get(prerequisite)!).toBeLessThan(position.get(node.id)!);
      for (const base of node.deepens)
        expect(position.get(base)!).toBeLessThan(position.get(node.id)!);
      for (const outcome of node.outcomes) {
        expect(outcomes.has(outcome.id)).toBe(false);
        outcomes.add(outcome.id);
      }
    }
  });

  test('v1-v4 snapshots remain accepted and malformed partial scores are sanitized', () => {
    for (const version of [1, 2, 3, 4])
      expect(isValidSnapshot({ version, exportedAt: '', attempts: [], cards: {} })).toBe(true);
    const bad: Attempt = {
      setId: 'x', itemId: 'y', itemType: 'table', correct: false,
      correctParts: 2, totalParts: 0, given: '', ts: 1,
    };
    expect(sanitizeAttempts([bad])[0]?.totalParts).toBeUndefined();
  });
});
