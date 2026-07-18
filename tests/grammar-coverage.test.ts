import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grammarCoverage, loadGrammarInventory } from '../src/lib/grammar-coverage';

/** A throwaway content tree, so the escape-hatch rules can be tested on shapes
 *  the real inventory must never contain. */
function fixture(points: unknown[], topics: Record<string, string[]> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'grammar-coverage-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'data', 'grammar-inventory.yaml'), JSON.stringify({ points }));
  mkdirSync(join(root, 'content', 'exercises'), { recursive: true });
  for (const [level, ids] of Object.entries(topics)) {
    mkdirSync(join(root, 'content', 'topics', level), { recursive: true });
    for (const id of ids) writeFileSync(join(root, 'content', 'topics', level, `${id}.mdx`), '');
  }
  return root;
}

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

  // Phase 10 closed the last A2 gap, so this stopped being a countdown and became a
  // ratchet: A2 is complete against the standard, and it must stay that way. The
  // number was lowered ten times, once per point, each in the commit that shipped the
  // unit closing it — that visibility was the whole purpose, and it still is. If this
  // fails, either a structure was silently dropped or a point was added to the
  // inventory without the content to pay for it, and both want noticing.
  test('A2 teaches every structure its standard expects', () => {
    const coverage = grammarCoverage('A2');
    const missing = coverage.points.filter((p) => p.status === 'missing').map((p) => p.point.id);
    expect(missing).toEqual([]);
    expect(coverage.percent).toBe(100);
    // Nothing is merely late either: a point taught above its standard level would
    // still count toward the percentage, so it has to be asserted separately.
    expect(coverage.late).toBe(0);
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

  // `preview: true` marks an item that intentionally uses a focus introduced
  // later in the spine — an exposure, not a lesson. Counting one as evidence
  // let a single A1 preview item report `anrede-du-sie` as covered-on-time
  // while every real drill of `du-sie` sits at A2, hiding the sequencing fact
  // that `late` exists to surface.
  test('a preview item is exposure, not teaching evidence', () => {
    const duSie = grammarCoverage('A1').points.find((p) => p.point.id === 'anrede-du-sie')!;
    expect(duSie.status).toBe('late');
    expect(duSie.taughtAt).toBe('A2');
  });

  describe('reference_only points are paid for', () => {
    const ref = (taught_in?: string[]) => [
      { id: 'p', standard_level: 'A2', de: 'x', en: 'x', reference_only: true, taught_in },
    ];

    test('an empty or absent taught_in is missing, not vacuously covered', () => {
      // [].every(...) is true, so the escape hatch used to cover a point with
      // no evidence at all — a self-certifying claim.
      for (const taught of [undefined, []]) {
        const root = fixture(ref(taught));
        try {
          expect(grammarCoverage('A2', root).points[0].status).toBe('missing');
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      }
    });

    test('a topic that does not exist cannot cover a point', () => {
      const root = fixture(ref(['nirgendwo']));
      try {
        expect(grammarCoverage('A2', root).points[0].status).toBe('missing');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    test('it is late when the topic teaching it sits above the standard level', () => {
      const root = fixture(ref(['spaeter']), { b1: ['spaeter'] });
      try {
        const result = grammarCoverage('A2', root).points[0];
        expect(result.status).toBe('late');
        expect(result.taughtAt).toBe('B1');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    test('it is covered when a topic at or below the standard level teaches it', () => {
      const root = fixture(ref(['frueher']), { a1: ['frueher'] });
      try {
        expect(grammarCoverage('A2', root).points[0].status).toBe('covered');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
