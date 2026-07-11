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

/** Write a snapshot into the sync folder; returns the file path written. */
export async function writeSnapshotToSyncDir(
  profileId: string,
  body: string,
  date: string,
): Promise<string> {
  const [{ mkdir, writeTextFile }, { join }] = await Promise.all([
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path'),
  ]);
  const folder = await join(await getSyncDir(), profileId);
  await mkdir(folder, { recursive: true });
  const path = await join(folder, `${date}.json`);
  await writeTextFile(path, body);
  return path;
}
