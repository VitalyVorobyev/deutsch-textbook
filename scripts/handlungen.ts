#!/usr/bin/env bun
/**
 * Sprachhandlung coverage: does this course's set of learner outcomes contain every communicative
 * function the published standard expects?
 *
 * The sibling of `scripts/structures.ts`, asking the same question of a different claim. That one
 * measures `data/grammar-inventory.yaml` against `data/strukturenlisten/`; this one measures the
 * 179 `outcomes` in `content/atlas.yaml` against `data/handlungslisten/`. Both exist because a
 * completeness figure measured against a list nobody checked drifts toward flattery — and outcomes
 * had no external list at all until 2026-08-14.
 *
 * The two are not substitutes. A course can teach every structure the exam tests and never ask the
 * learner to refuse an offer or say they did not understand; grammar coverage cannot see that by
 * construction.
 *
 *   bun scripts/handlungen.ts [A1|A2|B1] [--unclaimed-only] [--beyond]
 */
import { handlungCoverage, outcomeClaimants } from '@da/content/handlungen';
import type { Level } from '@da/schema';

const args = process.argv.slice(2);
const unclaimedOnly = args.includes('--unclaimed-only');
const showBeyond = args.includes('--beyond');
const requested = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase() as Level);
const levels: Level[] = requested.length ? requested : ['A1', 'A2', 'B1'];

const claimants = outcomeClaimants();
const byId = new Map(claimants.map((c) => [c.id, c]));
let anyDangling = false;

for (const level of levels) {
  const coverage = handlungCoverage(level);

  if (!coverage.anchored) {
    console.log(`\n## ${level} Sprachhandlungen — no external anchor`);
    console.log('   No file in data/handlungslisten/ covers this level, so nothing here can be measured.');
    continue;
  }

  console.log(
    `\n## ${level} Sprachhandlungen — ${coverage.claimed.length}/${coverage.total} claimed (${coverage.percent}%)`,
  );
  console.log(
    `   ${coverage.unclaimed.length} unclaimed · ${coverage.beyond.length} outcomes beyond the source`,
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
    const head = `${r.sourceId} · ${r.section.de}${r.section.page ? ` (S. ${r.section.page})` : ''}`;
    sections.set(head, [...(sections.get(head) ?? []), r]);
  }
  for (const [head, group] of sections) {
    console.log(`### ${head}`);
    for (const r of group.sort((a, b) => a.entry.key.localeCompare(b.entry.key))) {
      if (r.claimedBy.length) {
        // The topic is printed, not just the outcome id: "which unit delivers this function" is
        // the question an editor actually has, and an outcome id alone does not answer it.
        const where = r.claimedBy.map((id) => `${byId.get(id)?.topic ?? '?'}/${id}`).join(', ');
        console.log(`✓ ${r.entry.de.padEnd(58)} ${where}`);
      } else {
        console.log(`✗ ${r.entry.de.padEnd(58)} — kein Lernziel`);
      }
      if (r.entry.specified) console.log(`    (${r.entry.specified} in der Quelle)`);
    }
    console.log();
  }

  if (showBeyond && coverage.beyond.length) {
    console.log(`### beyond — Lernziele ohne Quellenbeleg auf ${level}`);
    console.log(
      '    Expected, not a defect: the DTZ list is scoped to one exam and most outcomes here are\n' +
        '    grammatical rather than communicative. Listed so the split is visible.',
    );
    for (const c of coverage.beyond) console.log(`  · ${c.id.padEnd(38)} ${c.label ?? ''}`);
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
console.log(`\n${cited}/${claimants.length} outcomes cite a published Sprachhandlung.\n`);
if (anyDangling) process.exitCode = 1;
