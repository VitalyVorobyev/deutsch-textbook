/**
 * Grammar depth report (dev tool, not part of the validate gate).
 *
 * `grammar-coverage.ts` says whether a structure is in the course; this says how much practice
 * stands behind it. Both are needed and neither substitutes for the other — for months all three
 * levels published the same 100% while median practice per confusion fell from twelve items to
 * four across them.
 *
 * The measurement lives in `src/lib/grammar-depth.ts` so this report and `bun run redaktion`
 * cannot disagree — the split every instrument here uses.
 *
 * Deliberately NO threshold: every row is read against the level median printed under its table,
 * exactly like `scripts/comprehensibility.ts`. The ratchet lives in `tests/grammar-depth.test.ts`
 * and pins measured reality, not an invented bar.
 *
 * Usage:
 *   bun scripts/grammar-depth.ts [A1|A2|B1] [--thin] [--by-point] [--no-probe]
 */
import { levelDepth, type TagDepth } from '../src/lib/grammar-depth';
import type { Level } from '@da/schema';

const args = process.argv.slice(2);
const thinOnly = args.includes('--thin');
const byPoint = args.includes('--by-point');
const noProbeOnly = args.includes('--no-probe');
const requested = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase() as Level);
const levels: Level[] = requested.length ? requested : ['A1', 'A2', 'B1'];

const num = (n: number, w = 5) => String(n).padStart(w);
const flag = (t: TagDepth, m: { teaching: number; production: number; files: number }) =>
  [
    t.teaching < m.teaching ? 'items' : '',
    t.production < m.production ? 'prod' : '',
    t.files === 1 ? '1 file' : '',
    t.probe === 0 ? 'no probe' : '',
  ]
    .filter(Boolean)
    .join(' · ');

for (const level of levels) {
  const d = levelDepth(level);
  console.log(`\n## ${level} depth — ${d.tags.length} confusions, ${d.points.length} structures`);
  console.log(
    `   median per confusion: ${d.medianTeaching} teaching items · ${d.medianProduction} production · ${d.medianFiles} practice files`,
  );
  console.log(
    `   ${d.thinTags} tags at ≤3 items · ${d.singleFileTags} tags in a single file · ${d.pointsWithoutProbe} structures with no probe\n`,
  );

  if (byPoint) {
    console.log('   structure                      items  prod  probe  chkpt  thinnest tag');
    for (const p of [...d.points].sort((a, b) => a.teaching - b.teaching)) {
      if (thinOnly && p.teaching > d.medianTeaching) continue;
      if (noProbeOnly && p.probe > 0) continue;
      console.log(
        `   ${p.point.id.padEnd(30)}${num(p.teaching)}${num(p.production)}${num(p.probe)}${num(p.checkpoint)}  ` +
          `${p.thinnest ? `${p.thinnest.tag} (${p.thinnest.teaching})` : '—'}`,
      );
    }
    console.log();
    continue;
  }

  const m = { teaching: d.medianTeaching, production: d.medianProduction, files: d.medianFiles };
  console.log('   confusion                      items  prod  sel  files  probe  chkpt  · below median / unseen');
  for (const t of [...d.tags].sort((a, b) => a.teaching - b.teaching || a.tag.localeCompare(b.tag))) {
    if (thinOnly && t.teaching > d.medianTeaching) continue;
    if (noProbeOnly && t.probe > 0) continue;
    console.log(
      `   ${t.tag.padEnd(30)}${num(t.teaching)}${num(t.production)}${num(t.selection, 4)}${num(t.files, 6)}${num(t.probe, 7)}${num(t.checkpoint, 7)}  ${flag(t, m)}`,
    );
  }
  console.log();
}

console.log(
  'No threshold: every row is read against its level median above, never against zero.\n' +
    'Outliers are the product. The ratchet is tests/grammar-depth.test.ts.\n',
);
