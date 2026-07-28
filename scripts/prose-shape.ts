/**
 * How the explanation prose is shaped, in paragraphs and sentences.
 *
 * Written for the same reason as scripts/lang-cost.ts: every figure about prose
 * in docs/article-prose.md and CLAUDE.md has to be reproducible by one paste,
 * and writing the command forces the author to have run it. The measurement
 * that produced the rule — A1/A2 max 107 words per paragraph, B1.4 at 397 —
 * came from this script.
 *
 * Usage:
 *   bun scripts/prose-shape.ts content/topics/b1/meinung-medien.mdx
 *   bun scripts/prose-shape.ts content/topics/b1        # a directory walks its .mdx files
 *   bun scripts/prose-shape.ts content/topics --worst   # one line per file, biggest first
 *
 * Counting method, stated so the numbers mean something:
 *  - a paragraph is a blank-line-separated chunk INSIDE one `<En>/<Ru>/<Uk>/<De>`
 *    block, with table rows, list items, blockquotes, headings and bare MDX
 *    elements dropped first (src/lib/prose-shape.ts) — German tables and example
 *    blockquotes live outside the halves and are not prose the reader wades through;
 *  - a "word" is a whitespace-separated token containing at least one letter or
 *    digit, the same rule scripts/lang-cost.ts uses;
 *  - `>30w` is the share of sentences over 30 words. Sentence splitting is
 *    approximate — German examples sit inside the prose in italics and can hide a
 *    boundary — so it is a shape signal, never a figure to quote on its own.
 *
 * The gate is `max`: `bun run validate` fails any paragraph over
 * MAX_PARAGRAPH_WORDS. mean and p90 are for authoring judgement, not enforced —
 * a word count is a tripwire, never a target (docs/article-prose.md).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAX_PARAGRAPH_WORDS,
  PROSE_LANGS,
  proseShapeStats,
  type ProseLang,
} from '../src/lib/prose-shape.ts';

const args = process.argv.slice(2);
const worstOnly = args.includes('--worst');
const paths = args.filter((a) => !a.startsWith('--'));

if (paths.length === 0) {
  process.stderr.write('Usage: bun scripts/prose-shape.ts <file.mdx|directory> [...] [--worst]\n');
  process.exit(1);
}

/** A directory contributes every .mdx below it, so `content/topics` is one argument. */
function expand(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? expand(join(path, entry.name))
      : entry.name.endsWith('.mdx')
        ? [join(path, entry.name)]
        : [],
  );
}

const files = paths.flatMap(expand).sort();
const rows = files.map((file) => ({ file, stats: proseShapeStats(readFileSync(file, 'utf8')) }));

const pct = (share: number) => `${Math.round(share * 100)}%`;
const worstOf = (stats: Partial<Record<ProseLang, { max: number }>>) =>
  Math.max(0, ...PROSE_LANGS.map((lang) => stats[lang]?.max ?? 0));

if (worstOnly) {
  const lines = rows
    .map((row) => ({ ...row, max: worstOf(row.stats) }))
    .sort((a, b) => b.max - a.max)
    .map((row) => `${String(row.max).padStart(5)}w  ${row.max > MAX_PARAGRAPH_WORDS ? '✗' : '·'}  ${row.file}`);
  process.stdout.write(
    [`Longest paragraph per file (cap ${MAX_PARAGRAPH_WORDS}):`, ...lines, ''].join('\n'),
  );
} else {
  const out: string[] = ['| File | half | paras | mean | p90 | max | >30w |', '| --- | --- | ---: | ---: | ---: | ---: | ---: |'];
  for (const { file, stats } of rows) {
    for (const lang of PROSE_LANGS) {
      const s = stats[lang];
      if (!s) continue;
      const over = s.max > MAX_PARAGRAPH_WORDS ? ' ✗' : '';
      out.push(
        `| ${file} | ${lang} | ${s.paragraphs} | ${s.mean.toFixed(1)} | ${s.p90} | ${s.max}${over} | ${pct(s.longSentenceShare)} |`,
      );
    }
  }
  const over = rows.filter((row) => worstOf(row.stats) > MAX_PARAGRAPH_WORDS);
  out.push(
    '',
    `cap = ${MAX_PARAGRAPH_WORDS} words per paragraph per half (validator-enforced); authoring target ≤ 90.`,
    over.length === 0
      ? `All ${rows.length} file(s) are under the cap.`
      : `${over.length} of ${rows.length} file(s) over the cap: ${over.map((row) => row.file).join(', ')}`,
    '',
  );
  process.stdout.write(out.join('\n'));
}
