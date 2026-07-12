/**
 * Goethe-A1 Wortliste coverage — how much of the official A1 word list the
 * course actually teaches. Build-time only (reads the repo), shared by the
 * `bun scripts/coverage-a1.ts` report and the Über page, so a claim on the
 * public page can never drift from the manifest it is measured against.
 *
 * data/goethe-a1-wortliste.txt holds bare headwords in `# --- section ---`
 * blocks mirroring the planned Kernwortschatz decks. A word listed in several
 * sections counts once, for its first. A leading `~` marks a word the course
 * addresses as grammar (pronouns, articles, case prepositions…) — addressed,
 * but deliberately without a flashcard.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';

const MANIFEST = 'data/goethe-a1-wortliste.txt';
const VOCAB_DIR = 'content/vocab';

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

export function goetheA1Coverage(root = process.cwd()): Coverage {
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

  const sections: CoverageSection[] = [];
  const seen = new Set<string>();
  let current: CoverageSection | undefined;
  for (const raw of readFileSync(join(root, MANIFEST), 'utf8').split('\n')) {
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
    sections,
    ownedBy,
    total,
    cards,
    grammar,
    missing,
    percent: total === 0 ? 0 : Math.round(((cards + grammar) / total) * 100),
  };
}
