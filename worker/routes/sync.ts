/**
 * Snapshot storage. **The server stores opaque bytes.**
 *
 * It never parses, validates, migrates or merges a snapshot — every one of
 * those lives in `src/lib/snapshot-schema.ts` and `src/lib/snapshot-merge.ts`
 * and runs on the client. Three consequences, all deliberate:
 *
 * - Snapshot **v8 needs no Worker deploy.** The schema has exactly one home,
 *   the same as it had before there was a server.
 * - This route **cannot** implement the dev writer's refuse-to-shrink rule
 *   (src/integrations/progress-writer.ts) — counting attempts means parsing.
 *   Its job is done instead by the conditional PUT below plus the client's
 *   non-destructive merge, with the per-day object as the net underneath.
 * - Size is enforced as a byte cap, not a shape check.
 *
 * **Concurrency is R2's own.** `onlyIf: { etagMatches }` is an atomic
 * compare-and-set at the storage layer, so two devices writing at once cannot
 * interleave: the loser gets 412, pulls, merges locally, and writes again. No
 * version column, no D1 write on the hot path.
 */
import { authenticate } from '../auth/session';
import { json, methodNotAllowed, noContent, problem, readCappedBody } from '../http';
import type { Env } from '../env';
import type { UserRow } from '../db';

/**
 * 5 MB of gzip. Measured headroom: the largest real snapshot is
 * `wc -c progress/vitaly/2026-08-03.json` = 1,141,842 bytes, which `gzip -9`
 * takes to 113,814 — so this is 44x the live corpus after eighteen months of
 * daily use.
 */
export const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

const CONTENT_TYPE = 'application/gzip';

export function currentKey(userId: string): string {
  return `snapshots/${userId}/current.json.gz`;
}

export function dailyKey(userId: string, date: string): string {
  return `snapshots/${userId}/daily/${date}.json.gz`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The learner's *local* date, sent as a header.
 *
 * Deliberately not `new Date()` on the server: `localDateString()` in
 * src/lib/store.ts is local time, the repo's `progress/<profile>/<date>.json`
 * layout is local time, and a learner practising at 01:00 CEST would otherwise
 * have their day filed under the previous one.
 */
export function snapshotDate(request: Request): string | null {
  const raw = request.headers.get('x-snapshot-date');
  return raw && DATE_PATTERN.test(raw) ? raw : null;
}

export async function handleSync(
  request: Request,
  env: Env,
  url: URL,
  segments: string[],
  secure: boolean,
  now: number,
): Promise<Response> {
  if (segments[0] !== 'snapshot' || segments.length !== 1) {
    return problem(404, 'not-found', 'Unknown sync route.');
  }

  const principal = await authenticate(request, env, secure, now);
  if (!principal) return problem(401, 'signed-out', 'Not signed in.');

  // The approval gate. A pending account is a fully working local-first app
  // that simply has no cloud copy — so this says *why*, and the client renders
  // it as a status line rather than an error.
  const gate = storageGate(principal.user);
  if (gate) return gate;

  switch (request.method) {
    case 'GET':
      return getSnapshot(request, env, principal.user.id);
    case 'PUT':
      return putSnapshot(request, env, url, principal.user.id);
    case 'DELETE':
      return deleteSnapshot(env, principal.user.id);
    default:
      return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }
}

function storageGate(user: UserRow): Response | null {
  if (user.status === 'approved') return null;
  return user.status === 'blocked'
    ? problem(403, 'blocked', 'This account has been blocked.')
    : problem(403, 'pending', 'This account is waiting for approval.');
}

async function getSnapshot(request: Request, env: Env, userId: string): Promise<Response> {
  // `If-None-Match` makes "has the other device written anything?" nearly free,
  // which is what lets the client ask on every sync instead of only after a
  // conflict. Without it, a device that never writes would never pull.
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) {
    const head = await env.SNAPSHOTS.head(currentKey(userId));
    if (!head) return problem(404, 'no-snapshot', 'No snapshot stored yet.');
    if (unquote(ifNoneMatch) === head.etag) {
      return new Response(null, {
        status: 304,
        headers: { etag: `"${head.etag}"`, 'cache-control': 'no-store' },
      });
    }
  }

  const object = await env.SNAPSHOTS.get(currentKey(userId));
  if (!object) return problem(404, 'no-snapshot', 'No snapshot stored yet.');
  return new Response(object.body, {
    headers: {
      'content-type': CONTENT_TYPE,
      // Quoted per RFC 9110; the client echoes it back verbatim in If-Match.
      etag: `"${object.etag}"`,
      'cache-control': 'no-store',
      'x-snapshot-uploaded': object.uploaded.toISOString(),
    },
  });
}

/** Strip the quotes (and any weak-validator prefix) R2 does not use in `etag`. */
function unquote(value: string): string {
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
}

async function putSnapshot(
  request: Request,
  env: Env,
  url: URL,
  userId: string,
): Promise<Response> {
  const body = await readCappedBody(request, MAX_SNAPSHOT_BYTES);
  if (body === 'too-large') {
    return problem(413, 'too-large', `Snapshot exceeds ${MAX_SNAPSHOT_BYTES} bytes.`);
  }
  if (body.byteLength === 0) return problem(400, 'empty', 'Empty snapshot.');

  const ifMatch = request.headers.get('if-match');
  const ifNoneMatch = request.headers.get('if-none-match');

  // Two preconditions, and a write with neither is refused. An unconditional PUT
  // is exactly the operation that loses another device's day of work, so it is
  // not reachable: a first write says `If-None-Match: *`, every later one names
  // the etag it is replacing.
  let onlyIf: R2Conditional;
  if (ifMatch) {
    onlyIf = { etagMatches: unquote(ifMatch) };
  } else if (ifNoneMatch === '*') {
    onlyIf = { etagDoesNotMatch: '*' };
  } else {
    return problem(428, 'precondition-required', 'Send If-Match: <etag> or If-None-Match: *.');
  }

  const written = await env.SNAPSHOTS.put(currentKey(userId), body, {
    onlyIf,
    httpMetadata: { contentType: CONTENT_TYPE },
  });

  if (!written) {
    // Someone else wrote first. The client pulls, merges locally, and retries —
    // the merge is never done here.
    const current = await env.SNAPSHOTS.head(currentKey(userId));
    return json(
      { error: 'conflict', message: 'The stored snapshot changed. Pull, merge and retry.' },
      { status: 412, headers: current ? { etag: `"${current.etag}"` } : {} },
    );
  }

  // The day's copy: an unconditional write to its own key, so a merge that goes
  // wrong is recoverable and `bun run progress:pull --date` can reach a specific
  // day. Best-effort — failing to keep the net must not fail the sync.
  const date = snapshotDate(request) ?? url.searchParams.get('date');
  if (date && DATE_PATTERN.test(date)) {
    try {
      await env.SNAPSHOTS.put(dailyKey(userId, date), body, {
        httpMetadata: { contentType: CONTENT_TYPE },
      });
    } catch {
      // ignored on purpose — see above
    }
  }

  return noContent({ etag: `"${written.etag}"` });
}

async function deleteSnapshot(env: Env, userId: string): Promise<Response> {
  await deleteAllSnapshots(env, userId);
  return noContent();
}

/** Every object belonging to an account — used by delete-my-data and account deletion. */
export async function deleteAllSnapshots(env: Env, userId: string): Promise<void> {
  const prefix = `snapshots/${userId}/`;
  let cursor: string | undefined;
  do {
    const listed = await env.SNAPSHOTS.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await env.SNAPSHOTS.delete(listed.objects.map((object) => object.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
