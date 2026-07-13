/**
 * Goethe Wortliste coverage report (dev tool, not part of the validate gate).
 *
 * The measurement itself lives in src/lib/coverage.ts, because the Über page
 * publishes the same number and the two must never disagree. This is the report
 * around it: per section, which manifest words a deck already covers
 * (`covered-by`), which are addressed as grammar (`~`), which are missing, and
 * which are *claimed* as grammar but addressed nowhere (`!` — validate fails on those).
 *
 * Usage:
 *   bun scripts/coverage.ts [A1|A2] [--missing-only]
 *   bun scripts/coverage.ts A2 --check-deck content/vocab/berufe-a2.yaml [...]
 *
 * `--check-deck` is the authoring guard for the Wortliste completion pass. The
 * validator hard-fails a headword owned by two decks, and hundreds of new entries
 * across dozens of files will collide by accident. Every `de` in a completion deck
 * must be a word the level is still missing — which is, by construction, a word no
 * other deck owns. Run it per deck, before `bun run validate`.
 */
import { readFileSync } from 'node:fs';
import * as YAML from 'yaml';
import { goetheCoverage, hasManifest, MEASURED_LEVELS } from '../src/lib/coverage';
import type { Level } from '../src/lib/schemas';

const args = process.argv.slice(2);
const missingOnly = args.includes('--missing-only');
const checkIdx = args.indexOf('--check-deck');
const decksToCheck =
  checkIdx === -1 ? [] : args.slice(checkIdx + 1).filter((a) => !a.startsWith('--'));
const requested = args
  .slice(0, checkIdx === -1 ? undefined : checkIdx)
  .find((a) => !a.startsWith('--'))
  ?.toUpperCase();
const level = (requested ?? 'A1') as Level;

if (!(MEASURED_LEVELS as readonly string[]).includes(level) || !hasManifest(level)) {
  console.error(
    `No Wortliste manifest for ${level}. Levels with one: ${MEASURED_LEVELS.join(', ')}.\n` +
      `A level without data/goethe-<level>-wortliste.txt has no coverage figure — and must not claim one.`,
  );
  process.exit(1);
}

const { sections, ownedBy, total, cards, grammar, missing, unearned, percent } =
  goetheCoverage(level);

// ---------------------------------------------------------------------------
// --check-deck: a completion deck may only teach words the level is missing
// ---------------------------------------------------------------------------

if (decksToCheck.length) {
  // Every manifest word that is supposed to have a flashcard — `covered` plus
  // `missing`, which is all of them except the `~` (grammar, no card) words.
  //
  // NOT just `missing`: goetheCoverage() reads all of content/vocab/, so once the
  // deck under check is saved to its real path its own headwords are already
  // `covered` and would every one of them be rejected as "not missing" — the guard
  // would be unusable in exactly the workflow it exists for. Asking "is this a
  // card-bearing manifest word that no *other* deck owns" is the question we
  // actually mean, and it gives the same answer whether or not the file is on disk.
  const cardWords = new Set(sections.flatMap((s) => [...s.covered, ...s.missing]));
  let bad = 0;
  for (const path of decksToCheck) {
    const deck = YAML.parse(readFileSync(path, 'utf8')) as {
      id: string;
      entries: Array<{ de: string }>;
    };
    for (const { de } of deck.entries) {
      const others = (ownedBy.get(de) ?? []).filter((d) => d !== deck.id);
      if (others.length) {
        console.error(`✗ ${path}: "${de}" is already taught by ${others.join(', ')}`);
        bad++;
      } else if (!cardWords.has(de)) {
        console.error(
          `✗ ${path}: "${de}" is not a Goethe-${level} headword that takes a flashcard — ` +
            `check the spelling against the manifest, or drop the entry ` +
            `(a "~" word is taught as grammar and must not get a card)`,
        );
        bad++;
      }
    }
  }
  if (bad) {
    console.error(`\n${bad} headword problem(s). A completion deck may only teach missing words.`);
    process.exit(1);
  }
  console.log(
    `✓ ${decksToCheck.length} deck(s): every headword is a Goethe-${level} word nothing else teaches.`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

for (const section of sections) {
  const words = section.covered.length + section.missing.length;
  console.log(
    `\n## ${section.name} — ${section.covered.length}/${words} covered` +
      (section.grammar.length ? ` (+${section.grammar.length} taught as grammar)` : ''),
  );
  if (!missingOnly) {
    for (const w of section.covered)
      console.log(`  ✓ ${w}  (covered-by ${ownedBy.get(w)!.join(', ')})`);
    for (const w of section.grammar) console.log(`  ~ ${w}  (skipped: grammar topic)`);
  }
  for (const w of section.missing) console.log(`  ✗ ${w}`);
  for (const w of section.unearned)
    console.log(`  ! ${w}  (claimed as grammar — no article, reading or practice item addresses it)`);
}

console.log(
  `\n=== Goethe-${level} coverage: ${cards + grammar}/${total} (${percent}%) — ` +
    `${cards} as cards, ${grammar} as grammar, ${missing} missing ===`,
);

if (unearned.length) {
  console.error(
    `\n✗ ${unearned.length} unearned grammar claim(s): ${unearned.join(', ')}\n` +
      `  Each is marked "~" in data/goethe-${level.toLowerCase()}-wortliste.txt — a promise that the\n` +
      `  course teaches it without a flashcard. Pay for it (an article table, a reading, a practice\n` +
      `  or drill item), or drop the "~" and give it a card. \`bun run validate\` fails while these stand.`,
  );
  process.exit(1);
}
