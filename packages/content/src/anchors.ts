/**
 * The denominator's own denominator, for any dimension of it.
 *
 * `grammar-coverage.ts` answers "does content teach every row of `data/grammar-inventory.yaml`". It
 * cannot answer "is that the right list", and for as long as nothing did, the answer was no: on
 * 2026-08-12 the A1 rows turned out to be missing entries the Goethe A1 exam tests, and 100% had
 * been measuring an incomplete list. This module reads the published lists.
 *
 * WHY IT IS GENERIC. The same failure has more than one shape, because a course makes more than one
 * kind of claim. Grammar rows were only the first:
 *
 *   | dimension  | directory                 | what claims an entry                    |
 *   | ---------- | ------------------------- | --------------------------------------- |
 *   | `struktur` | `data/strukturenlisten/`  | a row of `data/grammar-inventory.yaml`  |
 *   | `handlung` | `data/handlungslisten/`   | an `outcome` in `content/atlas.yaml`    |
 *   | `thema`    | `data/themenlisten/`      | (reserved — a topic, once manifests land) |
 *
 * A course can teach every structure on the published list and still never ask the learner to
 * refuse an offer, which is why these are separate denominators and not more rows in one. What they
 * share is the whole mechanism, so it lives here once: a caller supplies its claimants and gets
 * back the same three classes.
 *
 *   - **claimed**  — some claimant cites it.
 *   - **unclaimed** — no claimant cites it: a hole in the course's denominator, and the point.
 *   - **beyond**   — a claimant at this level citing nothing, where a source exists to be beyond.
 *                    Legitimate and common: this course aims at B1 and follows a coursebook
 *                    progression, so it teaches things Start Deutsch never tested. The point is
 *                    that the choice is visible instead of indistinguishable from an accident.
 *
 * A level with no source at all reports `anchored: false` and no `beyond` list, because calling
 * every B1 row unanchored would read as thirty-two defects when it is one missing book. An
 * instrument that manufactures findings out of its own blind spot is worse than one that says it
 * cannot see.
 *
 * Nothing here is imported by runtime code; it runs at authoring/validation time only.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import { LEVELS, type Level } from '@da/schema';
import { repoRoot } from './repo-root';

/** Which published claim a directory of anchors measures. */
export type AnchorDimension = 'struktur' | 'handlung' | 'thema';

export const ANCHOR_DIRS: Record<AnchorDimension, string> = {
  struktur: join('data', 'strukturenlisten'),
  handlung: join('data', 'handlungslisten'),
  thema: join('data', 'themenlisten'),
};

/** How a source document describes what its own inventory governs. Never assumed. */
export type SourceMode = 'reception' | 'production' | 'unstated';

export interface AnchorSourceMeta {
  id: string;
  title: string;
  publisher?: string;
  edition?: string;
  chapter?: string;
  /** Printed page range, as the document numbers itself. */
  pages?: string;
  levels: Level[];
  /**
   * The source assigns no level to its entries — the whole list is the repertoire across every
   * level in `levels`, and an entry's own `level` is the floor at which the source first requires
   * it rather than the level it belongs to.
   *
   * The DTZ handbook is one exam scored to A2 *or* B1, so its §8.4 levels nothing: two entries
   * carry a B1-only footnote and 162 carry none. Encoding that at A2 would have left B1 unanchored
   * a second time; at B1 it would have made the DTZ say something about A2 that it does not.
   */
  cumulative?: boolean;
  /** `retired` marks a superseded exam: real evidence about a level's shape, not a requirement. */
  status?: 'current' | 'retired';
  /**
   * Who sits the exam. Load-bearing, not decoration: for one day A2 read 138/138 = 100% and the
   * list it was 100% of was *Fit in Deutsch 2*, the exam for teenagers, because the adult A2
   * Prüfungsziele is not published free and nothing in the report said so.
   */
  audience?: string;
  mode?: SourceMode;
  url?: string;
  local?: string;
  retrieved?: string;
  /** Which pages of `local` hold `pages` — for `bun scripts/anchor-check.ts`. */
  pdf_pages?: string;
  /** x-bands where the document prints its label columns — for `--unaccounted`. */
  label_columns?: [number, number][];
}

export interface AnchorEntry {
  key: string;
  level: Level;
  de: string;
  /**
   * The source's literal wording, where it differs from the label this repo uses — a typo
   * (`irrogativ`), a footnote glyph fused to a word (`Passiv*`), a hyphen the typesetter spaced
   * away from its affix (`Nachsilbe - los`).
   *
   * It exists because `anchor-check.ts` forces every label word to appear on the page, and without
   * an escape hatch that pressure degrades the labels themselves: a first pass at it shipped
   * `Nachsilbe los` and `Nominalisierung er`, which are worse German than what the booklet prints,
   * and re-broke a typo an earlier author had deliberately corrected and documented. ADR 0011's
   * rule is that a source is not improved by being quietly corrected — the operative word is
   * *quietly*. `de` is what the structure is; `printed` is what the page says; the check reads
   * `printed ?? de`, so the correction is stated, machine-verified, and impossible to lose.
   */
  printed?: string;
  /** `overview-only` = listed in the document's section overview but absent from its detail table. */
  specified?: string;
  note?: string;
}

export interface AnchorSection {
  id: string;
  de: string;
  page?: number;
  entries: AnchorEntry[];
}

export interface AnchorSource {
  source: AnchorSourceMeta;
  sections: AnchorSection[];
}

/** Anything that can cite a source entry: a grammar-inventory row, an atlas outcome. */
export interface Claimant {
  id: string;
  /** The level at which this course delivers it — what `beyond` is computed against. */
  level: Level;
  claims?: string[];
  /** For the report only. */
  label?: string;
}

export interface AnchorEntryResult {
  sourceId: string;
  section: AnchorSection;
  entry: AnchorEntry;
  /** ids of claimants citing this entry */
  claimedBy: string[];
  /** the latest level among the claiming rows — where the course actually delivers it */
  producedAt?: Level;
}

export interface AnchorCoverage {
  dimension: AnchorDimension;
  level: Level;
  /** false when no source file covers this level at all */
  anchored: boolean;
  sources: AnchorSourceMeta[];
  claimed: AnchorEntryResult[];
  unclaimed: AnchorEntryResult[];
  /** claimants at this level citing no entry of any source covering it */
  beyond: Claimant[];
  /** `claims:` references whose source or key does not exist — always a defect */
  dangling: { claimant: string; ref: string }[];
  total: number;
  percent: number;
}

export function loadAnchorSources(dimension: AnchorDimension, root = repoRoot()): AnchorSource[] {
  const dir = join(root, ANCHOR_DIRS[dimension]);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => YAML.parse(readFileSync(join(dir, f), 'utf8')) as AnchorSource);
}

/** `<source-id>:<entry-key>` — the reference a claimant writes in `claims:`. */
export const entryRef = (sourceId: string, key: string): string => `${sourceId}:${key}`;

const rank = (level: Level) => LEVELS.indexOf(level);
const later = (a: Level, b: Level): Level => (rank(a) >= rank(b) ? a : b);

export function anchorCoverage(
  dimension: AnchorDimension,
  level: Level,
  claimants: Claimant[],
  root = repoRoot(),
): AnchorCoverage {
  const sources = loadAnchorSources(dimension, root);

  // Every existing entry ref, so a typo in `claims:` is a reported defect rather than a silent
  // miss — the same reason `focusIntroducedBy` is an allowlist and not a lookup.
  const known = new Set<string>();
  for (const src of sources)
    for (const section of src.sections)
      for (const entry of section.entries) known.add(entryRef(src.source.id, entry.key));

  const claimedBy = new Map<string, string[]>();
  const dangling: { claimant: string; ref: string }[] = [];
  for (const claimant of claimants)
    for (const ref of claimant.claims ?? []) {
      if (!known.has(ref)) {
        dangling.push({ claimant: claimant.id, ref });
        continue;
      }
      claimedBy.set(ref, [...(claimedBy.get(ref) ?? []), claimant.id]);
    }

  const byId = new Map(claimants.map((c) => [c.id, c]));
  const covering = sources.filter((s) => s.source.levels.includes(level));

  const results: AnchorEntryResult[] = [];
  for (const src of covering)
    for (const section of src.sections)
      for (const entry of section.entries) {
        // A levelled source answers "what does the standard require AT this level"; a cumulative
        // one answers "what must still be in the repertoire BY this level", so its A2 entries are
        // measured at B1 too. Both readings are the source's own — never inferred.
        const inScope = src.source.cumulative ? rank(entry.level) <= rank(level) : entry.level === level;
        if (!inScope) continue;
        const owners = claimedBy.get(entryRef(src.source.id, entry.key)) ?? [];
        const levels = owners.map((id) => byId.get(id)).filter(Boolean).map((c) => c!.level);
        results.push({
          sourceId: src.source.id,
          section,
          entry,
          claimedBy: owners,
          producedAt: levels.length ? levels.reduce(later) : undefined,
        });
      }

  const anchored = covering.length > 0;
  return {
    dimension,
    level,
    anchored,
    sources: covering.map((s) => s.source),
    claimed: results.filter((r) => r.claimedBy.length),
    unclaimed: results.filter((r) => !r.claimedBy.length),
    // `beyond` is only meaningful where a source exists to be beyond. With no anchor every
    // claimant would be listed, turning one missing book into thirty-two findings.
    beyond: anchored ? claimants.filter((c) => c.level === level && !(c.claims ?? []).length) : [],
    dangling,
    total: results.length,
    percent: results.length ? Math.round((results.filter((r) => r.claimedBy.length).length / results.length) * 100) : 0,
  };
}
