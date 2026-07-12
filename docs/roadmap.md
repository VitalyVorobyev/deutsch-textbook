# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **in progress** (updated 2026-07-11).

Deutsch-Atlas has the learning-system foundation and the first reference A1 unit. The current
milestone is to complete A1 with the same content quality, then extend the proven model through
A2. Executable work lives in [backlog.md](backlog.md); completed implementation history lives in
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

## Completed foundation

Phases 0, 1 and 1.5 are complete in the code on PR
[#10](https://github.com/VitalyVorobyev/deutsch-textbook/pull/10): eligibility and scoring
corrections, unified mastery, curriculum/outcome contracts, the Lernpfad redesign, Üben
navigation, and domain regression tests. Phase 2's reusable machinery is also complete:
the lesson-cycle convention, `write`, `audio-comprehension`, evidence classification, and the
`Erste Schritte` reference unit.

## Current milestone — Phase 2: complete A1

Outcome: a learner can follow a coherent path from Erste Schritte to a cumulative A1 checkpoint.

The current authored vocabulary baseline is **83 unique A1 headwords** and **141 unique A2
headwords**. These are coverage counts for today's incomplete course, not CEFR target sizes.
Vocabulary grows with complete units (topic, practice, reading, productive use and reviewed IPA),
never as disconnected padding.

1. Author the remaining units in spine order: Alltag & Zeit, Wohnen, Stadt & Wege, and
   Freizeit & Können. Menschen & Familie is complete.
2. Strengthen Präsens & Wortstellung, Artikel & Genus, Akkusativ, and Essen & Einkaufen with
   faded support, productive transfer and authentic task genres.
3. Add the cumulative A1 checkpoint, connected to stable outcome IDs and excluded from ordinary
   mixed training.

Each unit must implement pretest → model → explanation → scaffold → fade → transfer → delayed
check, cover its declared outcome modes, and ship only when its topic, exercises, reading,
vocabulary and validation are complete.

**Exit criteria:** every A1 unit is usable from the Lernpfad; the checkpoint covers the A1
outcomes; old snapshots still import; all repository gates pass.

## Next milestone — Phase 3: complete A2 and retention

Outcome: the same complete course loop reaches an A2 checkpoint and measures retention beyond
immediate practice.

- Author the revised A2 spine and strengthen the six existing A2 topics.
- Implement `deepens` in training so relevant earlier focus areas resurface.
- Add cumulative unit checkpoints and delayed probes with parallel variants.
- Reserve a stable share of mixed sessions for broad cumulative retrieval.
- Finish with a cumulative A2 checkpoint.

**Exit criteria:** the A1–A2 path is complete; checkpoints and delayed probes run; weakness
targeting cannot monopolize a session; verified and practice evidence remain distinct.

## Deferred — Phase 4

Reconsider only after real A1 usage data exists: committed neural-TTS assets, extensive readers,
local speaking capture, and scenario grouping. None may block A1 or A2 completion.

## Definition of roadmap completion

A learner can start at Erste Schritte and reach the A2 checkpoint through a visible ordered
path. Sessions combine due review, eligible mixed practice and a clear next step. Outcome progress
is backed by honest evidence, and snapshot-driven weakness drills continue to work throughout.
