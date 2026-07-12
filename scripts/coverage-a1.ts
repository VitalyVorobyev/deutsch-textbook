/**
 * Goethe-A1 Wortliste coverage report (dev tool, not part of the validate gate).
 *
 * The measurement itself lives in src/lib/coverage.ts, because the Über page
 * publishes the same number and the two must never disagree. This is the
 * report around it: per section, which manifest words a deck already covers
 * (`covered-by`), which are addressed as grammar (`~`), and which are missing.
 *
 * Usage: bun scripts/coverage-a1.ts [--missing-only]
 */
import { goetheA1Coverage } from '../src/lib/coverage';

const missingOnly = process.argv.includes('--missing-only');
const { sections, ownedBy, total, cards, grammar, missing, percent } = goetheA1Coverage();

for (const section of sections) {
  const words = section.covered.length + section.missing.length;
  console.log(
    `\n## ${section.name} — ${section.covered.length}/${words} covered` +
      (section.grammar.length ? ` (+${section.grammar.length} taught as grammar)` : ''),
  );
  if (!missingOnly) {
    for (const w of section.covered) console.log(`  ✓ ${w}  (covered-by ${ownedBy.get(w)!.join(', ')})`);
    for (const w of section.grammar) console.log(`  ~ ${w}  (skipped: grammar topic)`);
  }
  for (const w of section.missing) console.log(`  ✗ ${w}`);
}

console.log(
  `\n=== Goethe-A1 coverage: ${cards + grammar}/${total} (${percent}%) — ` +
    `${cards} as cards, ${grammar} as grammar, ${missing} missing ===`,
);
