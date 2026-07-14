# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P3 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v5 snapshot import and pass the full repository gate. What A2 teaches, in what order,
with which identities, is decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) — read it
before authoring anything.

Phases 0–4 are done: the learning system, the Atlas, complete A1 and A2 curriculum spines, and the
hardened learning loop. B1 remains provisional until representative A2 use, its checkpoint and
delayed evidence have been reviewed. Current authoring expands optional A1/A2 context without
adding new spine topics.

## The open gate

### P3-6 · Read the A1 retention cohort — `blocked on 2026-08-02` (a calendar gate, not a task)

The engineering half shipped with P3-1: the probe report on Fortschritt, reporting delayed results
apart from practice accuracy and at the interval that *actually* elapsed rather than the scheduled
one. The other half runs on wall-clock. Probes armed on 2026-07-12; the 21-day cohort completes
**2026-08-02**.

**The exit bar, stated so that it can fail:**

> **≥ 80% correct on delayed parallel probes per probed competence, with free-production items ≥ 70%.**

The bar used to say *per A1 outcome*, and it could not have been met as written. A probe family's
three variants were testing three **different** competences, and `dueProbe` serves one variant per
interval — so each competence was measured exactly once, at exactly one delay, and no retention
curve could exist. The number would have looked like retention without being it. Caught before the
cohort produced a single answer (zero probe attempts were logged), and fixed: a family's variants are
now parallel checks of **one** competence, and `bun run validate` refuses any other kind. One
competence per topic is probed — a topic's remaining outcomes get their evidence from practice, which
is where outcome mastery comes from anyway.

This used to gate the *start* of A2 authoring. It is now a **revision trigger** instead — the
roadmap explains why, and names the risk that change accepts. If A1 misses the bar, A2 authoring
stops, the units written by then are revised against the finding, and the lesson pattern is fixed
before another unit is written.

- Accept: delayed and novel-transfer evidence are reported separately from engagement; the findings
  update [the audit](a1-learning-audit.md) and, if the bar is missed, the A2 units already written.

## Completed — Phase 4: complete A2

### P4-1 · Freeze the A2 curriculum contract — `done` (S)

Rewrite the blueprint against the post-hardening authoring contract, and freeze the identities: the
spine order, the topic ids, the outcome ids, the focus-tag additions and the atlas groups. All of
them become persisted keys in the learner's progress the moment a unit ships.

Two decisions carry the weight. **Nebensätze move from last to sixth** — four of the units that
would have preceded them cannot decline an invitation or explain an absence without *weil*, and
declaring those items `preview: true` across three units would be a way of admitting the order is
wrong without fixing it. **An A2 unit owns a thin new A2 deck and never adopts an A1 one** —
adoption would flip that deck's fresh-card gate from "any A1 topic opened" to "this A2 topic
opened", pushing hundreds of A1 Wortliste words behind an A2 gate.

- Accept: the blueprint, roadmap, backlog and `CLAUDE.md` agree; no persisted identity is renamed;
  the documentation describes the system that exists, not a planned one.

Closed with bundle 2, which is when the last two disagreements surfaced — both of them in the
direction the acceptance criterion warns about, a document describing a system that does not exist.
The blueprint gave `gesundheit-arzttermin` a `gesundheit-koerper` group of its own under
`wortschatz`; the node is `communication`, the group would have been `vocabulary`, and the rule one
line above the table forbids the mismatch. The group had been added to `content/atlas.yaml` and was
held by no node. And `arbeit-beruf`'s `deepens` had grown a third edge (`termine-vereinbaren`, which
is real — the unit drills `du-sie`) that the blueprint's table never gained.

### P4-2 · Build the A2 instrument — `done` (L)

The measurement A2 authoring will be judged by, built before the content it judges.

- **A validator rule: every declared outcome must be measured.** Four A2 outcomes
  (`dativ-pronomen`, `dativ-praepositionen`, `dativ-verben`, `modal-konjugation`) are declared in
  `content/atlas.yaml` and referenced by no exercise item and no reading question. They can never
  light up, and a probe on them can never arm. Fix the four, then make it impossible to ship a fifth.
- Six A2 probe families with parallel variants, following the A1 pattern. This arms the A2 retention
  clock now rather than after ten more units.
- ~~`deepens` semantics in training~~ — **already true; do not build it.** The behaviour this asked
  for exists, and the focus tag is what delivers it: `focusStats` (`src/lib/weakness.ts`) keys weakness
  by tag alone and is blind to the topic an attempt came from, so an error while practising a deepening
  topic marks that confusion weak course-wide; `buildSession` (`src/lib/training.ts`) then draws its
  second band from the entire eligible pool, and the base topic — earlier in the spine, therefore
  already opened — hands over its items carrying that tag. Measured on the shipped content: four errors
  on `dativ-praepositionen` inside `dativ` resurface `stadt-wege`'s items on that tag in 200 sessions
  out of 200, and nothing else from `stadt-wege` enters. Base lessons are never duplicated because
  nothing copies them — training addresses items, not lessons. **A `deepens`-aware aggregation would be
  a regression**: scoping a tag to a topic narrows a signal that is deliberately global. What was
  genuinely missing is now shipped — the edge worked only because the content happened to give it a
  shared tag, so `bun run validate` now rejects a `deepens` edge whose two ends share no tag the base
  can be drilled on (`tests/deepens.test.ts` pins both the behaviour and the content contract).
- A Goethe-A2 Wortliste manifest (`data/goethe-a2-wortliste.txt`) and `goetheCoverage(level)`
  generalized from `goetheA1Coverage()`, so the Über page can make an A2 claim it has measured.
- A checkpoint route that is not hard-wired to A1: `a1/checkpoint-a1` is currently named in five
  places, and `NextTopic` accepts exactly one checkpoint.

- Accept: the outcome rule fails on a deliberately orphaned outcome; A2 probes arm from the real
  snapshot with correct due dates; every `deepens` edge is backed by a shared focus tag the base can be
  drilled on, and validation fails on one that is not; `bun scripts/coverage.ts A2` reports a real
  figure; an A2 checkpoint could be added without touching four pages.

### P4-3 · Bring the six shipped A2 topics up to the hardened contract — `done` (L)

They predate the loop entirely. Across all six: **zero** `write` items, **zero** `speak` items,
**zero** `audio-comprehension` items, **zero** probe families, no extensive reader. A1 has 8, 2, 14
and 10 respectively. Ten new units built on that foundation would inherit its gaps, so this comes
before them, not after.

Per topic: hidden-transcript listening, a `write` task with the draft → checklist → revision loop, a
`speak` task with record and replay, and a faded discrimination set against confusable earlier
material. One shared real-world scenario per topic — the mission convention, see the blueprint. One
A2 extensive reader.

- Depends on: P4-2 (the probe families land with it).
- Accept: every A2 topic exercises every mode A1 does; `pathDone` is unchanged for all sixteen
  existing topics — asserted, not assumed, because a new item in a `primaryPractice` set silently
  un-finishes a topic.

### P4-4 · Author the ten A2 units — `done` (L)

In spine order, in three bundles: `wohnen-umzug`, `reisen-verkehr`, `einkaufen-reklamation`; then
`gesundheit-arzttermin`, `arbeit-beruf`, `nebensaetze-plaene`; then `biografie-erfahrungen`,
`freunde-feste`, `lernen-verstehen`, `aemter-dienstleistungen`.

Each unit is one complete bundle: atlas node and unit slot, article, three-item pretest, practice
sets clearing the item-mix bar, a probe family, an intensive reading, a thin A2 vocab deck deduped
against every existing deck, and its focus tags registered in both `CLAUDE.md` and
`scripts/validate.ts`.

All three bundles have shipped. **A2 has its ten units**, the four units of bundle 3 use *weil* and
*dass* throughout, and the reorder that made that possible has paid for itself.

What bundle 3's review round found is worth recording, because it was not a content defect but an
**instrument** defect, and it had been live since A1:

> A `translate` item that grades word order could not attribute its own signature error.

`diffExpectedWords` is an LCS alignment, and a transposition is not a missing word: `… weil ich am
Samstag **arbeiten muss**` typed as `… muss arbeiten` still contains both words, so the diff matched
the learner's `muss` to the expected `muss`, flagged only `arbeiten`, and — since the item pins the
verb whose placement it grades — reported no graded token as diverged. The attempt was logged wrong
but **unattributed**. Every verb-final family was affected (`nebensatz-verbende`, `indirekte-frage`,
`modal-satzklammer`, `trennbar-modal`, `perfekt-satzklammer`), across practice, drill **and probe**
items: 34 items in all, 12 of them probe variants. So the retention curve for a word-order rule was
being read off items that could not measure it, and `weakFocuses()` could never see a learner who
systematically collapses the Satzklammer. CLAUDE.md had told every author the opposite — "tokens are
compared positionally" — which is the sentence that produced all 34.

Fixed in the scorer rather than in the content: `gradeTranslation` now also asks whether the learner
put something *else* into a slot the item grades, compared against the accepted rendering they came
closest to. All 34 items attribute correctly with no content change. The same round fixed dictation
attribution, where a mistyped noun was being logged as the *grammar* confusion the `listen` item
drills (31 items, inherited from A1).

- Depends on: P4-1, P4-2, P4-3.
- Accept per unit: the twelve-point A2 unit quality gate in the audit; the learning-science review;
  the full repository gate.

### P4-6 · Give the writing outcomes verified evidence — `done` (S)

Five A2 outcomes are measured *only* by a `write` item: `einladung-schreiben`,
`kursanfrage-schreiben`, `formelle-nachricht-schreiben`, `krankmeldung-schreiben`, `nachbarn-bitte`.
A `write` logs **unverified practice evidence** by design — it never affects accuracy or mastery — so
these outcomes are legal, honest in the snapshot, and can never light up. That is not a bug, but it
means "can write a short formal message" is an outcome the course claims and never measures.

`profil-schreiben` (`biografie-erfahrungen`) shows the cheap fix: it is *also* carried by a
third-person `translate` and by a reading question, so it has a verified source without pretending
the `write` was scored.

- Accept: every declared outcome has at least one verified measurement, or the Fortschritt page says
  plainly which outcomes are practice-only.
- Done (PR #38). Each of the five now carries a verified `translate` alongside its `write`, on the
  `profil-schreiben` model. **All 61 A2 outcomes have a verified measurement.** One correction to the
  note above: `nachbarn-bitte` was carried by a `speak` item, not a `write` — the same defect, since
  `speak` also logs unverified evidence. Both new items use a focus their own topic **owns** rather
  than `preview: true`: tagging `hoeflich-konjunktiv` in unit 7 would have marked the learner weak on
  a confusion the course does not teach until unit 16, and weakness is aggregated course-wide.

### P4-5 · Close A2 — `done` (M)

The cumulative A2 checkpoint and its page; the Goethe-A2 Wortliste completion pass; two or three A2
extensive readers; the Über page's A2 card rewritten from a hand-written hedge to a computed claim;
a 0.3.0 release.

- Depended on: P4-4. **P3-6 was re-read as advisory, not blocking** — see below.
- Accept: the checkpoint is reachable only when the A2 path is done and never enters ordinary
  training; the Über page's A2 figures match `bun scripts/coverage.ts A2`; no page claims A2 is more
  finished than it is. All met.
- Done in PRs #30, #31, #32–#37, #38. **A2: 1449/1449 (100%). A1: 673/673.**

**Why P3-6 no longer blocks this.** The gate's stated purpose was *"if A1 misses the bar, authoring
stops: the units written by then are revised against the finding, and the lesson pattern is fixed
before another unit is written."* All sixteen A2 units were already written when this work began, so
the gate can no longer protect what it was written to protect. It is now what it always really was: a
**revision trigger**. The cohort is read on 2026-08-02 (P3-6, still open); if A1 misses ≥80% / ≥70%,
that drives a 0.3.x revision of the lesson pattern across both levels. Releasing 0.3.0 first does not
weaken that — a release is a distribution event, not a claim about retention, and the Über page makes
no claim about retention.

**What the work actually turned out to be about.** The Wortliste completion pass was the smaller half.
The larger half was that the *instrument* could not be trusted with the claim it was about to make:
a `~` in a manifest (taught as grammar, no flashcard) counted toward the published percentage on the
manifest's own say-so, and nine of those marks were false — eight words that appeared nowhere in
`content/`, and A1's `euer`, which appeared only inside English prose *about* German. A1's 100% was
not fully earned. `bun run validate` now hard-fails an unearned `~`, and the check went on to refuse
its author's own frozen plan (teaching `Disko`/`Klub` inside vocab example sentences — which
`taughtSurface` excludes, correctly, because a word used in another word's example is not taught).

## Later — Phase 5 (deferred)

### P5-1 · Expand committed neural-TTS audio — `deferred` (L)

Prefer generated assets with speech synthesis as a permanent fallback. Reconsider after usage shows
that audio quality, rather than content coverage, is the limiting factor. It does not: `listen` sits
at 76% and `audio-comprehension` at 8/8 on browser TTS.

### P5-2 · Expand the extensive-reader series — `done` (M per reader)

The A2 vocabulary and grammar base is now complete enough for connected, optional reading. The
fifth Lena episode begins the post-spine enrichment pass with a Bremen civic errand and the Roland;
future episodes keep the enforced extensive-reader contract: 250–400 words, sparse glossing and at
most two gist questions. Evaluate readability and voluntary continuation, not completion as mastery.

Episodes 6 and 7 now continue the civic-life strand through a lost-property report and a shared
request to a property manager. They retain sparse glossing and two gist questions each.

### P5-8 · Revision-safe evidence and honest production — `done` (L)

Snapshot v5, explicit v1–v5 migrations, full nested validation and pure deterministic merge modules
are shipped. New attempts carry the authored item revision; old/mismatched attempts remain historical.
Writing and speaking persist structured before/after assessments and accept `needs work` without
turning self-assessment into a score. The FSRS compatibility adapter has no deprecation diagnostics.

### P5-9 · A2 context pilots — `done` (L)

`reisen-verkehr` owns a transcript-equivalent disruption board that stays visible through lesson and
mixed-training tasks. Its Wortfeld references existing cards and adds only answer-side context.
Entdecken contains one original-map historical piece with optional retelling and local feedback.
None of these passive surfaces creates mastery or review debt.

### P5-10 · Canonical case reference — `done` (M)

Articles, personal pronouns and preposition groups live in `content/reference-data/cases.yaml`.
The Akkusativ/Dativ lessons and `/referenz/kasus-praepositionen` render the shared data. Lookup has no
completion state or evidence semantics.

### P5-11 · Two-unit A2 evidence cycles — `doing` (recurring)

Run the just-in-time audit and post-pair snapshot review in
[a2-learning-led-program.md](a2-learning-led-program.md). The audit reports revision coverage,
response modes, overdue probes, productive-card lapses, persistent focus errors, structured
production changes, session workload, pair windows and pilot feedback.

### P5-3 · Evaluate pronunciation assistance — `deferred` (L)

Constrained local or optional AI pronunciation assistance. All resulting evidence stays unverified
unless a trustworthy assessment method exists.

### P5-4 · Add lightweight mission grouping — `deferred` (M)

A presentation and resume layer over stable content IDs — not a branching game engine.

**Deferred out of Phase 3 on 2026-07-12**, and it stays deferred: by its own description it adds no
new retrieval opportunity, and its premise is engagement, which is not the problem the data shows.
The audit's requirement that an A2 unit provide "a coherent real-world mission" is met as an
**authoring convention** instead — a unit's artifacts share one scenario and end in a fresh-context
production task. That costs no code. Reconsider the feature only if the convention proves
insufficient.

### P5-5 · Evaluate branching missions — `deferred` (M)

Only after a linear mission pilot shows that branching would improve rather than distract from the
learning workflow.

### P5-7 · Delayed evidence for listening — `todo` (M)

One competence is probed per topic, and in every one of the sixteen topics the competence that
answers "did this lesson stick" turned out to be a production one. So **no listening outcome has a
retention curve** — listening is practised (`listen` dictation, `audio-comprehension`) but never
re-checked after an interval. That is a real hole, and it is stated here rather than papered over.

The fix is a second probe family per topic where a listening outcome deserves it (`probe-<topic>-hoeren`,
three parallel `listen` or `audio-comprehension` variants). It is not free: a due probe opens the
session and the cap is three, and sixteen families already arm at once. Do it after the first cohort
reports, when the real probe load is known rather than guessed.

- Accept: a listening outcome shows a 2/7/21-day curve; the probe load per session stays bounded.

### P5-6 · Recognition-only vocabulary cards — `deferred` (S)

`buildDeck()` turns every vocab entry into two cards, so there is no way to teach a word for
recognition alone. Language the learner must understand but will never produce — station
announcements, listing abbreviations, form headings — therefore lives in readings and article tables
and never in a deck. If A2 usage shows the review load is genuinely inflated by words that only need
recognition, a `cards: recognition | both` field on a vocab entry is the fix.

- Accept, when taken up: a recognition-only entry produces one card rather than two; existing card
  ids are unchanged; the Wortschatz table says which words are recognition-only.
