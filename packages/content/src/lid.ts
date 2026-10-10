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
  lidBankSchema,
  lidNotesFileSchema,
  lidTopicsSchema,
  type LidBank,
  type LidNote,
  type LidQuestion,
  type LidTopics,
} from '@da/schema/lid';
import { langFieldProblems } from '@da/schema/langcheck';
import { repoRoot } from './repo-root';

export const LID_BANK_FILE = 'data/lid/bank.yaml';
export const LID_TOPICS_FILE = 'content/lid/topics.yaml';
export const LID_NOTES_DIR = 'content/lid/notes';

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
  const unplaced = bank.questions.filter((q) => !placed.has(q.id)).map((q) => q.id);
  if (unplaced.length)
    at(LID_NOTES_DIR, `${unplaced.length} question(s) belong to no topic: ${unplaced.slice(0, 12).join(', ')}${unplaced.length > 12 ? ' …' : ''}`);
  return problems;
}

/** The one place a question meets its note — pages and the audit join through this. */
export function lidQuestionsWithNotes(root = repoRoot()): { question: LidQuestion; note: PlacedLidNote | undefined }[] {
  const bank = loadLidBank(root);
  const notes = new Map(loadLidNotes(root).map((n) => [n.id, n]));
  return bank.questions.map((question) => ({ question, note: notes.get(question.id) }));
}
