# ADR 0019: A write that lands late still confirms itself, and only one runs at a time

Status: accepted · 2026-09-15 · **amends [ADR 0016](0016-durable-progress-writes.md)**

## Context

The desktop app showed a permanent red banner — `2 Antworten noch nicht gespeichert — Fenster
nicht schließen` — while the learner kept grading flashcards normally, 107 cards left in the
queue, every other surface healthy. The count was **stuck at 2**: it neither grew nor cleared.

That signature is most of the diagnosis. A genuinely wedged store fails every subsequent write,
so the count would climb. A healthy store never journals anything for longer than a round trip.
Two ops, frozen, in a working app means two writes went past their deadline, **landed anyway**,
and were never taken off the journal.

Four facts about the code as ADR 0016 left it, each of which can pin that count:

- **`withPersistenceRetry` dropped a post-deadline success.** It rejects with `StoreStallError`
  at 45 s and sets `settled = true`; the in-flight attempts are never cancelled, and the code
  says so itself — *"The write may still land later (attempts are never cancelled)"*. When one
  resolved afterwards, `settleResolve` hit `if (settled) return`. But idb-keyval resolves on
  `transaction.oncomplete`, so **a resolve is a commit**: the write was on disk and the caller
  was never told. `journalRemove` lives in the success branch, which never ran.
  [ADR 0018](0018-progress-reads-recover.md) had already given `withReadRetry` exactly this
  late-settle branch, 50 lines below in the same file. The write half was not brought along.
- **A stalled write left no evidence.** `stall-log.ts` was written only by `withReadRetry`, so
  nothing reached `da:stall-log:<profileId>` or the Fortschritt → Daten panel. Two
  `console.error` lines were the whole trail.
- **The retry could not rescue the failure it existed for, and multiplied the load.** All six
  progress keys live in ONE object store (`createStore(dbNameFor(id), 'progress')`), so
  IndexedDB gives each readwrite exclusive access across all of them: the attempt fired at 4 s
  could not begin until the attempt it was retrying had completed. It only queued three more
  full-blob read-modify-writes of a ~784 KB `cards` record behind it. Worse, idb-keyval memoizes
  its DB-open promise and clears it only from `db.onclose` — an event a hang never fires — so
  every retry re-awaited the identical hung promise.
- **The alert's grace and the write's deadline were unrelated constants in two files**
  (10 s against 45 s). A healthy-but-slow 12 s write therefore spent 35 seconds telling the
  learner not to close the window, and a warning that cries wolf stops being read — which
  defeats the reason ADR 0016 made it non-dismissible.

Two further ways the count can freeze, found while fixing the above and fixed here because
otherwise all of the above can ship and the banner can still be red:

- **A poison op.** `replayJournal` treated *every* rejection as "the store is stalled" and
  returned at the first one. A rejection that is not a stall recurs identically at every launch,
  so that op blocks every op behind it forever — and the bare `catch {}` guaranteed no evidence.
- **A journal that cannot be written.** `writeOps` swallowed its `localStorage` failure, which
  makes `journalAppend` *and* `journalRemove` both no-op. The count then freezes at whatever it
  held: new answers never join it, confirmed ones never leave.

## Decision

**A write that settles is confirmed, whenever it settles; and the store runs one write at a
time.** Concretely:

1. **Late settle confirms.** `withPersistenceRetry` takes `onLateSettle`, alongside the
   `surface` it now shares with `withReadRetry`. A post-deadline resolve records a recovery and
   calls it; the journal helpers pass `confirmOp`, the single function both the success path and
   the late path go through, because the drift between those two *was* the bug. A post-deadline
   **rejection** is not a settle: nothing landed, so the entry stays.
2. **One readwrite transaction at a time, N mutations per commit.** `enqueueUpdate` single-flights
   every store write and coalesces all pending mutations for a key into one `update()`. This
   models what the database already did — the serialization is not new — and adds what it cannot:
   a burst of eight grades costs one read and one write instead of eight of each. The mutators
   still run *inside* the transaction against the freshest stored value, so ADR 0016's
   read-modify-write invariant is untouched.
3. **The deadline clock starts at ENQUEUE, never at dequeue.** `withPersistenceRetry` wraps the
   enqueue, so queue time counts against the deadline. The alternative is defensible-sounding and
   wrong: a queue wedged behind one stuck transaction would hand op #10 a fresh 45 s budget
   starting whenever it was dequeued, possibly never. Queue time is silence, and silence is what
   the deadline exists to convert into a fact.
4. **The runner stops waiting for a batch at `QUEUE_BATCH_TIMEOUT_MS`, equal to the write
   deadline by construction.** It never cancels — IndexedDB has no cancel — and the orphaned
   transaction still settles its own members if it commits, which is decision 1's path. Without
   this bound, one wedged commit would halt every later write for the life of the page: the one
   genuine regression single-flighting could introduce.
5. **A timed retry reconnects instead of piling on.** The schedule is 12/30 s, and each offset
   drops the memoized handle first. Honest limits, stated where the function is:
   `resetStoreHandle` **can** rescue a hung `indexedDB.open()`; it **cannot** overtake a wedged
   readwrite transaction, because IndexedDB orders transactions by scope across the whole
   database rather than per connection; and it **leaks** the old connection, because idb-keyval
   never exposes the `IDBDatabase` to close it.
6. **Writes log their stalls**, under a `surface` (`grade`, `attempt`, `replay`, `write-queue`),
   into the same bounded `da:stall-log` reads already use. `replayJournal` returns its error
   instead of discarding it, and `PersistenceAlert` reports it.
7. **The alert has two tiers, tied together by an import.** Nothing under `ALERT_GRACE_MS`; a
   calm amber line, with no button, while the write is still inside its retry budget; the red,
   non-dismissible banner only past `ALERT_LATE_MS`, which *is* `PERSISTENCE_DEADLINE_MS`. No
   button on the amber tier because a second attempt only queues behind the first.
8. **An op that can never be applied is quarantined** to `da:journal-poison:<profileId>` with its
   error, so it stops blocking the ops behind it. Moved, never dropped: a write the learner made
   is not ours to discard.
9. **A journal write that fails is named** (`journalWriteBlocked`), and the alert says so. It
   still never throws — a safety net may not be the thing that breaks the app — but it is no
   longer silent.

## Alternatives rejected

- **A richer return type from `withPersistenceRetry`** (`{ value } | { stalled, late }`). Changes
  the type at every call site, breaks "first settle wins", and implies the caller could *use* the
  late value — but `FlashcardSession` adopting a card state 60 s later, for a card long gone from
  the queue, is an unwanted state jump. The caller needs the fact, not the value.
- **A completion registry in the journal**, keyed by `journalOpKey`. A second module-level map
  with its own lifetime and leak questions, when the wrapper already has the right closure.
- **A per-op `failed` flag in the journal.** More precise than inferring from age, but it mutates
  an entry after append — in the one structure whose whole value is that it is append-then-remove
  — and needs a migration for existing entries. Age is derivable from data already present, and
  survives a restart correctly.
- **Simply raising `ALERT_GRACE_MS` to 45 s.** Re-introduces 45 seconds of total silence, which
  is the thing ADR 0016 exists to forbid. The amber tier keeps the signal without the false alarm.
- **Dropping write retries entirely.** Tempting once the queue exists, since a same-connection
  retry provably cannot overtake a wedged transaction. Kept because the reconnect is a different
  attempt, and the backgrounded-tab unstick (`visibilitychange`) remains real.
- **Rewriting the store to per-record keys**, which would make a grade a small write instead of a
  full-blob rewrite. The right long-term answer and far beyond this repair: it touches every read
  path, the snapshot format and the sync layer. Filed, not done.

## Consequences

- A banner that says "noch nicht gespeichert" now means it. The permanent-red class of failure
  — an entry outliving its own landed write — cannot recur silently.
- A stalled write leaves a fact behind, and "the store unstuck itself after 12 s" is
  distinguishable from "the store never answered", for writes as it already was for reads.
- **Coalescing changes failure granularity**: one aborted transaction now fails N waiters at
  once, so the alert's count jumps rather than climbing. They would all have failed anyway, on N
  separate transactions; only the shape of the report differs.
- **The journal no longer literally holds everything unconfirmed** — a poisoned op lives beside
  it. Said out loud here because ADR 0016's sentence would otherwise read as still true.
- `scheduleAutoSync()` still fires once per waiter, so a coalesced batch of eight still schedules
  eight debounced syncs, which the debounce collapses into one. Moving it to once per batch is a
  clean follow-up, not part of this change.
- The A1 card-id migration deliberately stays OFF the queue: it takes an injected handle so the
  marker-stays-unset-on-failure path can be driven without an IndexedDB, and the race
  [ADR 0018](0018-progress-reads-recover.md) left open there stays open and stays filed.

## What this does not claim

The WKWebView IndexedDB stall itself is still not reproducible on demand, so nothing here proves
it will not happen again — [ADR 0018](0018-progress-reads-recover.md)'s honesty clause stands
unchanged. Nor is it established which of the six defects above produced the 2026-09-15 banner:
the frozen count is consistent with the late-settle orphan, with a poison op, and with a blocked
`localStorage`, and the machine was not inspected before the fix. Two of the six are insurance,
and they are here precisely because the other four could all ship and leave the banner red.

The claims are narrower and checkable: a write that commits is never reported as unsaved; a write
that stalls leaves a record; the app no longer issues up to four concurrent full-blob rewrites per
graded card; and no single failure can pin the alert at a count that cannot fall.

If the learner's two ops turn out to have been a second WKWebView container (backlog **P29-1**),
none of this fixes that — it makes it visible.

## Tests

`tests/store-persistence-retry.test.ts` (the late-settle branch and its stall-log side effects),
`tests/store-write-queue.test.ts` (ordering, coalescing, per-waiter results, the runner bound),
`tests/write-journal.test.ts` (a stalled-then-landed grade leaves the journal empty; poison
quarantine; a reported replay stall), `tests/journal-storage-blocked.test.ts`,
`tests/persistence-alert-tiers.test.tsx` (the two tiers, the imported boundary, the
self-clearing banner, and the rule that neither tier can be dismissed).
