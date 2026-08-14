/**
 * Structure coverage report (dev tool, not part of the validate gate).
 *
 * The structural twin of `scripts/coverage.ts`: that one asks whether the course teaches every
 * word on the Goethe Wortliste, this one asks whether the course's grammar inventory even
 * *contains* every structure on the Goethe Strukturenliste. Both exist for the same reason — a
 * completeness figure measured against a list nobody checked drifts toward flattery.
 *
 * The measurement lives in `packages/content/src/structures.ts` so this report and `bun run redaktion` can
 * never disagree, the same split the two coverage instruments already use.
 *
 * Usage:
 *   bun scripts/structures.ts [A1|A2|B1] [--unclaimed-only] [--beyond]
 */
import {
  structureCoverage,
  loadStructureSources,
  type EntryResult,
} from '@da/content/structures';
import type { Level } from '@da/schema';

const args = process.argv.slice(2);
const unclaimedOnly = args.includes('--unclaimed-only');
const showBeyond = args.includes('--beyond');
const requested = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase() as Level);
const levels: Level[] = requested.length ? requested : ['A1', 'A2', 'B1'];

const bySection = (rows: EntryResult[]): Map<string, EntryResult[]> => {
  const out = new Map<string, EntryResult[]>();
  for (const r of rows) {
    const head = `${r.sourceId} · ${r.section.de}${r.section.page ? ` (S. ${r.section.page})` : ''}`;
    out.set(head, [...(out.get(head) ?? []), r]);
  }
  return out;
};

let anyUnclaimed = false;
let anyDangling = false;
let anyAnchored = false;

for (const level of levels) {
  const coverage = structureCoverage(level);

  if (!coverage.anchored) {
    console.log(`\n## ${level} structures — no external anchor`);
    console.log(
      '   No file in data/strukturenlisten/ covers this level, so nothing here can be measured.\n' +
        '   That is a missing document, not a missing structure — data/strukturenlisten/README.md\n' +
        '   names which one and what it costs. Rows at this level rest on the coursebook\n' +
        '   progression alone.',
    );
    continue;
  }
  anyAnchored = true;

  console.log(
    `\n## ${level} structures — ${coverage.claimed.length}/${coverage.total} claimed (${coverage.percent}%)`,
  );
  console.log(
    `   ${coverage.unclaimed.length} unclaimed · ${coverage.beyond.length} inventory rows beyond the source`,
  );
  for (const s of coverage.sources)
    console.log(
      `   source: ${s.id} — ${s.title}${s.pages ? `, S. ${s.pages}` : ''}` +
        `${s.status === 'retired' ? '  [RETIRED]' : ''}${s.mode ? `  [${s.mode}]` : ''}`,
    );
  console.log();

  const rows = unclaimedOnly ? coverage.unclaimed : [...coverage.claimed, ...coverage.unclaimed];
  for (const [head, group] of bySection(rows)) {
    console.log(`### ${head}`);
    for (const r of group.sort((a, b) => a.entry.key.localeCompare(b.entry.key))) {
      if (r.claimedBy.length) {
        // A structure produced later than the source expects it is not a gap; it is the
        // reception/production split doing its job, and printing it silently as ✓ would hide the
        // one thing the split exists to make visible.
        const late = r.producedAt && r.producedAt !== level ? ` → produziert ${r.producedAt}` : '';
        console.log(`✓ ${r.entry.de.padEnd(62)} ${r.claimedBy.join(', ')}${late}`);
      } else {
        console.log(`✗ ${r.entry.de.padEnd(62)} — keine Inventarzeile`);
      }
      if (r.entry.specified) console.log(`    (${r.entry.specified} in der Quelle)`);
      if (r.entry.note) console.log(`    note: ${r.entry.note}`);
    }
    console.log();
  }

  if (showBeyond && coverage.beyond.length) {
    console.log(`### beyond — Inventarzeilen ohne Quellenbeleg auf ${level}`);
    console.log(
      '    Legitimate: this course aims at B1 and follows a coursebook progression, so it teaches\n' +
        '    structures Start Deutsch never tested. Listed so the choice is visible, not so it is fixed.',
    );
    for (const p of coverage.beyond) console.log(`  · ${p.id.padEnd(30)} ${p.de}`);
    console.log();
  }

  if (coverage.dangling.length) {
    anyDangling = true;
    console.log('### DANGLING claims — always a defect');
    for (const d of coverage.dangling) console.log(`  ✗ ${d.point} claims "${d.ref}", which no source defines`);
    console.log();
  }

  if (coverage.unclaimed.length) anyUnclaimed = true;
}

// The inventory's side of the picture, printed once: how many rows cite anything at all. It is the
// figure that says whether "anchored" is a property of the file or of a handful of rows in it.
const sources = loadStructureSources();
if (sources.length) {
  const { loadGrammarInventory } = await import('@da/content/grammar-coverage');
  const points = loadGrammarInventory();
  const cited = points.filter((p) => (p.claims ?? []).length).length;
  console.log(
    `\n${cited}/${points.length} inventory rows cite a source entry · ` +
      `${sources.length} source documents, ${sources.reduce((n, s) => n + s.sections.reduce((m, x) => m + x.entries.length, 0), 0)} entries · ` +
      `levels anchored: ${[...new Set(sources.flatMap((s) => s.source.levels))].sort().join(', ')}`,
  );
}

// "nothing unclaimed" and "nothing measurable" print the same zero, and only one of them is good
// news. The distinction is the whole reason `anchored` exists.
console.log(
  !anyAnchored
    ? '\nNo level in this run has an external anchor, so nothing was measured.\n'
    : anyUnclaimed
      ? '\nUnclaimed entries are structures a published standard lists and this course\'s inventory does not contain.\n'
      : '\nEvery source entry is claimed by an inventory row.\n',
);
if (anyDangling) process.exitCode = 1;
