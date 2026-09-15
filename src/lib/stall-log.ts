/**
 * A bounded record of store reads that did not settle in time.
 *
 * Exists because the failure that motivated it left no evidence at all. The
 * learner saw "Fortschritt konnte nicht geladen werden" on Heute and a permanent
 * loading line on Themen; the durable snapshot on disk held 824 cards and 3919
 * attempts, the write journal was empty, the profile registry was intact and the
 * sync API answered in 41 ms. Every fact needed to say what was *not* wrong was
 * recoverable after the fact — and nothing at all said which read stalled, how
 * long it waited, or whether it ever came back.
 *
 * Two rules the shape follows:
 *
 * - **Counters and timestamps only.** A surface name, a duration, an attempt
 *   count. No card ids, no attempt contents, no learner text — a diagnostic that
 *   carries content is a second copy of the data it is diagnosing.
 * - **Synchronous localStorage**, like `write-journal.ts`: a stall is exactly the
 *   situation in which the app may be killed before anything async flushes.
 *
 * A recovery is recorded separately from the stall, because "the store unstuck
 * itself after 12 s" and "the store never answered" are different bugs and the
 * remedy differs. `withReadRetry` (`store.ts`) writes both.
 */
import { getActiveProfileId } from './profile';

/** Keep the newest entries only. Twenty is enough to see a pattern across a few
    sessions and small enough that it can never be the reason a quota is hit. */
export const STALL_LOG_CAP = 20;

export interface StallEntry {
  /** Opaque id, so a later recovery can find its own stall. */
  id: string;
  /** Which load surface was waiting (`'read'` when the caller did not say). */
  surface: string;
  /** Wall-clock ms from the first attempt to the deadline. */
  waitedMs: number;
  /** How many attempts had been fired when the deadline passed. */
  attempts: number;
  /** When the deadline passed. */
  at: number;
  /** Set once a late attempt settled: ms from the first attempt to that settle. */
  recoveredAfterMs?: number;
}

function logKey(): string {
  return `da:stall-log:${getActiveProfileId()}`;
}

export function readStallLog(): StallEntry[] {
  try {
    const raw = localStorage.getItem(logKey());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StallEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as StallEntry).id === 'string' &&
        typeof (e as StallEntry).at === 'number',
    );
  } catch {
    return [];
  }
}

function write(entries: StallEntry[]): void {
  try {
    localStorage.setItem(logKey(), JSON.stringify(entries.slice(-STALL_LOG_CAP)));
  } catch {
    // A diagnostic may never be the thing that breaks the app it is diagnosing.
  }
}

/** Record a read that hit its deadline. Returns the entry id, so the caller can
    mark it recovered if a late attempt settles after all. */
export function recordStall(input: { surface?: string; waitedMs: number; attempts: number }): string {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  write([
    ...readStallLog(),
    {
      id,
      surface: input.surface ?? 'read',
      waitedMs: Math.round(input.waitedMs),
      attempts: input.attempts,
      at: Date.now(),
    },
  ]);
  return id;
}

/** Mark a recorded stall as having settled after the deadline. */
export function recordRecovery(id: string, afterMs: number): void {
  const entries = readStallLog();
  const hit = entries.find((e) => e.id === id);
  if (!hit || hit.recoveredAfterMs !== undefined) return;
  hit.recoveredAfterMs = Math.round(afterMs);
  write(entries);
}

/** Stalls recorded in the last `days` days, newest first — what the Daten view shows. */
export function recentStalls(days = 7, now = Date.now()): StallEntry[] {
  const floor = now - days * 24 * 60 * 60 * 1000;
  return readStallLog()
    .filter((e) => e.at >= floor)
    .sort((a, b) => b.at - a.at);
}

export function clearStallLog(): void {
  try {
    localStorage.removeItem(logKey());
  } catch {
    // ignore
  }
}
