/**
 * Structure coverage: how much of a level's **published** structural standard the course's own
 * inventory even claims to contain — the denominator's denominator.
 *
 * `grammar-coverage.ts` answers "does content teach every row of `data/grammar-inventory.yaml`".
 * It cannot answer "is that list the right list", and for as long as nothing did, the answer was
 * no: on 2026-08-12 the A1 rows turned out to be missing entries the Goethe A1 exam tests, and
 * 100% had been measuring an incomplete list. The audit that found it recorded that the official
 * inventory "is not among the local materials" and stopped there. It is a free download, and this
 * module is what reads it.
 *
 * The evidence channel is a per-row citation. An inventory row claims source entries by key:
 *
 *     claims: [goethe-a1-sd1:pron-personal-dativ-verben, goethe-a2-fit2:pron-personal-dativ]
 *
 * and every source entry then falls into exactly one class:
 *
 *   - **claimed**  — some inventory row cites it. The row's own production level rides along, so a
 *                    structure the source puts at A1 and this course produces at A2 reads as a
 *                    sequencing decision rather than as coverage.
 *   - **unclaimed** — no row cites it: a hole in the course's denominator, which is the whole
 *                    output of this module.
 *   - **beyond**   — an inventory row citing nothing at a level that HAS a source. Legitimate and
 *                    common: this course aims at B1 and follows a coursebook progression, so it
 *                    teaches structures Start Deutsch never tested. The point is that the choice
 *                    is visible instead of being indistinguishable from an accident.
 *
 * A level with no source file at all reports `anchored: false` and no `beyond` list, because
 * calling all 32 B1 rows unanchored would read as 32 defects when it is one missing book
 * (`data/strukturenlisten/README.md` names it). An instrument that manufactures findings out of
 * its own blind spot is worse than one that says it cannot see.
 *
 * Nothing here is imported by runtime code; it runs at authoring/validation time only, and is
 * shared by `scripts/structures.ts`, `scripts/redaktion.ts` and the tests — the house pattern, so
 * the console and the command cannot disagree about a figure.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import { loadGrammarInventory, productionLevel, type GrammarPoint } from './grammar-coverage';
import { LEVELS, type Level } from './schemas';

/** How a source document describes what its own inventory governs. Never assumed. */
export type SourceMode = 'reception' | 'production' | 'unstated';

export interface StructureSourceMeta {
  id: string;
  title: string;
  publisher?: string;
  edition?: string;
  chapter?: string;
  pages?: string;
  levels: Level[];
  /** `retired` marks a superseded exam: real evidence about a level's shape, not a requirement. */
  status?: 'current' | 'retired';
  audience?: string;
  mode?: SourceMode;
  url?: string;
  local?: string;
  retrieved?: string;
}

export interface StructureEntry {
  key: string;
  level: Level;
  de: string;
  /** `overview-only` = listed in the document's section overview but absent from its detail table. */
  specified?: string;
  note?: string;
}

export interface StructureSection {
  id: string;
  de: string;
  page?: number;
  entries: StructureEntry[];
}

export interface StructureSource {
  source: StructureSourceMeta;
  sections: StructureSection[];
}

/** One source entry, with whatever the inventory says about it. */
export interface EntryResult {
  sourceId: string;
  section: StructureSection;
  entry: StructureEntry;
  /** ids of inventory rows citing this entry */
  claimedBy: string[];
  /** the latest production level among the claiming rows — where the course actually produces it */
  producedAt?: Level;
}

export interface StructureCoverage {
  level: Level;
  /** false when no source file covers this level at all */
  anchored: boolean;
  sources: StructureSourceMeta[];
  claimed: EntryResult[];
  unclaimed: EntryResult[];
  /** inventory rows at this level citing no entry of any source covering it */
  beyond: GrammarPoint[];
  /** `claims:` references whose source or key does not exist — always a defect */
  dangling: { point: string; ref: string }[];
  total: number;
  percent: number;
}

export const STRUCTURES_DIR = join('data', 'strukturenlisten');

export function loadStructureSources(root = process.cwd()): StructureSource[] {
  const dir = join(root, STRUCTURES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => YAML.parse(readFileSync(join(dir, f), 'utf8')) as StructureSource);
}

/** `<source-id>:<entry-key>` — the reference an inventory row writes in `claims:`. */
export const entryRef = (sourceId: string, key: string): string => `${sourceId}:${key}`;

const later = (a: Level, b: Level): Level =>
  LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;

export function structureCoverage(level: Level, root = process.cwd()): StructureCoverage {
  const sources = loadStructureSources(root);
  const points = loadGrammarInventory(root);

  // Every existing entry ref, so a typo in `claims:` is a reported defect rather than a silent
  // miss — the same reason `focusIntroducedBy` is an allowlist and not a lookup.
  const known = new Set<string>();
  for (const src of sources)
    for (const section of src.sections)
      for (const entry of section.entries) known.add(entryRef(src.source.id, entry.key));

  const claimedBy = new Map<string, string[]>();
  const dangling: { point: string; ref: string }[] = [];
  for (const point of points)
    for (const ref of point.claims ?? []) {
      if (!known.has(ref)) {
        dangling.push({ point: point.id, ref });
        continue;
      }
      claimedBy.set(ref, [...(claimedBy.get(ref) ?? []), point.id]);
    }

  const byId = new Map(points.map((p) => [p.id, p]));
  const covering = sources.filter((s) => s.source.levels.includes(level));

  const results: EntryResult[] = [];
  for (const src of covering)
    for (const section of src.sections)
      for (const entry of section.entries) {
        if (entry.level !== level) continue;
        const owners = claimedBy.get(entryRef(src.source.id, entry.key)) ?? [];
        const levels = owners.map((id) => byId.get(id)).filter(Boolean).map((p) => productionLevel(p!));
        results.push({
          sourceId: src.source.id,
          section,
          entry,
          claimedBy: owners,
          producedAt: levels.length ? levels.reduce(later) : undefined,
        });
      }

  const claimed = results.filter((r) => r.claimedBy.length);
  const unclaimed = results.filter((r) => !r.claimedBy.length);
  const anchored = covering.length > 0;

  // `beyond` is only meaningful where a source exists to be beyond. With no anchor every row would
  // be listed, turning one missing book into thirty-two findings.
  const beyond = anchored
    ? points.filter((p) => productionLevel(p) === level && !(p.claims ?? []).length)
    : [];

  return {
    level,
    anchored,
    sources: covering.map((s) => s.source),
    claimed,
    unclaimed,
    beyond,
    dangling,
    total: results.length,
    percent: results.length ? Math.round((claimed.length / results.length) * 100) : 0,
  };
}
