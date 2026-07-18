import { describe, expect, test } from 'bun:test';
import { grammarCoverage, loadGrammarInventory } from '../src/lib/grammar-coverage';

describe('grammar coverage', () => {
  test('inventory point ids are unique and every point can be marked taught', () => {
    const points = loadGrammarInventory();
    const ids = points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A point with neither focus tags nor reference_only could never be covered,
    // so it would sit in the report as a permanent gap nobody can close.
    for (const point of points)
      expect(Boolean(point.reference_only) || (point.focus?.length ?? 0) > 0).toBe(true);
  });

  test('A1 has no missing structures', () => {
    const coverage = grammarCoverage('A1');
    expect(coverage.missing).toBe(0);
    // Four Goethe-A1 points are taught at A2 here (Perfekt, Imperativ, trennbare
    // Verben, darf/muss nicht). That is a sequencing choice and the report says
    // so — but it must stay visible rather than quietly counting as on-time.
    expect(coverage.late).toBeGreaterThan(0);
  });

  // This number is a tripwire, like the A2 spine length in contracts.test.ts:
  // closing an A2 gap is supposed to be a deliberate, visible change. Lower it
  // in the same commit that ships the unit which closes the point.
  test('A2 grammar coverage is measured, and the open gaps are the known ones', () => {
    const coverage = grammarCoverage('A2');
    const missing = coverage.points.filter((p) => p.status === 'missing').map((p) => p.point.id).sort();
    expect(missing).toEqual([
      'als-wenn',
      'futur-werden',
      'genitiv-eigenname',
      'indefinitpronomen',
      'infinitiv-mit-zu',
      'konjunktionaladverb',
      'passiv-praesens',
      'reflexiv-dativ',
      'relativsatz',
      'um-zu',
    ]);
    expect(coverage.percent).toBe(67);
  });

  test('a shipped structure counts as covered, and every taught point resolves a level', () => {
    const coverage = grammarCoverage('A2');
    const adjective = coverage.points.find((p) => p.point.id === 'adjektiv-unbestimmt')!;
    expect(adjective.status).toBe('covered');
    // Regression: a point whose tags are drilled at different levels must still
    // resolve to the level where the *last* of them is taught, not to undefined.
    for (const result of coverage.points)
      if (result.status !== 'missing') expect(result.taughtAt).toBeDefined();
  });
});
