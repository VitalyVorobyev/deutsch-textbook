# ADR 0016: A progress write is journaled, retried on a timer, and loud when late

Status: accepted · 2026-08-26

## Context

The learner reported the desktop app "shows no progress and loses reviewed cards at the next
start". Forensics on the desktop's daily backup files
(`~/Library/Application Support/dev.nonvision.deutsch-atlas/progress/vitaly/`, 46 files at the
time of investigation) established two facts that together name the mechanism:

- **The durable store never regressed day over day.** Across every consecutive pair of daily
  snapshots there is no card whose `last_review` moved backwards and none whose `reps` dropped;
  attempts, sessions and cards are monotone. Nothing was ever destroyed after it landed.
- **`2026-08-19.json` does not exist.** The writer runs on a 2.5 s debounce after every store
  write, so a day with no file is a day on which *no write ever settled* — the session's answers
  were lost before durability, not after it.

The write path made that silent. `setCardState` was fire-and-forget in FlashcardSession
(`.catch(console.error)`), every `logAttempt` call site was a bare `void logAttempt(...)` with no
catch at all, and `withVisibilityRetry` — the PR #173 fix for the backgrounded-tab stall — retries
only on `visibilitychange`, so a WKWebView IndexedDB stall while the window stayed visible (or a
quit before the next visibility flip) lost the write with no signal anywhere. On the read side the
same stall rendered "no progress": an empty-looking read fed `planReview`, which then dealt
mastered cards as new.

Two adjacent hazards were confirmed in the same investigation: FlashcardSession graded from its
mount-time card-state map while every page load also fires a cloud pull-merge, so a grade could
overwrite newer merged state (and `moreAdvancedCard`'s newest-`last_review`-wins rule would then
propagate the regression to every device); and a retried write, once retries exist, would
double-apply FSRS unless grading is idempotent.

## Decision

Silence is never an outcome of a progress write. Concretely:

1. **Idempotent primitives.** `logAttempt` dedupes by the merge key `setId|itemId|ts`
   (`attemptKey`, snapshot-merge.ts) inside its read-modify-write. Grading goes through
   `updateCardState(cardId, mutate)` — an atomic RMW against the freshest stored card — with
   `applyGradeAt(prev, grade, ts)` (srs.ts) as the mutate: its `last_review >= ts` guard makes N
   applications of one grade identical to one. Idempotency is what licenses every retry below.
2. **Timed retry with a deadline.** Critical writes run through `withPersistenceRetry`
   (store.ts): backoff attempts at 4/8/16 s, the visibility retry kept as one more trigger, and a
   hard 45 s deadline after which it rejects with `StoreStallError`. `withVisibilityRetry` itself
   is unchanged — its contract (never self-rejecting) is pinned by tests and still serves plain
   reads.
3. **A synchronous localStorage write journal** (`src/lib/write-journal.ts`, key
   `da:journal:<profileId>`). Every critical write is journaled *before* the IndexedDB attempt
   starts and removed after it settles; a stalled write stays journaled, and the next launch
   replays the journal (idempotency makes replaying an op that actually landed a no-op).
   localStorage is synchronous, so the journal survives an abrupt quit with no flush step — the
   property `resume.ts` already relies on.
4. **A loud, non-dismissible alert** (`PersistenceAlert`, mounted in Base.astro) whenever the
   journal holds ops older than a 10 s grace period, with a retry button. Dismissing "your work
   is not saved" is how work gets lost politely.
5. **Reads on daily-loop surfaces have a deadline and a plausibility gate.** `withReadDeadline`
   turns a stalled read into `StoreStallError`; the one-way `da:seen-data:<kind>:<profileId>`
   markers record that this profile has persisted cards/attempts before, and a read that comes
   back empty against its marker renders an explicit error state — never a fresh-profile view,
   and never feeds `planReview`.

## Rejected alternatives

- **Moving the store to Rust-side SQLite.** Removes the WKWebView IndexedDB failure mode
  entirely, but is a storage rewrite touching every read path, the sync layer and the web build
  (which has no Rust side); the journal gets the same safety for two orders of magnitude less
  change.
- **Blocking the session UI on a late write.** The journal plus replay makes continuing safe, and
  blocking punishes the learner for a storage stall they cannot fix mid-session. The alert is
  loud instead.
- **Migrating the stale second WKWebView container** (`~/Library/WebKit/deutsch-atlas/`, created
  by bundle-less runs of the release binary). Real, but the owner launches only the `.app`; a
  detect-and-warn is backlog, not part of this change.

## Consequences

- A stalled store is now visible within seconds and recoverable at the next launch; the
  2026-08-19 class (a whole session evaporating) can no longer happen silently.
- Grading writes commit on top of whatever is in the store at commit time, so a mid-session cloud
  merge is graded on top of rather than clobbered — closing the cross-device regression path.
- Every future critical write must state whether it is idempotent; a non-idempotent write may not
  go through `withPersistenceRetry` or the journal.
- The invariants live in [`docs/architecture/runtime-contracts.md`](../architecture/runtime-contracts.md);
  the tests are `tests/write-journal.test.ts` and `tests/store-visibility-retry.test.ts`.

---

**Amended by [ADR 0019](0019-writes-single-flight-and-confirm-late.md)** (2026-09-15). Three of
the decisions above are superseded rather than merely extended: the 4/8/16 s concurrent retry
schedule (it could not overtake the transaction it was rescuing, and queued three more full-blob
rewrites behind it), the flat 10 s alert grace (unrelated to the 45 s deadline it was supposed to
describe), and "removed after it settles" — which the code did not keep for a settle that arrived
after the deadline, leaving journal entries that outlived the writes they described.
