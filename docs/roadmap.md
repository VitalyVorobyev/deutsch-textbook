# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **A1 and A2 are structurally complete on both coverage measures** (updated 2026-07-18) —
Wortliste 100% at each level *and* every grammar point of each level's standard taught, 22/22 at
A1 and 30/30 at A2, verified by `bun scripts/grammar-coverage.ts`. These figures mean the manifest
is taught; they do **not** assert learner mastery or replace linguistic QA. A2's 30-point
[linguistic QA ledger](a2-linguistic-qa.md) completed its systematic corpus pass on 2026-07-18:
all points are signed off and all high/medium findings are closed. The second
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
  (P9-2) are the only half still open. The reference layer is **complete** — P9-3's third and
  last page, `/referenz/briefe`, shipped 2026-07-21 — and P9-4's Wortnetze are done.

## The retention gate

Phase 3's second exit criterion is the only one that can fail:

> **The A1 delayed probes retain their target competence in ≥ 80% of readable competences, with the
> free-production channel at ≥ 70%.**
>
> A probe counts as **retained** when the item's graded target survived — correct under today's
> contract, or wrong with the divergence outside the tokens the item's `focus` grades. It counts as
> **failed** only when the target itself diverged. Whole-sentence flawlessness is not the measure: a
> probe of `akkusativ-artikel` whose article is right and whose noun is misspelled is evidence that
> the accusative was retained.
>
> Competences group by **focus tag**, pooled across the families carrying it, read **per level**. A
> competence is **readable** only once it holds at least as many attempts as there are scheduled
> intervals (3); below that it is reported as pending, excluded from the percentage, and never
> counted as a pass — 2/2 is two data points, not 100% retention. A family whose items carry no
> `focus` cannot fail its target by construction, so it is likewise excluded and named as an
> instrument gap.

`bun run progress:audit` computes this directly — see *Retention by competence*.

**Why the restatement.** The bar previously read "due parallel probes clear ≥ 80%", where *clear*
meant `correct`: the whole typed sentence flawless. A probe item asks for eight or so independent
correctness decisions at once, so that number measures sentence-building, not retention of the one
competence the interval is testing. Read that way the A1 cohort sits at **18%**; read against target
retention it sits at **59%**. Those are different findings and the gate must not conflate them.
The restatement does **not** rescue the gate — 59% still misses 80%, and the expected 2026-08-02
outcome is a **fail → revision trigger**. Tuning the bar until it passes would manufacture exactly
the *number that looks like retention without being it* this document warns about elsewhere.

**Two limits of the instrument, recorded rather than hidden.** A family serves one variant per
interval, so a competence carried by a single family can never exceed three attempts — the gate is
thin by construction, and at the cohort's current depth only `akkusativ-artikel` (carried by three
families) is readable at all. And `a1/probe-erste-schritte` carries no `focus` on any variant, so it
can never fail its target and reads as 100% retained; it is excluded by name. Both are arguments for
widening the probe channel (P5-7 and the second-family work), not for lowering the bar.

It is a **revision trigger**, not a blocker on authoring:

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
- **Phase 9 — Entdecken & Referenz** — *reference layer done; editorial strand open.* All three
  derived/canonical lookup pages have shipped, the last being `/referenz/briefe` (2026-07-21). The
  discovery layer is at seven pieces spanning A1–B1 and is now reachable **from the lesson** — a
  piece may name its `topics`, and the topic page renders it as an aside that creates no
  obligation. P9-4's Wortnetze carry no progress semantics either.

  **What the `<De>` pilot cost, and the command that says so** —
  `bun scripts/lang-cost.ts content/discovery/b1/sonntagsruhe.mdx`, which counts words per
  explanation half (the method is stated at the top of the script). The four-half B1 piece is
  **1.98x** on the localised surface and **1.55x** overall once the invariant German article is
  folded back in. Run against the six three-half pieces
  (`bun scripts/lang-cost.ts content/discovery/a[12]/*.mdx`) the same measure gives **1.47x**
  localised — so `uk` costs about +47%, and adding `de` costs roughly that much again on top.
  That pair, not either number alone, is what the "B1 carries `de` from day one" preference
  should be decided against. Direction:
  [future-content-directions.md](future-content-directions.md).

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
   structural coverage language remains explicitly separate from mastery.** — **met
   2026-07-18:** [the 30-point ledger](a2-linguistic-qa.md) records the completed corpus pass.
8. **The first B1 PR freezes the B1 identities in [the blueprint](curriculum-a2-b1.md)** — ids
   become persisted learner-progress keys the moment a unit ships. — *authoring work, gated on
   1–7.*

Two things are explicitly **not** gates: the Ukrainian translation waves and the Schreib-Assistent.
Wortnetze are also explicitly a parallel track, not a gate. One soft preference is **met** — the
content-language machinery landed before B1 unit 1, so B1
content carries `uk` and its `<De>` half from day one instead of being backfilled.
