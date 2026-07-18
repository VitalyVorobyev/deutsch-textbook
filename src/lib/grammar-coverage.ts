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

/**
 * Every focus tag carried by a `practice` or `drill` item, mapped to the levels
 * whose exercise directories teach it. A tag drilled only by a checkpoint or a
 * probe is absent by design.
 */
export function drilledFocusTags(root = process.cwd()): Map<string, Set<Level>> {
  const tags = new Map<string, Set<Level>>();
  const base = join(root, 'content', 'exercises');
  for (const file of walk(base)) {
    let doc: { role?: string; items?: { focus?: string }[] };
    try {
      doc = YAML.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (doc.role !== 'practice' && doc.role !== 'drill') continue;
    const level = file.slice(base.length + 1).split('/')[0].toUpperCase() as Level;
    for (const item of doc.items ?? []) {
      if (!item.focus) continue;
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
  const topicDirs = new Set<string>();
  try {
    for (const lvl of readdirSync(join(root, 'content', 'topics')))
      for (const f of readdirSync(join(root, 'content', 'topics', lvl)))
        topicDirs.add(f.replace(/\.mdx$/, ''));
  } catch {
    /* no topics yet */
  }

  const points = loadGrammarInventory(root)
    .filter((p) => p.standard_level === level)
    .map((point): GrammarPointResult => {
      if (point.reference_only) {
        const taught = (point.taught_in ?? []).every((t) => topicDirs.has(t));
        return { point, status: taught ? 'covered' : 'missing', unmetTags: [] };
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
