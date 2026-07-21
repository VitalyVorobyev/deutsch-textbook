/**
 * What each explanation half costs, in words.
 *
 * Written because a figure that decides a policy has to be reproducible. The B1 `<De>`
 * pilot's cost ratios went into docs/roadmap.md with neither a command nor a stated
 * counting method — exactly what CLAUDE.md forbids ("a number in prose carries the command
 * that produces it"), and exactly the kind of number that quietly rots once the file it
 * was measured from changes.
 *
 * Usage:
 *   bun scripts/lang-cost.ts content/discovery/b1/sonntagsruhe.mdx
 *   bun scripts/lang-cost.ts content/discovery/a2/*.mdx
 *
 * Counting method, stated so the number means something:
 *  - a "word" is a whitespace-separated token containing at least one letter or digit, so
 *    a stray em dash or bullet is not counted as authoring;
 *  - MDX bodies contribute their `<En>/<Ru>/<Uk>/<De>` blocks to the four halves, and
 *    everything OUTSIDE those blocks to `invariant` — the German article text is written
 *    once whatever explanation languages a file carries, so it belongs to neither the cost
 *    nor the saving;
 *  - frontmatter and YAML files contribute every `en`/`ru`/`uk`/`de` string field, at any
 *    depth. `title_de` is deliberately NOT counted as a German half: it is the German name
 *    of the thing, present in every file regardless (the same distinction hasDeExplanation
 *    draws in src/lib/langcheck.ts).
 *
 * The two ratios answer different questions. `localised` is what authoring four halves
 * costs against two — the honest figure for "should B1 carry uk and de from day one".
 * `overall` folds the invariant German back in, which is what a whole file costs to
 * produce; it is always the smaller number and it is the one to quote when someone asks
 * about total effort rather than about the language policy.
 */
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const LANGS = ['en', 'ru', 'uk', 'de'] as const;
type Lang = (typeof LANGS)[number];
type Counts = Record<Lang | 'invariant', number>;

const empty = (): Counts => ({ en: 0, ru: 0, uk: 0, de: 0, invariant: 0 });

/** Whitespace tokens carrying at least one letter or digit — punctuation alone is not authoring. */
function words(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Every `en`/`ru`/`uk`/`de` string field at any depth. `*_de` keys are excluded on purpose. */
function countFields(node: unknown, into: Counts): void {
  if (Array.isArray(node)) {
    for (const item of node) countFields(item, into);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && (LANGS as readonly string[]).includes(key)) {
      into[key as Lang] += words(value);
    } else {
      countFields(value, into);
    }
  }
}

function countFile(path: string): Counts {
  const source = readFileSync(path, 'utf8');
  const counts = empty();
  if (!path.endsWith('.mdx')) {
    countFields(YAML.parse(source), counts);
    return counts;
  }
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${path}: no frontmatter`);
  countFields(YAML.parse(match[1]!), counts);
  let body = match[2]!;
  for (const lang of LANGS) {
    const tag = lang[0]!.toUpperCase() + lang.slice(1);
    const blocks = body.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')) ?? [];
    for (const block of blocks) counts[lang] += words(block.replace(/<\/?[A-Za-z]+>/g, ''));
    body = body.split(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`)).join(' ');
  }
  counts.invariant += words(body.replace(/<\/?[A-Za-z]+>/g, ''));
  return counts;
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  process.stderr.write('Usage: bun scripts/lang-cost.ts <file.mdx|file.yaml> [...]\n');
  process.exit(1);
}

const total = empty();
const rows: Array<{ path: string; counts: Counts }> = [];
for (const path of paths) {
  const counts = countFile(path);
  rows.push({ path, counts });
  for (const key of Object.keys(total) as Array<keyof Counts>) total[key] += counts[key];
}

const ratio = (a: number, b: number) => (b === 0 ? '—' : `${(a / b).toFixed(2)}x`);
const line = (label: string, c: Counts) => {
  const localised = c.en + c.ru + c.uk + c.de;
  const baseline = c.en + c.ru;
  return (
    `| ${label} | ${c.en} | ${c.ru} | ${c.uk} | ${c.de} | ${c.invariant} | ` +
    `${ratio(localised, baseline)} | ${ratio(localised + c.invariant, baseline + c.invariant)} |`
  );
};

process.stdout.write(
  [
    '| File | en | ru | uk | de | invariant | localised | overall |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => line(row.path, row.counts)),
    ...(rows.length > 1 ? [line('**total**', total)] : []),
    '',
    'localised = (en+ru+uk+de) / (en+ru) — the cost of four halves against two.',
    'overall   = the same with the invariant German folded back in.',
    '',
  ].join('\n'),
);
