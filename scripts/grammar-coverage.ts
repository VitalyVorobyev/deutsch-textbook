/**
 * Grammar coverage report (dev tool, not part of the validate gate).
 *
 * The measurement lives in src/lib/grammar-coverage.ts so that anything which
 * publishes the figure and this report can never disagree — the same split the
 * Wortliste coverage uses.
 *
 * Usage:
 *   bun scripts/grammar-coverage.ts [A1|A2|B1] [--missing-only]
 */
import { grammarCoverage } from '../src/lib/grammar-coverage';
import type { Level } from '../src/lib/schemas';

const args = process.argv.slice(2);
const missingOnly = args.includes('--missing-only');
const requested = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase() as Level);
const levels: Level[] = requested.length ? requested : ['A1', 'A2'];

const MARK: Record<string, string> = { covered: '✓', late: '~', missing: '✗' };

let anyMissing = false;
for (const level of levels) {
  const coverage = grammarCoverage(level);
  console.log(`\n## ${level} grammar — ${coverage.covered + coverage.late}/${coverage.total} (${coverage.percent}%)`);
  console.log(
    `   ${coverage.covered} covered · ${coverage.late} taught late · ${coverage.missing} missing\n`,
  );

  for (const result of coverage.points) {
    if (missingOnly && result.status !== 'missing') continue;
    const mark = MARK[result.status];
    const where =
      result.status === 'late'
        ? `  → taught at ${result.taughtAt}`
        : result.unmetTags.length
          ? `  → no practice/drill item carries: ${result.unmetTags.join(', ')}`
          : '';
    console.log(`${mark} ${result.point.id.padEnd(26)} ${result.point.de}${where}`);
    if (result.point.note && result.status !== 'covered') console.log(`    note: ${result.point.note}`);
  }
  if (coverage.missing) anyMissing = true;
}

console.log(
  anyMissing
    ? '\nMissing points are structures the level\'s standard expects and no practice or drill item teaches.\n'
    : '\nEvery point in the inventory is taught.\n',
);
