# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **in progress** (updated 2026-07-12).

A1 is complete and shipped (v0.2.0). The current milestone is to bring A2 to the same bar, and to
add the retention machinery — cumulative checkpoints and delayed probes — that a two-level course
needs. Executable work lives in [backlog.md](backlog.md); implementation history lives in
[archive/2026-07-learning-foundations.md](archive/2026-07-learning-foundations.md). The detailed
A2 authoring sequence and provisional B1 north star live in
[curriculum-a2-b1.md](curriculum-a2-b1.md).

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

## Current milestone — Phase 3: complete A2 and retention

Outcome: the same complete course loop reaches an A2 checkpoint and measures retention beyond
immediate practice.

- Author the revised A2 spine and strengthen the six existing A2 topics.
- Implement `deepens` in training so relevant earlier focus areas resurface.
- Add cumulative unit checkpoints and delayed probes with parallel variants.
- Reserve a stable share of mixed sessions for broad cumulative retrieval.
- Finish with a cumulative A2 checkpoint.

Vocabulary grows with complete units — topic, practice, reading, productive use and reviewed IPA —
never as disconnected padding. Do not quote headword counts here; they go stale. The live figures
are on the Über page, and `bun scripts/coverage-a1.ts` reports A1 against the Goethe Wortliste.

**Exit criteria:** the A1–A2 path is complete; checkpoints and delayed probes run; weakness
targeting cannot monopolize a session; verified and practice evidence remain distinct.

## Deferred — Phase 4

Reconsider only after real A1 usage data exists: committed neural-TTS assets, extensive readers,
local speaking capture, and scenario grouping. None may block A1 or A2 completion.

## North star — B1 after the A2 checkpoint

B1 is deliberately provisional. Its missions and progression are outlined in the curriculum
blueprint so A2 does not create a dead end, but B1 topics are not added to the live Atlas or backlog
until representative A2 usage and the cumulative checkpoint expose the real transition needs.
Promoting B1 requires a separate roadmap decision; it is not part of the current completion claim.

## Definition of roadmap completion

A learner can start at Erste Schritte and reach the A2 checkpoint through a visible ordered
path. Sessions combine due review, eligible mixed practice and a clear next step. Outcome progress
is backed by honest evidence, and snapshot-driven weakness drills continue to work throughout.
