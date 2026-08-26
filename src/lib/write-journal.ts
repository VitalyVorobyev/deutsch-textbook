/**
 * Synchronous write-ahead journal for progress writes (client-side only).
 *
 * IndexedDB on the desktop WKWebView can stall silently: the daily backups prove
 * whole sessions' writes never landed (2026-08-19 has no backup at all) while the
 * UI advanced normally — `setCardState` was fire-and-forget and `logAttempt` had
 * no catch. The journal closes that hole from the localStorage side, which is
 * synchronous and survives an abrupt quit with no flush step (the same property
 * `resume.ts` relies on):
 *
 *   1. every critical write is journaled here BEFORE the IndexedDB attempt starts;
 *   2. the attempt runs through `withPersistenceRetry` (timed backoff + deadline);
 *   3. on success the entry is removed; on stall it STAYS, the JOURNAL_EVENT lets
 *      `PersistenceAlert` go loud, and the next launch replays it.
 *
 * Replay is safe because both op kinds are idempotent at the store layer:
 * `logAttempt` dedupes by `setId|itemId|ts`, and a grade goes through
 * `applyGradeAt`, whose `last_review >= ts` guard makes a replay of a write that
 * actually landed a no-op.
 */
import { getActiveProfileId } from './profile';
import {
  logAttempt,
  updateCardState,
  withPersistenceRetry,
  type NewAttempt,
  type StoredCard,
} from './store';
import { applyGradeAt, type Grade } from './srs';

export type JournalOp =
  | { kind: 'attempt'; attempt: NewAttempt }
  | { kind: 'grade'; cardId: string; grade: Grade; ts: number };

/** Fired on every journal change (append, remove, replay) so the alert island can
    observe pending writes without polling. Same fire-and-forget shape as `da:attempt`. */
export const JOURNAL_EVENT = 'da:journal';

/** Bound on journaled ops (an op is ~100–300 bytes; the cap exists for hygiene, not
    quota). Overflow keeps the NEWEST ops and raises a flag the alert reports —
    dropping silently would defeat the journal's whole purpose. */
export const JOURNAL_CAP = 500;

function journalKey(): string {
  return `da:journal:${getActiveProfileId()}`;
}
function overflowKey(): string {
  return `da:journal-overflow:${getActiveProfileId()}`;
}
function seenDataKey(kind: SeenDataKind): string {
  return `da:seen-data:${kind}:${getActiveProfileId()}`;
}

/** Identity of an op, for removal after its write settles. */
export function journalOpKey(op: JournalOp): string {
  return op.kind === 'attempt'
    ? `attempt|${op.attempt.setId}|${op.attempt.itemId}|${op.attempt.ts}`
    : `grade|${op.cardId}|${op.ts}`;
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
}

export function journalPending(): JournalOp[] {
  try {
    const raw = localStorage.getItem(journalKey());
    return raw ? (JSON.parse(raw) as JournalOp[]) : [];
  } catch {
    return [];
  }
}

export function journalOverflowed(): boolean {
  try {
    return localStorage.getItem(overflowKey()) === '1';
  } catch {
    return false;
  }
}

function writeOps(ops: JournalOp[]): void {
  try {
    localStorage.setItem(journalKey(), JSON.stringify(ops));
  } catch {
    // storage blocked or full — the journal is a safety net, never a blocker
  }
  notify();
}

export function journalAppend(op: JournalOp): void {
  const ops = journalPending();
  ops.push(op);
  if (ops.length > JOURNAL_CAP) {
    ops.splice(0, ops.length - JOURNAL_CAP);
    try {
      localStorage.setItem(overflowKey(), '1');
    } catch {
      // ignore
    }
  }
  writeOps(ops);
}

export function journalRemove(op: JournalOp): void {
  const key = journalOpKey(op);
  writeOps(journalPending().filter((o) => journalOpKey(o) !== key));
}

/**
 * One-way marker: this profile has successfully persisted the named kind of
 * progress at least once. A launch-time read of that store that comes back EMPTY
 * while its marker is set is implausible — the store is stalled or the app is
 * looking at the wrong database — and must render an error state, never a
 * fresh-profile view (and never feed `planReview`). Per kind, not global: a
 * learner who has only ever trained has legitimately empty cards.
 */
export type SeenDataKind = 'cards' | 'attempts';

export function markSeenData(kind: SeenDataKind): void {
  try {
    localStorage.setItem(seenDataKey(kind), '1');
  } catch {
    // ignore
  }
}

export function hasSeenData(kind: SeenDataKind): boolean {
  try {
    return localStorage.getItem(seenDataKey(kind)) === '1';
  } catch {
    return false;
  }
}

async function applyOp(op: JournalOp): Promise<void> {
  if (op.kind === 'attempt') {
    await logAttempt(op.attempt);
  } else {
    await updateCardState(op.cardId, (prev) => applyGradeAt(prev, op.grade, op.ts));
  }
}

/**
 * Log an attempt durably: journal first, then the retried IndexedDB write.
 * Never rejects — a stalled write stays in the journal and `PersistenceAlert`
 * is the surface that reports it (call sites were `void logAttempt(...)` with
 * no catch, which is exactly the silence this replaces).
 */
export async function logAttemptDurably(attempt: NewAttempt): Promise<void> {
  const op: JournalOp = { kind: 'attempt', attempt };
  journalAppend(op);
  try {
    await withPersistenceRetry(() => logAttempt(attempt));
    journalRemove(op);
    markSeenData('attempts');
  } catch (err) {
    console.error('logAttempt stalled — kept in journal', attempt.setId, attempt.itemId, err);
  }
}

/**
 * Grade a card durably against the freshest stored state. Returns the card state
 * actually written, or null when the write stalled past its deadline (the op stays
 * journaled for replay; the caller keeps its optimistic UI either way).
 */
export async function gradeCardDurably(
  cardId: string,
  grade: Grade,
  ts = Date.now(),
): Promise<StoredCard | null> {
  const op: JournalOp = { kind: 'grade', cardId, grade, ts };
  journalAppend(op);
  try {
    const written = await withPersistenceRetry(() =>
      updateCardState(cardId, (prev) => applyGradeAt(prev, grade, ts)),
    );
    journalRemove(op);
    markSeenData('cards');
    return written;
  } catch (err) {
    console.error('gradeCard stalled — kept in journal', cardId, err);
    return null;
  }
}

/**
 * Replay every journaled op into the store, oldest first. Runs on launch
 * (PersistenceAlert) and behind the alert's retry button. Stops at the first
 * stall — a stalled store fails every subsequent op the same way, and the
 * remaining entries are exactly what the journal should keep.
 */
export async function replayJournal(): Promise<{ replayed: number; failed: number }> {
  const ops = journalPending();
  let replayed = 0;
  for (const op of ops) {
    try {
      await withPersistenceRetry(() => applyOp(op), { schedule: [4000], deadlineMs: 15000 });
      journalRemove(op);
      markSeenData(op.kind === 'attempt' ? 'attempts' : 'cards');
      replayed++;
    } catch {
      return { replayed, failed: ops.length - replayed };
    }
  }
  return { replayed, failed: 0 };
}
