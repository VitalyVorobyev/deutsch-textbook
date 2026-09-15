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
 *
 * ADR 0019 added the three cases step 3 did not cover, each of which could pin the alert at a
 * count that never fell:
 *
 *   - **A write that lands AFTER its deadline** still confirms itself, through
 *     `withPersistenceRetry`'s `onLateSettle` — idb-keyval resolves on `transaction.oncomplete`,
 *     so a resolve is a commit, and an entry that outlives its own landed write is the alert
 *     lying about the learner's data.
 *   - **An op that can never be applied** is quarantined (`journalPoison`) instead of blocking
 *     every op behind it at every future launch.
 *   - **A localStorage that refuses the write** is named (`journalWriteBlocked`) instead of
 *     silently freezing appends and removals alike.
 */
import { getActiveProfileId } from './profile';
import {
  logAttempt,
  StoreStallError,
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
function poisonKey(): string {
  return `da:journal-poison:${getActiveProfileId()}`;
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

/** Whether the last journal write failed. See `writeOps`. */
let writeBlocked = false;

/**
 * True when localStorage refused the journal's last write.
 *
 * This is its own failure mode, and before it was named it was indistinguishable from a stalled
 * store: a full or blocked localStorage makes `journalAppend` AND `journalRemove` both no-op, so
 * the alert's count freezes at whatever it held — new answers never join it and confirmed ones
 * never leave. "The count is stuck at N; it neither grows nor clears" is the signature, and no
 * amount of repairing the IndexedDB side touches it.
 */
export function journalWriteBlocked(): boolean {
  return writeBlocked;
}

function writeOps(ops: JournalOp[]): void {
  try {
    localStorage.setItem(journalKey(), JSON.stringify(ops));
    writeBlocked = false;
  } catch (err) {
    // The journal is a safety net, never a blocker — so this still does not throw. But it may
    // no longer be silent: a swallowed failure here freezes the alert at a count that can
    // never fall, which is worse than the write it was protecting.
    writeBlocked = true;
    console.error('journal write blocked — the alert count is frozen', err);
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

/** An op that could not be applied, kept out of the replay queue but never destroyed. */
export interface PoisonedOp {
  op: JournalOp;
  error: string;
  at: number;
}

/** Keep the newest few: this list is evidence for the author, not a second copy of progress. */
export const POISON_CAP = 20;

export function journalPoisoned(): PoisonedOp[] {
  try {
    const raw = localStorage.getItem(poisonKey());
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PoisonedOp[]) : [];
  } catch {
    return [];
  }
}

/**
 * Quarantine an op that can never be applied: take it out of the journal and keep it, with its
 * error, in a list the UI can name.
 *
 * Left in the journal such an op blocks every op behind it on every future replay — `replayJournal`
 * stops at the first failure, by design, because a stalled store fails everything the same way.
 * A failure that is NOT a stall breaks that assumption: it will fail identically at the next
 * launch and the one after, so the count can never fall and the banner is permanent. The op is
 * moved, never dropped, because a write the learner made is not ours to discard.
 */
function journalPoison(op: JournalOp, err: unknown): void {
  const key = journalOpKey(op);
  writeOps(journalPending().filter((o) => journalOpKey(o) !== key));
  try {
    const next = [...journalPoisoned(), { op, error: String(err), at: Date.now() }];
    localStorage.setItem(poisonKey(), JSON.stringify(next.slice(-POISON_CAP)));
  } catch {
    // ignore — the op is already off the journal, which is what unblocks the replay
  }
  console.error('journal op cannot be applied — quarantined', key, err);
}

/**
 * A write confirmed on disk: drop its journal entry and record that this profile has persisted
 * this kind of progress at least once.
 *
 * Called from the ordinary success path AND from `withPersistenceRetry`'s `onLateSettle`. The
 * two must not drift, because the drift WAS the bug: a write that landed after its deadline
 * kept its journal entry forever and the alert called saved data unsaved (ADR 0019).
 */
function confirmOp(op: JournalOp): void {
  journalRemove(op);
  markSeenData(op.kind === 'attempt' ? 'attempts' : 'cards');
}

/** Retry knobs, exposed only so tests can drive real deadlines in milliseconds — the same
    affordance `withPersistenceRetry` and `withReadRetry` already carry. */
export type RetryOptions = { schedule?: readonly number[]; deadlineMs?: number };

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
export async function logAttemptDurably(
  attempt: NewAttempt,
  retry: RetryOptions = {},
): Promise<void> {
  const op: JournalOp = { kind: 'attempt', attempt };
  journalAppend(op);
  try {
    await withPersistenceRetry(() => logAttempt(attempt), {
      surface: 'attempt',
      ...retry,
      onLateSettle: () => confirmOp(op),
    });
    confirmOp(op);
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
  retry: RetryOptions = {},
): Promise<StoredCard | null> {
  const op: JournalOp = { kind: 'grade', cardId, grade, ts };
  journalAppend(op);
  try {
    const written = await withPersistenceRetry(
      () => updateCardState(cardId, (prev) => applyGradeAt(prev, grade, ts)),
      { surface: 'grade', ...retry, onLateSettle: () => confirmOp(op) },
    );
    confirmOp(op);
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
export interface ReplayResult {
  replayed: number;
  /** Still journaled: the store is stalled, and every op behind this one fails the same way. */
  failed: number;
  /** Moved to the poison list: these can never be applied, whatever the store does. */
  poisoned: number;
  /** The stall that stopped the replay, for the caller to report rather than swallow. */
  error?: unknown;
}

export async function replayJournal(retry: RetryOptions = {}): Promise<ReplayResult> {
  const ops = journalPending();
  let replayed = 0;
  let poisoned = 0;
  for (const op of ops) {
    try {
      await withPersistenceRetry(() => applyOp(op), {
        surface: 'replay',
        schedule: [4000],
        deadlineMs: 15000,
        ...retry,
        onLateSettle: () => confirmOp(op),
      });
      confirmOp(op);
      replayed++;
    } catch (err) {
      if (err instanceof StoreStallError) {
        return { replayed, poisoned, failed: ops.length - replayed - poisoned, error: err };
      }
      // Not a stall: this op can never be applied, so stopping here would block every op
      // behind it at every future launch and pin the alert at a count that can never fall.
      // Quarantine it with its error and carry on. The old bare `catch {}` made this class of
      // failure permanent AND invisible.
      journalPoison(op, err);
      poisoned++;
    }
  }
  return { replayed, failed: 0, poisoned };
}
