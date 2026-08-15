/**
 * Structure coverage — the `struktur` dimension of `anchors.ts`.
 *
 * "Does `data/grammar-inventory.yaml` even contain every structure the published standard lists?"
 * The mechanism is generic and lives in `anchors.ts`, because the same question has to be asked of
 * the communicative outcomes too. What is specific to this dimension is only the claimant: a row of
 * the grammar inventory, cited as
 *
 *     claims: [goethe-a1-sd1:pron-personal-dativ-verben, goethe-dtz:verb-dativ]
 *
 * and read at its **production** level, so a structure the source puts at A1 and this course
 * produces at A2 shows as a sequencing decision rather than as coverage.
 *
 * The names below are kept as this module's own so that `payload.ts`, `scripts/structures.ts`, the
 * editorial app and the tests do not have to learn a second vocabulary for one refactor.
 */
import {
  anchorCoverage,
  entryRef,
  loadAnchorSources,
  ANCHOR_DIRS,
  type AnchorCoverage,
  type AnchorEntry,
  type AnchorEntryResult,
  type AnchorSection,
  type AnchorSource,
  type AnchorSourceMeta,
  type SourceMode,
} from './anchors';
import { repoRoot } from './repo-root';
import { loadGrammarInventory, productionLevel, type GrammarPoint } from './grammar-coverage';
import { LEVELS, type Level } from '@da/schema';

export type { SourceMode };
export type StructureSourceMeta = AnchorSourceMeta;
export type StructureEntry = AnchorEntry;
export type StructureSection = AnchorSection;
export type StructureSource = AnchorSource;
export type EntryResult = AnchorEntryResult;

export interface StructureCoverage extends Omit<AnchorCoverage, 'beyond'> {
  /** inventory rows at this level citing no entry of any source covering it */
  beyond: GrammarPoint[];
}

export const STRUCTURES_DIR = ANCHOR_DIRS.struktur;
export { entryRef };

export function loadStructureSources(root = repoRoot()): StructureSource[] {
  return loadAnchorSources('struktur', root);
}

export function structureCoverage(level: Level, root = repoRoot()): StructureCoverage {
  const points = loadGrammarInventory(root);
  const coverage = anchorCoverage(
    'struktur',
    level,
    points
      .filter((point) => LEVELS.includes(productionLevel(point) as Level))
      .map((point) => ({ id: point.id, level: productionLevel(point) as Level, claims: point.claims, label: point.de })),
    root,
  );
  const byId = new Map(points.map((p) => [p.id, p]));
  return {
    ...coverage,
    // Hand back the rows themselves: every consumer wants the point's `de`, `focus` and `strand`,
    // and re-looking them up at each call site is how two reports come to disagree.
    beyond: coverage.beyond.map((c) => byId.get(c.id)).filter((p): p is GrammarPoint => !!p),
  };
}
