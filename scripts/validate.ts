/**
 * Content validation beyond Astro's schema check. Run with: bun run validate
 *
 * Checks: schema conformance, id/filename/level consistency, reference resolution
 * (prerequisites, vocab, exercises, reading, pretest), exercise answer-key sanity,
 * reading gloss markup, prerequisite cycles, atlas.yaml consistency with topic
 * frontmatter, and language discipline (letter-set purity and uk/de parity —
 * src/lib/langcheck.ts).
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
  visualDocumentSchema,
  wordFieldSchema,
  wortnetzSchema,
  discoverySchema,
  referenceDataSchema,
  type ReferenceData,
  type Discovery,
  type ExerciseSet,
  type Reading,
  type Topic,
  type VocabEntry,
  type VocabFile,
  type VisualDocument,
  type WordField,
  type Wortnetz,
  LEVELS,
} from '../src/lib/schemas';
import type { GrammarPoint } from '../src/lib/grammar-coverage';
import { clozeGaps, normalizeDictation, normalizeTranslation } from '../src/lib/cloze';
import { glossFieldParity, parseGlosses } from '../src/lib/gloss';
import {
  deParityProblems,
  hasUkField,
  langFieldProblems,
  mdxLangProblems,
  ukParityProblems,
} from '../src/lib/langcheck';
import { goetheCoverage, hasManifest, MEASURED_LEVELS } from '../src/lib/coverage';
import {
  checkGradingDecisions,
  GRADING_DECISIONS_FILE,
  loadGradingDecisions,
} from '../src/lib/grading-decisions';
import { wortnetzCardRefProblems } from '../src/lib/wortnetze';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');

const errors: string[] = [];
const warnings: string[] = [];

/** Share of a topic's practice items that may be mc/match/order (see the item-mix check). */
const MAX_SELECTION_PERCENT = 45;
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

const topics = new Map<string, { file: string; data: Topic; body: string }>();
for (const file of listFiles(join(CONTENT, 'topics'), '.mdx')) {
  const src = readFileSync(file, 'utf8');
  const raw = parseFrontmatter(src, rel(file));
  if (raw === undefined) continue;
  const data = validateWith(topicSchema, raw, rel(file));
  if (!data) continue;
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '');

  const parts = relative(join(CONTENT, 'topics'), file).split(sep);
  const basename = parts.at(-1)!.replace(/\.mdx$/, '');
  const levelDir = parts.length > 1 ? parts[0]! : '';
  if (data.id !== basename) fail(rel(file), `frontmatter id "${data.id}" ≠ filename "${basename}"`);
  if (levelDir.toUpperCase() !== data.level)
    fail(rel(file), `level directory "${levelDir}" ≠ frontmatter level "${data.level}"`);
  if (topics.has(data.id)) fail(rel(file), `duplicate topic id "${data.id}"`);
  topics.set(data.id, { file: rel(file), data, body });
}

/**
 * Soft Lautschrift oracles. The hard rules (charset, stress, the ɡ/ʁ look-alike
 * traps, mark placement) live in `ipaProblems` in the schema, so `bun run build`
 * enforces them too; these are the heuristics that are useful but too fuzzy to
 * make a schema error.
 */
function checkIpa(where: string, e: VocabEntry): void {
  const at = `${where} → "${e.de}"`;
  if (!e.ipa) {
    // the schema requires ipa on everything but phrases; nudge the short ones
    if (e.pos === 'phrase' && e.de.split(/\s+/).length <= 3)
      warn(at, 'short phrase without ipa — worth transcribing');
    return;
  }
  // ä/ö/ü only; ß would false-positive on Fuß → ˈfuːs
  if (/[äöü]/i.test(e.de) && !/[ɛøœyʏ]/.test(e.ipa))
    warn(at, 'headword has an umlaut but its ipa has no front-rounded/ɛ vowel — check it');
  if (e.de.split(/\s+/).length !== e.ipa.split(/\s+/).length)
    warn(at, 'de and ipa disagree on word count');
}

// A reflexive verb's form fields must carry `sich`, because both consumers
// *compose* a claim out of them: the flashcard back (`deDetail` in
// src/lib/srs.ts) and the Verbformen reference page both render
// `hat ${partizip2}`. A bare participle there does not merely omit the
// pronoun — it teaches `hat gefreut`, and it collapses the minimal pairs the
// decks are built on (`treffen`/`sich treffen`, `anziehen`/`sich anziehen`
// otherwise print the same Perfekt). Reflexivity counts as declared when the
// headword carries `sich` or the valence leads with it; a verb whose valence
// offers both readings ("+ Akk / sich") is genuinely dual and stays bare.
function checkReflexiveForms(where: string, e: VocabEntry): void {
  if (e.pos !== 'verb') return;
  const declared = /^sich\s/.test(e.de) || /^sich\b/.test(e.valence ?? '');
  if (!declared) return;
  for (const [field, value] of [
    ['praesens_3sg', e.praesens_3sg],
    ['partizip2', e.partizip2],
  ] as const) {
    if (value && !/\bsich\b/.test(value))
      fail(
        `${where} → "${e.de}"`,
        `reflexive verb but ${field} "${value}" has no "sich" — the flashcard and Verbformen compose it into a form the learner is meant to produce`,
      );
  }
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
    checkIpa(rel(file), e);
    checkReflexiveForms(rel(file), e);
  }
}

// Every headword lives in exactly one deck: a duplicate means the learner
// grinds two SRS histories for one word and coverage counts it twice. The
// allowlist freezes the five pairs that predate the rule — card identity is
// <file-id>::<de>::<direction>, so consolidating them now would wipe history.
const LEGACY_DUPLICATE_PAIRS: Record<string, string> = {
  wohnen: 'erste-schritte+kernwortschatz-a2',
  kommen: 'erste-schritte+perfekt-verben',
  sprechen: 'erste-schritte+perfekt-verben',
  Arzt: 'menschen-familie+termine-zeit',
  Ärztin: 'menschen-familie+termine-zeit',
};
{
  const decksOf = new Map<string, string[]>();
  for (const [id, { data }] of vocabFiles) {
    for (const e of data.entries) decksOf.set(e.de, [...(decksOf.get(e.de) ?? []), id]);
  }
  for (const [de, decks] of decksOf) {
    if (decks.length < 2) continue;
    if (LEGACY_DUPLICATE_PAIRS[de] === [...decks].sort().join('+')) continue;
    fail(
      `content/vocab/${decks[decks.length - 1]}.yaml`,
      `headword "${de}" already exists in ${decks
        .slice(0, -1)
        .map((d) => `content/vocab/${d}.yaml`)
        .join(', ')} — every headword lives in exactly one deck`,
    );
  }
}

// The grammar inventory is the structural counterpart to the Wortliste: it is
// what makes "this level is complete" a measured claim instead of an asserted
// one. It cannot be checked against the focus taxonomy — a point whose tag is
// unregistered is the normal way an unwritten structure shows up — so what is
// enforced here is only that the file itself stays trustworthy: unique ids,
// real levels, and reference-only points that name a topic which exists.
{
  const file = join(ROOT, 'data', 'grammar-inventory.yaml');
  try {
    const points = (YAML.parse(readFileSync(file, 'utf8')) as { points?: GrammarPoint[] }).points ?? [];
    const seen = new Set<string>();
    for (const point of points) {
      if (seen.has(point.id)) fail('data/grammar-inventory.yaml', `duplicate point id "${point.id}"`);
      seen.add(point.id);
      if (!(LEVELS as readonly string[]).includes(point.standard_level))
        fail('data/grammar-inventory.yaml', `point "${point.id}" has unknown standard_level "${point.standard_level}"`);
      if (!point.reference_only && !point.focus?.length)
        fail(
          'data/grammar-inventory.yaml',
          `point "${point.id}" declares neither focus tags nor reference_only — nothing could ever mark it taught`,
        );
      // reference_only is the escape hatch for knowledge that names no
      // confusion, and `taught_in` is the price of using it. Without one the
      // point would be asserted rather than earned — the exact failure mode
      // the inventory was built to end.
      if (point.reference_only && !point.taught_in?.length)
        fail(
          'data/grammar-inventory.yaml',
          `point "${point.id}" is reference_only but names no taught_in topic — the escape hatch still has to be paid for`,
        );
      for (const topic of point.taught_in ?? [])
        if (!topics.has(topic))
          fail('data/grammar-inventory.yaml', `point "${point.id}" is taught_in unknown topic "${topic}"`);
    }
  } catch (e) {
    fail('data/grammar-inventory.yaml', `unreadable: ${e instanceof Error ? e.message : e}`);
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

const documents = new Map<string, { file: string; data: VisualDocument }>();
for (const file of listFiles(join(CONTENT, 'documents'), '.yaml')) {
  const raw = YAML.parse(readFileSync(file, 'utf8')) as unknown;
  const data = validateWith(visualDocumentSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'documents'), file).split(sep).join('/').replace(/\.yaml$/, '');
  documents.set(id, { file: rel(file), data });
  if (!existsSync(join(ROOT, 'public', data.asset.replace(/^\//, ''))))
    fail(rel(file), `asset "${data.asset}" does not exist under public/`);
}

const wordFields = new Map<string, { file: string; data: WordField }>();
for (const file of listFiles(join(CONTENT, 'wortfelder'), '.yaml')) {
  const raw = YAML.parse(readFileSync(file, 'utf8')) as unknown;
  const data = validateWith(wordFieldSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'wortfelder'), file).split(sep).join('/').replace(/\.yaml$/, '');
  if (data.id !== id) fail(rel(file), `id "${data.id}" ≠ filename "${id}"`);
  wordFields.set(id, { file: rel(file), data });
}

const wortnetze = new Map<string, { file: string; data: Wortnetz }>();
for (const file of listFiles(join(CONTENT, 'wortnetze'), '.yaml')) {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(rel(file), `YAML parse error: ${error instanceof Error ? error.message : error}`);
    continue;
  }
  const data = validateWith(wortnetzSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'wortnetze'), file).split(sep).join('/').replace(/\.yaml$/, '');
  if (data.id !== id) fail(rel(file), `id "${data.id}" ≠ filename "${id}"`);
  wortnetze.set(id, { file: rel(file), data });
}

const discoveries = new Map<string, { file: string; data: Discovery; body: string }>();
for (const file of listFiles(join(CONTENT, 'discovery'), '.mdx')) {
  const src = readFileSync(file, 'utf8');
  const raw = parseFrontmatter(src, rel(file));
  if (raw === undefined) continue;
  const data = validateWith(discoverySchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'discovery'), file).split(sep).join('/').replace(/\.mdx$/, '');
  const basename = id.split('/').at(-1)!;
  const levelDir = id.split('/')[0]?.toUpperCase();
  if (data.id !== basename) fail(rel(file), `id "${data.id}" ≠ filename "${basename}"`);
  if (data.level !== levelDir) fail(rel(file), `level ${data.level} ≠ directory ${levelDir}`);
  for (const image of data.images) {
    if (!image.src.startsWith('/'))
      fail(rel(file), `image src "${image.src}" must be a local /path under public/ (committed asset, never a hotlink)`);
    else if (!existsSync(join(ROOT, 'public', image.src.replace(/^\//, ''))))
      fail(rel(file), `image "${image.src}" does not exist under public/`);
  }
  discoveries.set(id, {
    file: rel(file),
    data,
    body: src.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, ''),
  });
}

const references = new Map<string, { file: string; data: ReferenceData }>();
for (const file of listFiles(join(CONTENT, 'reference-data'), '.yaml')) {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(rel(file), `YAML parse error: ${error instanceof Error ? error.message : error}`);
    continue;
  }
  const data = validateWith(referenceDataSchema, raw, rel(file));
  if (!data) continue;
  const id = relative(join(CONTENT, 'reference-data'), file).replace(/\.yaml$/, '');
  if (data.id !== id) fail(rel(file), `id "${data.id}" ≠ filename "${id}"`);
  references.set(id, { file: rel(file), data });
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
  // The recommended path advances a topic on its first role: practice set (see
  // primaryPractice in src/lib/content.ts). A topic without one can never be
  // completed, so the Lernpfad would stop on it forever.
  if (!data.exercises.some((ex) => exerciseSets.get(ex)?.data.role === 'practice'))
    fail(file, 'topic owns no role: practice exercise set — the Lernpfad could never advance past it');

  // Item mix (see "Item mix" in CLAUDE.md).
  //
  // Recognition items are cheap to author and cheap to answer, so a catalog drifts toward
  // them on its own. The pilot learner scored 93% on `mc`, 94% on `match` and 45/45 on
  // `order`, against 54% on `translate` — the constrained formats had stopped telling us
  // anything, while the one that discriminates was 13% of the catalog. These bounds keep a
  // topic's practice honest, and they are checked per topic rather than per set so that a
  // set may still specialize (a Hören set is all `listen`, and should be).
  const practiceItems = data.exercises
    .filter((ex) => exerciseSets.get(ex)?.data.role === 'practice')
    .flatMap((ex) => exerciseSets.get(ex)!.data.items);
  if (practiceItems.length > 0) {
    const count = (t: string) => practiceItems.filter((i) => i.type === t).length;
    const selection = count('mc') + count('match') + count('order');

    if (count('translate') < 2)
      fail(
        file,
        `topic's practice has ${count('translate')} translate item(s); at least 2 are required — ` +
          'free production of a whole sentence is the only format here that reliably discriminates',
      );
    if (count('mc') * 3 > practiceItems.length)
      fail(
        file,
        `${count('mc')} of ${practiceItems.length} practice items are mc (over one third) — ` +
          'recognition cannot carry a topic',
      );
    if (selection * 100 > practiceItems.length * MAX_SELECTION_PERCENT)
      fail(
        file,
        `${selection} of ${practiceItems.length} practice items are mc/match/order ` +
          `(${Math.round((100 * selection) / practiceItems.length)}%, cap ${MAX_SELECTION_PERCENT}%) — ` +
          'the learner picks from what is already on screen and never has to produce it',
      );
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
    } else if (pre.data.role !== 'pretest') {
      fail(file, `pretest set "${data.pretest}" must declare role: pretest`);
    }
    if (data.exercises.includes(data.pretest))
      fail(file, `pretest set "${data.pretest}" must not also be listed in exercises`);
  }
}

const canonicalNetworkRelations = new Map<string, string>();
const vocabHeadwords = new Map(
  [...vocabFiles].map(([id, entry]) => [id, new Set(entry.data.entries.map((word) => word.de))]),
);
for (const { file, data } of wortnetze.values()) {
  const members = new Map(data.members.map((member) => [
    member.id,
    member.kind === 'card' ? member.ref.de : member.de,
  ]));
  for (const problem of wortnetzCardRefProblems(data, vocabHeadwords)) fail(file, problem);
  for (const relation of data.relations) {
    const key = `${members.get(relation.from)}::${members.get(relation.to)}::${relation.type}`;
    const previous = canonicalNetworkRelations.get(key);
    if (previous) fail(file, `canonical relation "${key}" duplicates ${previous}`);
    else canonicalNetworkRelations.set(key, file);
  }
}

// Checkpoints are data, not wiring: `getCheckpoints()` (src/lib/content.ts) finds
// every `role: checkpoint` set, reads its level off its directory and gives it the
// page /checkpoint/<dir>. So the directory must name the level the checkpoint
// covers, and a level can own only one — a second would fight for the same route.
{
  const byLevel = new Map<string, string>();
  for (const [setId, { file, data }] of exerciseSets) {
    if (data.role !== 'checkpoint') continue;
    const dir = setId.split('/')[0]!;
    const level = topics.get(data.topic)?.data.level;
    if (level && dir.toUpperCase() !== level)
      fail(file, `checkpoint directory "${dir}" ≠ the level of its topic "${data.topic}" (${level}) — the /checkpoint/<level> route reads the level off the directory`);
    const other = byLevel.get(dir);
    if (other) fail(file, `a second ${dir.toUpperCase()} checkpoint ("${other}" already exists) — both would claim /checkpoint/${dir}`);
    byLevel.set(dir, setId);
  }
}

for (const [setId, { file, data }] of exerciseSets) {
  const owner = topics.get(data.topic);
  const standalone = data.role === 'checkpoint' || data.role === 'probe';
  if (!owner) {
    fail(file, `topic backref "${data.topic}" does not resolve`);
  } else if (standalone) {
    // Checkpoints/probes anchor to a topic for spine position only — they get
    // their own pages and must never be embedded in ordinary lesson flow.
    if (owner.data.exercises.includes(setId) || owner.data.pretest === setId)
      fail(file, `a role: ${data.role} set must not be listed in any topic's exercises or pretest`);
  } else if (!owner.data.exercises.includes(setId) && owner.data.pretest !== setId) {
    fail(file, `topic "${data.topic}" does not list this set ("${setId}") in its exercises or as its pretest`);
  }
  if (owner?.data.exercises.includes(setId) && data.role === 'pretest')
    fail(file, 'a role: pretest set must be referenced through topic.pretest, not topic.exercises');
  if (data.stimulus) {
    const document = documents.get(data.stimulus);
    if (!document) fail(file, `stimulus "${data.stimulus}" does not resolve to content/documents`);
    else if (document.data.topic !== data.topic)
      fail(file, `stimulus topic "${document.data.topic}" ≠ exercise topic "${data.topic}"`);
  }

  // A probe family's items are PARALLEL VARIANTS: different tasks, one competence.
  //
  // This is the whole basis of the retention measurement, and it is easy to get wrong in
  // a way that looks fine. `dueProbe` serves one unused variant per interval, so if the
  // variants test *different* things, the 2-day probe measures one skill, the 7-day probe
  // measures another and the 21-day probe a third. Each competence is then measured
  // exactly once, at exactly one delay — and a retention curve needs the same competence
  // at several delays. There is nothing to compare, and the number that comes out looks
  // like retention without being it.
  //
  // So every item in a probe family must carry the same `focus` and the same `outcomes`.
  // A topic with two core competences worth delayed evidence owns two families
  // (probe-<topic>-<competence>), not one family with two kinds of item in it.
  if (data.role === 'probe' && data.items.length > 0) {
    const key = (item: (typeof data.items)[number]): string =>
      `${item.focus ?? '-'} :: ${[...item.outcomes].sort().join('+')}`;
    const first = key(data.items[0]!);
    for (const item of data.items.slice(1)) {
      if (key(item) !== first)
        fail(
          `${file} → item "${item.id}"`,
          `probe variants must be parallel — same focus and same outcomes as the other ` +
            `variants ("${first}"), but this one is "${key(item)}". A family whose variants ` +
            `test different competences measures each of them once, at one interval, and can ` +
            `show no retention curve. Split it into one family per competence.`,
        );
    }

    // ...and the same item TYPE, for the same reason one step further in.
    //
    // The variants are served one per interval, so anything that differs between them is
    // confounded with the delay. A family running translate → cloze → translate asks for a
    // whole sentence at 2 days, hands the learner the sentence frame at 7, and takes it away
    // again at 21 — so the 7-day point would sit higher than the other two whatever the
    // learner remembered, and the curve would show a recovery that is pure response format.
    // The only thing allowed to vary across a probe family is the elapsed time.
    const type = data.items[0]!.type;
    for (const item of data.items.slice(1)) {
      if (item.type !== type)
        fail(
          `${file} → item "${item.id}"`,
          `probe variants must all be the same item type ("${type}"), but this one is ` +
            `"${item.type}". One variant is served per interval, so a format that changes ` +
            `between them is confounded with the delay — a cloze at 7 days scores higher than ` +
            `a translate at 2 and 21 no matter what was retained.`,
        );
    }
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
        // key_tokens names the tokens of `answer` OR an authored accept rendering that
        // the focus tag grades. Synonymous accepted forms must be pinned too; otherwise
        // a malformed form can be forgiven as a spelling slip. A stale token still has
        // to fail the build. The existing uniqueness guard remains anchored to `answer`;
        // for an alternative-only token, its accepted rendering is the equivalent anchor.
        const renderings = [item.answer, ...item.accept].map((rendering) => ({
          rendering,
          tokens: normalizeTranslation(rendering)
            .split(/\s+/)
            .map((w) => w.replace(/[.,!?;:]+$/, '')),
        }));
        for (const t of item.key_tokens) {
          const bare = t.replace(/[.,!?;:]+$/, '');
          const counts = renderings.map(({ tokens }) =>
            tokens.reduce((count, token) => count + Number(token === bare), 0),
          );
          if (counts.every((count) => count === 0)) {
            fail(where, `key_tokens entry "${t}" does not occur in the answer or accept list`);
          }
          const repeatedAt =
            counts[0]! > 1
              ? 0
              : counts[0] === 0
                ? counts.findIndex((count, index) => index > 0 && count > 1)
                : -1;
          if (repeatedAt >= 0) {
            const n = counts[repeatedAt]!;
            // `graded` in src/lib/production.ts is a Set of strings tested per token, so a
            // key token is matched by string, not by position: if it occurs twice, the focus
            // tag grades BOTH occurrences. In "Nina stellt den Stuhl neben den Schrank." the
            // second `den` is the direction case (wo-wohin), not the object article — so a
            // learner who writes `neben dem Schrank` gets logged against akkusativ-artikel,
            // and weakness-driven training then chases a confusion they do not have.
            // A false entry in the signal is worse than a missing one.
            fail(
              where,
              `key_tokens entry "${t}" occurs ${n}× in rendering ` +
                `"${renderings[repeatedAt]!.rendering}", so the focus tag grades every ` +
                `occurrence — including any that is a different decision. Rewrite the sentence ` +
                `so the graded token appears once, or pin a token that is unique.`,
            );
          }
        }
        if (item.key_tokens.length > 0 && !item.focus) {
          warn(where, 'key_tokens without a focus tag grades nothing');
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
      case 'listen': {
        if (/\d/.test(item.text))
          fail(where, 'listen text contains digits — write numbers as words so audio and answer agree');
        const words = item.text.trim().split(/\s+/).length;
        if (words > 12)
          warn(where, `listen text has ${words} words — dictation beyond ~12 words overloads working memory`);
        const canonical = normalizeDictation(item.text);
        const seen = new Set<string>();
        for (const a of item.accept) {
          const n = normalizeDictation(a);
          if (n === canonical) fail(where, `accept entry "${a}" duplicates the canonical text`);
          if (seen.has(n)) fail(where, `duplicate accept entry "${a}"`);
          seen.add(n);
        }
        break;
      }
      case 'write': {
        if (item.model_answer.trim().split(/\s+/).length < item.min_words)
          warn(where, 'model answer is shorter than the learner minimum');
        break;
      }
      case 'speak': {
        if (item.model_answer.trim().split(/\s+/).length < 3)
          warn(where, 'spoken model is very short; make the communicative response meaningful');
        break;
      }
      case 'audio-comprehension': {
        if (item.correct >= item.options.length)
          fail(where, `correct index ${item.correct} out of range (${item.options.length} options)`);
        if (new Set(item.options).size !== item.options.length) fail(where, 'duplicate options');
        break;
      }
    }
    if (!item.explain) warn(where, 'no explain text (feedback on wrong answers will be thin)');
  }
}

for (const { file, data } of documents.values()) {
  const topic = topics.get(data.topic);
  if (!topic) fail(file, `topic "${data.topic}" does not resolve`);
  else if (topic.data.level !== data.level)
    fail(file, `level ${data.level} ≠ topic level ${topic.data.level}`);
}

for (const { file, data } of wordFields.values()) {
  const topic = topics.get(data.topic);
  if (!topic) fail(file, `topic "${data.topic}" does not resolve`);
  else if (topic.data.level !== data.level)
    fail(file, `level ${data.level} ≠ topic level ${topic.data.level}`);
  for (const member of data.members) {
    if (member.kind !== 'card') continue;
    const deck = vocabFiles.get(member.ref.deck)?.data;
    if (!deck) fail(file, `card ref deck "${member.ref.deck}" does not resolve`);
    else if (!deck.entries.some((entry) => entry.de === member.ref.de))
      fail(file, `card ref "${member.ref.deck} / ${member.ref.de}" does not resolve`);
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
  let wordCount = 0;
  data.text.forEach((para, i) => {
    const { segments, errors: glossErrors } = parseGlosses(para);
    for (const e of glossErrors) fail(`${file} → paragraph ${i + 1}`, e);
    for (const s of segments) {
      // Letter-set checks per gloss field (en: no Cyrillic, ru: no і/ї/є/ґ,
      // uk: no ы/э/ъ/ё, de: no Cyrillic) — glosses live inside text strings,
      // where the YAML walker below cannot see them.
      if (s.kind === 'gloss')
        for (const p of langFieldProblems(s.gloss)) fail(`${file} → paragraph ${i + 1}`, p);
    }
    glossCount += segments.filter((s) => s.kind === 'gloss').length;
    // the German the learner actually reads: gloss markers flattened to their German half
    const plain = segments
      .map((s) => (s.kind === 'gloss' ? s.gloss.de : s.text))
      .join('')
      .trim();
    wordCount += plain ? plain.split(/\s+/).length : 0;
  });
  if (glossCount === 0)
    warn(file, 'reading has no [[gloss::…::…]] markers — add a few for comprehensible input');

  // The two reading kinds do different jobs, and the bounds are what keep them apart.
  // An "extensive" reader that is quizzed line by line, or glossed every other phrase, is
  // just a long intensive text — and the volume input it exists to provide never happens.
  if (data.kind === 'extensive') {
    if (wordCount < 250 || wordCount > 400)
      fail(file, `extensive reader is ${wordCount} words; the band is 250–400`);
    if (data.questions.length > 2)
      fail(
        file,
        `extensive reader has ${data.questions.length} questions; at most 2 (gist only) — ` +
          'accounting for every sentence turns reading back into a test',
      );
    // roughly one gloss per 40 words: enough to unblock, sparse enough to keep reading
    const maxGlosses = Math.ceil(wordCount / 40);
    if (glossCount > maxGlosses)
      fail(
        file,
        `extensive reader has ${glossCount} glosses for ${wordCount} words (max ~${maxGlosses}) — ` +
          'a gloss every few phrases interrupts the reading it is meant to support',
      );
  } else {
    if (data.questions.length < 2)
      fail(file, `intensive reading has ${data.questions.length} questions; 2–4 are required`);
    if (wordCount > 160) warn(file, `intensive reading is ${wordCount} words — keep these concise`);
  }

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

  // Language discipline for this reading — handled here rather than in the bulk
  // loop below, because gloss `uk` lives inside `text` strings where the YAML
  // walker cannot see it and must bridge into YAML parity in both directions:
  // any uk anywhere in the reading (YAML field or 4-field gloss) makes uk
  // required everywhere in it.
  const glossParity = glossFieldParity(data.text);
  if (glossParity.mixed)
    fail(
      file,
      `mixes ${glossParity.withUk} four-field and ${glossParity.withoutUk} three-field glosses — ` +
        'uk glosses are all-or-none per reading',
    );
  const anyUkYaml = hasUkField(data);
  if (anyUkYaml && glossParity.withUk === 0 && glossParity.withoutUk > 0)
    fail(
      file,
      `reading carries uk YAML fields but its ${glossParity.withoutUk} glosses have no uk field — ` +
        'add the fourth [[…::uk]] field to every gloss',
    );
  for (const p of langFieldProblems(data)) fail(file, p);
  for (const p of ukParityProblems(data, { forceUk: anyUkYaml || glossParity.withUk > 0 }))
    fail(file, p);
  for (const p of deParityProblems(data)) fail(file, p);
}

// Orphan exercise sets (not referenced by any topic)
for (const [setId, { file, data }] of exerciseSets) {
  if (data.role === 'checkpoint' || data.role === 'probe') continue; // standalone by design
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

// Atlas consistency + curriculum spine
{
  const atlasFile = join(CONTENT, 'atlas.yaml');
  const AT = 'content/atlas.yaml';
  if (!existsSync(atlasFile)) {
    fail(AT, 'missing');
  } else {
    const raw = YAML.parse(readFileSync(atlasFile, 'utf8'));
    const atlas = validateWith(atlasSchema, raw, AT);
    if (atlas) {
      const nodeIds = new Set(atlas.nodes.map((n) => n.id));
      const groupById = new Map(atlas.groups.map((group) => [group.id, group]));
      if (groupById.size !== atlas.groups.length) fail(AT, 'duplicate group id');
      const parentGroups = new Set(atlas.groups.flatMap((group) => group.parent ? [group.parent] : []));
      for (const group of atlas.groups) {
        if (group.parent) {
          const parent = groupById.get(group.parent);
          if (!parent) fail(AT, `group "${group.id}" has unknown parent "${group.parent}"`);
          else if (parent.strand !== group.strand)
            fail(AT, `group "${group.id}" strand differs from parent "${group.parent}"`);
        }
        const seen = new Set<string>([group.id]);
        let cursor = group.parent;
        while (cursor) {
          if (seen.has(cursor)) {
            fail(AT, `group cycle includes "${cursor}"`);
            break;
          }
          seen.add(cursor);
          cursor = groupById.get(cursor)?.parent;
        }
      }
      for (const id of topics.keys()) {
        if (!nodeIds.has(id)) fail(AT, `topic "${id}" missing from atlas`);
      }
      for (const node of atlas.nodes) {
        const t = topics.get(node.id);
        if (!t) {
          fail(AT, `node "${node.id}" has no topic file`);
          continue;
        }
        if (node.level !== t.data.level)
          fail(AT, `node "${node.id}" level ${node.level} ≠ topic level ${t.data.level}`);
        if (node.kind !== t.data.kind)
          fail(AT, `node "${node.id}" kind ${node.kind} ≠ topic kind ${t.data.kind}`);
        const group = groupById.get(node.group);
        if (!group) fail(AT, `node "${node.id}" has unknown group "${node.group}"`);
        else {
          if (parentGroups.has(group.id)) fail(AT, `node "${node.id}" must belong to a leaf group`);
          if (group.strand !== node.strand)
            fail(AT, `node "${node.id}" strand differs from group "${node.group}"`);
        }
        const a = [...node.prerequisites].sort().join(',');
        const b = [...t.data.prerequisites].sort().join(',');
        if (a !== b) fail(AT, `node "${node.id}" prerequisites ≠ topic frontmatter`);
      }

      // Spine: every topic in exactly one unit; unit topics exist and match
      // the unit's level; units grouped by ascending level; the flattened
      // order never puts a topic before a prerequisite; deepens targets exist
      // and appear strictly earlier.
      const nodeById = new Map(atlas.nodes.map((n) => [n.id, n]));
      const outcomeOwner = new Map<string, string>();
      for (const node of atlas.nodes) {
        for (const outcome of node.outcomes) {
          const previous = outcomeOwner.get(outcome.id);
          if (previous) fail(AT, `outcome id "${outcome.id}" is used by both "${previous}" and "${node.id}"`);
          else outcomeOwner.set(outcome.id, node.id);
        }
        if (
          node.kind === 'communication' &&
          !node.outcomes.some((o) =>
            ['writing', 'spoken-production', 'spoken-interaction'].includes(o.mode),
          )
        )
          fail(AT, `communication topic "${node.id}" needs a productive or interactive outcome`);
        for (const related of node.related) {
          const other = nodeById.get(related);
          if (!other) fail(AT, `node "${node.id}" relates to unknown topic "${related}"`);
          else if (!other.related.includes(node.id))
            fail(AT, `related edge "${node.id}" ↔ "${related}" must be symmetric`);
          if (related === node.id) fail(AT, `node "${node.id}" relates to itself`);
        }
      }
      const unitIds = new Set<string>();
      const unitOf = new Map<string, string>();
      for (const unit of atlas.units) {
        if (unitIds.has(unit.id)) fail(AT, `duplicate unit id "${unit.id}"`);
        unitIds.add(unit.id);
        for (const t of unit.topics) {
          const node = nodeById.get(t);
          if (!node) {
            fail(AT, `unit "${unit.id}" lists unknown topic "${t}"`);
            continue;
          }
          const prev = unitOf.get(t);
          if (prev) fail(AT, `topic "${t}" appears in two units ("${prev}" and "${unit.id}")`);
          else unitOf.set(t, unit.id);
          if (node.level !== unit.level)
            fail(AT, `unit "${unit.id}" (${unit.level}) contains topic "${t}" of level ${node.level}`);
        }
      }
      for (const node of atlas.nodes) {
        if (!unitOf.has(node.id)) fail(AT, `topic "${node.id}" is not in any unit`);
      }

      const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };
      for (let i = 1; i < atlas.units.length; i++) {
        const prev = atlas.units[i - 1]!;
        const cur = atlas.units[i]!;
        if (LEVEL_ORDER[cur.level]! < LEVEL_ORDER[prev.level]!)
          fail(AT, `unit "${cur.id}" (${cur.level}) comes after ${prev.level} unit "${prev.id}" — group units by ascending level`);
      }

      const spinePos = new Map(atlas.units.flatMap((u) => u.topics).map((t, i) => [t, i]));
      for (const node of atlas.nodes) {
        const at = spinePos.get(node.id);
        for (const p of node.prerequisites) {
          const pAt = spinePos.get(p);
          if (at !== undefined && pAt !== undefined && pAt > at)
            fail(AT, `spine orders "${node.id}" before its prerequisite "${p}"`);
        }
        for (const d of node.deepens) {
          if (!nodeIds.has(d)) {
            fail(AT, `node "${node.id}" deepens unknown topic "${d}"`);
            continue;
          }
          const dAt = spinePos.get(d);
          if (at !== undefined && dAt !== undefined && dAt >= at)
            fail(AT, `node "${node.id}" deepens "${d}", which must appear earlier in the spine`);
        }
      }

      for (const { file, data } of exerciseSets.values()) {
        // Checkpoints/probes span the whole level, so they may reference any
        // known outcome; ordinary sets stay locked to their own topic's.
        const crossTopic = data.role === 'checkpoint' || data.role === 'probe';
        for (const item of data.items) {
          for (const outcome of item.outcomes) {
            const owns = outcomeOwner.get(outcome);
            if (!owns) fail(`${file} → item "${item.id}"`, `unknown outcome "${outcome}"`);
            else if (!crossTopic && owns !== data.topic)
              fail(`${file} → item "${item.id}"`, `outcome "${outcome}" belongs to topic "${owns}"`);
          }
        }
      }
      for (const { file, data } of readings.values()) {
        for (const question of data.questions) {
          for (const outcome of question.outcomes) {
            const owns = outcomeOwner.get(outcome);
            if (!owns) fail(`${file} → question "${question.id}"`, `unknown outcome "${outcome}"`);
            else if (owns !== data.topic)
              fail(`${file} → question "${question.id}"`, `outcome "${outcome}" belongs to topic "${owns}"`);
          }
        }
      }

      // Every declared outcome must be measured by something the learner works through.
      //
      // An outcome nothing references can never light up on the progress page, and the
      // delayed probe on it can never arm — the topic promises a can-do the course never
      // asks for. Only practice and drill items count, plus reading questions: a pretest
      // is a guess taken *before* the lesson, and a checkpoint or probe *tests* an outcome
      // rather than teaching it, so an outcome that is only ever tested was never
      // practised. (A2 shipped four of these; A1 had none.)
      {
        const measured = new Set<string>();
        for (const { data } of exerciseSets.values()) {
          if (data.role !== 'practice' && data.role !== 'drill') continue;
          for (const item of data.items) for (const outcome of item.outcomes) measured.add(outcome);
        }
        for (const { data } of readings.values()) {
          for (const question of data.questions)
            for (const outcome of question.outcomes) measured.add(outcome);
        }
        for (const node of atlas.nodes) {
          for (const outcome of node.outcomes) {
            if (measured.has(outcome.id)) continue;
            fail(
              AT,
              `outcome "${outcome.id}" of topic "${node.id}" is measured by nothing — ` +
                'reference it from an item in a role: practice or role: drill set, or from a ' +
                'reading question. Pretests, checkpoints and probes do not count: an outcome ' +
                'that is only ever tested was never practised, so it can never light up on the ' +
                'progress page and its delayed probe can never arm.',
            );
          }
        }
      }

      // A focus tag cannot silently teach a structure whose owning topic is
      // later in the spine. Intentional preview items must say `preview: true`.
      const focusIntroducedBy: Record<string, string> = {
        verbzweit: 'praesens-wortstellung',
        'verb-endungen': 'praesens-wortstellung',
        'kopula-sein': 'praesens-wortstellung',
        'nicht-position': 'praesens-wortstellung',
        genus: 'artikel-genus',
        'plural-artikel': 'artikel-genus',
        'artikel-pflicht': 'artikel-genus',
        'kein-nicht': 'artikel-genus',
        possessivartikel: 'menschen-familie',
        'akkusativ-artikel': 'akkusativ',
        'akkusativ-pronomen': 'akkusativ',
        'akkusativ-praepositionen': 'akkusativ',
        'dativ-artikel': 'dativ',
        'dativ-pronomen': 'dativ',
        'dativ-praepositionen': 'dativ',
        'verben-mit-dativ': 'dativ',
        'passen-dativ': 'dativ',
        'wechsel-akk-dat': 'dativ',
        'trennbar-wortstellung': 'trennbare-verben',
        'trennbar-modal': 'trennbare-verben',
        'trennbar-untrennbar': 'trennbare-verben',
        'modal-satzklammer': 'freizeit-koennen',
        'modal-konjugation': 'freizeit-koennen',
        'gern-moegen': 'freizeit-koennen',
        'duerfen-muessen': 'modalverben',
        'will-moechte': 'modalverben',
        'haben-sein': 'perfekt-haben-sein',
        'partizip2-form': 'perfekt-haben-sein',
        'perfekt-satzklammer': 'perfekt-haben-sein',
        'um-am-zeit': 'alltag-zeit',
        'du-sie': 'termine-vereinbaren',
        // --- A2 units ---
        'wo-wohin': 'wohnen-umzug',
        'stellen-stehen': 'wohnen-umzug',
        'komparativ-als': 'einkaufen-reklamation',
        'superlativ-am': 'einkaufen-reklamation',
        'adjektiv-praedikativ': 'adjektive-deklination',
        'adjektiv-bestimmt': 'adjektive-deklination',
        'adjektiv-unbestimmt': 'adjektive-deklination',
        'imperativ-form': 'gesundheit-arzttermin',
        'seit-vor-zeit': 'gesundheit-arzttermin',
        'reflexiv-akkusativ': 'gesundheit-arzttermin',
        'verb-praeposition': 'verben-mit-praepositionen',
        'da-wo-woerter': 'verben-mit-praepositionen',
        'nebensatz-verbende': 'nebensaetze-plaene',
        'weil-denn': 'nebensaetze-plaene',
        'nebensatz-vorfeld': 'nebensaetze-plaene',
        'zu-infinitiv': 'infinitiv-mit-zu',
        'um-zu-zweck': 'infinitiv-mit-zu',
        'relativpronomen-kasus': 'relativsaetze',
        'konjunktionaladverb-inversion': 'verbindungen-folgen',
        'als-wenn-vergangenheit': 'verbindungen-folgen',
        'futur-werden': 'infinitiv-mit-zu',
        'reflexiv-dativ': 'gesundheit-arzttermin',
        'indefinitpronomen': 'man-und-besitz',
        'genitiv-eigenname': 'man-und-besitz',
        'passiv-rezeptiv': 'man-und-besitz',
        'aber-sondern': 'freunde-feste',
        'praeteritum-sein-haben': 'biografie-erfahrungen',
        'indirekte-frage': 'lernen-verstehen',
        'hoeflich-konjunktiv': 'aemter-dienstleistungen',
        // was escaping the spine check entirely while the table was a lookup, not an allowlist
        'haben-wendungen': 'essen-trinken',
      };
      for (const { file, data } of exerciseSets.values()) {
        const ownerAt = spinePos.get(data.topic);
        for (const item of data.items) {
          if (!item.focus) continue;
          // An allowlist, not a lookup. A tag missing from the table used to be silently
          // exempt from the spine check — which is exactly backwards, since a tag nobody
          // registered is the one most likely to be a typo or an undeclared new confusion.
          // (`haben-wendungen` had been escaping this way.) The table is also the canonical
          // focus-tag list in CLAUDE.md, so the two cannot drift apart unnoticed.
          const intro = focusIntroducedBy[item.focus];
          if (!intro) {
            fail(
              `${file} → item "${item.id}"`,
              `focus "${item.focus}" is not in the focus-tag table — add it to CLAUDE.md and to ` +
                'focusIntroducedBy in scripts/validate.ts, naming the topic that introduces it',
            );
            continue;
          }
          const introAt = spinePos.get(intro);
          if (!item.preview && ownerAt !== undefined && introAt !== undefined && introAt > ownerAt)
            fail(
              `${file} → item "${item.id}"`,
              `focus "${item.focus}" is introduced later by "${intro}"; move it or declare preview: true`,
            );
        }
      }

      // A `deepens` edge must be one the training loop can act on.
      //
      // The edge has exactly one runtime channel, and it is the focus tag. Weakness is
      // aggregated per tag and is blind to the topic an attempt came from
      // (`focusStats` in src/lib/weakness.ts keys only by `a.focus`), so an error in a
      // deepening topic marks that confusion weak across the whole course; mixed
      // training's second band then pulls every item carrying it out of the entire
      // eligible pool — the base topic's practice and drill sets among them
      // (`buildSession` in src/lib/training.ts). That, and nothing else, is what makes a
      // spiral revisit resurface its base. No other code reads `deepens`.
      //
      // So an edge whose two ends share no focus tag can resurface nothing. It renders in
      // the relations pane and the spiral it claims to build does not exist. The base side
      // counts only trainable roles — practice and drill are the only sets buildSession may
      // draw from (`eligibleTrainingSets`) — while the deepening side counts every role,
      // because an error anywhere in the topic, a pretest included, feeds weakness.
      const TRAINABLE_ROLES = new Set(['practice', 'drill']);
      const focusOfTopic = new Map<string, Set<string>>();
      const trainableFocusOfTopic = new Map<string, Set<string>>();
      const remember = (m: Map<string, Set<string>>, topic: string, focus: string) => {
        const tags = m.get(topic);
        if (tags) tags.add(focus);
        else m.set(topic, new Set([focus]));
      };
      for (const { data } of exerciseSets.values()) {
        for (const item of data.items) {
          if (!item.focus) continue;
          remember(focusOfTopic, data.topic, item.focus);
          if (TRAINABLE_ROLES.has(data.role)) remember(trainableFocusOfTopic, data.topic, item.focus);
        }
      }
      for (const node of atlas.nodes) {
        for (const base of node.deepens) {
          if (!nodeIds.has(base)) continue; // unknown target — already reported above
          const mine = focusOfTopic.get(node.id) ?? new Set<string>();
          const theirs = trainableFocusOfTopic.get(base) ?? new Set<string>();
          if (![...mine].some((focus) => theirs.has(focus)))
            fail(
              AT,
              `node "${node.id}" deepens "${base}", but no focus tag of "${node.id}" is drilled by a ` +
                `practice or drill item of "${base}" — an error in "${node.id}" could never resurface a ` +
                `"${base}" item, which is the whole runtime meaning of the edge. Tag an item of ` +
                `"${node.id}" with one of the base's confusions, or drop the edge`,
            );
        }
      }

      // Language discipline: letter sets over the whole file; uk parity per
      // node/group/unit (not per file), so translating one topic's outcomes
      // does not demand the entire atlas in the same change.
      for (const p of langFieldProblems(atlas)) fail(AT, p);
      for (const group of atlas.groups)
        for (const p of ukParityProblems(group)) fail(AT, `group "${group.id}": ${p}`);
      for (const node of atlas.nodes)
        for (const p of ukParityProblems(node)) fail(AT, `node "${node.id}": ${p}`);
      for (const unit of atlas.units)
        for (const p of ukParityProblems(unit)) fail(AT, `unit "${unit.id}": ${p}`);
      for (const p of deParityProblems(atlas)) fail(AT, p);
    }
  }
}

// ---------------------------------------------------------------------------
// Language discipline: letter-set purity and uk/de parity (src/lib/langcheck.ts)
// ---------------------------------------------------------------------------

/**
 * Letter sets and parity for one YAML/frontmatter tree. `deParity: false`
 * exempts content/reference-data: its referenceExampleSchema records
 * (de/en/ru, optionally uk) are German example sentences with translations —
 * the `de` is German *content*, not a bilingual explanation half — and they
 * legitimately sit beside de-less bilingual `meaning` records, which is the
 * one false positive of deParityProblems' structural shape test. uk parity
 * still applies: the example schema carries a `uk` slot exactly so a
 * translated reference file can satisfy it.
 *
 * Readings are handled inside the reading loop above, where 4-field glosses
 * (invisible to the YAML walker) bridge into uk parity. Atlas is handled in
 * the atlas block, where uk parity is per node/group/unit. Topics and
 * discovery pieces are handled by checkMdxLangDiscipline below, where
 * frontmatter and body bridge into one parity scope.
 */
function checkLangDiscipline(file: string, data: unknown, opts: { deParity?: boolean } = {}): void {
  for (const p of langFieldProblems(data)) fail(file, p);
  for (const p of ukParityProblems(data)) fail(file, p);
  if (opts.deParity ?? true) for (const p of deParityProblems(data)) fail(file, p);
}

for (const { file, data } of vocabFiles.values()) checkLangDiscipline(file, data);
for (const { file, data } of exerciseSets.values()) checkLangDiscipline(file, data);
for (const { file, data } of documents.values()) checkLangDiscipline(file, data);
for (const { file, data } of wordFields.values()) checkLangDiscipline(file, data);
// A network's example records contain German source sentences beside their
// translations. Structurally those look like German-medium explanation records,
// but `de` is content here, not a language-mode half. EN/RU/UK parity still
// applies; German explanations remain optional for this reference layer.
for (const { file, data } of wortnetze.values())
  checkLangDiscipline(file, data, { deParity: false });
for (const { file, data } of references.values()) checkLangDiscipline(file, data, { deParity: false });

/**
 * MDX files: frontmatter and body are ONE parity scope — the contract is per
 * file ("any uk in a file means every ru-bearing field in that file carries
 * uk", docs/i18n-design.md), and the frontmatter/body split must not open a
 * hole in it. So uk on either side forces parity on both — the same bridge as
 * reading glosses ↔ YAML above: `title_uk` alone demands a <Uk> half in every
 * <Bilingual> block, and a <Uk> block alone demands `title_uk`. Otherwise a
 * wave could translate the title, skip the article, and both validate and be
 * counted as translated by the Über figure. Balance stays a warning for topic
 * bodies and an error for discovery pieces — the pre-existing <En> contract.
 */
function checkMdxLangDiscipline(
  file: string,
  data: unknown,
  body: string,
  balance: (file: string, msg: string) => void,
): void {
  for (const p of langFieldProblems(data)) fail(file, p);
  for (const p of ukParityProblems(data, { forceUk: body.includes('<Uk>') })) fail(file, p);
  for (const p of deParityProblems(data)) fail(file, p);
  const report = mdxLangProblems(body, { forceUk: hasUkField(data) });
  for (const p of report.balance) balance(file, p);
  for (const p of report.letters) fail(file, p);
  for (const p of report.parity) fail(file, p);
}

for (const { file, data, body } of topics.values()) checkMdxLangDiscipline(file, data, body, warn);
for (const { file, data, body } of discoveries.values())
  checkMdxLangDiscipline(file, data, body, fail);

// ---------------------------------------------------------------------------
// Grading decisions: a committed linguistic ruling must stay true
// ---------------------------------------------------------------------------

/**
 * `data/grading-decisions.yaml` is the committed memory of the audit's
 * grading-review queue (see CLAUDE.md). Two of its claims are machine-checkable
 * and enforced here via `checkGradingDecisions` (`src/lib/grading-decisions.ts`):
 * a decision's item ref must exist (hard fail), and an `accept`-ruled rendering
 * must pass today's grader (hard fail) — an accepted rendering the scorer still
 * rejects is a stale claim, and the queue it was meant to drain would refill.
 *
 * `constrain` and `confirm` have no machine-checkable semantics: whether an
 * `instruction` really pins the target, or a rejection was linguistically right,
 * is a judgement about meaning — on the author. And whether a ruling still
 * matches a *queueable* rendering is snapshot-relative, so that half of orphan
 * detection lives in the audit; here, an item that is no longer a graded
 * translate item warns rather than fails.
 */
{
  let ruled = false;
  try {
    const decisions = loadGradingDecisions(ROOT);
    ruled = true;
    const checked = checkGradingDecisions(decisions, (ref) => {
      const at = ref.lastIndexOf(':');
      if (at <= 0) return undefined;
      const item = exerciseSets
        .get(ref.slice(0, at))
        ?.data.items.find((candidate) => candidate.id === ref.slice(at + 1));
      if (!item) return undefined;
      return item.type === 'translate'
        ? {
            type: item.type,
            answer: item.answer,
            accept: item.accept,
            focus: item.focus,
            keyTokens: item.key_tokens,
          }
        : { type: item.type };
    });
    for (const message of checked.errors) fail(GRADING_DECISIONS_FILE, message);
    for (const message of checked.warnings) warn(GRADING_DECISIONS_FILE, message);
  } catch (e) {
    if (!ruled) fail(GRADING_DECISIONS_FILE, `parse error: ${e instanceof Error ? e.message : e}`);
    else throw e;
  }
}

// ---------------------------------------------------------------------------
// Wortliste: a "~" (taught as grammar, no flashcard) must be earned
// ---------------------------------------------------------------------------

/**
 * A `~` in a Wortliste manifest counts toward the coverage figure the Über page
 * publishes. It used to be a self-certification — the manifest asserted the course
 * taught the word, and nothing checked. Nine marks turned out to be false, so the
 * claim is now measured: goetheCoverage() demotes a `~` word the taught surface
 * does not contain, and the build stops here rather than shipping the number.
 */
for (const level of MEASURED_LEVELS) {
  if (!hasManifest(level, ROOT)) continue;
  const { unearned } = goetheCoverage(level, ROOT);
  for (const word of unearned) {
    fail(
      `data/goethe-${level.toLowerCase()}-wortliste.txt`,
      `"~${word}" claims the course teaches ${word} as grammar, but no topic article ` +
        `(outside its En/Ru blocks), reading or practice/drill item contains it. ` +
        `Teach it, or drop the "~" and give it a flashcard.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(
  `Validated ${topics.size} topics, ${vocabFiles.size} vocab files, ${exerciseSets.size} exercise sets, ${readings.size} reading texts, ${documents.size} documents, ${wordFields.size} word fields, ${wortnetze.size} word networks, ${discoveries.size} discovery pieces, ${references.size} references.`,
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
