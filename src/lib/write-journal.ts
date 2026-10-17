/**
 * Synchronous write-ahead journal for progress writes (client-side only).
 *
 * IndexedDB in the desktop WKWebView can stall silently, so every critical write is journaled
 * in localStorage — synchronous, and it survives an abrupt quit — BEFORE the IndexedDB attempt
 * starts. One drain per profile then applies the journal in submission order; live writes,
 * launch replay and the alert's retry button all join that drain rather than starting a second.
 * The managed store (`managed-store.ts`) owns transaction aborts and retries; a caller's deadline
 * stops the caller waiting and never releases the live drain. Only a confirmed commit removes
 * an entry. A failed journal write keeps a volatile copy and reports it — never as durable
 * across a restart. ADR 0020; ADR 0016 and 0019 for the history.
 *
 * **Every op must be idempotent**, because both layers re-run them: the managed store retries an
 * aborted transaction up to three times, and a page that dies between commit and removal
 * replays the op at the next launch. Each kind is idempotent at the store layer —
 * `logAttempt` dedupes by `setId|itemId|ts`, a grade goes through `applyGradeAt`, whose
 * `last_review >= ts` guard makes a replay of a landed grade a no-op, `logSession` merges
 * through `mergeSessions`, keyed by date and ts, a LiD answer dedupes by `q|ts` before it grades
 * (`applyLidAnswer`), and a LiD mock run by its id (`applyLidExam`). A new op kind needs the
 * same property.
 */
import { getActiveProfileId } from './profile';
import type { LidAnswer, LidExamRun } from './lid';
import {
  logAttempt,
  logLidAnswer,
  logLidExam,
  logSession,
  type SessionLogEntry,
  updateCardState,
  withPersistenceRetry,
  type NewAttempt,
  type StoredCard,
} from './store';
import { applyGradeAt, type Grade } from './srs';

export type JournalOp =
  | { kind: 'attempt'; attempt: NewAttempt }
  | { kind: 'grade'; cardId: string; grade: Grade; ts: number }
  | { kind: 'session'; entry: SessionLogEntry }
  | { kind: 'lid-answer'; answer: LidAnswer }
  | { kind: 'lid-exam'; run: LidExamRun };

/** Fired on every journal change (append, remove, replay) so the alert island can
    observe pending writes without polling. Same fire-and-forget shape as `da:attempt`. */
export const JOURNAL_EVENT = 'da:journal';

/** Bound on journaled ops (an op is ~100–300 bytes; the cap exists for hygiene, not
    quota). Crossing it raises a flag but never discards unconfirmed work. */
export const JOURNAL_CAP = 500;

function journalKey(profileId = getActiveProfileId()): string {
  return `da:journal:${profileId}`;
}
function overflowKey(profileId = getActiveProfileId()): string {
  return `da:journal-overflow:${profileId}`;
}
function poisonKey(profileId = getActiveProfileId()): string {
  return `da:journal-poison:${profileId}`;
}
function seenDataKey(kind: SeenDataKind, profileId = getActiveProfileId()): string {
  return `da:seen-data:${kind}:${profileId}`;
}

/** Identity of an op, for removal after its write settles. */
export function journalOpKey(op: JournalOp): string {
  switch (op.kind) {
    case 'session':
      return `session|${op.entry.date}|${op.entry.ts}`;
    case 'attempt':
      return `attempt|${op.attempt.setId}|${op.attempt.itemId}|${op.attempt.ts}`;
    case 'grade':
      return `grade|${op.cardId}|${op.ts}`;
    case 'lid-answer':
      return `lid-answer|${op.answer.q}|${op.answer.ts}`;
    case 'lid-exam':
      return `lid-exam|${op.run.id}`;
  }
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
}

const volatileOps = new Map<string, JournalOp[]>();

export function journalPending(profileId = getActiveProfileId()): JournalOp[] {
  if (volatileOps.has(profileId)) return [...volatileOps.get(profileId)!];
  try {
    const raw = localStorage.getItem(journalKey(profileId));
    return raw ? (JSON.parse(raw) as JournalOp[]) : [];
  } catch {
    return [];
  }
}

export function journalOverflowed(profileId = getActiveProfileId()): boolean {
  try {
    return localStorage.getItem(overflowKey(profileId)) === '1';
  } catch {
    return false;
  }
}

/** Whether the last journal write failed. See `writeOps`. */
let writeBlocked = false;

/** True when the last journal update was not durable in localStorage. */
export function journalWriteBlocked(): boolean {
  return writeBlocked;
}

function writeOps(ops: JournalOp[], profileId = getActiveProfileId()): void {
  try {
    localStorage.setItem(journalKey(profileId), JSON.stringify(ops));
    volatileOps.delete(profileId);
    writeBlocked = false;
  } catch (err) {
    // The journal is a safety net, never a blocker — so this still does not throw. But it may
    // no longer be silent: a swallowed failure here freezes the alert at a count that can
    // never fall, which is worse than the write it was protecting.
    volatileOps.set(profileId, [...ops]);
    writeBlocked = true;
    console.error('journal write blocked — pending operations retained in memory', err);
  }
  notify();
}

export function journalAppend(op: JournalOp, profileId = getActiveProfileId()): void {
  const ops = journalPending(profileId);
  if (ops.some((existing) => journalOpKey(existing) === journalOpKey(op))) return;
  ops.push(op);
  if (ops.length > JOURNAL_CAP) {
    // Warn without discarding unconfirmed work. Storage quota is reported separately.
    try {
      localStorage.setItem(overflowKey(profileId), '1');
    } catch {
      // ignore
    }
  }
  writeOps(ops, profileId);
}

export function journalRemove(op: JournalOp, profileId = getActiveProfileId()): void {
  const key = journalOpKey(op);
  writeOps(
    journalPending(profileId).filter((o) => journalOpKey(o) !== key),
    profileId,
  );
}

/**
 * One-way marker: this profile has successfully persisted the named kind of
 * progress at least once. A launch-time read of that store that comes back EMPTY
 * while its marker is set is implausible — the store is stalled or the app is
 * looking at the wrong database — and must render an error state, never a
 * fresh-profile view (and never feed `planReview`). Per kind, not global: a
 * learner who has only ever trained has legitimately empty cards.
 */
export type SeenDataKind = 'cards' | 'attempts' | 'lid';

export function markSeenData(kind: SeenDataKind, profileId = getActiveProfileId()): void {
  try {
    localStorage.setItem(seenDataKey(kind, profileId), '1');
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

/** Bound the quarantine without evicting old evidence: this list is evidence for the author, not a second copy of progress. */
export const POISON_CAP = 20;

export function journalPoisoned(profileId = getActiveProfileId()): PoisonedOp[] {
  try {
    const raw = localStorage.getItem(poisonKey(profileId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PoisonedOp[]) : [];
  } catch {
    return [];
  }
}

/** Preserve quarantine evidence before removing the original operation. */
function journalPoison(op: JournalOp, err: unknown, profileId: string): boolean {
  try {
    // Evidence first. Failure to preserve it must leave the original operation replayable.
    const next = [...journalPoisoned(profileId), { op, error: String(err), at: Date.now() }];
    if (next.length > POISON_CAP) return false;
    localStorage.setItem(poisonKey(profileId), JSON.stringify(next));
  } catch {
    return false;
  }
  journalRemove(op, profileId);
  return !journalPending(profileId).some((o) => journalOpKey(o) === journalOpKey(op));
}

function confirmOp(op: JournalOp, profileId: string): void {
  journalRemove(op, profileId);
  // Per kind, and LiD never as `cards`: a LiD-only learner's empty vocabulary store is real, and
  // marking it "seen" would make every card surface render it as a stalled read.
  if (op.kind === 'attempt') markSeenData('attempts', profileId);
  else if (op.kind === 'grade') markSeenData('cards', profileId);
  else if (op.kind === 'lid-answer' || op.kind === 'lid-exam') markSeenData('lid', profileId);
}

/** Retry knobs, exposed only so tests can drive real deadlines in milliseconds — the same
    affordance `withPersistenceRetry` and `withReadRetry` already carry. */
export type RetryOptions = { schedule?: readonly number[]; deadlineMs?: number };

/** A single drain per profile owns ordering across live answers, launch replay and retries. */
const flights = new Map<string, Promise<ReplayResult>>();
const results = new Map<string, StoredCard>();

async function applyOp(op: JournalOp): Promise<StoredCard | undefined> {
  if (op.kind === 'attempt') await logAttempt(op.attempt);
  else if (op.kind === 'session') await logSession(op.entry);
  else if (op.kind === 'lid-answer') await logLidAnswer(op.answer);
  else if (op.kind === 'lid-exam') await logLidExam(op.run);
  else return updateCardState(op.cardId, (prev) => applyGradeAt(prev, op.grade, op.ts));
  return undefined;
}

export interface ReplayResult {
  replayed: number;
  failed: number;
  poisoned: number;
  error?: unknown;
}

export async function replayJournal(retry: RetryOptions = {}): Promise<ReplayResult> {
  const profileId = getActiveProfileId();
  let run = flights.get(profileId);
  if (!run) {
    run = drainJournal(profileId);
    flights.set(profileId, run);
    const owned = run;
    void run
      .finally(() => {
        if (flights.get(profileId) === owned) flights.delete(profileId);
      })
      .catch(() => {});
  }
  try {
    // A caller's clock starts here, not when its operation eventually reaches the head.
    // Timing out stops the caller waiting; it NEVER releases ownership of the live drain.
    return await withPersistenceRetry(() => run!, { surface: 'replay', ...retry, schedule: [] });
  } catch (error) {
    return { replayed: 0, poisoned: 0, failed: journalPending(profileId).length, error };
  }
}

async function drainJournal(profileId: string): Promise<ReplayResult> {
  let replayed = 0;
  let poisoned = 0;
  // Give the caller time to register this single flight before synchronous journal events.
  await Promise.resolve();
  for (;;) {
    const ops = journalPending(profileId);
    if (!ops.length) return { replayed, poisoned, failed: 0 };
    const op = ops[0]!;
    if (getActiveProfileId() !== profileId)
      return { replayed, poisoned, failed: ops.length, error: new Error('Profile changed') };
    try {
      const card = await applyOp(op);
      if (card) {
        results.set(`${profileId}|${journalOpKey(op)}`, card);
        if (results.size > JOURNAL_CAP) results.delete(results.keys().next().value!);
      }
      confirmOp(op, profileId);
      if (journalPending(profileId).some((pending) => journalOpKey(pending) === journalOpKey(op)))
        return {
          replayed,
          poisoned,
          failed: journalPending(profileId).length,
          error: new Error('Journal storage blocked'),
        };
      replayed++;
    } catch (err) {
      // Only deterministic data/programming errors qualify as poison. DOMException storage
      // failures (quota, abort, closed connection) are recoverable and stay in the journal.
      if (
        (err instanceof TypeError || err instanceof RangeError) &&
        journalPoison(op, err, profileId)
      ) {
        poisoned++;
        continue;
      }
      return { replayed, poisoned, failed: journalPending(profileId).length, error: err };
    }
  }
}

export async function logAttemptDurably(
  attempt: NewAttempt,
  retry: RetryOptions = {},
): Promise<void> {
  journalAppend({ kind: 'attempt', attempt });
  await replayJournal(retry);
}

export async function logSessionDurably(
  entry: SessionLogEntry,
  retry: RetryOptions = {},
): Promise<void> {
  journalAppend({ kind: 'session', entry });
  await replayJournal(retry);
}

/** A LiD answer: journaled, then graded into the `lid` key by the one drain (ADR 0021). */
export async function logLidAnswerDurably(
  answer: LidAnswer,
  retry: RetryOptions = {},
): Promise<void> {
  journalAppend({ kind: 'lid-answer', answer });
  await replayJournal(retry);
}

/**
 * A submitted LiD mock: the run, plus one exam-mode answer per item (`lidExamAnswers`, lid.ts),
 * so a question missed in a mock is scheduled for review like a missed practice one. Every op is
 * journaled in one synchronous pass before the drain is awaited, so the run and its answers are
 * pending together and replay together.
 */
export async function logLidExamDurably(
  run: LidExamRun,
  answers: LidAnswer[],
  retry: RetryOptions = {},
): Promise<void> {
  journalAppend({ kind: 'lid-exam', run });
  for (const answer of answers) journalAppend({ kind: 'lid-answer', answer });
  await replayJournal(retry);
}

export async function gradeCardDurably(
  cardId: string,
  grade: Grade,
  ts = Date.now(),
  retry: RetryOptions = {},
): Promise<StoredCard | null> {
  const op: JournalOp = { kind: 'grade', cardId, grade, ts };
  const key = `${getActiveProfileId()}|${journalOpKey(op)}`;
  journalAppend(op);
  await replayJournal(retry);
  const card = results.get(key) ?? null;
  results.delete(key);
  return card;
}
