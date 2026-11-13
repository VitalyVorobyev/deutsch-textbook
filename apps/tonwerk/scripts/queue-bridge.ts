/**
 * The shared queue (ADR 0014), reached from the Tonwerk engine.
 *
 * The queue has one writer, `@da/content/queue`, and Redaktion and `bun run queue` both go through
 * it. The engine is Python, so it does not import that module: it runs this script once per
 * request, hands it one JSON object on stdin and reads one JSON object back from stdout. That keeps
 * the ids, the order and the bytes of `data/redaktion-queue.yaml` the same whoever writes them,
 * and leaves no second YAML writer in the engine.
 *
 *   bun apps/tonwerk/scripts/queue-bridge.ts <repo root>
 *     {"action":"list"}                                  → {"ok":true,"entries":[…]}
 *     {"action":"file","type":"finding","target":{…},"text":"…"}
 *                                                        → {"ok":true,"entry":{…}} | {"ok":false,"error":"…"}
 *
 * Only `list` and `file` are offered: a verdict heard in Tonwerk files an entry as the owner, and
 * answering or closing one stays with Redaktion and `bun run queue`.
 */
import { contentGraph } from '@da/content/graph';
import { loadQueue, ownerQueueAction, type OwnerQueueAction } from '@da/content/queue';

type Request = { action: 'list' } | Extract<OwnerQueueAction, { action: 'file' }>;

/** One request against the queue under `root`. */
export function answer(root: string, request: Request): unknown {
  if (request?.action === 'list') return { ok: true, entries: loadQueue(root).entries };
  if (request?.action === 'file') return ownerQueueAction(root, contentGraph(root), request);
  return { ok: false, error: 'action is list or file' };
}

if (import.meta.main) {
  const root = process.argv[2];
  if (!root) {
    console.error('usage: queue-bridge.ts <repo root>');
    process.exit(2);
  }
  const raw = await Bun.stdin.text();
  console.log(JSON.stringify(answer(root, JSON.parse(raw) as Request)));
}
