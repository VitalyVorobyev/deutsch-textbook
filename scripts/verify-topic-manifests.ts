#!/usr/bin/env bun
/**
 * Proves the manifest migration moved data rather than changing it.
 *
 * A migration that touches 99 files and 2 100 lines of `atlas.yaml` cannot be reviewed by reading
 * the diff — the diff is the whole corpus. So this re-derives, from the 49 manifests alone, the two
 * artifacts they replaced: every article's old frontmatter, and the old `nodes:` array. Anything
 * that is not byte-for-byte the same value is printed. Silence is the claim.
 *
 * It also diffs each article body against the same commit, because stripping a frontmatter block
 * with a regex is exactly the kind of edit that eats the first line after it.
 *
 *   bun scripts/verify-topic-manifests.ts [<git-ref>]     # default HEAD
 *
 * The codemod that produced the manifests is not kept: it can only ever run once (it throws on a
 * migrated tree), and its output is the diff. This is kept instead, because it is the half that can
 * still be re-run — delete it once the ref it compares against has scrolled out of reach.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as YAML from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const REF = process.argv[2] ?? 'HEAD';

const show = (path: string): string =>
  execFileSync('git', ['show', `${REF}:${path}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Only the shape this script reads back — the schema is `topicManifestSchema`. */
interface Manifest {
  id: string;
  level: string;
  kind: string;
  strand: string;
  group: string;
  title_de: string;
  title_en: string;
  title_ru: string;
  title_uk?: string;
  status: string;
  tags: string[];
  prerequisites: string[];
  deepens: string[];
  related: string[];
  outcomes: unknown[];
  elements: { article: string; pretest?: string; exercises: string[]; reading: string[]; vocab: string[] };
}

const problems: string[] = [];

/** Deep key sort. Map key ORDER is not data — the old nodes wrote `related` before `prerequisites`
    in some entries and after it in others — while array order very much is, so arrays are left
    alone. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)]))
      : v;

const differs = (what: string, before: unknown, after: unknown): void => {
  const a = JSON.stringify(canonical(before), null, 1);
  const b = JSON.stringify(canonical(after), null, 1);
  if (a === b) return;
  const at = a.split('\n').findIndex((line, i) => line !== b.split('\n')[i]);
  problems.push(`${what}\n    before: …${a.split('\n').slice(Math.max(0, at - 1), at + 3).join(' ')}\n    after:  …${b.split('\n').slice(Math.max(0, at - 1), at + 3).join(' ')}`);
};

// --- the old atlas, as it was ------------------------------------------------
const before = YAML.parse(show('content/atlas.yaml')) as {
  groups: unknown[];
  nodes: Record<string, unknown>[];
  units: unknown[];
};
const after = YAML.parse(read('content/atlas.yaml')) as { groups: unknown[]; units: unknown[]; nodes?: unknown };

differs('atlas groups:', before.groups, after.groups);
differs('atlas units:', before.units, after.units);
if (after.nodes) problems.push('atlas.yaml still has a nodes: key');

const oldNodes = new Map(before.nodes.map((n) => [n.id as string, n]));

// --- every manifest, against the two files it replaced ----------------------
const seen = new Set<string>();
for (const level of readdirSync(join(ROOT, 'content/topics'))) {
  for (const name of readdirSync(join(ROOT, 'content/topics', level))) {
    if (!name.endsWith('.topic.yaml')) continue;
    const id = name.replace(/\.topic\.yaml$/, '');
    const m = YAML.parse(read(`content/topics/${level}/${name}`)) as Manifest;
    seen.add(id);

    // 1. the atlas node
    const node = oldNodes.get(id);
    if (!node) {
      problems.push(`${id}: no node in ${REF}`);
    } else {
      differs(`${id} node:`, node, {
        id: m.id,
        level: m.level,
        kind: m.kind,
        strand: m.strand,
        group: m.group,
        ...(node.prerequisites === undefined ? {} : { prerequisites: m.prerequisites }),
        ...(node.deepens === undefined ? {} : { deepens: m.deepens }),
        ...(node.related === undefined ? {} : { related: m.related }),
        outcomes: m.outcomes,
      });
    }

    // 2. the article's frontmatter and body
    const mdx = `content/topics/${level}/${id}.mdx`;
    const src = show(mdx);
    const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?/);
    if (!match) {
      problems.push(`${mdx}: no frontmatter in ${REF}`);
      continue;
    }
    const fm = YAML.parse(match[1]!) as Record<string, unknown>;
    differs(`${id} frontmatter:`, fm, {
      id: m.id,
      title_de: m.title_de,
      title_en: m.title_en,
      title_ru: m.title_ru,
      ...(fm.title_uk === undefined ? {} : { title_uk: m.title_uk }),
      level: m.level,
      kind: m.kind,
      ...(fm.prerequisites === undefined ? {} : { prerequisites: m.prerequisites }),
      ...(fm.vocab === undefined ? {} : { vocab: m.elements.vocab }),
      ...(fm.exercises === undefined ? {} : { exercises: m.elements.exercises }),
      ...(fm.reading === undefined ? {} : { reading: m.elements.reading }),
      ...(fm.pretest === undefined ? {} : { pretest: m.elements.pretest }),
      ...(fm.tags === undefined ? {} : { tags: m.tags }),
      ...(fm.status === undefined ? {} : { status: m.status }),
    });

    const oldBody = src.slice(match[0].length).replace(/^\s*\n/, '');
    if (read(mdx) !== oldBody) problems.push(`${mdx}: body changed, not just the frontmatter`);
    if (m.elements.article !== `${id}.mdx`) problems.push(`${id}: elements.article ≠ ${id}.mdx`);
  }
}

for (const id of oldNodes.keys()) if (!seen.has(id)) problems.push(`${id}: node in ${REF} has no manifest`);

if (problems.length) {
  console.log(`\n${problems.length} difference(s) against ${REF} — this is NOT a relocation:\n`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ ${seen.size} manifests re-derive ${REF}'s atlas nodes and frontmatter exactly; every body is unchanged.\n`);
}
