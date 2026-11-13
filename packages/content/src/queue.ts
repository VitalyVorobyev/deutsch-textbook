/**
 * The shared queue (ADR 0014): findings, requests and questions between the owner and Claude, in
 * `data/redaktion-queue.yaml`. Redaktion, `bun run queue` and Tonwerk's Hörprobe (through
 * `apps/tonwerk/scripts/queue-bridge.ts`) write it through here, so ids, order and bytes come out
 * the same whoever writes.
 *
 * A queue write touches no content, so it never invalidates the content graph.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import {
  queueSchema,
  type Queue,
  type QueueEntry,
  type QueueTarget,
  QUEUE_PARTIES,
  QUEUE_TYPES,
} from '@da/schema';
import { ELEMENT_KINDS } from './elements';
import type { ContentGraph } from './graph';

export const QUEUE_FILE = join('data', 'redaktion-queue.yaml');

type Party = (typeof QUEUE_PARTIES)[number];
type QueueType = (typeof QUEUE_TYPES)[number];

export function loadQueue(root: string): Queue {
  const path = join(root, QUEUE_FILE);
  if (!existsSync(path)) return { version: 1, entries: [] };
  return queueSchema.parse(YAML.parse(readFileSync(path, 'utf8')) ?? { version: 1, entries: [] });
}

/** Entries in id order, so two writers produce the same bytes and a diff shows only what moved. */
export function serializeQueue(queue: Queue): string {
  const entries = [...queue.entries].sort((a, b) => idNumber(a.id) - idNumber(b.id));
  return (
    '# Findings, requests and questions between the owner and Claude (ADR 0014). Written by\n' +
    '# Redaktion and by `bun run queue`; `waiting` says whose turn it is, and a resolved entry is\n' +
    '# deleted.\n' +
    YAML.stringify({ version: 1, entries }, { lineWidth: 0 })
  );
}

const idNumber = (id: string): number => Number(id.slice(2));

function save(root: string, queue: Queue): void {
  const path = join(root, QUEUE_FILE);
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, serializeQueue(queue));
  renameSync(tmp, path);
}

const today = (): string => new Date().toISOString().slice(0, 10);
const other = (party: Party): Party => (party === 'owner' ? 'claude' : 'owner');

export type QueueResult = { ok: true; entry?: QueueEntry } | { ok: false; error: string };

/**
 * Who acts first on a new entry. The owner's entries wait for Claude. Claude's questions and
 * requests wait for the owner; a finding Claude files is Claude's own to fix, so it waits for
 * Claude.
 */
export function firstTurn(from: Party, type: QueueType): Party {
  return from === 'owner' || type === 'finding' ? 'claude' : 'owner';
}

/** File a new entry. */
export function fileEntry(
  root: string,
  input: { type: QueueType; target: QueueTarget; from: Party; text: string; at?: string },
  graph?: ContentGraph,
): QueueResult {
  const text = input.text.trim();
  if (!text) return { ok: false, error: 'an entry needs text' };
  const queue = loadQueue(root);
  const id = `q-${String(Math.max(0, ...queue.entries.map((e) => idNumber(e.id))) + 1).padStart(4, '0')}`;
  const entry: QueueEntry = {
    id,
    type: input.type,
    target: input.target,
    waiting: firstTurn(input.from, input.type),
    thread: [{ from: input.from, at: input.at ?? today(), text }],
  };
  const parsed = queueSchema.safeParse({ version: 1, entries: [...queue.entries, entry] });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
  const problem = graph ? targetProblem(root, graph, entry.target) : undefined;
  if (problem) return { ok: false, error: problem };
  save(root, parsed.data);
  return { ok: true, entry };
}

/** Add to an entry's thread — an answer or a reply — and hand the turn to the other party. */
export function addNote(
  root: string,
  input: { id: string; from: Party; text: string; at?: string },
): QueueResult {
  const text = input.text.trim();
  if (!text) return { ok: false, error: 'a note needs text' };
  const queue = loadQueue(root);
  const entry = queue.entries.find((e) => e.id === input.id);
  if (!entry) return { ok: false, error: `${input.id} is not in the queue` };
  entry.thread.push({ from: input.from, at: input.at ?? today(), text });
  entry.waiting = other(input.from);
  save(root, queue);
  return { ok: true, entry };
}

/** Resolve an entry: it leaves the queue, and `git log` keeps the thread. */
export function closeEntry(root: string, id: string): QueueResult {
  const queue = loadQueue(root);
  if (!queue.entries.some((e) => e.id === id))
    return { ok: false, error: `${id} is not in the queue` };
  save(root, { version: 1, entries: queue.entries.filter((e) => e.id !== id) });
  return { ok: true };
}

/** The set that holds an item now — the item move map of the learner app, passed in by a caller. */
export type ItemLocator = (setId: string, itemId: string) => string;

/** The ids of the items or questions a YAML file holds, or `undefined` when it is not such a file. */
function fileItemIds(root: string, file: string): string[] | undefined {
  try {
    const doc = YAML.parse(readFileSync(join(root, file), 'utf8')) as {
      items?: { id?: string }[];
      questions?: { id?: string }[];
    };
    return [...(doc.items ?? []), ...(doc.questions ?? [])].flatMap((i) => (i.id ? [i.id] : []));
  } catch {
    return undefined;
  }
}

const EXERCISE_FILE = /^content\/exercises\/(.+)\.yaml$/;

/**
 * Why a target names nothing in the corpus, or `undefined` when it names something. An entry is
 * never rewritten by hand, so an item filed against a set it has since moved out of (ADR 0019) is
 * read at its current location when `locate` is given.
 */
export function targetProblem(
  root: string,
  graph: ContentGraph,
  target: QueueTarget,
  locate?: ItemLocator,
): string | undefined {
  if (target.topic)
    return graph.topics.has(target.topic) ? undefined : `no topic "${target.topic}"`;
  if (target.kind)
    return (ELEMENT_KINDS as readonly string[]).includes(target.kind)
      ? undefined
      : `no material kind "${target.kind}"`;
  const file = target.file!;
  if (!existsSync(join(root, file))) return `${file} does not exist`;
  if (!target.item) return undefined;
  const ids = fileItemIds(root, file);
  if (!ids) return `${file} is not YAML with items`;
  if (ids.includes(target.item)) return undefined;
  const setId = EXERCISE_FILE.exec(file)?.[1];
  const now = setId && locate ? locate(setId, target.item) : undefined;
  if (
    now &&
    now !== setId &&
    fileItemIds(root, `content/exercises/${now}.yaml`)?.includes(target.item)
  )
    return undefined;
  return `${file} has no item "${target.item}"`;
}

/** Queue defects the validator reports: a malformed file, a duplicate id, a dangling target. */
export function queueProblems(root: string, graph: ContentGraph, locate?: ItemLocator): string[] {
  let queue: Queue;
  try {
    queue = loadQueue(root);
  } catch (error) {
    return [`${QUEUE_FILE}: ${error instanceof Error ? error.message : String(error)}`];
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of queue.entries) {
    if (seen.has(entry.id)) problems.push(`${QUEUE_FILE}: two entries with id ${entry.id}`);
    seen.add(entry.id);
    const problem = targetProblem(root, graph, entry.target, locate);
    if (problem) problems.push(`${QUEUE_FILE}: ${entry.id} — ${problem}`);
  }
  return problems;
}

/** What the owner can do from Redaktion: file, reply, close. */
export type OwnerQueueAction =
  | { action: 'file'; type: QueueType; target: QueueTarget; text: string }
  | { action: 'reply'; id: string; text: string }
  | { action: 'close'; id: string };

/** The one entry point both Redaktion transports use, so the browser and the desktop app agree. */
export function ownerQueueAction(
  root: string,
  graph: ContentGraph,
  input: OwnerQueueAction,
): QueueResult {
  switch (input?.action) {
    case 'file':
      return fileEntry(
        root,
        { type: input.type, target: input.target, from: 'owner', text: String(input.text ?? '') },
        graph,
      );
    case 'reply':
      return addNote(root, { id: String(input.id), from: 'owner', text: String(input.text ?? '') });
    case 'close':
      return closeEntry(root, String(input.id));
    default:
      return { ok: false, error: 'action is file, reply or close' };
  }
}
