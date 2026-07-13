# Deutsch-Atlas Roadmap: complete the A1–A2 course

Status: **in progress** (updated 2026-07-13). Phase 4 is complete and shipped as 0.3.0.

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

## Current milestone — Phase 4: complete A2

Outcome: A2 reaches the same bar as A1 — sixteen topics, a cumulative checkpoint, delayed probes,
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

**All of it is done** (PRs #23–#38, shipped as 0.3.0). A2 is sixteen units, a twenty-item cumulative
checkpoint, sixteen probe families, and **1449/1449 of the Goethe-A2 Wortliste**. The one thing the
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
