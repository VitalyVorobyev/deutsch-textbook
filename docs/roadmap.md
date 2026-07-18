# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **A1 and A2 are structurally complete on both coverage measures** (updated 2026-07-18) —
Wortliste 100% at each level *and* every grammar point of each level's standard taught, 22/22 at
A1 and 30/30 at A2, verified by `bun scripts/grammar-coverage.ts`. These figures mean the manifest
is taught; they do **not** assert learner mastery or replace linguistic QA. A2's 30-point
[linguistic QA ledger](a2-linguistic-qa.md) is undergoing a systematic corpus pass; the targeted
2026-07-18 findings are closed, but unaffected rows are not signed off by inference. The second
half of the structural claim is new: A2 was
called content-complete for months on its lexical figure alone, and when structure was finally
measured it was **67%**, with six A2 structures unwritten and several of them scheduled inside B1
units. Phase 10 closed all ten gaps. Both figures are computed from the content and published on
Über; neither is hand-written anywhere. Also included: the Ukrainian explanation half across every
ru-bearing A1/A2 file. The system is in the **pre-B1 evidence window**: almost
every remaining gate is calendar- or learner-evidence-bound rather than authoring work. Phase
history lives in [archive/2026-07-phases-4-9.md](archive/2026-07-phases-4-9.md) and
[archive/2026-07-learning-foundations.md](archive/2026-07-learning-foundations.md); *what* A2/B1
teach is decided in [the curriculum blueprint](curriculum-a2-b1.md); executable work is in
[backlog.md](backlog.md).

## Product direction

- **One clear next action.** The curriculum spine recommends the next unfinished lesson, while
  retained mastery remains a separate delayed-evidence signal; completing a lesson never demands
  an immediate second-day repetition.
- **A layered Atlas.** Nested conceptual groups orient, prerequisite edges form the blocking DAG,
  and `deepens`/`related` express spiral and non-blocking relationships. The spine is teaching
  order, not an implicit dependency chain.
- **A soft path.** Curriculum order drives recommendations and automatic content selection, but
  learners may open any topic or deck deliberately.
- **Honest evidence.** Automatically scored retrieval/comprehension is `verified`; open writing,
  speaking and other unverified production is `practice`. Practice is visible but never inflates
  accuracy or mastery.
- **Explicit content roles.** `pretest`, `practice`, `drill`, `checkpoint` and `probe` determine
  where a set may appear. Checkpoints, probes and pretests never leak into mixed training.
- **Spiral learning.** A later topic may `deepen` earlier ones, reactivating their knowledge
  without duplicating lessons. Cumulative checkpoints and delayed probes provide broader review.
- **Local-first and non-gamified.** Profiles, attempts and FSRS state stay on the learner's device
  and stay portable through backward-compatible snapshots.

## Where things stand now

**Done** (detail in the archive): the learning system and Atlas (Phases 0–1.5); complete A1
(Phase 2) and complete A2 — seventeen units, cumulative checkpoints, delayed probe families, and
both Goethe A1/A2 Wortlisten at 100%, *measured* rather than asserted (Phase 4). The hardened
learning loop — honest free-production scoring, parallel delayed probes, revising open writing,
local speaking, an enforced item mix, the extensive reader, a reserved broad-retrieval share
(Phase 3). The pre-1.0 evidence foundation (Phase 5). The honest-signal instrument pass — a
committed home for grading rulings, probe-debt pacing, targeted drills (Phase 6). The
Schreib-Assistent (Phase 7). The learner-language machinery and the complete Ukrainian A1+A2
translation (Phase 8 + C3).

**Open:**

- **P3-6 — read the A1 retention cohort.** A calendar gate, not a task: probes armed 2026-07-12, so
  the 21-day cohort completes **2026-08-02**. See *the retention gate* below.
- **P5-11 — two-unit A2 evidence cycles** (recurring). The just-in-time audit + post-pair snapshot
  review that carries the learner's signal into the backlog; it feeds everything else.
- **P5-7 — delayed evidence for listening.** Scheduled *after* the cohort read, when the real probe
  load is known and can be paced.
- **Phase 9 — Entdecken & Referenz** (parallel, never gates B1): recurring editorial pieces
  (P9-2), derived/canonical reference pages (P9-3), and multilingual Wortnetze (P9-4).

## The retention gate

Phase 3's second exit criterion is the only one that can fail: **due parallel probes clear ≥ 80%
per probed competence, with free-production items ≥ 70%.** It is a **revision trigger**, not a
blocker on authoring:

> On 2026-08-02 the probe cohort is read and [the audit](a1-learning-audit.md) updated. If A1 misses
> the bar, authoring stops: the units written by then are revised against the finding, and the
> lesson pattern is fixed before another unit is written.

A2 authoring proceeded before the read on purpose — repairing, arming and measuring the existing
material is work the probe report can only make *more* necessary, never less, so holding it for
three weeks would have bought nothing. The risk this accepts is explicit and recorded: if the
pattern proves defective, the meantime units need rework, and that rework is the price of not
idling. (The bar once read "per A1 outcome" and could not have been met — the probe families tested
three *different* skills per topic, so no retention curve could exist; fixed before the cohort
produced a single answer, so each family now runs parallel checks of *one* competence.)

## Parallel tracks (none gate B1)

- **Phase 7 — Schreib-Assistent** — *done.* Local, advisory-only Ollama feedback on `write` drafts:
  it quotes the learner's words and nudges, never rewrites, and **never becomes evidence**;
  self-hides when no local model answers. Design: [assist-design.md](assist-design.md).
- **Phase 8 — Sprachen** — *machinery done; Ukrainian A1+A2 content done (C3).* Ukrainian joins
  EN/RU as an explanation language at the same bar, English fallback where `uk` is missing;
  German-medium `<De>` explanations are authored for B1 onward, never backfilled. The per-profile
  UI language is the foundation, not the objective; chrome stays pinned German by default. B1 `uk`
  waves follow B1 content. Design: [i18n-design.md](i18n-design.md).
- **Phase 9 — Entdecken & Referenz** — *open.* The discovery layer grows from one piece toward a
  small editorial strand (committed CC/PD assets with attribution + licence, online-only links),
  and the reference layer gains lookup pages **derived from canonical data** rather than
  hand-maintained. P9-4's first four multilingual Wortnetze are shipped in parallel and carry no
  progress semantics. Direction: [future-content-directions.md](future-content-directions.md).

## Definition of roadmap completion

A learner can start at Erste Schritte and reach the A2 checkpoint through a visible ordered path.
Sessions combine due review, eligible mixed practice and a clear next step. The learner reads and
listens at useful volume, produces and revises language, rehearses spoken exchanges, and proves
retention later in parallel contexts. Outcome progress is backed by mode-valid honest evidence, and
snapshot-driven weakness drills keep working throughout.

## The B1 gate

B1 authoring begins when all eight hold, and not before:

1. **The A1 retention cohort has been read** (P3-6, on or after 2026-08-02) — and, if the
   ≥80%/≥70% bar was missed, the revision it triggers has shipped. — *pending (calendar).*
2. **The A2 checkpoint is completed** and window 6 of
   [the operating program](a2-learning-led-program.md) — checkpoint + delayed-evidence review — is
   done. — *pending (learner evidence).*
3. **The A2 probe evidence has been reviewed** under the operating program's rules. — *pending.*
4. **The grading queue holds no undecided rendering**, and the post-triage audit has been re-read. —
   *recurring (P5-11).*
5. **No persistent weak focus is without an owned drill in rotation.** — *recurring (P5-11).*
6. **`data/goethe-b1-wortliste.txt` is acquired and `bun scripts/coverage.ts B1` reports against
   it.** — **met 2026-07-15:** 3,416 headwords transcribed; the Über page states the honest head
   start (~41% already covered by A1/A2 material).
7. **Every A2 manifest point has linguistic sign-off, all high/medium findings are fixed, and
   structural coverage language remains explicitly separate from mastery.** — *in progress:*
   [the 30-point ledger](a2-linguistic-qa.md) distinguishes closed targeted findings from rows
   still awaiting full corpus verification.
8. **The first B1 PR freezes the B1 identities in [the blueprint](curriculum-a2-b1.md)** — ids
   become persisted learner-progress keys the moment a unit ships. — *authoring work, gated on
   1–7.*

Two things are explicitly **not** gates: the Ukrainian translation waves and the Schreib-Assistent.
Wortnetze are also explicitly a parallel track, not a gate. One soft preference is **met** — the
content-language machinery landed before B1 unit 1, so B1
content carries `uk` and its `<De>` half from day one instead of being backfilled.
