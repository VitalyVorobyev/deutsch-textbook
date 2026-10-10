/**
 * Reads the Leben-in-Deutschland bank and the course's notes on it, and says what is wrong with
 * them. ADR 0021. One reader for the validator, the pages and the progress audit, so the three
 * can never disagree about which question belongs to which topic.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import YAML from 'yaml';
import {
  LID_LESSON_ID,
  lidBankSchema,
  lidLessonSchema,
  lidNotesFileSchema,
  lidTopicsSchema,
  type LidBank,
  type LidLesson,
  type LidNote,
  type LidQuestion,
  type LidTopics,
} from '@da/schema/lid';
import { hasUkField, langFieldProblems, mdxLangProblems, ukParityProblems } from '@da/schema/langcheck';
import { proseShapeProblems } from './prose-shape';
import { repoRoot } from './repo-root';

export const LID_BANK_FILE = 'data/lid/bank.yaml';
export const LID_TOPICS_FILE = 'content/lid/topics.yaml';
export const LID_NOTES_DIR = 'content/lid/notes';
export const LID_LESSONS_DIR = 'content/lid/lessons';

export function loadLidBank(root = repoRoot()): LidBank {
  return lidBankSchema.parse(YAML.parse(readFileSync(join(root, LID_BANK_FILE), 'utf8')));
}

export function loadLidTopics(root = repoRoot()): LidTopics {
  return lidTopicsSchema.parse(YAML.parse(readFileSync(join(root, LID_TOPICS_FILE), 'utf8')));
}

/** A note with the topic its file assigns it to. */
export type PlacedLidNote = LidNote & { topic: string };

export function loadLidNotes(root = repoRoot()): PlacedLidNote[] {
  const dir = join(root, LID_NOTES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .flatMap((file) => {
      const topic = basename(file, '.yaml');
      const parsed = lidNotesFileSchema.parse(YAML.parse(readFileSync(join(dir, file), 'utf8')));
      return parsed.notes.map((note) => ({ ...note, topic }));
    });
}

/** The topic → module map, for grouping accuracy and building the overview. */
export function lidTopicModules(topics: LidTopics): Map<string, { module: string; moduleTitle: string; title: string }> {
  const map = new Map<string, { module: string; moduleTitle: string; title: string }>();
  for (const m of topics.modules)
    for (const t of m.topics) map.set(t.id, { module: m.id, moduleTitle: m.title_de, title: t.title_de });
  return map;
}

/** Everything `bun run validate` holds the LiD layer to. Empty means valid. */
export function lidProblems(root = repoRoot()): string[] {
  const problems: string[] = [];
  const at = (file: string, msg: string) => problems.push(`${file}: ${msg}`);
  if (!existsSync(join(root, LID_BANK_FILE))) return problems; // no bank imported yet

  let bank: LidBank;
  try {
    bank = loadLidBank(root);
  } catch (err) {
    at(LID_BANK_FILE, String(err));
    return problems;
  }

  // The bank: the published counts, unique ids, every image present and unchanged.
  const general = bank.questions.filter((q) => q.scope === 'general');
  if (general.length !== 300) at(LID_BANK_FILE, `${general.length} general questions, expected 300`);
  for (const state of bank.states) {
    const n = bank.questions.filter((q) => q.stateCode === state).length;
    if (n !== 10) at(LID_BANK_FILE, `${state} has ${n} questions, expected 10`);
  }
  const stray = bank.questions.filter((q) => q.stateCode && !bank.states.includes(q.stateCode));
  if (stray.length) at(LID_BANK_FILE, `questions for undeclared states: ${stray.map((q) => q.id).join(', ')}`);
  const ids = new Set<string>();
  for (const q of bank.questions) {
    if (ids.has(q.id)) at(LID_BANK_FILE, `duplicate id ${q.id}`);
    ids.add(q.id);
    for (const image of q.images) {
      const file = join(root, 'public', image.path);
      if (image.withheld) {
        // A credited third-party photo must never reach the deployed build (ADR 0021).
        if (existsSync(file)) at(LID_BANK_FILE, `${q.id}: ${image.path} is withheld (${image.withheld}) but present`);
        continue;
      }
      if (!existsSync(file)) at(LID_BANK_FILE, `${q.id}: ${image.path} does not exist`);
      else if (createHash('sha256').update(readFileSync(file)).digest('hex') !== image.sha256)
        at(LID_BANK_FILE, `${q.id}: ${image.path} differs from the imported file`);
    }
  }

  // The notes: every question placed in exactly one topic that exists.
  let topics: LidTopics;
  try {
    topics = loadLidTopics(root);
  } catch (err) {
    at(LID_TOPICS_FILE, String(err));
    return problems;
  }
  const known = lidTopicModules(topics);
  const topicIds = topics.modules.flatMap((m) => m.topics.map((t) => t.id));
  if (new Set(topicIds).size !== topicIds.length) at(LID_TOPICS_FILE, 'duplicate topic id');

  // The lessons: reading material over the topics, never a second placement of a question.
  problems.push(...lidLessonProblems(root, topics));

  let notes: PlacedLidNote[];
  try {
    notes = loadLidNotes(root);
  } catch (err) {
    at(LID_NOTES_DIR, String(err));
    return problems;
  }
  const placed = new Map<string, string>();
  for (const note of notes) {
    const file = `${LID_NOTES_DIR}/${note.topic}.yaml`;
    if (!known.has(note.topic)) at(file, `"${note.topic}" is not a topic in ${LID_TOPICS_FILE}`);
    if (!ids.has(note.id)) at(file, `${note.id} is not in the bank`);
    const other = placed.get(note.id);
    if (other) at(file, `${note.id} is already placed in ${other}`);
    placed.set(note.id, note.topic);
    for (const p of langFieldProblems(note)) at(file, `${note.id}: ${p}`);
  }
  problems.push(...lidNotesUkProblems(notes));
  const unplaced = bank.questions.filter((q) => !placed.has(q.id)).map((q) => q.id);
  if (unplaced.length)
    at(LID_NOTES_DIR, `${unplaced.length} question(s) belong to no topic: ${unplaced.slice(0, 12).join(', ')}${unplaced.length > 12 ? ' …' : ''}`);
  return problems;
}

/**
 * Ukrainian is all-or-none per notes file, the scope every other content file is held to: one `uk`
 * anywhere in `notes/<topic>.yaml` obliges a `uk` beside every `ru` in it — question, options and
 * terms. A file with none passes here; `tests/i18n-content.test.ts` is what holds every file to
 * carrying one.
 */
export function lidNotesUkProblems(notes: PlacedLidNote[]): string[] {
  const problems: string[] = [];
  for (const topic of new Set(notes.map((n) => n.topic))) {
    const inFile = notes.filter((n) => n.topic === topic);
    if (!hasUkField(inFile)) continue;
    for (const note of inFile)
      for (const p of ukParityProblems(note, { forceUk: true })) problems.push(`${LID_NOTES_DIR}/${topic}.yaml: ${note.id}: ${p}`);
  }
  return problems;
}

/** The one place a question meets its note — pages and the audit join through this. */
export function lidQuestionsWithNotes(root = repoRoot()): { question: LidQuestion; note: PlacedLidNote | undefined }[] {
  const bank = loadLidBank(root);
  const notes = new Map(loadLidNotes(root).map((n) => [n.id, n]));
  return bank.questions.map((question) => ({ question, note: notes.get(question.id) }));
}

// ---------------------------------------------------------------------------
// Lessons — `content/lid/lessons/<lesson-id>.mdx`, compact reading in simple German that teaches
// the system behind a group of questions. Reading material, not spine topics (ADR 0021): no
// exercises, no probes, no Themen or grammar denominators. A topic belongs to at most one lesson,
// so a question has at most one lesson to point back to.

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** One lesson file, read but not yet judged. */
interface LidLessonSource {
  /** the file name without `.mdx` — the lesson id */
  id: string;
  /** repo-relative, e.g. `content/lid/lessons/wahlen-parteien.mdx` */
  file: string;
  frontmatter: { ok: true; data: unknown } | { ok: false; error: string };
  body: string;
}

function readLidLessonSources(root: string): LidLessonSource[] {
  const dir = join(root, LID_LESSONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const source = readFileSync(join(dir, name), 'utf8');
      const match = FRONTMATTER.exec(source);
      const body = match ? source.slice(match[0].length) : source;
      let frontmatter: LidLessonSource['frontmatter'];
      if (!match) frontmatter = { ok: false, error: 'missing frontmatter block' };
      else {
        try {
          frontmatter = { ok: true, data: YAML.parse(match[1]!) as unknown };
        } catch (err) {
          frontmatter = { ok: false, error: `frontmatter YAML parse error: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
      return { id: basename(name, '.mdx'), file: `${LID_LESSONS_DIR}/${name}`, frontmatter, body };
    });
}

/** A lesson as the pages see it: its frontmatter, its id (the file name) and the file its body is in. */
export type LoadedLidLesson = LidLesson & { id: string; bodyPath: string };

/**
 * Every lesson, sorted by `order`. An absent or empty directory is zero lessons. A malformed file
 * throws, naming itself — `lidLessonProblems` is where `bun run validate` reports it properly.
 */
export function loadLidLessons(root = repoRoot()): LoadedLidLesson[] {
  return readLidLessonSources(root)
    .map((source) => {
      if (!source.frontmatter.ok) throw new Error(`${source.file}: ${source.frontmatter.error}`);
      const parsed = lidLessonSchema.safeParse(source.frontmatter.data);
      if (!parsed.success) throw new Error(`${source.file}: ${parsed.error.message}`);
      return { ...parsed.data, id: source.id, bodyPath: source.file };
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * The body's shape: it opens with `## Kurz gesagt` (only MDX comments may precede it), that
 * section holds exactly one `<Bilingual>` block with an `<En>` and a `<Ru>` half, and it is the
 * lesson's only bilingual block — everything after it is German, in `##` sections. No `#`
 * heading: the page already has its title.
 */
export function lidLessonBodyProblems(body: string): string[] {
  const problems: string[] = [];
  const heading = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
  const headings = [...body.matchAll(heading)].map((m) => ({ depth: m[1]!.length, text: m[2]!, at: m.index }));
  const first = headings[0];
  if (!first || first.depth !== 2 || first.text !== 'Kurz gesagt') {
    problems.push(
      `the first heading must be "## Kurz gesagt"${first ? `, found "${'#'.repeat(first.depth)} ${first.text}"` : ', found none'}`,
    );
    return problems;
  }
  const before = body.slice(0, first.at).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
  if (before) problems.push(`nothing but MDX comments may precede "## Kurz gesagt": "${before.slice(0, 60)}"`);
  if (headings.some((h) => h.depth === 1)) problems.push('no "#" heading — the page renders the lesson title itself');

  const next = headings.find((h) => h.at > first.at && h.depth <= 2);
  if (!next) problems.push('after "## Kurz gesagt" comes at least one "##" section in German');
  const section = body.slice(first.at, next?.at ?? body.length);
  const blocks = section.match(/<Bilingual>[\s\S]*?<\/Bilingual>/g) ?? [];
  if (blocks.length !== 1)
    problems.push(`"## Kurz gesagt" holds exactly one <Bilingual> block, found ${blocks.length}`);
  else if (!blocks[0]!.includes('<En>') || !blocks[0]!.includes('<Ru>'))
    problems.push('the <Bilingual> block of "## Kurz gesagt" needs an <En> and a <Ru> half');
  const elsewhere = (body.match(/<Bilingual\b/g) ?? []).length - (section.match(/<Bilingual\b/g) ?? []).length;
  if (elsewhere > 0)
    problems.push(`${elsewhere} <Bilingual> block(s) outside "## Kurz gesagt" — the lesson body after it is German only`);
  return problems;
}

/**
 * Everything `bun run validate` holds the lessons to (called by `lidProblems`; `topics` is passed
 * when the caller already has them). Empty means valid, and zero lesson files is valid.
 *
 * Language discipline is the discovery pieces' (scripts/validate.ts `checkMdxLangDiscipline`):
 * letter sets in frontmatter and body, prose shape, and uk parity bridged across the two — which
 * fires only once a file carries some `uk` (the corpus ratchet in tests/i18n-content.test.ts is what
 * holds every lesson to carrying it). No
 * de parity: a term's `de` is the German word itself, not a German-medium explanation half.
 */
export function lidLessonProblems(root = repoRoot(), topics?: LidTopics): string[] {
  const problems: string[] = [];
  const at = (file: string, msg: string) => problems.push(`${file}: ${msg}`);
  const sources = readLidLessonSources(root);
  if (sources.length === 0) return problems;

  let known: Set<string>;
  try {
    known = new Set((topics ?? loadLidTopics(root)).modules.flatMap((m) => m.topics.map((t) => t.id)));
  } catch (err) {
    at(LID_TOPICS_FILE, String(err));
    return problems;
  }

  const topicOwner = new Map<string, string>();
  const orderOwner = new Map<number, string>();
  for (const source of sources) {
    const { file, body } = source;
    if (!LID_LESSON_ID.test(source.id)) at(file, `"${source.id}" is not a lesson id — the file name is the id, kebab-case ASCII`);
    for (const p of lidLessonBodyProblems(body)) at(file, p);

    const fm = source.frontmatter.ok ? source.frontmatter.data : undefined;
    if (!source.frontmatter.ok) at(file, source.frontmatter.error);
    for (const p of langFieldProblems(fm)) at(file, p);
    for (const p of ukParityProblems(fm, { forceUk: body.includes('<Uk>') })) at(file, p);
    const report = mdxLangProblems(body, { forceUk: hasUkField(fm) });
    for (const p of [...report.balance, ...report.letters, ...report.parity]) at(file, p);
    for (const p of proseShapeProblems(body)) at(file, p);
    if (!source.frontmatter.ok) continue;

    const parsed = lidLessonSchema.safeParse(fm);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) at(file, `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      continue;
    }
    const lesson = parsed.data;
    for (const topic of new Set(lesson.topics)) {
      if (!known.has(topic)) at(file, `"${topic}" is not a topic in ${LID_TOPICS_FILE}`);
      const owner = topicOwner.get(topic);
      if (owner) at(file, `topic "${topic}" already belongs to lesson "${owner}" — a topic belongs to at most one lesson`);
      else topicOwner.set(topic, source.id);
    }
    const sameOrder = orderOwner.get(lesson.order);
    if (sameOrder) at(file, `order ${lesson.order} is already taken by lesson "${sameOrder}"`);
    else orderOwner.set(lesson.order, source.id);
  }
  return problems;
}
