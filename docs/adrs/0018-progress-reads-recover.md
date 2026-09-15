# ADR 0018: Reads recover on a timer, and no surface renders a stall as emptiness

Status: accepted · 2026-09-03

## Context

The learner opened the installed desktop app and got the red *"Fortschritt konnte nicht
geladen werden"* card on **Heute** and a permanent *"Загружаем ваш прогресс…"* on **Themen**.
They had opened the app on no other device, and read it as a sync failure: *"if there is no
connection, there still should be valid local state, not just empty UI."*

Forensics on the machine, all read-only, say the data was fine and the network was
irrelevant:

| Evidence | Reading |
| --- | --- |
| `~/Library/WebKit/dev.nonvision.deutsch-atlas/…/IndexedDB.sqlite3` holds the `deutsch-atlas`/`progress` store with 5 records (784 KB `cards`, 171 KB `attempts`, …) | the store is populated |
| `<appData>/progress/vitaly/2026-09-03.json` — 1.73 MB, 824 cards, 3919 attempts, 54 sessions, written 17:25 the same day, 13 attempts more than 2026-09-02 | the app had worked two hours earlier; the durable backup is healthy |
| `da:profiles = [{"id":"vitaly","label":"Vitaly"}]`, `da:journal:vitaly = []`, `da:seen-data:{cards,attempts}:vitaly = 1` | not first-run, no stalled writes, markers intact |
| `https://deutsch.vitavision.dev/api/auth/session` → 200 in 41 ms; `runRemoteSync` fires only 20 s *after a write* and swallows its own errors; no page-load pull exists (`mergeSnapshot` has one call site, a button) | **reads never wait on the network** |
| 0 of the 174 ids in `A1_CARD_ID_MIGRATION` were present in the learner's 824 cards | the migration read on every store open was dead weight |

So an IndexedDB read in the WKWebView stalled — the ADR 0016 failure mode, on the read side.
Three defects turned that stall into what the learner saw, and a fourth left it
undiagnosable.

1. **`CurriculumPath` had no way out.** It fired four store reads in a bare
   `Promise.all(...).then(onFulfilled)` — no deadline, no `onRejected`, no error state — so
   `ctx` stayed `null` and the loading line was permanent. It was the only daily-loop surface
   without a deadline, and `tests/curriculum-path-loading.test.tsx` pinned that loading text
   as correct behaviour with a `neverResolves` fixture while asserting nothing about it ever
   ending.
2. **Reads had a deadline but no retry.** ADR 0016 gave *writes* timed retries
   (`withPersistenceRetry`) and left reads with `withReadDeadline` — which took an
   already-created **promise**, so it structurally could not retry — plus
   `withVisibilityRetry`, whose only trigger is `visibilitychange` and whose own doc comment
   says the stall "does not always clear on its own". A stalled read therefore had no
   automatic recovery at all; a manual retry button was the whole mechanism.
3. **`getStore()` could park on a read that did nothing.** It awaited `migrateStoredCardIds`
   — a bare `get('cards')`, 784 KB here, no deadline, no retry — on every store open. The
   page's first reader waited on it, and under `Promise.all` that one leg hanging hung the
   whole surface.
4. **Nothing recorded why.** No stall was logged anywhere, and the release bundle had no
   inspector, so the occurrence left no evidence at all.

## Decision

A stalled read recovers by itself; if it cannot, every surface says so and offers a way
back; and the next occurrence leaves a fact behind.

1. **Reads retry on a timer.** `withReadRetry(op, { surface })` (store.ts) is
   `withPersistenceRetry`'s shape for reads: attempts at 0/2/5 s, the visibility retry kept
   as one more trigger, first settle wins, `StoreStallError` at a 10 s deadline. It takes a
   **thunk**; `withReadDeadline` is gone, so there is no non-retrying variant to reach for.
   A read needs no idempotency argument, which is why it should have had this from the start.
   A read that *rejects* is not retried — only silence is.
2. **No load surface renders a stall as emptiness.** Two tiers, because the slots differ.
   Surfaces that make a claim about progress (Themen, mixed training, the topic mastery
   badge, the placement summary, the session's probe planning) get the
   `ProgressLoadError` + retry shape Heute already had, plus the implausibly-empty gate
   against `hasSeenData`. Badges and counters (DueBadge, VocabMastery, ProbeBacklog) get the
   retries and an explicit unknown state — never a confident `0`.
3. **The card-id migration leaves the critical path, and gains an owner.** `getStore()` is
   now only create-memoize-return. The repair runs once per launch from `PersistenceAlert`
   — the island Base.astro already mounts on every page to replay the write journal — gated
   on `da:cardid-migrated:<profileId>`, set only after a **successful** pass, so a stall
   retries next launch instead of skipping the repair forever. Firing it un-awaited from
   inside `getStore()` was tried first: it fixes the hang and keeps the other half of the
   problem, an unobserved IndexedDB transaction opened by whichever code path happens to
   touch the store first, racing whatever that page is reading. (It also hung `bun test`,
   where one process shares the store module across 89 files.) The rename now commits in one `update()` read-modify-write rather than a
   `get` then a `set`: the old pair could drop a grade written in between by any reader that
   skipped the migration, and moving the migration off the critical path would have widened
   exactly that window.
4. **A bounded stall log** (`src/lib/stall-log.ts`, key `da:stall-log:<profileId>`, ≤ 20
   entries, synchronous localStorage like the write journal). Surface, wait, attempt count,
   timestamp — **counters only, never learner content**; a diagnostic that carries content is
   a second copy of the data it diagnoses. A late settle after the deadline is recorded as a
   recovery, because "the store unstuck itself after 12 s" and "the store never answered" are
   different bugs. Surfaced on **Fortschritt → Daten** beside the newest local backup's date,
   counts and path — which is also the honest answer to *"my progress is gone"*: it names the
   file that holds it, read through `fs:allow-exists`/`fs:allow-read-text-file`, which were
   already granted.
5. **Three desktop guards**, chosen as guards rather than as proven causes:
   - `tauri-plugin-single-instance`, registered first, so a second launch focuses the
     existing window instead of putting a second process on one WebKit container and its
     IndexedDB SQLite files.
   - the `devtools` feature on in release builds. The app whose storage can stall is the
     installed one, and it had no way to be looked at.
   - `legacy_webkit_container`, a macOS-only, metadata-only report of
     `~/Library/WebKit/deutsch-atlas` — the second container created by bundle-less runs of
     the binary, which ADR 0016 named and deferred. It is **reported, never touched**: what
     to do about a second copy of a learner's progress is the owner's call, and doing it
     silently is how a day of work disappears.

## Rejected alternatives

- **Rendering read-only from the newest backup file when IndexedDB stalls.** Directly
  answers "there should still be valid local state", and the capability to read the file was
  already granted. Rejected as a second read path with a mode that cannot be graded on and a
  staleness the learner would have to reason about; the retries plus a named backup file get
  the reassurance without the parallel source. Revisit if the retries prove insufficient in
  practice.
- **Retrying a read that rejected.** A read that says "no" has answered. Retrying it turns
  one real error into three, and `NotFoundError` (the shape a missing object store takes)
  would never resolve anyway.
- **A shorter read deadline.** 10 s is unchanged: it is long enough that no ordinary round
  trip trips it, and the retries now fire at 2 s and 5 s inside it, so recovery does not wait
  for the deadline.
- **Deleting or migrating the second WebKit container.** The detection is new; acting on it
  is not this change, and an automatic merge of two divergent stores is precisely the
  operation that must never happen without the owner.

## Consequences

- A stalled read is retried twice before anyone is told, and the learner is never shown a
  screen that means "you have no progress" because of one.
- First paint on every load surface loses the 784 KB migration read that used to sit in
  front of it.
- Every future load surface must go through `withReadRetry` and must distinguish "still
  reading" from "read failed" from "confirmed empty". `bun test` pins the wrapper
  (`tests/store-read-retry.test.ts`), the log (`tests/stall-log.test.ts`), the marker
  (`tests/store-visibility-retry.test.ts`) and Themen's four states
  (`tests/curriculum-path-loading.test.tsx`).
- **What this does not claim.** The WKWebView stall itself is not reproducible on demand, so
  nothing here proves it will not happen again. The claim is narrower and checkable: the UI
  always has a way out, reads retry themselves, and the failure is recorded.

## Known gap, filed rather than fixed

`AccountPanel`'s `bind()` reads `getAttempts()` to decide whether to warn before binding a
profile to a cloud account. A stalled read there resolves as "nothing to merge" and skips the
confirmation. Real, different surface, different hazard — `docs/backlog.md`.
