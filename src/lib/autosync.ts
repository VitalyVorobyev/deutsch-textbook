/**
 * Dev-only automatic progress sync.
 *
 * Every progress write (attempt, card grade, session, topic state) schedules
 * a debounced POST of the full snapshot to the dev-server middleware
 * (`POST /__progress/<profile>`, see src/integrations/progress-writer.ts),
 * which writes `progress/<profile>/<date>.json` into the repo. The snapshot
 * is full-state, so a lost sync self-heals on the next write.
 *
 * In a production build `import.meta.env.DEV` is statically false and every
 * call is a no-op — the deployed site keeps manual Export/Import (there is
 * no server to write to).
 */
import { getActiveProfile, getActiveProfileId } from './profile';

const DELAY_MS = 2500;

let timer: number | undefined;
let listening = false;

export function scheduleAutoSync(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
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
  try {
    // deferred import: store.ts imports this module (runtime-only cycle)
    const { exportSnapshot } = await import('./store');
    const snapshot = await exportSnapshot(getActiveProfile().label);
    await fetch(`/__progress/${getActiveProfileId()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot, null, 2),
      keepalive: true,
    });
  } catch {
    // dev endpoint unavailable or write failed — the next write retries
  }
}
