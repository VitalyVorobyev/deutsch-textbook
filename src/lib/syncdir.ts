/**
 * Desktop (Tauri) snapshot sync folder.
 *
 * The packaged app writes progress snapshots to `<sync dir>/<profile>/<date>.json`
 * — the same layout the dev middleware produces in the repo's progress/ folder.
 * The folder defaults to `<app data>/progress` and can be repointed (e.g. at a
 * cloned repo's progress/ directory) on the Fortschritt page; the choice is
 * persisted in localStorage. Tauri plugin modules are imported dynamically so
 * the web bundle never loads them.
 */

export const SYNCDIR_KEY = 'da:syncdir';

/** True when running inside the Tauri webview (desktop app, incl. `bun tauri dev`). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getSyncDirOverride(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(SYNCDIR_KEY) : null;
}

/** Absolute path of the folder snapshots are written to (default: app data). */
export async function getSyncDir(): Promise<string> {
  const override = getSyncDirOverride();
  if (override) return override;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), 'progress');
}

/** Folder picker; persists the choice. Returns the new dir, or null if cancelled. */
export async function pickSyncDir(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({ directory: true, title: 'Sync-Ordner' });
  if (typeof dir !== 'string' || !dir) return null;
  localStorage.setItem(SYNCDIR_KEY, dir);
  return dir;
}

/**
 * Would writing `incomingRaw` over `existingRaw` lose attempts?
 *
 * The same rule as the dev writer (src/integrations/progress-writer.ts) and
 * `progress:pull`: attempts only ever grow, so an incoming snapshot with fewer
 * of them is not "today's state" — it is a different, staler state (a second
 * container, a stalled read exporting an empty store) about to flatten a real
 * day of work. An existing file that does not parse is treated the same way:
 * park rather than overwrite, investigate rather than delete.
 */
export function snapshotWouldShrink(existingRaw: string, incomingRaw: string): boolean {
  let had: number;
  try {
    const prior = JSON.parse(existingRaw) as { attempts?: unknown[] };
    had = Array.isArray(prior.attempts) ? prior.attempts.length : 0;
  } catch {
    return true;
  }
  let now = 0;
  try {
    const next = JSON.parse(incomingRaw) as { attempts?: unknown[] };
    now = Array.isArray(next.attempts) ? next.attempts.length : 0;
  } catch {
    return true;
  }
  return now < had;
}

export interface SyncDirWrite {
  path: string;
  /** true when the write was parked in a sibling conflict file instead of the daily name. */
  parked: boolean;
}

/**
 * Write a snapshot into the sync folder; returns the file path written.
 *
 * **Never shrinks the daily file.** All three snapshot writers hold this
 * invariant (`progress:pull` refuses and parks; the dev middleware answers 409
 * `would-shrink`); this one used to be the exception, and it is the one the
 * desktop app relies on — a stale second WKWebView container writing through
 * here could silently flatten the day's backup. On a would-shrink the incoming
 * state is parked beside the daily file as `<date>.conflict-<stamp>.json`.
 */
export async function writeSnapshotToSyncDir(
  profileId: string,
  body: string,
  date: string,
): Promise<SyncDirWrite> {
  const [{ exists, mkdir, readTextFile, writeTextFile }, { join }] = await Promise.all([
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path'),
  ]);
  const folder = await join(await getSyncDir(), profileId);
  await mkdir(folder, { recursive: true });
  const path = await join(folder, `${date}.json`);
  if (await exists(path)) {
    const existing = await readTextFile(path).catch(() => null);
    if (existing !== null && snapshotWouldShrink(existing, body)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const parked = await join(folder, `${date}.conflict-${stamp}.json`);
      await writeTextFile(parked, body);
      console.warn(
        `[syncdir] ${date}.json holds more attempts than the outgoing snapshot — not shrinking; parked at ${parked}`,
      );
      return { path: parked, parked: true };
    }
  }
  await writeTextFile(path, body);
  return { path, parked: false };
}
