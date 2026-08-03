/**
 * Automatic progress sync (dev server, desktop app, and the cloud account).
 *
 * Every progress write (attempt, card grade, session, topic state) schedules a
 * debounced full-snapshot sync. Three backends:
 *
 * - Dev server (`import.meta.env.DEV`): POST to the dev-only middleware
 *   (`POST /__progress/<profile>`, see src/integrations/progress-writer.ts),
 *   which writes into the repo's progress/ folder.
 * - Tauri desktop app: write via the fs plugin into the configurable sync
 *   folder (see src/lib/syncdir.ts). Under `bun tauri dev` both backends run.
 * - A signed-in and **approved** cloud account: PUT to `/api/sync/snapshot`
 *   (src/lib/sync-remote.ts). With no account this is a no-op, so the deployed
 *   site stays exactly as local-first as it was before accounts existed.
 *
 * The snapshot is full-state, so a lost sync self-heals on the next write.
 *
 * **The two cadences are deliberately different.** The local backends write a
 * file on the same machine, so 2.5 s costs nothing. The remote backend uploads
 * over the learner's connection: the largest real snapshot is 1,141,842 bytes
 * (`wc -c progress/vitaly/2026-08-03.json`), which `gzip -9` takes to 113,814 —
 * so a 30-minute session on a 2.5 s debounce could push ~100 times, roughly
 * 11 MB of mobile data for one day of practice. Remote therefore waits 20 s and
 * never fires more than once a minute, with the page-leaving flush underneath
 * so nothing is lost to the floor.
 */
import { getActiveProfile, getActiveProfileId } from './profile';
import { isTauri, writeSnapshotToSyncDir } from './syncdir';

const DELAY_MS = 2500;
/** Remote debounce: long enough that a run of answers becomes one upload. */
const REMOTE_DELAY_MS = 20_000;
/** Floor between remote syncs, whatever the debounce says. */
const REMOTE_MIN_INTERVAL_MS = 60_000;

let timer: number | undefined;
let remoteTimer: number | undefined;
let remoteLastAt = 0;
let remoteInFlight = false;
let listening = false;

export function scheduleAutoSync(): void {
  if (typeof window === 'undefined') return;

  if (import.meta.env.DEV || isTauri()) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      void sync();
    }, DELAY_MS);
  }

  scheduleRemoteSync();

  if (!listening) {
    listening = true;
    // leaving the page before the debounce fires: sync immediately —
    // keepalive lets the request outlive the document. pagehide covers
    // navigation/reload (visibilitychange alone does not fire there in
    // every browser); visibilitychange covers tab switch / minimize.
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPending();
    });
  }
}

function scheduleRemoteSync(): void {
  window.clearTimeout(remoteTimer);
  remoteTimer = window.setTimeout(() => {
    remoteTimer = undefined;
    void runRemoteSync();
  }, REMOTE_DELAY_MS);
}

/**
 * Run the cloud sync, unless one is already in flight or the floor has not
 * elapsed. Overlapping runs would each pull, merge and push the same state and
 * race each other into conflicts.
 */
async function runRemoteSync(force = false): Promise<void> {
  if (remoteInFlight) return;
  if (!force && Date.now() - remoteLastAt < REMOTE_MIN_INTERVAL_MS) {
    // Too soon. Come back when the floor has passed rather than dropping the write.
    scheduleRemoteSync();
    return;
  }
  remoteInFlight = true;
  try {
    const { syncNow } = await import('./sync-remote');
    await syncNow();
  } catch {
    // Offline, signed out, or the API is unreachable — the next write retries.
  } finally {
    remoteInFlight = false;
    remoteLastAt = Date.now();
  }
}

/** Sync now, ignoring the debounce and the floor — for an explicit button press. */
export function flushRemoteSync(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  window.clearTimeout(remoteTimer);
  remoteTimer = undefined;
  return runRemoteSync(true);
}

function flushPending(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
    void sync();
  }
  if (remoteTimer !== undefined) {
    window.clearTimeout(remoteTimer);
    remoteTimer = undefined;
    // The floor does not apply to a page that is going away: this is the last
    // chance to persist the session that just happened.
    void runRemoteSync(true);
  }
}

async function sync(): Promise<void> {
  let body: string;
  try {
    // deferred import: store.ts imports this module (runtime-only cycle)
    const { exportSnapshot } = await import('./store');
    const snapshot = await exportSnapshot(getActiveProfile().label);
    body = JSON.stringify(snapshot, null, 2);
  } catch {
    return; // snapshot unavailable — the next write retries
  }

  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/__progress/${getActiveProfileId()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
      // fetch only rejects on a network failure, so a refused write (e.g. the writer
      // declining to shrink an existing snapshot — see progress-writer.ts) arrives as
      // a perfectly successful response and would otherwise pass unnoticed while sync
      // silently stopped happening. Say so.
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string } | null;
        console.warn(
          `[autosync] progress not written (${res.status}): ${detail?.message ?? 'unknown reason'}`,
        );
      }
    } catch {
      // dev endpoint unavailable or write failed — the next write retries
    }
  }

  if (isTauri()) {
    try {
      const { localDateString } = await import('./store');
      await writeSnapshotToSyncDir(getActiveProfileId(), body, localDateString());
    } catch {
      // sync folder unwritable (moved/permission revoked) — the next write retries
    }
  }
}
