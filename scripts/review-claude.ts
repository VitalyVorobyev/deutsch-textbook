/**
 * `bun run review:claude <file…> --note "<what to look at>"` — hand material files to the owner.
 *
 * Records a `claude-reviewed` row in `data/review-ledger.yaml` for each file, at its current bytes,
 * with the note the owner reads in Redaktion's Prüfen inbox (ADR 0014). A pull request that
 * changes material runs this for every material file it touched, after the last edit: a row
 * records the bytes it was written against, so an edit after it reads as *changed since review*.
 *
 * It never writes `owner-reviewed`; only Redaktion does.
 */
import { relative, resolve } from 'node:path';
import { recordReview } from '@da/content/review-ledger';
import { repoRoot } from '@da/content/repo-root';

const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] : undefined;
const files = args.filter((arg, i) => !arg.startsWith('--') && (noteAt < 0 || i !== noteAt + 1));

if (!note || !files.length) {
  console.error('usage: bun run review:claude <file…> --note "<what the owner should look at>"');
  process.exit(1);
}

const root = repoRoot();
let failed = false;
for (const file of files) {
  const path = relative(root, resolve(process.cwd(), file));
  const result = recordReview(root, {
    file: path,
    state: 'claude-reviewed',
    by: 'Claude Code',
    note,
  });
  if (result.ok) console.log(`  ✓ ${path}  ${result.entry.revision.slice(0, 10)}`);
  else {
    console.error(`  ✗ ${path}: ${result.error}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
