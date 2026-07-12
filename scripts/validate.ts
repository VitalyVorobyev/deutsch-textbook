/**
 * Content validation beyond Astro's schema check. Run with: bun run validate
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
  type VocabEntry,
  type VocabFile,
} from '../src/lib/schemas';
import { clozeGaps, normalizeDictation, normalizeTranslation } from '../src/lib/cloze';
import { parseGlosses } from '../src/lib/gloss';

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

/** English-facing text must contain no Cyrillic (see CLAUDE.md, bilingual voice). */
const CYRILLIC = /[Ѐ-ӿ]/;

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
        // key_tokens names the tokens of `answer` the focus tag grades. A token that is
        // not in the answer grades nothing, and the item would silently lose both its
        // typo protection and its attribution — so a stale one has to fail the build.
        const answerTokens = new Set(
          canonical.split(/\s+/).map((w) => w.replace(/[.,!?;:]+$/, '')),
        );
        for (const t of item.key_tokens) {
          if (!answerTokens.has(t.replace(/[.,!?;:]+$/, ''))) {
            fail(where, `key_tokens entry "${t}" does not occur in the answer`);
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
      if (s.kind === 'gloss' && CYRILLIC.test(s.gloss.en))
        fail(`${file} → paragraph ${i + 1}`, `Cyrillic in en gloss field: "${s.gloss.en}"`);
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

      checkEnFields(AT, atlas, '');
    }
  }
}

// ---------------------------------------------------------------------------
// EN-half purity: no Cyrillic anywhere an EN-only reader looks
// ---------------------------------------------------------------------------

/** Recursively flags Cyrillic in any string under a key named `en` or ending in `_en`. */
function checkEnFields(file: string, node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => checkEnFields(file, v, `${path}[${i}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const p = path ? `${path}.${key}` : key;
      if ((key === 'en' || key.endsWith('_en')) && typeof value === 'string') {
        if (CYRILLIC.test(value))
          fail(file, `Cyrillic in English-facing field ${p}: "${value.slice(0, 70)}"`);
      } else {
        checkEnFields(file, value, p);
      }
    }
  }
}

for (const { file, data } of vocabFiles.values()) checkEnFields(file, data, '');
for (const { file, data } of exerciseSets.values()) checkEnFields(file, data, '');
for (const { file, data } of readings.values()) checkEnFields(file, data, '');
for (const { file, data } of topics.values()) checkEnFields(file, data, '');

// <En> blocks in topic article bodies
for (const { file, body } of topics.values()) {
  const opens = (body.match(/<En>/g) ?? []).length;
  const closes = (body.match(/<\/En>/g) ?? []).length;
  if (opens !== closes) warn(file, `unbalanced <En> tags (${opens} open, ${closes} close)`);
  (body.match(/<En>[\s\S]*?<\/En>/g) ?? []).forEach((block, i) => {
    for (const line of block.split('\n')) {
      if (CYRILLIC.test(line))
        fail(file, `Cyrillic inside <En> block ${i + 1}: "${line.trim().slice(0, 70)}"`);
    }
  });
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
