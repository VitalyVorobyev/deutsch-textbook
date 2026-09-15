/** IndexedDB-backed progress store (client-side only), namespaced per profile. */
import { createStore, get, set, update, clear, type UseStore } from 'idb-keyval';
import { getActiveProfileId, dbNameFor, resolveProfileState, type ProfileRecord } from './profile';
import { scheduleAutoSync } from './autosync';
import { isProgressSnapshot, parseProgressSnapshot } from './snapshot-schema';
import { migrateCardIds, needsCardIdMigration } from './a1-card-id-migration';
import { recordRecovery, recordStall } from './stall-log';
import {
  attemptKey,
  mergeAttempts,
  mergeCards,
  mergeFeedback,
  mergeSessions,
  mergeTopics,
} from './snapshot-merge';

// ---------------------------------------------------------------------------
// Profile-aware store handle
// ---------------------------------------------------------------------------

// One idb-keyval store per profile, memoized so we don't reopen the IndexedDB
// connection on every operation. The active profile is read inside each call
// (not at module load) so a mid-session profile switch + reload picks the right
// database. The legacy profile aliases the pre-profile `deutsch-atlas` DB.
const stores = new Map<string, UseStore>();

// Awaits the first-run/legacy decision before touching IndexedDB: creating a
// store here would otherwise race the legacy-DB detection in profile.ts (e.g.
// markTopicRead fires on topic-page mount with no user interaction). While the
// first-run gate is up there is no profile to own a write, so park forever —
// creating the profile reloads the page, which discards parked operations.
async function getStore(): Promise<UseStore> {
  if ((await resolveProfileState()) === 'first-run') {
    await new Promise<never>(() => {});
  }
  const id = getActiveProfileId();
  let s = stores.get(id);
  if (!s) {
    s = createStore(dbNameFor(id), 'progress');
    stores.set(id, s);
  }
  return s;
}

/**
 * Drop the memoized handle for a profile so the next store call opens a fresh connection.
 *
 * **Can** rescue a hung `indexedDB.open()`: idb-keyval memoizes the open promise in
 * `createStore`'s own closure and clears it only from `db.onclose` — an event a hang never
 * fires — so before this existed, every retry re-awaited the identical hung promise and the
 * backoff schedule was incapable of doing anything the first attempt had not already done.
 *
 * **Cannot** rescue a wedged readwrite transaction: a new connection's transaction still
 * queues behind it, because IndexedDB orders transactions by scope across the whole database,
 * not per connection. Reconnecting is a narrow remedy, not a general one.
 *
 * **Leaks one connection per reset** — idb-keyval never exposes the `IDBDatabase`, so the old
 * one cannot be `close()`d. Acceptable because a reset only happens on a stall, but real, and
 * the reason retries reconnect twice rather than on every attempt.
 */
export function resetStoreHandle(profileId = getActiveProfileId()): void {
  stores.delete(profileId);
}

/** Test-only: whether a live handle is memoized for a profile, so the reconnect path can be
    observed without an IndexedDB. Mirrors `__resetProfileStateCacheForTests` in profile.ts. */
export function __hasStoreHandleForTests(profileId = getActiveProfileId()): boolean {
  return stores.has(profileId);
}

/** localStorage marker: this profile's live `cards` blob has already been through
    the A1 rename. Set only after a SUCCESSFUL pass, so a stalled read simply tries
    again at the next launch rather than skipping the migration forever. */
function cardIdMigrationKey(id: string): string {
  return `da:cardid-migrated:${id}`;
}

function cardIdMigrationDone(id: string): boolean {
  try {
    return localStorage.getItem(cardIdMigrationKey(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * The A1 card-id repair, run against one profile's live blob.
 *
 * Never rejects: nothing awaits it, so throwing here would be an unhandled rejection
 * rather than a signal. A failed or stalled pass leaves the marker unset and is retried
 * at the next launch — a stall must not be able to skip the repair forever.
 */
export async function runCardIdMigration(id: string, handle: UseStore): Promise<void> {
  if (cardIdMigrationDone(id)) return;
  try {
    // Deliberately NOT through the write queue: this takes an injected `handle` so the
    // marker-stays-unset-on-failure path can be driven without an IndexedDB
    // (tests/store-visibility-retry.test.ts), and the queue resolves its own handle. It is a
    // once-per-profile repair off the critical path, so the serialization the queue would buy
    // is not worth giving up the seam. The race ADR 0018 left open stays open, and stays filed.
    await migrateStoredCardIds((mutate) => update<CardStates>('cards', mutate, handle));
    localStorage.setItem(cardIdMigrationKey(id), '1');
  } catch {
    // Stalled or unavailable: leave the marker unset and retry next launch. The
    // migration is a repair, not a write the learner is waiting on.
  }
}

/**
 * Run the repair once for the active profile — the launch-time entry point.
 *
 * It has ONE owner (`PersistenceAlert`, the island Base.astro mounts on every page and
 * which already performs launch-time repair) rather than being triggered by whoever
 * happens to open the store first. It used to be `await`ed inside `getStore()`, where a
 * 784 KB `cards` read with no deadline of its own sat between the page's first reader and
 * its data: under the `Promise.all` every load surface uses, that one leg hanging hung the
 * whole screen. Firing it from `getStore()` un-awaited fixed the hang and kept the other
 * half of the problem — an unobserved transaction opened by any code path that touches the
 * store, racing whatever else that page is reading. One owner, once per launch, after the
 * profile gate has resolved.
 */
export async function runCardIdMigrationOnce(): Promise<void> {
  const id = getActiveProfileId();
  await runCardIdMigration(id, await getStore());
}

/**
 * Rename the cards the A1 lexical relocation moved, in the LIVE database.
 *
 * Snapshot import is not enough on its own: `getCardStates` reads the raw `cards` blob, so a
 * learner who never exports and re-imports would have `planReview` miss 174 renamed ids and
 * deal them as fresh — roughly twelve days of the new-card budget spent on words they already
 * know, while their FSRS history sat stranded under the old keys.
 *
 * Runs at most once per profile — `runCardIdMigration`'s marker retires it after the first
 * success — and off the critical path, so no load surface ever waits on it.
 *
 * **One transaction, not a `get` then a `set`.** The rename runs inside a single
 * `update()` read-modify-write, the same primitive `updateCardState` grades through. The
 * previous get-then-set could drop a grade written in between by any reader that skipped
 * the migration — and moving the migration off the critical path would have widened exactly
 * that window.
 *
 * Takes the update as a parameter (rather than reaching for the module's memoized handle)
 * because the test environment has no IndexedDB — the alternative was leaving the one path
 * that matters covered only by the import path's tests, which is how the gap arose in the
 * first place.
 *
 * Returns whether it renamed anything. It is now `runCardIdMigration`'s marker, not a
 * write-count guard, that keeps this off the second launch — so the transaction commits once
 * per profile whether or not there was anything to rename.
 */
export async function migrateStoredCardIds(
  updateCards: (mutate: (cards: CardStates | undefined) => CardStates) => Promise<void>,
): Promise<boolean> {
  let renamed = false;
  await updateCards((cards) => {
    if (!cards || !needsCardIdMigration(cards)) return cards ?? {};
    renamed = true;
    return migrateCardIds(cards, mergeCards);
  });
  return renamed;
}

// ---------------------------------------------------------------------------
// Retry-on-visible: a stalled critical-path read/write is not the end of the story
// ---------------------------------------------------------------------------

/**
 * How long a critical-path store call is given before the wrapper also arms a
 * retry — long enough that an ordinary IndexedDB round trip never trips it,
 * short enough that a genuinely stalled one does not read to the caller as a
 * silent hang. WebKit is documented to stall IndexedDB transactions opened in
 * a backgrounded tab; that stall does not always clear on its own when the
 * tab is foregrounded again, which is what made `grade()` (FlashcardSession)
 * a dead button and every topic read "Neu" (CurriculumPath) — both callers
 * were awaiting a store promise that had simply stopped notifying anyone.
 */
export const VISIBILITY_RETRY_TIMEOUT_MS = 4000;

/**
 * Wraps a store operation so a stalled underlying IndexedDB promise is not
 * the end of the story: if `op()` has not settled within `timeoutMs`, the
 * wrapper ALSO retries it the next time the document becomes visible — the
 * exact moment a backgrounded tab's stalled transaction tends to unstick —
 * and settles with whichever attempt finishes first.
 *
 * Safe to wrap a write with: `setCardState` stores one full value per card
 * id, so if the stale first attempt's write lands after a retry already
 * settled the caller, it writes the identical value again — idempotent, not
 * a double-apply. Nothing here changes what gets written, only how long a
 * caller waits to find out it did.
 *
 * SSR-safe: without `document` there is no visibility event to retry on, so
 * this is a passthrough to `op()`.
 *
 * `timeoutMs` is a parameter (not baked in) purely so tests can exercise the
 * retry path without a real ~4s wait; every call site below uses the default.
 */
export function withVisibilityRetry<T>(
  op: () => Promise<T>,
  timeoutMs = VISIBILITY_RETRY_TIMEOUT_MS,
): Promise<T> {
  if (typeof document === 'undefined') return op();

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const onVisible = () => {
      if (settled || document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      op().then(settleResolve, settleReject);
    };
    function settleResolve(value: T) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      resolve(value);
    }
    function settleReject(err: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      reject(err);
    }

    op().then(settleResolve, settleReject);
    // Declared after settleResolve/settleReject only textually — both are hoisted
    // function declarations that close over `timer`, and neither can run before
    // this line does (Promise callbacks are never synchronous), so the binding is
    // always initialized by the time either reads it.
    const timer = setTimeout(() => {
      if (!settled) document.addEventListener('visibilitychange', onVisible);
    }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Persistence retry with a deadline: a stalled write becomes an error, never silence
// ---------------------------------------------------------------------------

/** A store operation that did not settle within its deadline. The caller (the write
    journal, a load surface) treats this as "the store is stalled", which is a state
    the learner must be shown — never as "the data does not exist". */
export class StoreStallError extends Error {
  constructor(message = 'IndexedDB operation did not settle within its deadline') {
    super(message);
    this.name = 'StoreStallError';
  }
}

/**
 * Backoff schedule for critical writes: when the previous attempt has not settled by each
 * offset (ms from start), the memoized store handle is dropped and another attempt is fired.
 *
 * **Two retries, not three, and far apart — because a retry on the same connection cannot
 * help.** All six progress keys live in ONE object store, so IndexedDB gives each readwrite
 * exclusive access over the whole store: an attempt fired while the previous one is pending
 * cannot begin until that one completes. The old 4/8/16 s schedule therefore never once
 * overtook the transaction it was rescuing — it only queued three more full-blob
 * read-modify-writes of a ~784 KB `cards` record behind it. What a retry CAN do that the
 * first attempt could not is open a fresh connection (see `resetStoreHandle`), so that is
 * what each offset now does. ADR 0016 set the old schedule; ADR 0019 supersedes it.
 *
 * The op must still be idempotent — `logAttempt` dedupes by attempt key and card grades go
 * through `applyGradeAt`'s ts-guard, so N landed attempts equal one.
 */
export const PERSISTENCE_RETRY_SCHEDULE_MS = [12_000, 30_000];

/** Hard deadline after which `withPersistenceRetry` stops waiting and rejects with
    `StoreStallError`. The write may still land later (attempts are never cancelled);
    rejection only means "stop trusting silence" — the journal keeps the op. */
export const PERSISTENCE_DEADLINE_MS = 45000;

/**
 * Run an IDEMPOTENT store operation with timed retries and a hard deadline.
 *
 * `withVisibilityRetry` (below) retries only when the document becomes visible —
 * the right medicine for the backgrounded-tab stall, and useless for a stall while
 * the window stays visible (observed on the desktop WKWebView: sessions whose
 * writes never landed while the learner was actively grading). This wrapper fires
 * additional attempts on a timer, keeps the visibility retry as one more trigger,
 * settles with the first attempt that finishes, and — unlike `withVisibilityRetry`,
 * which deliberately waits forever — rejects with `StoreStallError` at `deadlineMs`
 * so the caller can go loud instead of staying silent.
 */
export function withPersistenceRetry<T>(
  op: () => Promise<T>,
  {
    surface = 'write',
    schedule = PERSISTENCE_RETRY_SCHEDULE_MS,
    deadlineMs = PERSISTENCE_DEADLINE_MS,
    onLateSettle,
  }: {
    surface?: string;
    schedule?: readonly number[];
    deadlineMs?: number;
    onLateSettle?: (value: T) => void;
  } = {},
): Promise<T> {
  if (typeof document === 'undefined') return op();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let lateFired = false;
    let attempts = 0;
    let stallId: string | undefined;
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const cleanup = () => {
      settled = true;
      for (const t of timers) clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
    const settleResolve = (value: T) => {
      // A settle after the deadline already rejected. For a READ the value is worthless and
      // only the fact is kept (`withReadRetry`, below). For a WRITE the fact is that it
      // COMMITTED — idb-keyval resolves on `transaction.oncomplete`, so a resolve is a commit
      // — and the caller has to be told, or its journal entry outlives the write it describes
      // and the alert claims "noch nicht gespeichert" about data that is on disk. That was the
      // permanently red banner of 2026-09-15, frozen at a count that could never fall.
      if (settled) {
        if (stallId) recordRecovery(stallId, Date.now() - startedAt);
        if (!lateFired) {
          lateFired = true;
          onLateSettle?.(value);
        }
        return;
      }
      cleanup();
      resolve(value);
    };
    const settleReject = (err: unknown) => {
      // A late REJECTION is not a late settle: nothing landed, so the journal entry stays.
      if (settled) return;
      cleanup();
      reject(err);
    };
    const attempt = (reconnect: boolean) => {
      if (settled) return;
      if (reconnect) resetStoreHandle();
      attempts += 1;
      op().then(settleResolve, settleReject);
    };
    const onVisible = () => {
      // The backgrounded-tab stall unsticks the EXISTING connection, so this trigger must not
      // throw it away — reconnecting here would discard a handle that is about to answer.
      if (document.visibilityState === 'visible') attempt(false);
    };

    attempt(false);
    for (const at of schedule) timers.push(setTimeout(() => attempt(true), at));
    timers.push(
      setTimeout(() => {
        if (settled) return;
        // cleanup() before recording, so a later settle sees `settled` and takes the
        // recovery/late branch above instead of resolving a caller that has gone.
        cleanup();
        stallId = recordStall({ surface, waitedMs: Date.now() - startedAt, attempts });
        reject(new StoreStallError());
      }, deadlineMs),
    );
    document.addEventListener('visibilitychange', onVisible);
  });
}

/**
 * Backoff schedule for a critical-path READ: when nothing has settled by each
 * offset (ms from start), another attempt is fired.
 *
 * A read needs no idempotency argument — that is exactly why it should have had
 * this from the start. ADR 0016 gave writes `withPersistenceRetry` and left reads
 * with a deadline and `withVisibilityRetry`, whose only trigger is
 * `visibilitychange`; a stall while the window stays visible therefore had no
 * automatic recovery at all, and the retry button was the whole mechanism. That
 * is how a populated store (824 cards, 3919 attempts on disk) rendered as an
 * error card on Heute and as a permanent loading line on Themen.
 */
export const READ_RETRY_SCHEDULE_MS = [2000, 5000];

/** Hard deadline for a critical-path read: past this the caller is told the store
    is stalled rather than being left to wait. Earlier attempts are never
    cancelled — one of them may still settle, which `withReadRetry` records. */
export const READ_DEADLINE_MS = 10000;

/**
 * Run a store READ with timed retries and a hard deadline.
 *
 * Fires `op()`, fires it again at each schedule offset if nothing has settled,
 * keeps `visibilitychange` as one more trigger, settles with the first attempt to
 * finish, and rejects with `StoreStallError` at `deadlineMs` so a load surface can
 * render an explicit error instead of waiting forever. Every rejection and every
 * late settle is written to the stall log, because the failure that produced this
 * function left no evidence behind at all.
 *
 * Takes a THUNK, not a promise. Its predecessor `withReadDeadline` took an
 * already-created promise, which is the structural reason reads could never retry;
 * that variant is gone, so there is no wrong one to reach for.
 *
 * SSR-safe: without `document` there is no timer to hang a retry on, so this is a
 * passthrough.
 */
export function withReadRetry<T>(
  op: () => Promise<T>,
  {
    surface = 'read',
    schedule = READ_RETRY_SCHEDULE_MS,
    deadlineMs = READ_DEADLINE_MS,
  }: { surface?: string; schedule?: readonly number[]; deadlineMs?: number } = {},
): Promise<T> {
  if (typeof document === 'undefined') return op();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let attempts = 0;
    let stallId: string | undefined;
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const cleanup = () => {
      settled = true;
      for (const t of timers) clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
    const settleResolve = (value: T) => {
      // A late settle after the deadline has already rejected: nobody is waiting
      // for it any more, but it is the fact that separates "the store unstuck
      // itself" from "the store never answered". Record it and drop the value.
      if (settled) {
        if (stallId) recordRecovery(stallId, Date.now() - startedAt);
        return;
      }
      cleanup();
      resolve(value);
    };
    const settleReject = (err: unknown) => {
      if (settled) return;
      cleanup();
      reject(err);
    };
    const attempt = () => {
      if (settled) return;
      attempts += 1;
      op().then(settleResolve, settleReject);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') attempt();
    };

    attempt();
    for (const at of schedule) timers.push(setTimeout(attempt, at));
    timers.push(
      setTimeout(() => {
        if (settled) return;
        // cleanup() before recording, so a later settle sees `settled` and takes
        // the recovery branch above instead of resolving a caller that has gone.
        cleanup();
        stallId = recordStall({ surface, waitedMs: Date.now() - startedAt, attempts });
        reject(new StoreStallError());
      }, deadlineMs),
    );
    document.addEventListener('visibilitychange', onVisible);
  });
}

// ---------------------------------------------------------------------------
// The write queue: one readwrite transaction at a time, N mutations per commit
// ---------------------------------------------------------------------------

/**
 * Every progress key lives in ONE object store (`createStore(dbNameFor(id), 'progress')`), so
 * IndexedDB already gives each readwrite exclusive access across all of them: a burst of grades
 * was never concurrent, only queued invisibly, each holding its own full-blob read-modify-write
 * of a ~784 KB `cards` record. The queue models what the database does anyway and adds the one
 * thing the database cannot — several mutations inside ONE transaction — so a burst of eight
 * grades costs one read and one write rather than eight of each. ADR 0019.
 *
 * What it deliberately does NOT do is make the spread cheaper: each mutator still copies the
 * record it was handed. That is a few thousand pointer copies against a structured clone of
 * ~784 KB, so collapsing the transactions is the whole prize and rewriting the mutators to
 * mutate in place would buy nothing worth the subtlety.
 */
type StoreKey = 'cards' | 'attempts' | 'sessions' | 'topics' | 'goal' | 'feedback';

/**
 * How long the runner WAITS for one batch before moving on to the next.
 *
 * Not a cancel — IndexedDB has none — and not a verdict: the orphaned transaction may still
 * commit, and `runBatch` settles its own members if it does. That late resolve is what reaches
 * `withPersistenceRetry`'s `onLateSettle` and clears the journal, which is why the late-settle
 * branch is a prerequisite for this queue rather than an independent repair.
 *
 * Equal to the write deadline by construction: the runner stops waiting exactly when the
 * callers do. Without it, one wedged commit would halt every later write for the life of the
 * page — the single genuine regression single-flighting could introduce.
 */
export const QUEUE_BATCH_TIMEOUT_MS = PERSISTENCE_DEADLINE_MS;

interface PendingWrite {
  key: StoreKey;
  mutate: (current: unknown) => unknown;
  resolve: () => void;
  reject: (err: unknown) => void;
}

let writeQueue: PendingWrite[] = [];
let draining = false;

/** The commit primitive, injectable for tests — the same reason `migrateStoredCardIds` takes
    its updater as a parameter: the test environment has no IndexedDB, and the queue's ordering
    and coalescing are exactly what deserves pinning without one. */
let commitBatch: (key: StoreKey, apply: (current: unknown) => unknown) => Promise<void> = async (
  key,
  apply,
) => {
  await update<unknown>(key, apply, await getStore());
};

/** Test-only: swap the commit primitive. Returns the restore function. */
export function __setCommitBatchForTests(fn: typeof commitBatch): () => void {
  const prev = commitBatch;
  commitBatch = fn;
  return () => {
    commitBatch = prev;
  };
}

/**
 * Enqueue one read-modify-write.
 *
 * The mutate runs INSIDE the transaction against the freshest stored value (ADR 0016's
 * invariant — a cloud merge that landed mid-session is written on top of, never clobbered) and
 * against the accumulated result of every earlier mutate in the same batch, so two grades of
 * one card in one batch compose exactly as they would in two transactions.
 */
function enqueueUpdate<V>(key: StoreKey, mutate: (current: V | undefined) => V): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    writeQueue.push({ key, mutate: mutate as (c: unknown) => unknown, resolve, reject });
    if (!draining) {
      draining = true;
      void drainWriteQueue();
    }
  });
}

async function drainWriteQueue(): Promise<void> {
  try {
    // Yield once before taking the first batch. Without it the very first enqueue drains alone,
    // because `enqueueUpdate`'s executor runs synchronously and starts the drain before its
    // siblings in the same tick have been pushed — so a burst submitted together would commit
    // one transaction per op, which is the cost this queue exists to remove. Coalescing must
    // not depend on how slow the commit happens to be.
    await Promise.resolve();
    while (writeQueue.length > 0) {
      // FIFO by the head's key, taking every queued mutation for that key. A burst of eight
      // grades and one attempt becomes two transactions, not nine. Head-first means no key can
      // be starved by a steady stream of writes to another.
      const key = writeQueue[0]!.key;
      const batch: PendingWrite[] = [];
      const rest: PendingWrite[] = [];
      for (const w of writeQueue) (w.key === key ? batch : rest).push(w);
      writeQueue = rest;

      const commit = runBatch(key, batch); // never rejects; settles its own members
      let timer: ReturnType<typeof setTimeout> | undefined;
      const answered = await Promise.race([
        commit.then(() => true),
        new Promise<false>((r) => {
          timer = setTimeout(() => r(false), QUEUE_BATCH_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timer);

      if (!answered) {
        recordStall({ surface: 'write-queue', waitedMs: QUEUE_BATCH_TIMEOUT_MS, attempts: 1 });
        resetStoreHandle();
      }
    }
  } finally {
    draining = false;
  }
}

async function runBatch(key: StoreKey, batch: PendingWrite[]): Promise<void> {
  const failures = new Map<PendingWrite, unknown>();
  try {
    await commitBatch(key, (current) => {
      let acc = current;
      for (const w of batch) {
        // A mutate that throws must not abort the transaction: the other writes in this batch
        // are innocent, and an abort would fail them all.
        try {
          acc = w.mutate(acc);
        } catch (err) {
          failures.set(w, err);
        }
      }
      return acc;
    });
  } catch (err) {
    for (const w of batch) w.reject(failures.has(w) ? failures.get(w) : err);
    return;
  }
  for (const w of batch) {
    if (failures.has(w)) w.reject(failures.get(w));
    else w.resolve();
  }
}

/** Wait until nothing is queued — for the destructive paths that must not interleave with an
    ordinary write (`replaceSnapshot` clears the store before refilling it). */
export async function flushWriteQueue(): Promise<void> {
  while (draining || writeQueue.length > 0) await new Promise((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Exercise attempts
// ---------------------------------------------------------------------------

export interface Attempt {
  /** exercise set id, e.g. "a2/perfekt-haben-sein" */
  setId: string;
  itemId: string;
  itemType: string;
  /** Authored task contract used for this attempt; absent on v1-v4 history. */
  itemRevision?: number;
  /** fully correct (partial credit lives in correctParts/totalParts) */
  correct: boolean;
  /** parts answered correctly, for multi-part items (cloze gaps, match pairs, table cells) */
  correctParts?: number;
  /** parts asked; ≥ 1 when present — emitters and snapshot import both enforce it */
  totalParts?: number;
  /** what the learner entered/chose, for the personalization loop */
  given: string;
  /** the item's confusion tag (see focus-tag table in docs/authoring/focus-tags.md), when tagged */
  focus?: string;
  /** Explicit verdict for the item's targeted focus; absent on historical attempts. */
  focusEvidence?: 'retained' | 'failed' | 'unknown';
  /** omitted in historical snapshots; absence means verified */
  evidence?: 'verified' | 'practice';
  /** actual response channel; absent in historical snapshots */
  responseMode?: 'selection' | 'writing' | 'listening' | 'spoken-production' | 'spoken-interaction';
  /** stable curriculum outcome ids exercised by this attempt */
  outcomes?: string[];
  /** Structured open-production evidence. Never contributes verified accuracy. */
  practice?: PracticePayload;
  ts: number;
}

export type CriterionAssessment = 'met' | 'needs-work';

export type PracticePayload =
  | {
      kind: 'writing';
      draft: string;
      revision: string;
      /** Legacy only: the retired staged self-assessment logged these; nothing writes them now. */
      before?: CriterionAssessment[];
      after?: CriterionAssessment[];
    }
  | {
      kind: 'speaking';
      recorded: boolean;
      /** Legacy only: the retired staged self-assessment logged these; nothing writes them now. */
      before?: CriterionAssessment[];
      after?: CriterionAssessment[];
    };

/** Write boundary: historical attempts may omit a revision; newly logged ones may not. */
export type NewAttempt = Omit<Attempt, 'itemRevision'> & { itemRevision: number };

/**
 * Notifies other islands on the page that the attempt log changed.
 *
 * Islands are independent React roots and cannot share state, so a panel rendered beside
 * an exercise set has no way to learn that the learner just answered something. The
 * placement results panel needs exactly that — it sits under the test on the same page and
 * must appear as the last item is answered. Fire-and-forget, same shape as `da:langchange`.
 */
export const ATTEMPT_EVENT = 'da:attempt';

export async function logAttempt(attempt: NewAttempt): Promise<void> {
  // Deduped by the merge key inside the read-modify-write, so a timed retry or a
  // journal replay of an attempt that actually landed appends nothing — the same
  // idempotency contract mergeAttempts already gives cross-device imports.
  await enqueueUpdate<Attempt[]>('attempts', (arr) => {
    const cur = arr ?? [];
    const key = attemptKey(attempt);
    return cur.some((a) => attemptKey(a) === key) ? cur : [...cur, attempt];
  });
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(ATTEMPT_EVENT, { detail: attempt.setId }));
  scheduleAutoSync();
}

export async function getAttempts(): Promise<Attempt[]> {
  return withVisibilityRetry(async () => (await get<Attempt[]>('attempts', await getStore())) ?? []);
}

// ---------------------------------------------------------------------------
// FSRS card states (serialized ts-fsrs Card objects, dates as ISO strings)
// ---------------------------------------------------------------------------

export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
  /** Local date this card was first ever graded (YYYY-MM-DD) — the daily new-card
      budget counts these. Stamped once by `gradeCard`, never updated. Absent on
      cards introduced before the field existed, which reads correctly as "not
      today". See `introducedToday` in srs.ts for why FSRS's own fields cannot
      answer this. */
  introducedAt?: string;
}

export type CardStates = Record<string, StoredCard>;

export async function getCardStates(): Promise<CardStates> {
  return withVisibilityRetry(async () => (await get<CardStates>('cards', await getStore())) ?? {});
}

export async function setCardState(cardId: string, card: StoredCard): Promise<void> {
  await withVisibilityRetry(async () => {
    await enqueueUpdate<CardStates>('cards', (m) => ({ ...(m ?? {}), [cardId]: card }));
  });
  scheduleAutoSync();
}

/**
 * Atomic read-modify-write of one card's state; returns the value actually written.
 *
 * The grading path persists through this rather than `setCardState`, because the
 * mutate runs against the FRESHEST stored card inside the `update()` transaction: a
 * cloud pull-merge that landed after the session mounted is graded on top of, never
 * clobbered from a component's mount-time state map. Pair with `applyGradeAt`
 * (src/lib/srs.ts) so retries and journal replays are idempotent.
 */
export async function updateCardState(
  cardId: string,
  mutate: (prev: StoredCard | undefined) => StoredCard,
): Promise<StoredCard> {
  let written: StoredCard | undefined;
  await enqueueUpdate<CardStates>('cards', (m) => {
    const cur = m ?? {};
    written = mutate(cur[cardId]);
    return { ...cur, [cardId]: written };
  });
  scheduleAutoSync();
  // The callback runs synchronously inside update(); by the time the await above
  // resolves, `written` is always assigned.
  return written!;
}

// ---------------------------------------------------------------------------
// Active curriculum goal (profile-scoped and snapshot-synced)
// ---------------------------------------------------------------------------

export interface LearningGoal {
  /** absent is a timestamped clear marker, so clearing also merges across devices */
  topicId?: string;
  setAt: number;
}

export async function getLearningGoal(): Promise<LearningGoal | undefined> {
  return withVisibilityRetry(async () => await get<LearningGoal>('goal', await getStore()));
}

export async function setLearningGoal(goal: LearningGoal): Promise<void> {
  await enqueueUpdate<LearningGoal>('goal', () => goal);
  scheduleAutoSync();
}

// ---------------------------------------------------------------------------
// Daily session log ("done today" state + cadence history for the agent loop)
// ---------------------------------------------------------------------------

export interface SessionLogEntry {
  /** local calendar date, YYYY-MM-DD */
  date: string;
  /** cards reviewed in step 1 (null = step was skipped) */
  reviewed: number | null;
  /** exercise items answered in step 2 */
  trained: number;
  ts: number;
}

/** Local calendar date — not UTC, so a late-evening session still counts for its own day. */
export function localDateString(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function logSession(entry: SessionLogEntry): Promise<void> {
  await enqueueUpdate<SessionLogEntry[]>('sessions', (arr) => [...(arr ?? []), entry]);
  scheduleAutoSync();
}

export async function getSessionLog(): Promise<SessionLogEntry[]> {
  return (await get<SessionLogEntry[]>('sessions', await getStore())) ?? [];
}

export async function sessionDoneToday(): Promise<boolean> {
  const today = localDateString();
  return (await getSessionLog()).some((e) => e.date === today);
}

// ---------------------------------------------------------------------------
// Topic completion (persisted): the "read" signal + the manual learned override.
// Derived tiers (read/practiced/mastered) are computed in src/lib/mastery.ts.
// ---------------------------------------------------------------------------

export type TopicManual = 'learned' | 'reopened';

/**
 * A passed level entry test, recorded per topic.
 *
 * Deliberately **beside** `manual` rather than a third value of it: that union's whole
 * contract is "self-rating, not evidence", and `pathDone` already special-cases
 * `'learned'` on exactly that basis. A placement result *is* evidence — it just is not
 * evidence of mastery — so it needs its own field and its own marker.
 */
export interface TopicPlacement {
  /** the `role: placement` set that produced this result, e.g. `a1/placement-a1` */
  setId: string;
  /** epoch ms the learner applied the result */
  at: number;
  /** the topic's parts-weighted ratio in [0,1] — kept so a retake can be compared */
  score: number;
}

export interface TopicProgress {
  /** epoch ms the article was first opened */
  readAt?: number;
  /** manual override set by the learner */
  manual?: TopicManual;
  /** epoch ms the manual override was last changed (for merge last-write-wins) */
  manualAt?: number;
  /** passed entry test — green, but never a tier (see src/lib/placement.ts) */
  placement?: TopicPlacement;
}

export type TopicsState = Record<string, TopicProgress>;

export async function getTopicsState(): Promise<TopicsState> {
  return withVisibilityRetry(async () => (await get<TopicsState>('topics', await getStore())) ?? {});
}

/** Mark a topic's article as read. Idempotent — keeps the earliest readAt. */
export async function markTopicRead(topicId: string, ts = Date.now()): Promise<void> {
  await enqueueUpdate<TopicsState>('topics', (m) => {
    const cur = m ?? {};
    if (cur[topicId]?.readAt) return cur;
    return { ...cur, [topicId]: { ...cur[topicId], readAt: ts } };
  });
  scheduleAutoSync();
}

/** Set (or clear, with null) the manual learned/reopened override for a topic. */
export async function setTopicManual(
  topicId: string,
  manual: TopicManual | null,
  ts = Date.now(),
): Promise<void> {
  await enqueueUpdate<TopicsState>('topics', (m) => {
    const cur = m ?? {};
    const prev = cur[topicId] ?? {};
    const next: TopicProgress = { ...prev };
    if (manual === null) {
      delete next.manual;
      delete next.manualAt;
    } else {
      next.manual = manual;
      next.manualAt = ts;
    }
    return { ...cur, [topicId]: next };
  });
  scheduleAutoSync();
}

/**
 * Record a passed placement result for a topic. **Idempotent, and monotone in score.**
 *
 * A retake that goes worse must not un-place a topic: the learner has already stopped
 * being taught it, and taking the test again out of curiosity is not a reason to put the
 * lesson back. So the higher score wins, and an equal score keeps the earlier `at` — the
 * placement's own timestamp then always names the moment the topic actually left the path.
 */
export async function setTopicPlacement(
  topicId: string,
  result: Omit<TopicPlacement, 'at'>,
  ts = Date.now(),
): Promise<void> {
  await enqueueUpdate<TopicsState>('topics', (m) => {
    const cur = m ?? {};
    const prev = cur[topicId]?.placement;
    if (prev && prev.score >= result.score) return cur;
    return { ...cur, [topicId]: { ...cur[topicId], placement: { ...result, at: ts } } };
  });
  scheduleAutoSync();
}

// ---------------------------------------------------------------------------
// Optional-artifact feedback (engagement/editorial signal, never mastery)
// ---------------------------------------------------------------------------

export interface ArtifactFeedback {
  artifactId: string;
  difficulty?: 'too-easy' | 'comfortable' | 'too-hard';
  useful?: boolean;
  wantsMore?: boolean;
  ts: number;
}

export type ArtifactFeedbackState = Record<string, ArtifactFeedback>;

export async function getArtifactFeedback(): Promise<ArtifactFeedbackState> {
  return (await get<ArtifactFeedbackState>('feedback', await getStore())) ?? {};
}

export async function setArtifactFeedback(
  entry: Omit<ArtifactFeedback, 'ts'>,
): Promise<ArtifactFeedback> {
  const stamped = { ...entry, ts: Date.now() };
  await enqueueUpdate<ArtifactFeedbackState>('feedback', (current) => ({
    ...(current ?? {}),
    [stamped.artifactId]: stamped,
  }));
  scheduleAutoSync();
  return stamped;
}

// ---------------------------------------------------------------------------
// Export / import (the agent personalization loop reads these snapshots)
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  /** written as 7; import accepts v1-v7 through explicit migration. */
  version: 7;
  exportedAt: string;
  /** profile label, informational only */
  profile?: string;
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
  topics: TopicsState;
  goal?: LearningGoal;
  feedback: ArtifactFeedbackState;
}

export async function exportSnapshot(profile?: string): Promise<ProgressSnapshot> {
  return {
    version: 7,
    exportedAt: new Date().toISOString(),
    profile,
    attempts: await getAttempts(),
    cards: await getCardStates(),
    sessions: await getSessionLog(),
    topics: await getTopicsState(),
    goal: await getLearningGoal(),
    feedback: await getArtifactFeedback(),
  };
}

export function isValidSnapshot(s: unknown): boolean {
  return isProgressSnapshot(s);
}

/** Strip malformed partial-credit fields so attemptScore() can trust totalParts ≥ 1. */
export function sanitizeAttempts(attempts: Attempt[]): Attempt[] {
  return attempts.map((a) => {
    if (a.correctParts === undefined && a.totalParts === undefined) return a;
    if (
      typeof a.correctParts === 'number' &&
      typeof a.totalParts === 'number' &&
      Number.isFinite(a.correctParts) &&
      a.correctParts >= 0 &&
      a.totalParts >= 1
    ) {
      return a;
    }
    const { correctParts: _cp, totalParts: _tp, ...rest } = a;
    return rest;
  });
}

/**
 * Non-destructive merge: unions attempts/sessions (dedup), keeps the
 * more-advanced card state, and last-write-wins for topic manual overrides.
 * This is the default import so two devices/profiles don't clobber each other.
 */
export async function mergeSnapshot(snapshot: unknown): Promise<void> {
  const migrated = parseProgressSnapshot(snapshot);
  // Through the queue like every other write: a merge is six back-to-back readwrites, which is
  // exactly the backlog a grade issued mid-sync used to find itself behind (ADR 0019). Queued
  // together they interleave with the session's own writes instead of monopolising the store.
  await enqueueUpdate<Attempt[]>('attempts', (cur) =>
    mergeAttempts(cur ?? [], sanitizeAttempts(migrated.attempts)),
  );
  await enqueueUpdate<CardStates>('cards', (cur) => mergeCards(cur ?? {}, migrated.cards));
  await enqueueUpdate<SessionLogEntry[]>('sessions', (cur) =>
    mergeSessions(cur ?? [], migrated.sessions),
  );
  await enqueueUpdate<TopicsState>('topics', (cur) => mergeTopics(cur ?? {}, migrated.topics));
  await enqueueUpdate<ArtifactFeedbackState>('feedback', (cur) =>
    mergeFeedback(cur ?? {}, migrated.feedback),
  );
  if (migrated.goal) {
    await enqueueUpdate<LearningGoal | undefined>('goal', (cur) =>
      !cur || migrated.goal!.setAt > cur.setAt ? migrated.goal : cur,
    );
  }
  scheduleAutoSync();
}

/** Destructive: replaces the whole store with the snapshot's contents. */
export async function replaceSnapshot(snapshot: unknown): Promise<void> {
  const migrated = parseProgressSnapshot(snapshot);
  // The one path that must not interleave: it clears the store before refilling it, so a
  // queued grade committing in between would be wiped by the clear or resurrected after it.
  await flushWriteQueue();
  const store = await getStore();
  // The identity record names this database for discovery — it outlives its contents.
  const identity = await get<ProfileRecord>('profile', store);
  await clear(store);
  if (identity) await set('profile', identity, store);
  await set('attempts', sanitizeAttempts(migrated.attempts), store);
  await set('cards', migrated.cards, store);
  await set('sessions', migrated.sessions, store);
  await set('topics', migrated.topics, store);
  await set('feedback', migrated.feedback, store);
  if (migrated.goal) await set('goal', migrated.goal, store);
  scheduleAutoSync();
}

/** Default import path — non-destructive merge. */
export const importSnapshot = mergeSnapshot;
