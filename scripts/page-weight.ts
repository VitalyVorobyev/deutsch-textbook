/**
 * The page-weight gate: fails when any built HTML page exceeds the ceiling.
 *
 * Exists because page weight regrew past its recorded sizes with nothing to notice: the session
 * pages reached 7–18 MB each by inlining the corpus into an island's props, while every gate
 * stayed green. Course content a page needs in bulk is fetched from a shared data file instead
 * (src/lib/corpus-payload.ts, ADR 0022); this holds the line.
 *
 * Usage (after `bun run build`, which CI runs first):
 *   bun scripts/page-weight.ts            # the ten heaviest pages, exit 1 over the ceiling
 *   bun scripts/page-weight.ts --all      # every page
 *
 * The ceiling sits just above the heaviest page at the time it was set (`/progress`, 1.37 MB).
 * Raising it is a decision with a reason in the same commit, never a fix for a red build.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CEILING_BYTES = 1_500_000;
const dist = join(import.meta.dir, '..', 'dist');

function pages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pages(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let files: string[];
try {
  files = pages(dist);
} catch {
  console.error('No dist/ — run `bun run build` first.');
  process.exit(2);
}

const sized = files
  .map((file) => ({ page: relative(dist, file), bytes: statSync(file).size }))
  .sort((a, b) => b.bytes - a.bytes);
const total = sized.reduce((sum, p) => sum + p.bytes, 0);
const mb = (bytes: number) => (bytes / 1e6).toFixed(2).padStart(6);

for (const p of process.argv.includes('--all') ? sized : sized.slice(0, 10)) {
  console.log(`${mb(p.bytes)} MB  ${p.page}`);
}
console.log(`${sized.length} pages, ${mb(total).trim()} MB in total; ceiling ${mb(CEILING_BYTES).trim()} MB per page.`);

const over = sized.filter((p) => p.bytes > CEILING_BYTES);
if (over.length > 0) {
  console.error(`\n${over.length} page(s) over the ceiling:`);
  for (const p of over) console.error(`${mb(p.bytes)} MB  ${p.page}`);
  process.exit(1);
}
