#!/usr/bin/env bun
/**
 * Theme coverage: is this course *about* the things an adult building a life in Germany needs to
 * talk about?
 *
 * The third sibling of `scripts/structures.ts` and `scripts/handlungen.ts`, and the one that asks
 * the question the other two cannot. Grammar coverage measures what the course teaches;
 * Sprachhandlung coverage measures what it lets the learner do. Neither can see that a course has
 * never mentioned Versicherungen, Polizei or Kinderbetreuung.
 *
 *   bun scripts/themen.ts [A1|A2|B1] [--unclaimed-only] [--beyond]
 */
import { themaCoverage, topicClaimants } from '@da/content/themen';
import type { Level } from '@da/schema';

const args = process.argv.slice(2);
const unclaimedOnly = args.includes('--unclaimed-only');
const showBeyond = args.includes('--beyond');
const requested = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase() as Level);
const levels: Level[] = requested.length ? requested : ['A1', 'A2', 'B1'];

const claimants = topicClaimants();
const byId = new Map(claimants.map((c) => [c.id, c]));
let anyDangling = false;

for (const level of levels) {
  const coverage = themaCoverage(level);

  if (!coverage.anchored) {
    console.log(`\n## ${level} Themen — no external anchor`);
    console.log('   No file in data/themenlisten/ covers this level, so nothing here can be measured.');
    continue;
  }

  console.log(
    `\n## ${level} Themen — ${coverage.claimed.length}/${coverage.total} claimed (${coverage.percent}%)`,
  );
  console.log(
    `   ${coverage.unclaimed.length} unclaimed · ${coverage.beyond.length} topics beyond the source`,
  );
  for (const s of coverage.sources)
    console.log(
      `   source: ${s.id} — ${s.title}${s.pages ? `, S. ${s.pages}` : ''}` +
        `${s.audience ? `  [${s.audience}]` : ''}${s.mode ? `  [${s.mode}]` : ''}` +
        `${s.cumulative ? '  [kumulativ A2–B1]' : ''}`,
    );
  console.log();

  const rows = unclaimedOnly ? coverage.unclaimed : [...coverage.claimed, ...coverage.unclaimed];
  const sections = new Map<string, typeof rows>();
  for (const r of rows) {
    const head = `${r.section.de}${r.section.page ? ` (S. ${r.section.page})` : ''}`;
    sections.set(head, [...(sections.get(head) ?? []), r]);
  }
  for (const [head, group] of sections) {
    console.log(`### ${head}`);
    // The source's own pairing, printed because it is what an editor is actually looking for:
    // "which Handlungsfeld is this theme the language of".
    const feld = group[0]?.section.handlungsfelder;
    if (feld) console.log(`    ↔ Handlungsfeld: ${feld}`);
    if (group[0]?.section.note) console.log(`    ⚑ ${group[0].section.note}`);
    for (const r of group.sort((a, b) => a.entry.key.localeCompare(b.entry.key))) {
      if (r.claimedBy.length) {
        const where = r.claimedBy.map((id) => `${byId.get(id)?.manifest.level}/${id}`).join(', ');
        console.log(`✓ ${r.entry.de.padEnd(46)} ${where}`);
      } else {
        console.log(`✗ ${r.entry.de.padEnd(46)} — kein Thema`);
      }
    }
    console.log();
  }

  if (showBeyond && coverage.beyond.length) {
    console.log(`### beyond — Themen ohne Quellenbeleg auf ${level}`);
    console.log(
      '    Expected, not a defect: most of these are grammar topics, and "Der Akkusativ" is about\n' +
        '    the accusative, not about a slice of life. Listed so the split is visible.',
    );
    for (const c of coverage.beyond) console.log(`  · ${c.id.padEnd(34)} ${c.label ?? ''}`);
    console.log();
  }

  if (coverage.dangling.length) {
    anyDangling = true;
    console.log('### DANGLING claims — always a defect');
    for (const d of coverage.dangling)
      console.log(`  ✗ ${d.claimant} claims "${d.ref}", which no source defines`);
    console.log();
  }
}

const cited = claimants.filter((c) => (c.claims ?? []).length).length;
console.log(`\n${cited}/${claimants.length} topics cite a published Thema.\n`);
if (anyDangling) process.exitCode = 1;
