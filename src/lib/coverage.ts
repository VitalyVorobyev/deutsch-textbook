/**
 * Goethe Wortliste coverage — how much of an official CEFR word list the course
 * actually teaches. Build-time only (reads the repo), shared by the
 * `bun scripts/coverage.ts` report and the Über page, so a claim on the public
 * page can never drift from the manifest it is measured against.
 *
 * data/goethe-<level>-wortliste.txt holds bare headwords in `# --- section ---`
 * blocks. A word listed in several sections counts once, for its first. A
 * leading `~` marks a word the course addresses as grammar (pronouns, articles,
 * case prepositions…) — addressed, but deliberately without a flashcard.
 *
 * A manifest is measured against **every** deck, not only the decks of its own
 * level: the Goethe A2 list is not a superset of the A1 one, but the two overlap
 * heavily, and an A1 deck that already teaches a word on the A2 list has taught
 * it. Coverage is a question about the learner, not about our filing.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import type { Level } from './schemas';

const VOCAB_DIR = 'content/vocab';

/** Levels that have a committed Wortliste manifest to be measured against. */
export const MEASURED_LEVELS = ['A1', 'A2'] as const;
export type MeasuredLevel = (typeof MEASURED_LEVELS)[number];

const manifestPath = (level: Level): string =>
  `data/goethe-${level.toLowerCase()}-wortliste.txt`;

export interface CoverageSection {
  name: string;
  /** manifest words a deck teaches as a flashcard */
  covered: string[];
  /** manifest words no deck teaches yet */
  missing: string[];
  /** manifest words the course addresses as grammar, without a flashcard */
  grammar: string[];
}

export interface Coverage {
  level: Level;
  sections: CoverageSection[];
  /** headword → the deck ids that teach it */
  ownedBy: Map<string, string[]>;
  /** every manifest word, however addressed */
  total: number;
  /** taught as a flashcard */
  cards: number;
  /** addressed as grammar */
  grammar: number;
  /** neither */
  missing: number;
  /** (cards + grammar) / total, rounded to a percent */
  percent: number;
}

/** Every headword any deck teaches → the deck ids that teach it. */
function deckHeadwords(root: string): Map<string, string[]> {
  const ownedBy = new Map<string, string[]>();
  const vocabDir = join(root, VOCAB_DIR);
  for (const file of readdirSync(vocabDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const data = YAML.parse(readFileSync(join(vocabDir, file), 'utf8')) as {
      id: string;
      entries: Array<{ de: string }>;
    };
    for (const entry of data.entries) {
      ownedBy.set(entry.de, [...(ownedBy.get(entry.de) ?? []), data.id]);
    }
  }
  return ownedBy;
}

/** True when the level has a committed manifest — i.e. a coverage claim is possible. */
export function hasManifest(level: Level, root = process.cwd()): boolean {
  return existsSync(join(root, manifestPath(level)));
}

export function goetheCoverage(level: Level, root = process.cwd()): Coverage {
  const ownedBy = deckHeadwords(root);

  const sections: CoverageSection[] = [];
  const seen = new Set<string>();
  let current: CoverageSection | undefined;
  for (const raw of readFileSync(join(root, manifestPath(level)), 'utf8').split('\n')) {
    const line = raw.trim();
    const header = line.match(/^# --- (.+?) ---/);
    if (header) {
      current = { name: header[1]!, covered: [], missing: [], grammar: [] };
      sections.push(current);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const isGrammar = line.startsWith('~');
    const word = isGrammar ? line.slice(1) : line;
    if (seen.has(word)) continue; // first section wins
    seen.add(word);
    if (isGrammar) current?.grammar.push(word);
    else if (ownedBy.has(word)) current?.covered.push(word);
    else current?.missing.push(word);
  }

  const cards = sections.reduce((n, s) => n + s.covered.length, 0);
  const grammar = sections.reduce((n, s) => n + s.grammar.length, 0);
  const missing = sections.reduce((n, s) => n + s.missing.length, 0);
  const total = cards + grammar + missing;
  return {
    level,
    sections,
    ownedBy,
    total,
    cards,
    grammar,
    missing,
    percent: total === 0 ? 0 : Math.round(((cards + grammar) / total) * 100),
  };
}
