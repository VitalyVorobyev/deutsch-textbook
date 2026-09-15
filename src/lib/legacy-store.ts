/**
 * "Is there a second copy of my progress on this machine?"
 *
 * On macOS a Tauri app's WKWebView data (IndexedDB *and* localStorage) lives in a
 * container named after the bundle identifier — `~/Library/WebKit/dev.nonvision.deutsch-atlas`.
 * Launching the release *binary* without its `.app` bundle gets a container named after the
 * executable instead (`~/Library/WebKit/deutsch-atlas`), which is a completely separate
 * profile registry, a separate card store and a separate attempt log. ADR 0016 named this as
 * a real, unfixed hazard and deferred a detect-and-warn to the backlog; this is that warning.
 *
 * Two rules it never breaks: it **reports**, and it reports **metadata only** — a path and a
 * modification time from the Rust side. Nothing here reads, merges, moves or deletes the
 * other container. Deciding what to do about a second store is the owner's call, and doing it
 * silently is how a day of work disappears.
 */
import { isTauri } from './syncdir';

export interface LegacyStoreInfo {
  /** Absolute path of the other container. */
  path: string;
  /** Unix seconds of its last modification, or 0 when unreadable. */
  modifiedAt: number;
}

/**
 * The other container, or `null` when there is none (and on every platform and build where
 * the question does not apply — the browser build, Windows, Linux).
 */
export async function legacyWebkitContainer(): Promise<LegacyStoreInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const found = await invoke<LegacyStoreInfo | null>('legacy_webkit_container');
    return found ?? null;
  } catch {
    // An older shell without the command, or a platform where it is not compiled in.
    return null;
  }
}
