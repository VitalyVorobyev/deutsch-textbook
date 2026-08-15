import { describe, expect, test } from 'bun:test';
import { levelDepth, pointDepths, tagDepths, PRODUCTION_TYPES, SELECTION_TYPES } from '@da/content/grammar-depth';
import { invalidateContentGraph } from '@da/content/graph';
import { focusIntroducedBy } from '@da/content/focus-tags';

/**
 * The depth ratchet.
 *
 * `tests/grammar-coverage.test.ts` guards BREADTH — that every structure the inventory lists is
 * taught by something. It cannot see how much. On 2026-08-14 all three levels published 100%
 * coverage while median practice per confusion ran A1 12 · A2 8 · B1 4 and production items
 * 6 · 6 · 3: a fourfold drop that no published figure could express.
 *
 * What is pinned here is **measured reality on the day it was measured**, not a bar anybody
 * validated. There is no evidence for a correct number of items per confusion, and inventing one
 * would put a fabricated threshold into a repo built on earned figures — so the report itself
 * (`bun scripts/grammar-depth.ts`) prints no threshold at all and reads every row against its
 * level median, the way `comprehensibility.ts` does. These assertions only stop the numbers moving
 * the wrong way. A failure means one of two things, and both want noticing:
 *
 *   - practice was removed from a confusion that had it, or
 *   - a focus tag was added without the practice to pay for it.
 *
 * Raising a floor is a commit that shipped items. Lowering one is a decision, and it needs a
 * sentence here saying which structure lost practice and why.
 */
describe('grammar depth', () => {
  // Re-derive: bun scripts/grammar-depth.ts
  const FLOORS = {
    A1: { teaching: 13, production: 9, files: 4 },
    A2: { teaching: 8, production: 6, files: 3 },
    B1: { teaching: 4, production: 3, files: 2 },
  } as const;

  for (const [level, floor] of Object.entries(FLOORS) as [keyof typeof FLOORS, typeof FLOORS.A1][]) {
    test(`${level} median practice per confusion does not fall`, () => {
      const d = levelDepth(level);
      expect([
        d.medianTeaching >= floor.teaching,
        d.medianProduction >= floor.production,
        d.medianFiles >= floor.files,
      ]).toEqual([true, true, true]);
    });
  }

  /**
   * The tail, counted rather than averaged, because a median hides it: B1 carries nine of the
   * fifteen tags at three items or fewer, and ten of the eighteen that live in a single practice
   * file — a confusion drilled in one sitting and never interleaved again (§2 spacing, §3
   * interleaving). These are ceilings; closing one is a commit that added items.
   */
  test('the thin tail does not grow', () => {
    const totals = (['A1', 'A2', 'B1'] as const).reduce(
      (acc, level) => {
        const d = levelDepth(level);
        return {
          thin: acc.thin + d.thinTags,
          singleFile: acc.singleFile + d.singleFileTags,
          noProbe: acc.noProbe + d.pointsWithoutProbe,
        };
      },
      { thin: 0, singleFile: 0, noProbe: 0 },
    );
    // The A2 wave closed the three zero-item structures and all eight structure-level probe gaps.
    // Keep the corpus-wide ceilings honest: thin tags in later levels still remain editorial work,
    // but A2 may not silently recreate the debt this wave removed.
    expect([
      totals.thin <= 15,
      totals.singleFile <= 16,
      totals.noProbe <= 0,
    ]).toEqual([true, true, true]);
  });

  test('every allowlisted tag appears, including ones nothing drills yet', () => {
    // A registered tag with no items must report 0, not vanish: an absent row and a zero row look
    // identical in a table and mean opposite things.
    const tags = tagDepths();
    for (const tag of Object.keys(focusIntroducedBy)) expect(tags.has(tag)).toBe(true);
  });

  test('production and selection types are disjoint, and order counts as selection', () => {
    // `order` hands the learner every token and asks only for the sequence — scaffolding for a
    // word-order rule, not a test of one, which is why the item-mix bar caps it too.
    expect(SELECTION_TYPES.has('order')).toBe(true);
    for (const t of PRODUCTION_TYPES) expect(SELECTION_TYPES.has(t)).toBe(false);
    // `audio-comprehension` is on neither side, exactly as in the mix bar: it cannot ask for
    // production at all, so counting it either way would misstate the ratio.
    expect(PRODUCTION_TYPES.has('audio-comprehension')).toBe(false);
    expect(SELECTION_TYPES.has('audio-comprehension')).toBe(false);
  });

  /**
   * The memo, and the reason it is allowed to exist.
   *
   * `tagDepths` is this module's only corpus pass — `pointDepths` calls it and `levelDepth` calls
   * both, so one `levelDepth()` re-parsed all 336 exercise files twice. The test below made eight
   * such walks and timed out on CI at 5244 ms against a 5000 ms budget; the file as a whole went
   * from 4.90 s to 520 ms once the pass was memoised.
   *
   * What that buys has to be paid for: a cached figure that outlives the file it was read from is
   * exactly the silent-wrong-number class this repo keeps writing rules about, and the editorial
   * dev server rebuilds on every save. So both halves of the contract are asserted — the memo
   * holds, and `invalidateContentGraph` (the ONE entry point, which the watcher already calls)
   * really drops it. Remove either line from `graph.ts` and one of these goes red.
   */
  test('the corpus pass is memoised, and the one invalidator really drops it', () => {
    const first = tagDepths();
    expect(tagDepths()).toBe(first);
    invalidateContentGraph();
    const afterwards = tagDepths();
    expect(afterwards).not.toBe(first);
    // Same corpus, so the same answer — the memo is a speed-up, never a different measurement.
    expect(afterwards.size).toBe(first.size);
    expect(afterwards.get('akkusativ-artikel')?.teaching).toBe(first.get('akkusativ-artikel')?.teaching);
  });

  test('a point with no teaching items is not counted as missing its delayed check', () => {
    // Opening a denominator gap must not look like a retention regression. The three open A2 rows
    // have no items and no probes, and are excluded by construction.
    const untaught = pointDepths().filter((p) => p.teaching === 0);
    expect(untaught.length).toBeGreaterThan(0);
    const counted = (['A1', 'A2', 'B1'] as const).reduce((n, l) => n + levelDepth(l).pointsWithoutProbe, 0);
    const allWithoutProbe = pointDepths().filter((p) => p.probe === 0).length;
    expect(counted).toBeLessThan(allWithoutProbe);
  });
});
