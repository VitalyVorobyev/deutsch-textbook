/**
 * The shared queue from Claude's side (ADR 0014). Run at the start of every session.
 *
 *   bun run queue                          what the owner filed or replied, in full; counts of the rest
 *   bun run queue --all                    every entry
 *   bun run queue --id q-0007              one entry
 *   bun run queue --answer q-0007 "…"      answer; the entry then waits for the owner
 *   bun run queue --close q-0007           resolve it, in the pull request that resolves it
 *   bun run queue --new --topic <id> "…"   file an entry (also --file <path> [--item <id>],
 *                                          --kind <kind>; --type finding|request|question,
 *                                          default question; a finding waits for Claude)
 */
import { contentGraph } from '@da/content/graph';
import { addNote, closeEntry, fileEntry, loadQueue, type QueueResult } from '@da/content/queue';
import { repoRoot } from '@da/content/repo-root';
import { QUEUE_TYPES, type QueueEntry, type QueueTarget } from '@da/schema';

const root = repoRoot();
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
/** The text is the last argument that is neither a flag nor a flag's value. */
const text = (): string => {
  const valued = new Set(['answer', 'close', 'topic', 'file', 'item', 'kind', 'type', 'id']);
  const free = args.filter((arg, i) => {
    if (arg.startsWith('--')) return false;
    const previous = args[i - 1];
    return !(previous?.startsWith('--') && valued.has(previous.slice(2)));
  });
  return free.join(' ');
};

function target(entry: QueueEntry): string {
  const t = entry.target;
  return t.topic
    ? `topic ${t.topic}`
    : t.kind
      ? `kind ${t.kind}`
      : `${t.file}${t.item ? ` · ${t.item}` : ''}`;
}

function print(entry: QueueEntry): void {
  console.log(`${entry.id}  ${entry.type}  ${target(entry)}  (waiting: ${entry.waiting})`);
  for (const note of entry.thread) console.log(`    ${note.from} ${note.at}: ${note.text}`);
}

function done(result: QueueResult, what: string): never {
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(what);
  process.exit(0);
}

const answer = flag('answer');
const close = flag('close');
if (answer) done(addNote(root, { id: answer, from: 'claude', text: text() }), `${answer} answered`);
if (close) done(closeEntry(root, close), `${close} closed`);
if (args.includes('--new')) {
  const type = (flag('type') ?? 'question') as (typeof QUEUE_TYPES)[number];
  if (!QUEUE_TYPES.includes(type))
    done({ ok: false, error: `--type is ${QUEUE_TYPES.join('|')}` }, '');
  const topic = flag('topic');
  const file = flag('file');
  const kind = flag('kind');
  const item = flag('item');
  const where: QueueTarget = topic
    ? { topic }
    : kind
      ? { kind }
      : { file, ...(item ? { item } : {}) };
  const result = fileEntry(
    root,
    { type, target: where, from: 'claude', text: text() },
    contentGraph(root),
  );
  done(result, result.ok && result.entry ? `${result.entry.id} filed` : '');
}

const entries = loadQueue(root).entries;
const lastFrom = (entry: QueueEntry) => entry.thread.at(-1)!.from;
if (args.includes('--all')) {
  for (const entry of entries) print(entry);
  process.exit(0);
}
const one = flag('id');
if (one) {
  const entry = entries.find((e) => e.id === one);
  if (!entry) done({ ok: false, error: `${one} is not in the queue` }, '');
  print(entry!);
  process.exit(0);
}
// What the owner said last comes first and in full: that is the session's work.
const fromOwner = entries.filter((e) => e.waiting === 'claude' && lastFrom(e) === 'owner');
const ownFindings = entries.filter((e) => e.waiting === 'claude' && lastFrom(e) === 'claude');
const theirs = entries.filter((e) => e.waiting === 'owner');
if (!fromOwner.length) console.log('Nothing from the owner is waiting for Claude.');
for (const entry of fromOwner) print(entry);
console.log(
  `\n${ownFindings.length} of Claude's own findings wait to be fixed when their files are next ` +
    `touched; ${theirs.length} entries wait for the owner. --all lists them, --id <q-…> shows one.`,
);
