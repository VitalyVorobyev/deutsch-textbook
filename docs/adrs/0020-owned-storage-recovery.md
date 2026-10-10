# ADR 0020: Own stalled transactions before retrying progress writes

Status: accepted · 2026-09-17 · amends ADR 0019

## Context

Read-only inspection of the installed app's localStorage on September 17 found three pending
card grades and a stall log containing three 45-second grade deadlines, two failed manual
replays, and repeated queue deadlines. The learner reported the count growing after moving
from a daily session to word cards. This establishes a live persistence failure, not its original
WebKit trigger. No learner database or journal was modified during diagnosis.

ADR 0019 retired the JavaScript handle without owning the database connection or transaction.
Its queue advanced after a deadline while the original transaction could still hold the same
object-store lock. Another connection cannot overtake that transaction. Its statement that
IndexedDB has no cancellation mechanism was incorrect: IDBTransaction.abort() rolls back a
live transaction. Whether a malfunctioning engine acknowledges that abort must itself be bounded.

## Decision

- `managed-store.ts` owns connections and terminal transaction listeners. Opens have a 2-second
  deadline; expired results are closed. Transactions have a 10-second watchdog and a 1-second
  abort acknowledgement budget. Up to three attempts run sequentially. Only observed aborts
  permit retry; missing terminal acknowledgement blocks the adapter until a page/app restart.
- Completion during the abort grace is still a commit. A callback failure after an observed
  commit is distinguishable from an abort. All operations retried by the adapter are idempotent.
- Queue batches remain owned until their managed operation settles. A journal drain, shared by
  live writes and manual/launch replays, preserves submission order and remains owned after a
  caller's 45-second deadline. Callers never multiply transactions on visibility changes.
- Session completion joins the backward-compatible journal union, deduplicated by date and
  timestamp using the existing snapshot merge identity. Snapshot v7 and database keys do not change.
- Storage errors remain pending. Quarantine must preserve evidence before removing an invalid
  operation and cannot evict older evidence. Journal overflow no longer drops pending entries.
  A localStorage failure retains a volatile copy, explicitly shown as not durable.
- Diagnostics retain bounded phase, duration, attempt count, queue depth, outcome and version
  metadata, never answer contents. Recovery failure offers restart guidance without auto-reload.

## Consequences

Fault-injection tests exercise actual IndexedDB transaction locks, rollback, abort failure,
late completion, stale opens, and missing callbacks. Transition tests combine session completion,
card grading, concurrent merge and duplicate replay; repeated manual retries share the original
write even after a caller timeout. These prove recovery mechanisms, not elimination of all
WKWebView engine stalls. Bundled desktop verification remains necessary.

No migration, database deletion, learner-journal clearing or cloud API change is required.
