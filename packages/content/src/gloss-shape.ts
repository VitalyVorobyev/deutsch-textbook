/**
 * How vocabulary glosses are shaped, per deck — the measurement behind the
 * gloss rule in docs/authoring/item-authoring.md.
 *
 * A gloss is the retrieval cue: the question side of the production card and
 * the meaning side of the recognition card. The learner asked for "heart", and
 * the B1 lexis waves shipped "the organ in the chest that pumps and beats
 * faster when you run" — a riddle, not a cue — across 31 decks, and no gate
 * saw it because every entry was schema-valid. This module makes the shape
 * measurable; `tests/gloss-shape.test.ts` ratchets today's counts downward so
 * the class cannot silently return, and `scripts/gloss-shape.ts` prints the
 * per-deck report.
 *
 * Counting method, stated so the numbers mean something: a "word" is a
 * whitespace-separated token containing at least one letter or digit (the
 * scripts/lang-cost.ts rule); the whole EN gloss counts, parentheticals
 * included, because the learner reads all of it before answering. `long` is
 * the count of entries at or above LONG_GLOSS_WORDS — the tripwire boundary,
 * never a target: a legitimate disambiguating parenthetical can cross it, and
 * the ratchet holds per-deck counts, not a blanket zero.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';

/** At or above this many EN-gloss words an entry counts as `long`. Healthy decks
    sit at 1–4 words with the odd parenthetical; the defective B1 waves have
    medians of 13–18. Eight is the boundary that separates the two populations. */
export const LONG_GLOSS_WORDS = 8;

export interface VocabGlossEntry {
  de: string;
  en?: string;
  en_compact?: string;
}

export interface DeckGlossShape {
  /** deck id (the file's `id:` field, falling back to the filename) */
  id: string;
  file: string;
  entries: number;
  /** EN-gloss word counts: median, 90th percentile, max */
  median: number;
  p90: number;
  max: number;
  /** entries whose EN gloss runs to LONG_GLOSS_WORDS or more */
  long: number;
  /** same-deck pairs whose EN glosses reduce to the same content-word set —
      two correct answers to one production prompt (the P22-11 hazard) */
  duplicates: Array<[string, string]>;
}

export function glossWordCount(gloss: string): number {
  return gloss.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** Function words that never distinguish two prompts. Deliberately small, and
    deliberately WITHOUT prepositions: "in love" and "love", or "on foot" and
    "foot", are different prompts — an over-eager list would merge glosses that
    differ in a real content word. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'or', 'that', 'which', 'who', 'you',
  'it', 'is', 'are', 'be', 'one', 'someone', 'something', 'somebody',
]);

function contentWordKey(gloss: string): string {
  const words = gloss
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return [...new Set(words)].sort().join(' ');
}

/** Same-deck duplicate detector: two entries whose EN glosses carry the same
    content words answer the same production prompt. Requires a non-empty key —
    an empty gloss is a schema problem, not a duplicate. */
export function duplicateGlossPairs(entries: VocabGlossEntry[]): Array<[string, string]> {
  const byKey = new Map<string, string[]>();
  for (const entry of entries) {
    const key = contentWordKey(entry.en ?? '');
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(entry.de);
    byKey.set(key, list);
  }
  const pairs: Array<[string, string]> = [];
  for (const group of byKey.values()) {
    for (let i = 1; i < group.length; i++) pairs.push([group[0], group[i]]);
  }
  return pairs;
}

export function deckGlossShape(id: string, file: string, entries: VocabGlossEntry[]): DeckGlossShape {
  const counts = entries.map((e) => glossWordCount(e.en ?? '')).sort((a, b) => a - b);
  const at = (q: number) => (counts.length ? counts[Math.min(counts.length - 1, Math.floor(counts.length * q))] : 0);
  return {
    id,
    file,
    entries: entries.length,
    median: at(0.5),
    p90: at(0.9),
    max: counts.length ? counts[counts.length - 1] : 0,
    long: counts.filter((c) => c >= LONG_GLOSS_WORDS).length,
    duplicates: duplicateGlossPairs(entries),
  };
}

/** Measure every deck under `<root>/content/vocab` (optionally one level). */
export function glossShapeReport(root: string, level?: string): DeckGlossShape[] {
  const dir = join(root, 'content', 'vocab');
  const out: DeckGlossShape[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
    const doc = YAML.parse(readFileSync(join(dir, file), 'utf8')) as {
      id?: string;
      level?: string;
      entries?: VocabGlossEntry[];
    } | null;
    if (!doc?.entries) continue;
    if (level && doc.level?.toUpperCase() !== level.toUpperCase()) continue;
    out.push(deckGlossShape(doc.id ?? file.replace(/\.yaml$/, ''), file, doc.entries));
  }
  return out;
}
