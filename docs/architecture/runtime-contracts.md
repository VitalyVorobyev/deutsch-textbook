# Runtime contracts

Status: active engineering checklist. [design.md](../design.md) is the system map; `CLAUDE.md` owns
authoring rules. Historical failures and extended rationale are
[archived](../archive/2026-07-runtime-contracts-full.md).

| Contract | Source of truth | Required companion checks |
| --- | --- | --- |
| Content shapes | `packages/schema/src/index.ts`, `src/content.config.ts` | validator and schema tests |
| Curriculum order and graph | `content/atlas.yaml`, `packages/content/src/curriculum.ts` | contracts/deepens tests |
| Review queue and daily new-card budget | `src/lib/decks.ts` | review-plan tests |
| Training eligibility and interleaving | `src/lib/training.ts` | eligibility/broad-retrieval tests |
| Mastery and navigation evidence | `src/lib/mastery.ts`, `src/lib/placement.ts` | mastery/placement tests |
| Delayed probes | `src/lib/probes.ts` | probe tests and progress audit |
| Scoring and focus attribution | `src/lib/scoring.ts`, `packages/grading/src/production.ts` | grading/contract tests |
| Profiles and learner storage | `src/lib/profile.ts`, `src/lib/store.ts` | snapshot/store tests |
| Snapshot compatibility | `src/lib/snapshot-schema.ts`, `src/lib/snapshot-merge.ts` | all-version migration tests |
| Language selection | `src/lib/prefs.ts`, `packages/schema/src/langcheck.ts` | i18n tests and validator |
| Explanation prose shape | `packages/content/src/prose-shape.ts` (authoring-time only; never imported by runtime) | prose-shape tests, validator, `bun scripts/prose-shape.ts` |
| Positional references to shuffled options | `src/lib/option-references.ts` (authoring-time only; never imported by runtime) | option-reference tests, validator |
| Answer-shaped rendering of an input | `src/components/exercises/Cloze.tsx` (`gapWidthCh`) | cloze gap-width tests |
| Same-day lesson resume | `src/lib/resume.ts` | resume tests |
| Durable write path (journal, replay, retry deadline, late-settle confirmation) | `src/lib/write-journal.ts`, `src/lib/store.ts` ([ADR 0016](../adrs/0016-durable-progress-writes.md), amended by [ADR 0019](../adrs/0019-writes-single-flight-and-confirm-late.md)) | write-journal, store-persistence-retry and journal-storage-blocked tests |
| Single-flight coalescing write queue | `src/lib/store.ts` (`enqueueUpdate`, `QUEUE_BATCH_TIMEOUT_MS`) ([ADR 0019](../adrs/0019-writes-single-flight-and-confirm-late.md)) | store-write-queue and persistence-alert-tiers tests |
| Recovering read path (timed retries, deadline, stall log) | `src/lib/store.ts` (`withReadRetry`), `src/lib/stall-log.ts` ([ADR 0018](../adrs/0018-progress-reads-recover.md)) | store-read-retry, stall-log and curriculum-path-loading tests |
| Tauri filesystem integration | `src/lib/syncdir.ts` | browser path plus Tauri guard, syncdir-shrink tests |
| Desktop exit flush | `src-tauri/src/main.rs`, `src/lib/autosync.ts` (`initExitFlush`/`flushForExit`) | `cargo check`; manual Cmd+Q smoke (needs a webview) |
| Session-probe caching | `src/lib/sync-remote.ts` (`classifySessionResponse`) | sync-remote session-probe tests |

## Non-negotiable invariants

- Persisted identities are contracts. Renaming topics, items, outcomes, decks or card headwords
  requires an explicit migration.
- Historical attempts keep their logged result and revision; current answer keys never replay them.
- Unverified writing and speaking remain practice evidence and never raise measured mastery.
- Placement may advance the recommended path but never raises a topic’s measured tier.
- Probe state is derived from the attempt log and served before contaminating practice.
- Fresh-card introductions are budgeted per day, not per rendered queue.
- No database is created before a learner profile exists; the final profile cannot be deleted.
- References, documents, discovery pieces and learning figures create no progress or review debt.
- Persisted UI choices receive migrations when their value domain changes.
- Build-time claims on `/about` are computed from content, never typed by hand.
- A progress write is journaled synchronously before it is attempted, retried on a timer, and
  loud in the UI once it is late — silence is never an outcome ([ADR 0016](../adrs/0016-durable-progress-writes.md)).
  Every write behind `withPersistenceRetry` or the journal must be idempotent (`attemptKey`
  dedupe, `applyGradeAt` ts-guard); a non-idempotent write may not use them.
- A write that settles **after** its deadline still confirms itself: `withPersistenceRetry` calls
  `onLateSettle`, the journal helpers pass `confirmOp`, and the entry comes off. idb-keyval
  resolves on `transaction.oncomplete`, so a resolve is a commit — an entry that outlives its own
  landed write is the alert claiming the learner's data is unsaved when it is on disk. A late
  *rejection* is not a settle ([ADR 0019](../adrs/0019-writes-single-flight-and-confirm-late.md)).
- Store writes go through `enqueueUpdate`: one readwrite transaction on `progress` at a time,
  with all pending mutations for a key coalesced into one commit. The deadline clock runs from
  **enqueue**, and the runner stops waiting for a batch at `QUEUE_BATCH_TIMEOUT_MS` (the write
  deadline) so one wedged commit cannot halt every later write. `replaceSnapshot` flushes the
  queue before its destructive `clear()`; the A1 card-id migration deliberately stays off it, to
  keep the injected-handle seam its failure test needs
  ([ADR 0019](../adrs/0019-writes-single-flight-and-confirm-late.md)).
- An op that can never be applied is quarantined to `da:journal-poison:<profileId>` instead of
  blocking the replay behind it, and a journal write `localStorage` refuses raises
  `journalWriteBlocked()` instead of freezing the alert's count in silence
  ([ADR 0019](../adrs/0019-writes-single-flight-and-confirm-late.md)).
- A stalled or implausibly empty progress read renders an explicit error state — never a
  fresh-profile view, and never feeds `planReview`. "Implausibly empty" means empty against the
  profile's one-way `da:seen-data` marker.
- **Reads get the same timed retries writes do, and every load surface distinguishes three
  states**: still reading, read failed, confirmed empty ([ADR 0018](../adrs/0018-progress-reads-recover.md)).
  Every critical-path read goes through `withReadRetry(op, { surface })` — attempts at 0/2/5 s,
  `StoreStallError` at 10 s, the stall written to `da:stall-log:<profileId>` with counters only.
  A read that *rejects* is not retried; only silence is. A surface making a claim about progress
  renders `ProgressLoadError` with a retry; a badge or counter renders an explicit unknown, never
  a confident `0`. Two supporting rules: **nothing may sit between `getStore()` and its handle** —
  the A1 card-id migration used to be awaited there and hung the page from behind a 784 KB read;
  it now has one owner (`PersistenceAlert`, once per launch) and runs behind
  `da:cardid-migrated:<profileId>`, set only on success —
  and **a repair that rewrites a whole blob commits in one `update()`**, never a `get` then a
  `set`, or it drops the grade written in between.
- **No snapshot writer ever shrinks an existing snapshot file.** All three hold it the same way —
  `progress:pull` refuses and parks, the dev middleware answers 409 `would-shrink`, and the
  desktop writer (`writeSnapshotToSyncDir`) parks a sibling `<date>.conflict-<stamp>.json`. Fewer
  attempts than the existing file means a staler state (a second container, a stalled read), and
  an unparseable existing file is parked around, never overwritten.
- **The session probe caches only definitive answers.** A parseable 2xx and a 401/404 are facts
  about the account and may be memoized; everything else (5xx, gateway pages, non-JSON 2xx) is a
  fact about the moment, is never cached, and surfaces from `syncNow` as `error /
  session-probe` — never as `off / signed-out` (`classifySessionResponse`, the #143 class).
- No input is sized, capped or captioned from the answer it is waiting for. A cloze gap was
  drawn at `answers[0].length + 2`, so `Es gibt hier ___ Supermarkt.` fitted only *einen* of
  *einen / eine / ein* and the item scored a width judgement as accusative mastery. Every gap
  now rests at one width and grows with what the learner typed. The same applies to
  `maxLength`, `placeholder`, `size` and any cell width derived from an answer string —
  `FormFill` and `TableFill` are CSS-sized and must stay so. Nothing catches this class: the
  validator sees a well-formed item, the grader sees a correct answer, and the learner is the
  only observer positioned to notice.

## Change procedure

1. Identify the source-of-truth row above and read its tests before editing.
2. Change the implementation, migration and tests in the same commit.
3. Preserve old snapshots and persisted ids unless the change explicitly migrates them.
4. Run `bun run validate`, `bun test`, `bun run check`, `bun run lint` and `bun run build`.
