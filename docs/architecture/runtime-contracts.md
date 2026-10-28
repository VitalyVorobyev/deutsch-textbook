# Runtime contracts

Status: active engineering checklist. [overview.md](../overview.md) is the system map; `CLAUDE.md` owns
authoring rules.

| Contract | Source of truth | Required companion checks |
| --- | --- | --- |
| Content shapes | `packages/schema/src/index.ts`, `src/content.config.ts` | validator and schema tests |
| Curriculum order and graph | `content/atlas.yaml`, `packages/content/src/curriculum.ts` | contracts/deepens tests |
| Review queue and daily new-card budget | `src/lib/decks.ts` | review-plan tests |
| In-session retry after "Again" or a missed LiD question | `src/lib/requeue.ts` | requeue tests, `tests/lid-question.test.tsx` |
| Training eligibility and interleaving | `src/lib/training.ts` | eligibility/broad-retrieval tests |
| Mastery and navigation evidence | `src/lib/mastery.ts`, `src/lib/placement.ts` | mastery/placement tests |
| Delayed probes | `src/lib/probes.ts` | probe tests and progress audit |
| Scoring and focus attribution | `src/lib/scoring.ts`, `packages/grading/src/production.ts`, `packages/grading/src/evidence.ts` (`focus_evidence` predicates: where an item declares them they decide attribution — on `translate`, `listen` and the `cloze`/`order`/`table` islands alike (`islandAttribution`, `src/lib/evidence.ts`) — and a `failed` match beats `dictationSlip`) | grading/contract, evidence, focus-attribution and focus-evidence tests |
| Profiles and learner storage | `src/lib/profile.ts`, `src/lib/store.ts` | snapshot/store tests |
| Snapshot compatibility | `src/lib/snapshot-schema.ts`, `src/lib/snapshot-merge.ts` | all-version migration tests |
| Language selection | `src/lib/prefs.ts`, `packages/schema/src/langcheck.ts` | i18n tests and validator |
| Shown headword vs keyed headword (reflexive `sich`) | `packages/schema/src/headword.ts` (`shownHeadword`; the validator reads its `reflexivityDeclared`), `src/lib/typing.ts` (`shownAnswer` displays, `checkCardAnswer` grades the raw key) | reflexive-headword tests, validator |
| Explanation prose shape | `packages/content/src/prose-shape.ts` (authoring-time only; never imported by runtime) | prose-shape tests, validator, `bun scripts/prose-shape.ts` |
| Positional references to shuffled options | `src/lib/option-references.ts` (authoring-time only; never imported by runtime) | option-reference tests, validator |
| Answer-shaped rendering of an input | `src/components/exercises/Cloze.tsx` (`gapWidthCh`) | cloze gap-width tests |
| Same-day lesson resume | `src/lib/resume.ts` | resume tests |
| Durable write path (journal, replay, retry deadline, late-settle confirmation) | `src/lib/write-journal.ts`, `src/lib/store.ts` ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)) | write-journal, store-persistence-retry and journal-storage-blocked tests |
| Managed transaction recovery | `src/lib/managed-store.ts` ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)) | managed-store and progress-transition tests |
| Single-flight coalescing write queue | `src/lib/store.ts` (`enqueueUpdate`) ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)) | store-write-queue and persistence-alert-tiers tests |
| Recovering read path (timed retries, deadline, stall log) | `src/lib/store.ts` (`withReadRetry`), `src/lib/stall-log.ts` ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)) | store-read-retry, stall-log and curriculum-path-loading tests |
| Tauri filesystem integration | `src/lib/syncdir.ts` | browser path plus Tauri guard, syncdir-shrink tests |
| Desktop exit flush | `src-tauri/src/main.rs`, `src/lib/autosync.ts` (`initExitFlush`/`flushForExit`) | `cargo check`; manual Cmd+Q smoke (needs a webview) |
| Session-probe caching | `src/lib/sync-remote.ts` (`classifySessionResponse`) | sync-remote session-probe tests |
| Session content files and their cache | `src/lib/corpus-payload.ts`, `src/components/session/CorpusIslands.tsx`, `src/integrations/service-worker.js` ([ADR 0008](../adrs/0008-delivery-static-site-desktop-shell-worker.md)) | corpus-gate and service-worker tests; `bun scripts/page-weight.ts` after a build |

## Non-negotiable invariants

- Persisted identities are contracts. Renaming topics, items, outcomes, decks or card headwords
  requires an explicit migration.
- Historical attempts keep their logged result and revision; current answer keys never replay them.
- Unverified writing and speaking remain practice evidence and never raise measured mastery.
- Placement may advance the recommended path but never raises a topic’s measured tier.
- Probe state is derived from the attempt log and served before contaminating practice.
- Fresh-card introductions are budgeted per day, not per rendered queue.
- Queue planning reads a card's identity only (`CardRef`: id, deck, headword, direction), so
  `planReview` is generic over it. A surface that only counts (DueBadge) plans from ids rebuilt
  from headwords (`decksOf`/`deckCardRefs`) instead of inlining the built cards. It is still the
  same plan: `tests/review-plan.test.ts` holds the two queues equal under one seed.
- A card missed in a session shows its answer at once but is retried only after other cards —
  8 for a word not retrieved at all, 50 for a lapse or a near miss, halved per further miss, never
  fewer than 3 (`recordMiss`). The gap orders today's queue only; FSRS alone schedules the card.
  A missed Leben-in-Deutschland question follows the same rule (`LidPractice`).
- The session pages receive the corpus as URLs of content-hashed files, never as props
  (`corpusUrl`), and an island never mounts on a missing file: `CorpusGate` shows loading or an
  error with a retry until every file has arrived, because an empty list would plan "nothing due".
  No HTML page may exceed 1.5 MB (`scripts/page-weight.ts`, run in CI).
- No database is created before a learner profile exists; the final profile cannot be deleted.
- References, documents, discovery pieces and learning figures create no progress or review debt.
- Persisted UI choices receive migrations when their value domain changes.
- Build-time claims on `/about` are computed from content, never typed by hand.
- A progress write is journaled synchronously before it is attempted, retried on a timer, and
  loud in the UI once it is late — silence is never an outcome ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)).
  Every write behind `withPersistenceRetry` or the journal must be idempotent (`attemptKey`
  dedupe, `applyGradeAt` ts-guard); a non-idempotent write may not use them.
- A write that settles **after** its deadline still confirms itself: `withPersistenceRetry` calls
  `onLateSettle`, the journal helpers pass `confirmOp`, and the entry comes off. idb-keyval
  resolves on `transaction.oncomplete`, so a resolve is a commit — an entry that outlives its own
  landed write is the alert claiming the learner's data is unsaved when it is on disk. A late
  *rejection* is not a settle ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)).
- Store writes go through `enqueueUpdate`; the managed adapter owns the live connection and
  transaction. Its 10-second watchdog aborts stalled transactions and retries only after an
  observed terminal event. An unconfirmed abort blocks further operations until restart.
  A page that enters the back/forward cache (`pagehide` with `persisted`) aborts its live
  transactions and refuses new ones; one restored from the cache reloads if it had any.
  WebKit commits an IndexedDB transaction only when the page says so, so a transaction frozen
  in a cached page keeps its lock on `progress` until the page is evicted (30 min). Every
  transaction on the next page queues behind it, and the watchdog's abort of a queued
  transaction is never acknowledged. On the desktop app that turned one quick click during the
  launch replay into the restart banner. A two-page probe in the system `WKWebView` reproduces
  it: the second page's write stalls past 20 s without the abort and lands at once with it.
  The 45-second journal caller deadline never releases the active drain or enqueues duplicates.
  Daily completion, grades and attempts share an ordered, profile-scoped journal drain.
  See [ADR 0006](../adrs/0006-local-first-durable-learner-state.md).
- Storage failures remain journaled. Deterministic invalid operations may be quarantined only
  after their evidence is saved; a full/unwritable quarantine leaves the original pending.
  Journal overflow warns without discarding entries. Refused journal updates retain an in-memory
  copy and show the storage-blocked warning, never a promise of durability after restart.
- A stalled or implausibly empty progress read renders an explicit error state — never a
  fresh-profile view, and never feeds `planReview`. "Implausibly empty" means empty against the
  profile's one-way `da:seen-data` marker.
- **Reads get the same timed retries writes do, and every load surface distinguishes three
  states**: still reading, read failed, confirmed empty ([ADR 0006](../adrs/0006-local-first-durable-learner-state.md)).
  Every critical-path read goes through `withReadRetry(op, { surface })` — attempts at 0/2/5 s,
  `StoreStallError` at 10 s, the stall written to `da:stall-log:<profileId>` with counters only.
  A read that *rejects* is not retried; only silence is. A surface making a claim about progress
  renders `ProgressLoadError` with a retry; a badge or counter renders an explicit unknown, never
  a confident `0`. Two supporting rules: **nothing may sit between `getStore()` and its handle** —
  a migration awaited there hangs every page behind a full-blob read, so the card-id migration has
  one owner (`PersistenceAlert`, once per launch) and runs behind `da:cardid-migrated:<profileId>`,
  set only on success —
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
