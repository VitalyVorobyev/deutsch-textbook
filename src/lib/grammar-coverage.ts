/**
 * Grammar coverage: how much of the level's *structural* standard the course
 * actually teaches, measured rather than asserted.
 *
 * The Wortliste answers "which words does this level own"; nothing answered
 * "which structures". That gap is how A2 came to be called content-complete
 * while six A2-standard structures were unwritten — and several of them were
 * scheduled to be taught inside B1 units, where they would have been invisible
 * as A2 debt forever.
 *
 * The evidence channel is deliberately the same one the runtime already
 * believes: a point counts as taught when a `practice` or `drill` item carries
 * the focus tag that names its confusion. That is exactly the bar the Wortliste
 * `~` has to clear — a claim is paid for in content, or it is not made.
 * Checkpoints, pretests and probes do not count: they test rather than teach,
 * and a structure that is only ever tested was never taught.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import { LEVELS, type Level } from './schemas';

export interface GrammarPoint {
  id: string;
  standard_level: Level;
  de: string;
  en: string;
  focus?: string[];
  reference_only?: boolean;
  taught_in?: string[];
  note?: string;
}

export type PointStatus = 'covered' | 'late' | 'missing';

export interface GrammarPointResult {
  point: GrammarPoint;
  status: PointStatus;
  /** the level whose material actually drills it, when it is taught at all */
  taughtAt?: Level;
  /** tags the point declares that no practice/drill item carries */
  unmetTags: string[];
}

export interface GrammarCoverage {
  level: Level;
  points: GrammarPointResult[];
  covered: number;
  late: number;
  missing: number;
  total: number;
  /** covered + late — a late point is taught, just not where the standard puts it */
  percent: number;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.yaml') ? [full] : [];
  });
}

export function exerciseLevelFromPath(file: string, base: string): Level {
  // `join()` follows the host platform. Accept both separators here so the
  // coverage result is also testable independently of the machine running it.
  return file.slice(base.length + 1).split(/[\\/]/)[0].toUpperCase() as Level;
}

/**
 * Every focus tag carried by a `practice` or `drill` item, mapped to the levels
 * whose exercise directories teach it. A tag drilled only by a checkpoint or a
 * probe is absent by design.
 *
 * `preview: true` items are skipped, and the flag's own definition is the
 * reason: it marks an item that *intentionally* uses a focus introduced later
 * in the spine, and exists so the validator will permit that one leak. Counting
 * it as teaching evidence would therefore contradict the thing it declares.
 * This is not hypothetical — the single A1 preview item for `du-sie` in
 * `stadt-wege.yaml` was enough to report `anrede-du-sie` as covered-on-time
 * while every real drill of it sits at A2, hiding a genuine sequencing fact
 * from the one category that exists to show it.
 */
export function drilledFocusTags(root = process.cwd()): Map<string, Set<Level>> {
  const tags = new Map<string, Set<Level>>();
  const base = join(root, 'content', 'exercises');
  for (const file of walk(base)) {
    let doc: { role?: string; items?: { focus?: string; preview?: boolean }[] };
    try {
      doc = YAML.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (doc.role !== 'practice' && doc.role !== 'drill') continue;
    const level = exerciseLevelFromPath(file, base);
    for (const item of doc.items ?? []) {
      if (!item.focus || item.preview) continue;
      if (!tags.has(item.focus)) tags.set(item.focus, new Set());
      tags.get(item.focus)!.add(level);
    }
  }
  return tags;
}

export function loadGrammarInventory(root = process.cwd()): GrammarPoint[] {
  const raw = readFileSync(join(root, 'data', 'grammar-inventory.yaml'), 'utf8');
  return (YAML.parse(raw) as { points: GrammarPoint[] }).points;
}

/** CEFR order, taken from the schema so a new level never has to be added twice. */
const LEVEL_ORDER: readonly Level[] = LEVELS;

export function grammarCoverage(level: Level, root = process.cwd()): GrammarCoverage {
  const drilled = drilledFocusTags(root);
  // Topic → the level that owns it. A plain set of ids would say whether a
  // reference-only point's evidence exists but not *where* it is, which is
  // half the question: a point the standard puts at A2 and a B1 topic teaches
  // is taught late, exactly as it would be if a focus tag carried it.
  const topicLevel = new Map<string, Level>();
  try {
    for (const lvl of readdirSync(join(root, 'content', 'topics')))
      for (const f of readdirSync(join(root, 'content', 'topics', lvl)))
        topicLevel.set(f.replace(/\.mdx$/, ''), lvl.toUpperCase() as Level);
  } catch {
    /* no topics yet */
  }

  const points = loadGrammarInventory(root)
    .filter((p) => p.standard_level === level)
    .map((point): GrammarPointResult => {
      if (point.reference_only) {
        // An empty `taught_in` must not pass. `[].every(...)` is vacuously
        // true, so the escape hatch would otherwise cover a point with no
        // evidence whatsoever — a self-certifying claim, which is the one
        // thing this whole file exists to prevent.
        const where = (point.taught_in ?? []).map((t) => topicLevel.get(t));
        if (!where.length || where.some((l) => !l))
          return { point, status: 'missing', unmetTags: [] };
        const taughtAt = where.reduce((a, b) =>
          LEVEL_ORDER.indexOf(a!) >= LEVEL_ORDER.indexOf(b!) ? a : b,
        )!;
        const onTime = LEVEL_ORDER.indexOf(taughtAt) <= LEVEL_ORDER.indexOf(level);
        return { point, status: onTime ? 'covered' : 'late', taughtAt, unmetTags: [] };
      }
      const declared = point.focus ?? [];
      const unmetTags = declared.filter((tag) => !drilled.has(tag));
      if (unmetTags.length) return { point, status: 'missing', unmetTags };

      // Where the course actually finishes teaching it. Per tag, the earliest
      // level that drills it; for the point as a whole, the latest of those —
      // a point is not taught until all of its tags are. Taking the earliest
      // level that happens to carry *every* tag would return nothing at all for
      // a point whose tags are split across two levels, and report a taught
      // structure as untaught.
      const perTag = declared.map(
        (tag) => LEVEL_ORDER.findIndex((lvl) => drilled.get(tag)!.has(lvl)),
      );
      const taughtAt = LEVEL_ORDER[Math.max(...perTag)];
      const onTime = LEVEL_ORDER.indexOf(taughtAt) <= LEVEL_ORDER.indexOf(level);
      return { point, status: onTime ? 'covered' : 'late', taughtAt, unmetTags: [] };
    });

  const covered = points.filter((p) => p.status === 'covered').length;
  const late = points.filter((p) => p.status === 'late').length;
  const missing = points.filter((p) => p.status === 'missing').length;
  return {
    level,
    points,
    covered,
    late,
    missing,
    total: points.length,
    percent: points.length ? Math.round(((covered + late) / points.length) * 100) : 0,
  };
}
