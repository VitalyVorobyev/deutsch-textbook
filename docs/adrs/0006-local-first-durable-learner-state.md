# ADR 0006: Learner state is local-first, and the store never fails silently

Status: accepted · 2026-10-18

## Context

Progress lives in the learner's own browser or desktop webview, per profile, in IndexedDB. That
store can stall: WKWebView transactions hang without an error, open requests never settle, and a
backgrounded tab freezes timers. Each stall reached the learner as one of two silent lies — an
answer that looked saved and was not, or an empty progress page that looked like a fresh profile
and then fed an empty review plan. Both destroy trust in every other number the app shows.

## Decision

**Learner state is local, per profile, and owned by the device.** No database is created before a
profile exists, no name is assumed, and the last profile cannot be deleted. A server copy is
optional and opaque ([ADR 0007](0007-opaque-snapshot-sync-and-approval-accounts.md)).

**Silence is never an outcome of a progress read or write.**

1. **Writes are journaled before they are attempted** (synchronous localStorage), retried on a
   timer to a deadline, and loud in the UI once late. Every journaled write is idempotent, so a
   replay at launch is safe. A write that commits after its deadline still confirms itself.
2. **One readwrite transaction at a time, and a burst of writes is one commit.** A stalled
   transaction is aborted and the abort is observed before any retry. An unacknowledged abort
   blocks the store until restart rather than racing it.
3. **Reads retry on a timer too, and every surface distinguishes three states:** still reading,
   read failed, confirmed empty. A stall renders an error with a retry, a badge renders an explicit
   unknown, and an implausibly empty read never feeds `planReview`.
4. **Nothing learner-written is discarded.** An operation that can never apply is quarantined
   after its evidence is saved; overflow never drops entries; no snapshot writer shrinks an
   existing file.
5. **Diagnostics carry counters, never learner content.**

The mechanism (deadlines, the managed adapter, the journal drain, the tests that pin each
property) is in [`../architecture/runtime-contracts.md`](../architecture/runtime-contracts.md).

## Consequences

- Moving the store to Rust-side SQLite would remove the WKWebView failure mode, but it is a
  rewrite of every read path, the sync layer and the web build. It stays rejected until a measured
  failure says otherwise.
- Progress sits under six keys in one object store, so a grade rewrites a large blob. Per-record
  keys are the long-term answer and are on the backlog, gated on measured write latency.
- Any new progress surface owes the three-state read and its error shape before it ships.
