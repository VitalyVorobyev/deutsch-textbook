/**
 * Vocabulary gloss shape, per deck — the command behind the gloss rule in
 * docs/authoring/item-authoring.md, written so the figure that decided the
 * B1 gloss-repair waves is reproducible by one paste.
 *
 * Usage:
 *   bun scripts/gloss-shape.ts               # every deck
 *   bun scripts/gloss-shape.ts B1            # one level
 *   bun scripts/gloss-shape.ts --long-only   # only decks with long glosses
 *
 * Read every row against the corpus medians the report prints, never against
 * zero — a legitimate disambiguating parenthetical crosses the `long` line and
 * is not a defect (the same discipline as scripts/comprehensibility.ts). The
 * gate lives in tests/gloss-shape.test.ts: today's per-deck `long` counts are
 * ratcheted and may only go down, one wave at a time.
 */
import { glossShapeReport, LONG_GLOSS_WORDS } from '@da/content/gloss-shape';
import { repoRoot } from '@da/content/repo-root';

const args = process.argv.slice(2);
const longOnly = args.includes('--long-only');
const level = args.find((a) => /^(A1|A2|B1)$/i.test(a));

const decks = glossShapeReport(repoRoot(), level);
if (decks.length === 0) {
  process.stderr.write('no decks matched\n');
  process.exit(1);
}

const shown = (longOnly ? decks.filter((d) => d.long > 0) : decks).slice().sort((a, b) => b.long - a.long || b.median - a.median);

const medians = decks.map((d) => d.median).sort((a, b) => a - b);
const corpusMedian = medians[Math.floor(medians.length / 2)];
const totalLong = decks.reduce((n, d) => n + d.long, 0);

console.log(`gloss shape · ${decks.length} deck(s) · long = EN gloss ≥ ${LONG_GLOSS_WORDS} words`);
console.log(`corpus median of deck medians: ${corpusMedian} word(s) · long entries in total: ${totalLong}\n`);
console.log('deck'.padEnd(36) + 'entries'.padStart(8) + 'median'.padStart(8) + 'p90'.padStart(6) + 'max'.padStart(6) + 'long'.padStart(6) + '  duplicates');
for (const d of shown) {
  const dup = d.duplicates.length ? d.duplicates.map(([a, b]) => `${a}≈${b}`).join(', ') : '';
  console.log(
    d.id.padEnd(36) +
      String(d.entries).padStart(8) +
      String(d.median).padStart(8) +
      String(d.p90).padStart(6) +
      String(d.max).padStart(6) +
      String(d.long).padStart(6) +
      (dup ? `  ${dup}` : ''),
  );
}
