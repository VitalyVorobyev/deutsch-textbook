/**
 * Goethe-A1 Wortliste coverage report (dev tool, not part of the validate gate).
 *
 * Reads data/goethe-a1-wortliste.txt — bare headwords grouped into
 * `# --- section ---` blocks that mirror the planned Kernwortschatz decks —
 * and reports, per section, which manifest words any vocab deck already
 * covers (`covered-by`) and which are still missing. A word that appears in
 * several manifest sections counts once, for its first section. A leading `~`
 * marks a word the curriculum addresses as grammar (pronouns, articles, case
 * prepositions…) — counted as addressed without a flashcard.
 *
 * Usage: bun scripts/coverage-a1.ts [--missing-only]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';

const MANIFEST = 'data/goethe-a1-wortliste.txt';
const VOCAB_DIR = 'content/vocab';
const missingOnly = process.argv.includes('--missing-only');

// headword → owning deck id(s)
const ownedBy = new Map<string, string[]>();
for (const file of readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.yaml')).sort()) {
  const data = YAML.parse(readFileSync(join(VOCAB_DIR, file), 'utf8')) as {
    id: string;
    entries: Array<{ de: string }>;
  };
  for (const e of data.entries) ownedBy.set(e.de, [...(ownedBy.get(e.de) ?? []), data.id]);
}

interface Section {
  name: string;
  words: string[];
  grammar: string[];
}
const sections: Section[] = [];
const seenInManifest = new Set<string>();
let current: Section | undefined;
for (const raw of readFileSync(MANIFEST, 'utf8').split('\n')) {
  const line = raw.trim();
  const header = line.match(/^# --- (.+?) ---/);
  if (header) {
    current = { name: header[1]!, words: [], grammar: [] };
    sections.push(current);
    continue;
  }
  if (!line || line.startsWith('#')) continue;
  const grammar = line.startsWith('~');
  const word = grammar ? line.slice(1) : line;
  if (seenInManifest.has(word)) continue; // first section wins
  seenInManifest.add(word);
  (grammar ? current?.grammar : current?.words)?.push(word);
}

let coveredTotal = 0;
let grammarTotal = 0;
let wordTotal = 0;
for (const section of sections) {
  const covered = section.words.filter((w) => ownedBy.has(w));
  const missing = section.words.filter((w) => !ownedBy.has(w));
  coveredTotal += covered.length;
  grammarTotal += section.grammar.length;
  wordTotal += section.words.length + section.grammar.length;
  console.log(
    `\n## ${section.name} — ${covered.length}/${section.words.length} covered` +
      (section.grammar.length ? ` (+${section.grammar.length} taught as grammar)` : ''),
  );
  if (!missingOnly) {
    for (const w of covered) console.log(`  ✓ ${w}  (covered-by ${ownedBy.get(w)!.join(', ')})`);
    for (const w of section.grammar) console.log(`  ~ ${w}  (skipped: grammar topic)`);
  }
  for (const w of missing) console.log(`  ✗ ${w}`);
}

const addressed = coveredTotal + grammarTotal;
console.log(
  `\n=== Goethe-A1 coverage: ${addressed}/${wordTotal} (${Math.round(
    (addressed / wordTotal) * 100,
  )}%) — ${coveredTotal} as cards, ${grammarTotal} as grammar, ${
    wordTotal - addressed
  } missing ===`,
);
