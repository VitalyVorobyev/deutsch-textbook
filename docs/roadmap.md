# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **in progress** (updated 2026-07-14). Phase 4 shipped as 0.3.0 and Phase 5 is closed as a
milestone; Phase 6 — finishing A2 on honest signal — is the current milestone, with Phases 7–9
running as parallel tracks that never gate B1.

A1 is content-complete and shipped (v0.2.0), and its learning loop has been hardened: free
production is scored honestly, delayed parallel probes are running, open writing revises, speaking
is practised locally, and the item mix is enforced rather than merely asked for. The
[learning-system audit](a1-learning-audit.md) records why each of those was necessary — chiefly that
the system had not been measuring what it claimed to.

The current milestone completes A2 to that same bar. The unit order, the identities and the
per-unit language are decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md); executable
work lives in [backlog.md](backlog.md); implementation history lives in
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

Phase 3 hardened that loop. Every engineering item shipped on 2026-07-12: the scorer, the probes,
the enforced item mix, the extensive reader, the reserved broad-retrieval share, and mode-valid
evidence. One criterion remains open, and it runs on wall-clock rather than on work — see the gate
below.

## Completed milestone — Phase 4: complete A2

Outcome: A2 reaches the same bar as A1 — seventeen topics, a cumulative checkpoint, delayed probes,
measured Wortliste coverage — and the whole A1–A2 path is walkable end to end.

- **Fix the A2 foundation first.** The six shipped A2 topics predate the hardened loop and are below
  its bar: no `write`, no `speak`, no `audio-comprehension`, no probe families, no extensive reader,
  and four declared outcomes that nothing measures. Ten new units built on that foundation would
  inherit its gaps.
- Build the A2 instrument: probe families for the existing topics, a Goethe-A2 Wortliste coverage
  manifest, and a checkpoint route that is not hard-wired to A1. (`deepens` semantics in training was
  on this list and was **deliberately not built** — P4-2 concluded that the focus tag already *is* the
  edge's runtime channel, and that scoping a tag to a topic would narrow a signal that is meant to be
  global. The validator instead enforces that every `deepens` edge shares a tag, so an inert edge
  cannot be authored.)
- Author the ten A2 units in spine order, one complete bundle each.
- Close the level with the cumulative A2 checkpoint, the Wortliste completion pass, and an Über page
  whose A2 figures are computed rather than claimed.

**The original milestone shipped** in PRs #23–#38 as 0.3.0. Learner evidence then justified a
seventeenth required unit, `verben-mit-praepositionen`, and expanded the checkpoint to twenty-two
items. A2 now has seventeen probe families and **1449/1449 of the Goethe-A2 Wortliste**. The one thing the
phase turned up that was not on the list: the coverage *instrument* could not be trusted with the
claim it was about to make. A `~` in a manifest — a word the course teaches as grammar rather than as
a flashcard — counted toward the published figure on the manifest's own say-so, and **nine of those
marks were false**, one of them at A1. `bun run validate` now hard-fails a `~` that no article,
reading or practice item actually contains, so the number on the Über page is a measurement rather
than a promise. A1's 100% was not fully earned before this; it is now.

Vocabulary grows with complete units, never as disconnected padding, and an A2 unit owns a thin new
A2 deck rather than adopting an A1 one — the blueprint explains why that distinction is load-bearing.
Do not quote headword counts here; they go stale. The live figures are on the Über page.

**Exit criteria:** the A1–A2 path is complete; the A2 checkpoint and A2 probes run; every declared
outcome is measured by something; weakness targeting cannot monopolize a session; verified and
practice evidence remain distinct.

### The A1 retention gate, and why A2 authoring proceeds anyway

Phase 3's second exit criterion is the only one that can fail: **due parallel probes clear ≥ 80% per
probed competence, with free-production items ≥ 70%.** The probes armed on 2026-07-12, so the 21-day
cohort cannot report before **2026-08-02**.

*(The bar used to say "per A1 outcome". It could not have been met, because the probe families were
not built to measure an outcome across time — their three variants tested three* different *skills,
so each was checked exactly once, at exactly one delay, and no retention curve could exist. Fixed
before the cohort produced a single answer: a family's variants are now parallel checks of one
competence, and the validator refuses any other kind. One competence per topic is probed; the rest
of a topic's outcomes get their evidence from practice, not from delay.)*

This roadmap previously said that A2 authoring would not begin until it did. That rule is
deliberately changed here rather than quietly broken, because the reasoning behind it turned out to
be narrower than the rule it produced. The danger the gate names is real — scaling a lesson pattern
tenfold before knowing whether it produces retention would multiply a defect rather than find it.
But most of the A2 work in front of us is not that. Repairing the six existing A2 topics, arming
their probes, measuring coverage and fixing the outcome layer are all things the probe report can
only make *more* necessary, never less. Holding them for three weeks buys nothing and costs the
learner three weeks of an A2 that is known to be broken.

So the gate becomes a **revision trigger** with a consequence attached:

> On 2026-08-02 the probe cohort is read and the audit updated. If A1 misses the bar, authoring
> stops: the units written by then are revised against the finding, and the lesson pattern is fixed
> before another unit is written.

The risk this accepts is explicit. If the pattern proves defective, the units authored in the
meantime need rework, and that rework is the price of not idling. It is a bet on the pattern, made
with open eyes, and it is recorded here so that the bill — if it comes — is not a surprise.

## Completed milestone — Phase 5: learning-led pre-1.0 improvement

The evidence foundation and three bounded pilots are implemented: revision-safe v5 snapshots and
honest production review; a persistent train-document mission; a travel Wortfeld that enriches
existing card backs without changing their identities; and one optional Entdecken piece with local,
non-mastery feedback. Two more extensive-reader episodes and a canonical case lookup are available.

Phase 5 closes as a milestone without closing its practice. The two-unit evidence cycle (P5-11) is
recurring by nature and continues inside Phase 6's windows — it is how the learner's signal reaches
the backlog, not a deliverable that can finish. P5-7 (delayed evidence for listening) keeps its ID
and folds into Phase 6's schedule: it was always gated on the first probe cohort, and Phase 6 owns
that calendar. P5-1/3/4/5/6 stay deferred with their reasons intact in the backlog — none of those
reasons has changed. Editorial work continues to follow the six learning windows in
[the operating program](a2-learning-led-program.md); B1 identities remain provisional until the A2
checkpoint and its 2/7/21-day evidence have been reviewed.

## Deferred within Phase 5

Reconsider only after real A1 usage data exists: broader neural-audio replacement, longer reader
series beyond the pilot, optional constrained AI feedback and pronunciation analysis. None may
silently create verified evidence.

## Current milestone — Phase 6: learning quality — finish A2 on honest signal

The newest audit (2026-07-14, 879 attempts) does not show a content shortage; it shows an
instrument backlog. Thirty-two rejected production renderings await a linguistic ruling, and 35
production attempts are withheld from the focus signals until they get one — the review queue is
derived from the attempt log and has no memory, so it can never drain. Nine probes are due against
a three-per-session cap that will compound once all seventeen A2 families arm. And the worst weak
focus, `dativ-artikel`, stayed weak *despite an existing drill*. Phase 6 therefore works
instrument-first: a drill authored against a distorted weak-focus table drills the wrong confusion.

- **P6-1 · Grading-decisions instrument** — a committed home for linguistic rulings, so the review
  queue reports only what is genuinely undecided.
- **P6-2 · Triage the queued renderings** — every rendering gets its ruling and its paired
  content edit; the audit is rerun before anything else is authored.
- **P6-3 · Probe catch-up pacing** — a Heute "Probe-Rückstand" card drains probe debt in
  measurement-clean probes-only runs; the ordinary per-session cap stays.
- **P6-4 · Dative-cluster drill** — production-heavy, authored against the post-triage audit, with
  a test that the drill actually gets served.
- **P6-5 · Verb-forms drill** — conditional on what the post-triage signal still shows.
- **P6-6 · Desktop microphone permission** — the config-only fix that lets `speak` record in the
  desktop app.
- **P5-7 · Delayed evidence for listening** — keeps its ID; scheduled after the 2026-08-02 cohort
  read and P6-3, when the real probe load is known and paced.

**The exit criterion is the B1 gate** (below, next to the definition of completion): Phase 6 is
done when B1 authoring may honestly begin.

## Parallel tracks

Three phases run beside Phase 6 rather than after it. None of them gates B1 — they are listed here
so their scope is decided once, in writing, rather than re-litigated per PR.

**Phase 7 — Schreib-Assistent.** Local advisory feedback on `write` drafts: a runtime-only Ollama
client that quotes the learner's own words and nudges with questions and rule pointers — it never
rewrites, and its output is **advisory only, never evidence**: nothing it produces touches
accuracy, mastery, attempts or the snapshot. It self-hides when no local model answers, so the
course is complete without it. The Phase 5 deferral's own condition — reconsider constrained AI
feedback only after real usage data exists — is now met; what stays deferred is P5-3's
pronunciation half, which this phase deliberately does **not** reopen. Design:
[assist-design.md](assist-design.md).

**Phase 8 — Sprachen.** The objective is the **learner's language**, on two axes — restated after
a 2026-07-15 course correction, because the chrome-first sequencing had made the UI language look
like the point. **Ukrainian** joins EN/RU as an explanation language at the same quality bar as
Russian — a Ukrainian learner reads UK+EN units the way today's learner reads RU+EN — with English
as the fallback wherever `uk` is missing; the waves start now, in large chunks (A1 ~3, A2 ~4–5),
and each doubles as a review-and-improve pass over the existing RU prose. **German-medium
explanations** serve advanced learners: an optional `de` half authored for B1 content from day
one, never backfilled to A1/A2. The per-profile **UI language** (DE/EN/RU/UK chrome) that shipped
first is the foundation for both, not the objective; pure-German chrome remains the default. The
machinery is 5 PRs (P8-4, both axes' content machinery, shipped 2026-07-15); the waves run
concurrent with B1 authoring and never gate it. Design: [i18n-design.md](i18n-design.md).

**Phase 9 — Entdecken & Referenz.** The discovery layer grows from one piece toward a small
editorial strand — committed CC/PD assets with attribution and licence metadata, curated external
links visibly marked online-only — and the reference layer gains lookup pages derived from
canonical data rather than maintained by hand. Direction:
[future-content-directions.md](future-content-directions.md); themes and pages in the backlog.

## Definition of roadmap completion

A learner can start at Erste Schritte and reach the A2 checkpoint through a visible ordered path.
Sessions combine due review, eligible mixed practice and a clear next step. The learner reads and
listens at useful volume, produces and revises language, rehearses spoken exchanges, and proves
retention later in parallel contexts. Outcome progress is backed by mode-valid honest evidence, and
snapshot-driven weakness drills continue to work throughout.

## The B1 gate

B1 authoring begins when all seven of these hold, and not before:

1. **The A1 retention cohort has been read** (P3-6, on or after 2026-08-02) — and, if the
   ≥80%/≥70% bar was missed, the revision it triggers has shipped.
2. **The A2 checkpoint is completed** and window 6 of
   [the operating program](a2-learning-led-program.md) — the checkpoint and delayed-evidence
   review — is done.
3. **The A2 probe evidence has been reviewed** under the operating program's rules.
4. **The grading queue holds no undecided rendering**, and the post-triage audit has been re-read.
5. **No persistent weak focus is without an owned drill in rotation.**
6. **`data/goethe-b1-wortliste.txt` is acquired and `bun scripts/coverage.ts B1` reports against
   it** — its own sizable PR. A level with no manifest has no coverage figure and must not claim
   one. **Met 2026-07-15 (P6-8):** 3,416 headwords transcribed from the official PDF; the report
   runs, and the Über page states the honest head start (41% already covered by A1/A2 material —
   cards plus the inherited grammar-word `~` marks).
7. **The first B1 PR freezes the B1 identities in
   [the curriculum blueprint](curriculum-a2-b1.md)** — ids become persisted keys in learner
   progress the moment a unit ships, so freezing them is authoring work, not paperwork.

Two things are explicitly **not** gates: the state of the Ukrainian translation waves, and the
Schreib-Assistent. Both are parallel tracks, and B1 never waits for them. One soft preference was
recorded and is now **met** (P8-4 shipped 2026-07-15): the content-language machinery landed
before B1 unit 1, so B1 content carries `uk` — and its German-medium `<De>` explanation half,
a standing decision of the same date — from day one instead of being backfilled.
