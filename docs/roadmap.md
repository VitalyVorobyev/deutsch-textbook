# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **in progress** (updated 2026-07-12).

A1 is content-complete and shipped (v0.2.0). The post-release
[learning-system audit](a1-learning-audit.md) found that the lesson foundation is strong but the
course loop still lacks delayed probes, production revision, spoken self-practice and sustained
input. Re-examining it against a much larger snapshot (671 attempts, three consecutive days) then
surfaced a deeper problem the thin early data had hidden: **the system was not measuring what it
claimed to.** Free production was scored so that a typo counted as a grammar failure, and every
sentence error was blamed on whichever confusion the item drilled — so the weakness signal that
drives training and drill authoring was substantially wrong. The current milestone fixes that
instrument, then hardens the loop, before either is scaled across A2. Executable work lives in
[backlog.md](backlog.md); implementation history lives in
[archive/2026-07-learning-foundations.md](archive/2026-07-learning-foundations.md).

## Product direction

- **One clear next action.** The curriculum spine recommends the next unfinished lesson, while
  retained mastery remains a separate delayed-evidence signal; completing a lesson never demands
  an immediate second-day repetition.
- **A layered Atlas.** Nested conceptual groups provide orientation, prerequisite edges form the
  blocking knowledge DAG, and `deepens`/`related` express spiral and non-blocking relationships.
  The spine is teaching order, not an implicit dependency chain.
- **A soft path.** Curriculum order drives recommendations and automatic content selection, but
  learners may open any topic or deck deliberately.
- **Honest evidence.** Automatically scored retrieval/comprehension is `verified`; open writing,
  speaking and other unverified production is `practice`. Practice is visible but never inflates
  accuracy or mastery.
- **Explicit content roles.** `pretest`, `practice`, `drill`, `checkpoint` and `probe` determine
  where a set may appear. Checkpoints, probes and pretests never leak into mixed training.
- **Spiral learning.** A later topic may `deepen` earlier topics, reactivating their knowledge
  without duplicating lessons. Cumulative checkpoints and delayed probes provide broader review.
- **Local-first and non-gamified.** Profiles, attempts and FSRS state remain on the learner's
  device and portable through backward-compatible snapshots.

## Completed

Phases 0–1.5 built the learning system: eligibility and scoring corrections, unified mastery,
curriculum/outcome contracts, the Lernpfad and Atlas, Üben navigation, and the domain regression
suite. Phase 2 completed A1 — ten units, the cumulative checkpoint, and full Goethe-A1 Wortliste
coverage. Details and stable IDs are in the archive.

## Current milestone — Phase 3: harden the A1 learning loop

Outcome: A1 demonstrates a complete input → retrieval → interaction/production → revision → delayed
transfer loop, **measured by an instrument that works**, and that loop becomes the required
authoring contract for A2.

- **Fix free-production scoring and error attribution first.** The 671-attempt snapshot showed the
  `translate` scorer was recording spelling slips as grammar failures and blaming every sentence
  error on whichever confusion the item happened to drill. Weakness detection, training priority and
  drill authoring all read that signal, and the most-practiced set in the corpus turned out to be a
  drill for a confusion the learner does not have. Everything below consumes this signal, so it is
  the gate.
- Add local, snapshot-safe delayed probes with parallel variants — and start their clock early, as
  a 21-day probe cannot report before 21 days.
- Reserve a stable share of mixed sessions for broad cumulative retrieval.
- Upgrade open writing to checklist-led revision and add local record/replay speaking practice.
- Rebalance the item mix before A2 inherits it: `mc`+`match`+`order` are ~58% of all attempts at
  93–100% accuracy, buying almost no information.
- Pilot one late-A1 extensive reader.
- Record actual response mode separately from the curriculum outcome's target mode.

Mission grouping and reviewed multi-voice audio were **deferred out of this milestone** — neither is
supported by the usage data, and both cost more than they would measurably teach. See P5-4 and P5-1.

**Status (2026-07-12): every engineering item is done.** The scorer is fixed, probes are running,
the item mix is enforced, the extensive reader has shipped, and mixed sessions reserve a quarter of
themselves for broad retrieval. What Phase 3 now waits on is *elapsed time*, not work.

**Exit criteria:**

1. The weak-focus signal is trustworthy — ✅ replaying the newest snapshot moves it, and the change
   survived review (`trennbar-modal` was a phantom; `kein-nicht` and `dativ-artikel` are real).
2. Due parallel probes run after a real interval and clear a stated numeric bar: **≥ 80% per A1
   outcome, with free-production items ≥ 70%.** ⏳ The 21-day cohort completes **2026-08-02**. This
   is the one criterion that can fail, and it is the gate on A2.
3. Progress shows actual mode coverage without treating unverified production as mastery — ✅.
4. The full repository gate passes — ✅.

A2 authoring does not begin before (2) reports. If A1 does not clear the bar, the lesson pattern
about to be scaled tenfold is the thing to fix, and authoring faster would only multiply the defect.

## Next milestone — Phase 4: complete A2 and retention

Outcome: the hardened course loop reaches an A2 checkpoint and measures retention beyond immediate
practice.

- Author the revised A2 spine and strengthen the six existing A2 topics.
- Implement `deepens` in training so relevant earlier focus areas resurface.
- Author ten A2 units to the quality gate in the audit.
- Add cumulative unit checkpoints and delayed probes with parallel variants.
- Finish with a cumulative A2 checkpoint.

Vocabulary grows with complete units — topic, practice, reading, productive use and reviewed IPA —
never as disconnected padding. Do not quote headword counts here; they go stale. The live figures
are on the Über page, and `bun scripts/coverage-a1.ts` reports A1 against the Goethe Wortliste.

**Exit criteria:** the A1–A2 path is complete; checkpoints and delayed probes run; weakness
targeting cannot monopolize a session; verified and practice evidence remain distinct.

## Deferred — Phase 5

Reconsider only after real A1 usage data exists: broader neural-audio replacement, longer reader
series beyond the pilot, optional constrained AI feedback and pronunciation analysis. None may
silently create verified evidence.

## Definition of roadmap completion

A learner can start at Erste Schritte and reach the A2 checkpoint through a visible ordered path.
Sessions combine due review, eligible mixed practice and a clear next step. The learner reads and
listens at useful volume, produces and revises language, rehearses spoken exchanges, and proves
retention later in parallel contexts. Outcome progress is backed by mode-valid honest evidence, and
snapshot-driven weakness drills continue to work throughout.
