/**
 * Grammar DEPTH: not whether a structure is taught, but how much practice stands behind it, in
 * which modes, spread over how many sittings, and whether anything ever re-checks it.
 *
 * `grammar-coverage.ts` is binary by design — one `practice`/`drill` item carrying the tag marks a
 * point taught — and that was the right bar for the question it answers ("is this structure in the
 * course at all"). It is the wrong bar for the question it kept being *read* as answering. On
 * 2026-08-14 all three levels published the same 100% while the median practice/drill items per
 * focus tag ran A1 12 · A2 8 · B1 4, production items 6 · 6 · 3, and 29% of B1 tags lived in
 * exactly one practice file against 15% at A1. A fourfold drop in practice depth was invisible to
 * every published figure, because breadth was the only thing anything measured.
 *
 * Four numbers per tag, and each answers a different question the lesson cycle asks:
 *
 *   - **teaching** — items at all: is there enough to practise on?
 *   - **production** — of those, how many make the learner BUILD German rather than pick it
 *     (§12 pushed output). A tag with ten items and one production item trains recognition.
 *   - **files** — distinct practice/drill sets carrying it: a tag drilled in one file is met once
 *     and never revisited (§2 spacing, §3 interleaving), however many items that file holds.
 *   - **probe** — delayed variants: is the structure ever re-asked after an interval, or only
 *     ever on the day it was taught (§1 retrieval, the delayed check that closes the cycle)?
 *
 * THERE IS NO THRESHOLD HERE, and that is deliberate — the `comprehensibility.ts` discipline.
 * Nobody has validated a "correct" number of items per confusion, and inventing one would put a
 * fabricated bar into a repo whose whole point is earned figures. What `tests/grammar-depth.test.ts`
 * pins instead is a **ratchet on measured reality**: today's medians and counts, free to move only
 * in the right direction. A failure means either depth was removed or a tag was added without the
 * practice to pay for it, and both want noticing.
 *
 * Counting rules are the ones `drilledFocusTags` already uses, deliberately and not incidentally:
 * only `practice` and `drill` roles teach, and `preview: true` is excluded because the flag
 * declares a forward reference to a focus introduced later — counting it as practice would
 * contradict what it says.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { repoRoot } from './repo-root';
import { join } from 'node:path';
import * as YAML from 'yaml';
import {
  loadGrammarInventory,
  productionLevel,
  type GrammarPoint,
} from './grammar-coverage';
import { focusIntroducedBy } from './focus-tags';
import type { CefrLevel, Level } from '@da/schema';

/**
 * Item types that make the learner construct German rather than choose it.
 *
 * `mc`, `match` and `order` are selection: every token is on the screen already. `order` sits
 * there rather than with production for the reason the item-mix bar gives — it hands the learner
 * every word and asks only for the sequence, which is scaffolding for a word-order rule and not a
 * test of one. `audio-comprehension` is on neither side, exactly as in the mix bar: it cannot ask
 * for production at all, so counting it either way would misstate the ratio.
 */
// Re-exported for callers that already reach for them here; they LIVE in @da/schema, because
// this module opens node:fs and a browser importer must never pull the filesystem in with them.
import { PRODUCTION_TYPES, SELECTION_TYPES } from '@da/schema';
export { PRODUCTION_TYPES, SELECTION_TYPES };

export interface TagDepth {
  tag: string;
  /** the topic that introduces it, from `focusIntroducedBy` */
  introducedBy?: string;
  /** the level of that topic — where this confusion belongs */
  level?: Level;
  /** practice/drill items carrying it, `preview` excluded */
  teaching: number;
  /** of those, items that demand construction */
  production: number;
  /** of those, items that only demand a choice */
  selection: number;
  /** distinct practice/drill files carrying it — the distributed-practice signal */
  files: number;
  probe: number;
  checkpoint: number;
  placement: number;
  pretest: number;
  byType: Map<string, number>;
}

export interface PointDepth {
  point: GrammarPoint;
  level: CefrLevel;
  tags: TagDepth[];
  /** summed over the point's tags — an item carries exactly one tag, so nothing double counts */
  teaching: number;
  production: number;
  probe: number;
  checkpoint: number;
  /** the point's thinnest tag: a structure is only as practised as its least-practised half */
  thinnest?: TagDepth;
}

export interface LevelDepth {
  level: Level;
  tags: TagDepth[];
  points: PointDepth[];
  medianTeaching: number;
  medianProduction: number;
  medianFiles: number;
  /** tags carried by exactly one practice/drill file */
  singleFileTags: number;
  /** tags with three or fewer teaching items */
  thinTags: number;
  /**
   * Points that ARE taught and that no probe item ever re-asks — the delayed check missing from
   * the end of the lesson cycle. Structures with no teaching items at all are excluded: a point
   * waiting to be written cannot be faulted for having no delayed evidence, and counting it here
   * would make opening a denominator gap look like a regression in retention design.
   */
  pointsWithoutProbe: number;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.yaml') ? [full] : [];
  });
}

const median = (xs: number[]): number =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0;

/**
 * Memoised per root, because this is the module's only corpus pass and everything else here is a
 * projection of it — `pointDepths` calls it, `levelDepth` calls BOTH, so one `levelDepth(level)`
 * used to re-read and re-parse all 336 exercise files twice. `tests/grammar-depth.test.ts` made
 * eight such walks in a single test and tipped over CI's 5 s budget at 5244 ms; the same test now
 * makes one.
 *
 * Safe because nothing mutates what comes back — every caller here, in `payload.ts` and in
 * `scripts/grammar-depth.ts` only filters, maps and sums. Cleared through
 * `invalidateContentGraph()`, which is deliberately the ONE invalidation entry point: the editorial
 * dev server's watcher already calls it on every file change, and a second thing to remember to
 * call is a stale number waiting to happen.
 */
const depthCache = new Map<string, Map<string, TagDepth>>();

/** Drop the memo. Called by `invalidateContentGraph`; not part of the public surface. */
export function invalidateGrammarDepth(root?: string): void {
  if (root) depthCache.delete(root);
  else depthCache.clear();
}

/** Depth for every tag in the allowlist, whether or not any item carries it. */
export function tagDepths(root = repoRoot()): Map<string, TagDepth> {
  const cached = depthCache.get(root);
  if (cached) return cached;
  const computed = computeTagDepths(root);
  depthCache.set(root, computed);
  return computed;
}

function computeTagDepths(root: string): Map<string, TagDepth> {
  const topicLevel = new Map<string, Level>();
  try {
    for (const lvl of readdirSync(join(root, 'content', 'topics')))
      for (const f of readdirSync(join(root, 'content', 'topics', lvl)))
        topicLevel.set(f.replace(/\.mdx$/, ''), lvl.toUpperCase() as Level);
  } catch {
    /* no topics yet */
  }

  const out = new Map<string, TagDepth>();
  const fresh = (tag: string): TagDepth => ({
    tag,
    introducedBy: focusIntroducedBy[tag],
    level: focusIntroducedBy[tag] ? topicLevel.get(focusIntroducedBy[tag]!) : undefined,
    teaching: 0,
    production: 0,
    selection: 0,
    files: 0,
    probe: 0,
    checkpoint: 0,
    placement: 0,
    pretest: 0,
    byType: new Map(),
  });
  // Seed the allowlist first, so a registered tag nothing drills reports 0 rather than vanishing —
  // an absent row and a zero row look the same in a table and mean opposite things.
  for (const tag of Object.keys(focusIntroducedBy)) out.set(tag, fresh(tag));
  // …and then every tag an inventory row NAMES, registered or not. An unregistered tag is how an
  // unwritten structure declares itself (`validate.ts` permits it deliberately), so it is the most
  // interesting row there is: a confusion the course has committed to and not yet built. It gets a
  // zero row here and, crucially, a page in the console instead of a dead link. It never reaches a
  // level median: `focusIntroducedBy` gives it no owning topic, so `levelDepth` filters it out.
  for (const point of loadGrammarInventory(root))
    for (const tag of point.focus ?? []) if (!out.has(tag)) out.set(tag, fresh(tag));

  const filesByTag = new Map<string, Set<string>>();
  const base = join(root, 'content', 'exercises');
  for (const file of walk(base)) {
    let doc: { role?: string; items?: { type?: string; focus?: string; preview?: boolean }[] };
    try {
      doc = YAML.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const role = doc.role ?? 'practice';
    const stem = file.slice(base.length + 1);
    for (const item of doc.items ?? []) {
      if (!item.focus) continue;
      if (!out.has(item.focus)) out.set(item.focus, fresh(item.focus));
      const depth = out.get(item.focus)!;
      if ((role === 'practice' || role === 'drill') && !item.preview) {
        depth.teaching += 1;
        if (PRODUCTION_TYPES.has(item.type ?? '')) depth.production += 1;
        if (SELECTION_TYPES.has(item.type ?? '')) depth.selection += 1;
        depth.byType.set(item.type ?? '?', (depth.byType.get(item.type ?? '?') ?? 0) + 1);
        if (!filesByTag.has(item.focus)) filesByTag.set(item.focus, new Set());
        filesByTag.get(item.focus)!.add(stem);
      } else if (role === 'probe') depth.probe += 1;
      else if (role === 'checkpoint') depth.checkpoint += 1;
      else if (role === 'placement') depth.placement += 1;
      else if (role === 'pretest') depth.pretest += 1;
    }
  }
  for (const [tag, files] of filesByTag) out.get(tag)!.files = files.size;
  return out;
}

export function pointDepths(root = repoRoot()): PointDepth[] {
  const tags = tagDepths(root);
  return loadGrammarInventory(root).map((point) => {
    const mine = (point.focus ?? []).map((t) => tags.get(t)).filter(Boolean) as TagDepth[];
    const sum = (pick: (t: TagDepth) => number) => mine.reduce((n, t) => n + pick(t), 0);
    return {
      point,
      level: productionLevel(point),
      tags: mine,
      teaching: sum((t) => t.teaching),
      production: sum((t) => t.production),
      probe: sum((t) => t.probe),
      checkpoint: sum((t) => t.checkpoint),
      thinnest: mine.length
        ? mine.reduce((a, b) => (a.teaching <= b.teaching ? a : b))
        : undefined,
    };
  });
}

export function levelDepth(level: Level, root = repoRoot()): LevelDepth {
  const all = tagDepths(root);
  // A tag belongs to the level of the topic that INTRODUCES it, not to every level whose items
  // happen to carry it: the question is where the confusion is owned, and a tag recycled by a
  // later unit is depth for its owner, not a second tag.
  const tags = [...all.values()].filter((t) => t.level === level);
  const points = pointDepths(root).filter((p) => p.level === level);
  return {
    level,
    tags,
    points,
    medianTeaching: median(tags.map((t) => t.teaching)),
    medianProduction: median(tags.map((t) => t.production)),
    medianFiles: median(tags.map((t) => t.files)),
    singleFileTags: tags.filter((t) => t.files === 1).length,
    thinTags: tags.filter((t) => t.teaching <= 3).length,
    pointsWithoutProbe: points.filter((p) => p.teaching > 0 && p.probe === 0).length,
  };
}
