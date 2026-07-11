/**
 * Automatic progress sync (dev server and desktop app).
 *
 * Every progress write (attempt, card grade, session, topic state) schedules a
 * debounced full-snapshot sync. Two backends, both writing the same
 * `progress/<profile>/<date>.json` layout:
 *
 * - Dev server (`import.meta.env.DEV`): POST to the dev-only middleware
 *   (`POST /__progress/<profile>`, see src/integrations/progress-writer.ts),
 *   which writes into the repo's progress/ folder.
 * - Tauri desktop app: write via the fs plugin into the configurable sync
 *   folder (see src/lib/syncdir.ts). Under `bun tauri dev` both backends run.
 *
 * The snapshot is full-state, so a lost sync self-heals on the next write.
 * On the plain deployed website neither backend exists and every call is a
 * no-op — it keeps manual Export/Import.
 */
import { getActiveProfile, getActiveProfileId } from './profile';
import { isTauri, writeSnapshotToSyncDir } from './syncdir';

const DELAY_MS = 2500;

let timer: number | undefined;
let listening = false;

export function scheduleAutoSync(): void {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV && !isTauri()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    void sync();
  }, DELAY_MS);

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

function flushPending(): void {
  if (timer === undefined) return;
  window.clearTimeout(timer);
  timer = undefined;
  void sync();
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
      await fetch(`/__progress/${getActiveProfileId()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
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
