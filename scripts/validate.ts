/**
 * Content validation beyond Astro's schema check. Run with: npm run validate
 *
 * Checks: schema conformance, id/filename/level consistency, reference resolution
 * (prerequisites, vocab, exercises, reading, pretest), exercise answer-key sanity,
 * reading gloss markup, prerequisite cycles, and atlas.yaml consistency with
 * topic frontmatter.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import {
  atlasSchema,
  exerciseSetSchema,
  readingSchema,
  topicSchema,
  vocabFileSchema,
  type ExerciseSet,
  type Reading,
  type Topic,
  type VocabFile,
} from '../src/lib/schemas';
import { clozeGaps, normalizeTranslation } from '../src/lib/cloze';
import { parseGlosses } from '../src/lib/gloss';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');

const errors: string[] = [];
const warnings: string[] = [];
const fail = (file: string, msg: string) => errors.push(`${file}: ${msg}`);
const warn = (file: string, msg: string) => warnings.push(`${file}: ${msg}`);

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));
}

function parseFrontmatter(src: string, file: string): unknown {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) {
    fail(file, 'missing frontmatter block');
    return undefined;
  }
  try {
    return YAML.parse(m[1]!);
  } catch (e) {
    fail(file, `frontmatter YAML parse error: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}

function validateWith<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  file: string,
): z.output<S> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      fail(file, `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

const rel = (f: string) => relative(ROOT, f);

// ---------------------------------------------------------------------------
// Load everything
// ---------------------------------------------------------------------------

const topics = new Map<string, { file: string; data: Topic }>();
for (const file of listFiles(join(CONTENT, 'topics'), '.mdx')) {
  const raw = parseFrontmatter(readFileSync(file, 'utf8'), rel(file));
  if (raw === undefined) continue;
  const data = validateWith(topicSchema, raw, rel(file));
  if (!data) continue;

  const parts = relative(join(CONTENT, 'topics'), file).split(sep);
  const basename = parts.at(-1)!.replace(/\.mdx$/, '');
  const levelDir = parts.length > 1 ? parts[0]! : '';
  if (data.id !== basename) fail(rel(file), `frontmatter id "${data.id}" ≠ filename "${basename}"`);
  if (levelDir.toUpperCase() !== data.level)
    fail(rel(file), `level directory "${levelDir}" ≠ frontmatter level "${data.level}"`);
  if (topics.has(data.id)) fail(rel(file), `duplicate topic id "${data.id}"`);
  topics.set(data.id, { file: rel(file), data });
}

const vocabFiles = new Map<string, { file: string; data: VocabFile }>();
for (const file of listFiles(join(CONTENT, 'vocab'), '.yaml')) {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(rel(file), `YAML parse error: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const data = validateWith(vocabFileSchema, raw, rel(file));
  if (!data) continue;
  const basename = relative(join(CONTENT, 'vocab'), file).replace(/\.yaml$/, '');
  if (data.id !== basename) fail(rel(file), `id "${data.id}" ≠ filename "${basename}"`);
  if (vocabFiles.has(data.id)) fail(rel(file), `duplicate vocab id "${data.id}"`);
  vocabFiles.set(data.id, { file: rel(file), data });

  const seen = new Set<string>();
  for (const e of data.entries) {
    if (seen.has(e.de)) fail(rel(file), `duplicate entry "${e.de}" (card ids must be unique)`);
    seen.add(e.de);
  }
}

const exerciseSets = new Map<string, { file: string; data: ExerciseSet }>();
for (const file of listFiles(join(CONTENT, 'exercises'), '.yaml')) {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(rel(file), `YAML parse error: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const data = validateWith(exerciseSetSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'exercises'), file).split(sep).join('/').replace(/\.yaml$/, '');
  exerciseSets.set(id, { file: rel(file), data });
}

const readings = new Map<string, { file: string; data: Reading }>();
for (const file of listFiles(join(CONTENT, 'reading'), '.yaml')) {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(rel(file), `YAML parse error: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const data = validateWith(readingSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'reading'), file).split(sep).join('/').replace(/\.yaml$/, '');
  readings.set(id, { file: rel(file), data });
}

// ---------------------------------------------------------------------------
// Cross-checks
// ---------------------------------------------------------------------------

for (const [id, { file, data }] of topics) {
  for (const p of data.prerequisites) {
    if (!topics.has(p)) fail(file, `prerequisite "${p}" does not resolve to a topic`);
    if (p === id) fail(file, `topic lists itself as a prerequisite`);
  }
  for (const v of data.vocab) {
    if (!vocabFiles.has(v)) fail(file, `vocab ref "${v}" does not resolve to content/vocab/${v}.yaml`);
  }
  for (const ex of data.exercises) {
    if (!exerciseSets.has(ex)) fail(file, `exercise ref "${ex}" does not resolve to content/exercises/${ex}.yaml`);
  }
  for (const r of data.reading) {
    if (!readings.has(r)) fail(file, `reading ref "${r}" does not resolve to content/reading/${r}.yaml`);
  }
  if (data.pretest !== undefined) {
    const pre = exerciseSets.get(data.pretest);
    if (!pre) {
      fail(file, `pretest ref "${data.pretest}" does not resolve to content/exercises/${data.pretest}.yaml`);
    } else if (pre.data.topic !== id) {
      fail(file, `pretest set "${data.pretest}" has topic backref "${pre.data.topic}", expected "${id}"`);
    }
    if (data.exercises.includes(data.pretest))
      fail(file, `pretest set "${data.pretest}" must not also be listed in exercises`);
  }
}

for (const [setId, { file, data }] of exerciseSets) {
  const owner = topics.get(data.topic);
  if (!owner) {
    fail(file, `topic backref "${data.topic}" does not resolve`);
  } else if (!owner.data.exercises.includes(setId) && owner.data.pretest !== setId) {
    fail(file, `topic "${data.topic}" does not list this set ("${setId}") in its exercises or as its pretest`);
  }

  const itemIds = new Set<string>();
  for (const item of data.items) {
    const where = `${file} → item "${item.id}"`;
    if (itemIds.has(item.id)) fail(where, 'duplicate item id within set');
    itemIds.add(item.id);

    switch (item.type) {
      case 'mc': {
        if (item.correct >= item.options.length)
          fail(where, `correct index ${item.correct} out of range (${item.options.length} options)`);
        if (new Set(item.options).size !== item.options.length) fail(where, 'duplicate options');
        break;
      }
      case 'cloze': {
        const gaps = clozeGaps(item.text);
        if (gaps.length === 0) fail(where, 'cloze text contains no {{gaps}}');
        if (gaps.some((g) => g.length === 0)) fail(where, 'cloze gap with no answers');
        if (/\{\{|\}\}/.test(item.text.replace(/\{\{[^{}]+\}\}/g, '')))
          fail(where, 'unbalanced {{ }} braces in cloze text');
        break;
      }
      case 'match': {
        const lefts = item.pairs.map((p) => p.left);
        const rights = item.pairs.map((p) => p.right);
        if (new Set(lefts).size !== lefts.length) fail(where, 'duplicate left values');
        if (new Set(rights).size !== rights.length) fail(where, 'duplicate right values');
        break;
      }
      case 'order': {
        if (item.words.length < 3) warn(where, 'order item with fewer than 3 tokens is trivial');
        break;
      }
      case 'translate': {
        if (item.answer.trim().length === 0) fail(where, 'translate answer is empty');
        const canonical = normalizeTranslation(item.answer);
        const seen = new Set<string>();
        for (const a of item.accept) {
          const n = normalizeTranslation(a);
          if (n === canonical) fail(where, `accept entry "${a}" duplicates the canonical answer`);
          if (seen.has(n)) fail(where, `duplicate accept entry "${a}"`);
          seen.add(n);
        }
        break;
      }
      case 'table': {
        let asked = 0;
        for (const row of item.rows) {
          if (row.cells.length !== item.columns.length)
            fail(where, `row "${row.label}" has ${row.cells.length} cells, expected ${item.columns.length}`);
          asked += row.cells.filter((c) => !c.given).length;
        }
        if (asked === 0) fail(where, 'table has no cells to fill in');
        break;
      }
    }
    if (!item.explain) warn(where, 'no explain text (feedback on wrong answers will be thin)');
  }
}

// Reading texts: backrefs, gloss markup, question sanity
for (const [readingId, { file, data }] of readings) {
  const owner = topics.get(data.topic);
  if (!owner) {
    fail(file, `topic backref "${data.topic}" does not resolve`);
  } else if (!owner.data.reading.includes(readingId)) {
    fail(file, `topic "${data.topic}" does not list this reading ("${readingId}") in its reading refs`);
  }

  let glossCount = 0;
  data.text.forEach((para, i) => {
    const { segments, errors: glossErrors } = parseGlosses(para);
    for (const e of glossErrors) fail(`${file} → paragraph ${i + 1}`, e);
    glossCount += segments.filter((s) => s.kind === 'gloss').length;
  });
  if (glossCount === 0)
    warn(file, 'reading has no [[gloss::…::…]] markers — add a few for comprehensible input');

  const qIds = new Set<string>();
  for (const q of data.questions) {
    const where = `${file} → question "${q.id}"`;
    if (qIds.has(q.id)) fail(where, 'duplicate question id within reading');
    qIds.add(q.id);
    if (q.correct >= q.options.length)
      fail(where, `correct index ${q.correct} out of range (${q.options.length} options)`);
    if (new Set(q.options).size !== q.options.length) fail(where, 'duplicate options');
    if (!q.explain) warn(where, 'no explain text (feedback on wrong answers will be thin)');
  }
}

// Orphan exercise sets (not referenced by any topic)
for (const [setId, { file }] of exerciseSets) {
  const referenced = [...topics.values()].some(
    (t) => t.data.exercises.includes(setId) || t.data.pretest === setId,
  );
  if (!referenced) warn(file, 'exercise set is not embedded on any topic page');
}

// Prerequisite cycles (DFS)
{
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      errors.push(`prerequisite cycle: ${[...path, id].join(' → ')}`);
      return;
    }
    visiting.add(id);
    for (const p of topics.get(id)?.data.prerequisites ?? []) {
      if (topics.has(p)) visit(p, [...path, id]);
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const id of topics.keys()) visit(id, []);
}

// Atlas consistency
{
  const atlasFile = join(CONTENT, 'atlas.yaml');
  if (!existsSync(atlasFile)) {
    fail('content/atlas.yaml', 'missing');
  } else {
    const raw = YAML.parse(readFileSync(atlasFile, 'utf8'));
    const atlas = validateWith(atlasSchema, raw, 'content/atlas.yaml');
    if (atlas) {
      const nodeIds = new Set(atlas.nodes.map((n) => n.id));
      for (const id of topics.keys()) {
        if (!nodeIds.has(id)) fail('content/atlas.yaml', `topic "${id}" missing from atlas`);
      }
      for (const node of atlas.nodes) {
        const t = topics.get(node.id);
        if (!t) {
          fail('content/atlas.yaml', `node "${node.id}" has no topic file`);
          continue;
        }
        if (node.level !== t.data.level)
          fail('content/atlas.yaml', `node "${node.id}" level ${node.level} ≠ topic level ${t.data.level}`);
        if (node.kind !== t.data.kind)
          fail('content/atlas.yaml', `node "${node.id}" kind ${node.kind} ≠ topic kind ${t.data.kind}`);
        const a = [...node.prerequisites].sort().join(',');
        const b = [...t.data.prerequisites].sort().join(',');
        if (a !== b) fail('content/atlas.yaml', `node "${node.id}" prerequisites ≠ topic frontmatter`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(
  `Validated ${topics.size} topics, ${vocabFiles.size} vocab files, ${exerciseSets.size} exercise sets, ${readings.size} reading texts.`,
);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('✓ content is valid');
