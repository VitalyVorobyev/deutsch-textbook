/**
 * Goethe Wortliste coverage report (dev tool, not part of the validate gate).
 *
 * The measurement itself lives in src/lib/coverage.ts, because the Über page
 * publishes the same number and the two must never disagree. This is the report
 * around it: per section, which manifest words a deck already covers
 * (`covered-by`), which are addressed as grammar (`~`), and which are missing.
 *
 * Usage: bun scripts/coverage.ts [A1|A2] [--missing-only]
 */
import { goetheCoverage, hasManifest, MEASURED_LEVELS } from '../src/lib/coverage';
import type { Level } from '../src/lib/schemas';

const missingOnly = process.argv.includes('--missing-only');
const requested = process.argv.slice(2).find((a) => !a.startsWith('--'))?.toUpperCase();
const level = (requested ?? 'A1') as Level;

if (!(MEASURED_LEVELS as readonly string[]).includes(level) || !hasManifest(level)) {
  console.error(
    `No Wortliste manifest for ${level}. Levels with one: ${MEASURED_LEVELS.join(', ')}.\n` +
      `A level without data/goethe-<level>-wortliste.txt has no coverage figure — and must not claim one.`,
  );
  process.exit(1);
}

const { sections, ownedBy, total, cards, grammar, missing, percent } = goetheCoverage(level);

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
}

console.log(
  `\n=== Goethe-${level} coverage: ${cards + grammar}/${total} (${percent}%) — ` +
    `${cards} as cards, ${grammar} as grammar, ${missing} missing ===`,
);
