# Active Backlog

Companion to [roadmap.md](roadmap.md). Statuses are `todo` → `doing` → `done`. **A finished item
moves to an archive, keeping at most one line here** — done entries never accumulate detail in this
file. Completed P0–P3 items: [the learning-foundations archive](archive/2026-07-learning-foundations.md);
completed Phase 4–10 items: [the phases 4–10 archive](archive/2026-07-phases-4-9.md).

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v5 snapshot import and pass the full repository gate. What A2 teaches, in what order,
with which identities, is decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) — read it
before authoring anything.

Phases 0–8 are done: the learning system, the Atlas, complete A1 and A2 curriculum spines (including
the Ukrainian explanation half), the hardened learning loop, the pre-1.0 evidence foundation, the
honest-signal instrument pass, the Schreib-Assistent, and the learner-language machinery. Only
Phase 9 (Entdecken & Referenz) runs in parallel now, and it never gates B1. B1 remains provisional
until representative A2 use, its checkpoint and delayed evidence have been reviewed — the B1 gate
lives in [roadmap.md](roadmap.md).

## Completed work — one line here, detail in the archive

- **Phase 10 · close the A2 grammar standard** — `done` 2026-07-18. Structural coverage moved from 20/30 to 30/30; see [the phases 4–10 archive](archive/2026-07-phases-4-9.md).
- **Pre-B1 A2 linguistic QA** — `done` 2026-07-18. All 30 manifest points are signed off and all
  high/medium findings closed; see [the QA ledger](a2-linguistic-qa.md).

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

## Done phases — one line per item, details in [the phases 4–10 archive](archive/2026-07-phases-4-9.md)

- **Phase 4 · complete A2** — `done`. P4-1 froze the A2 curriculum contract; P4-2 built the A2
  instrument (outcome-measurement rule, probe families, A2 Wortliste manifest, checkpoint
  discovery); P4-3 brought the six pre-loop A2 topics up to contract; P4-4 authored the ten A2
  units and fixed the transposition-blind scorer (34 items); P4-6 gave the writing outcomes
  verified evidence (all 61 A2 outcomes measured); P4-5 closed A2 (checkpoint, 100% Wortliste,
  computed Über claims, 0.3.0).
- **Phase 5 · pre-1.0 foundation** — `done` except the entries kept below. P5-2 extensive readers
  (Lena 5–7); P5-8 snapshot v5 + revision-safe evidence; P5-9 A2 context pilots; P5-10 canonical
  case reference.
- **Phase 6 · learning quality** — `done` 2026-07-14/15. P6-1 grading-decisions instrument;
  P6-2 triaged all 32 queued renderings; P6-3 probe catch-up pacing (Probe-Rückstand card);
  P6-4 dative-cluster drill; P6-5 verb-forms drill (split by tag ownership); P6-6 desktop mic
  permission; P6-7 minimal-ceremony open production; P6-8 Goethe-B1 Wortliste manifest
  (3,416 headwords, inherited-only `~`).
- **Phase 7 · Schreib-Assistent** — `done` 2026-07-15, per [assist-design.md](assist-design.md);
  advisory only, never evidence. P7-1 assist library; P7-2 Write.tsx advisory panel; P7-3 Tauri
  transport.
- **Phase 8 · Sprachen, machinery** — `done` 2026-07-15/16, per [i18n-design.md](i18n-design.md);
  the objective is the learner's language, not the chrome. P8-1 strings module + per-profile
  language preferences; P8-2/P8-3 the ternary sweep (~136 ternaries → hoisted `pick()` records);
  P8-4 content-language machinery for `uk` **and** the B1-onward German-medium `de` half;
  P8-5 card meaning side + computed Über UK-coverage figure + chrome residue. **Post-scriptum
  2026-07-16**: one Lernsprache selector, chrome pinned German, EN surface never shows RU/UK
  (`pickSecond` under `en` → EN alone) — the owner ruling and rationale live in
  [i18n-design.md](i18n-design.md).
- **C3 · Ukrainian A1+A2 explanation half** — `done` 2026-07-18. Authored across every ru-bearing
  A1/A2 file (Über **266/266**), idiomatic and per-file-parity, `en`/`ru` prose byte-identical
  (waves 1–7, PRs #60/#61/#66/#67/#68/#69). B1 `uk` waves follow B1 content.

## Parallel — Phase 9: Entdecken & Referenz

P9-1 (discovery schema: provenance-checked `images[]`, online-only `links[]`) — `done` 2026-07-15,
archived.

P9-4 (canonical multilingual Wortnetze schema, four pilot networks, reference page and compact
card-back context) — `done` 2026-07-18, archived. It remains a parallel reference track and does
not gate B1.

### P9-2 · Entdecken pieces — `todo` (recurring, ~1–2 per PR)

Optional editorial pieces from the fifteen-theme backlog, each passing the editorial test in
[future-content-directions.md](future-content-directions.md) — a language reason to exist, level
control, and no review obligation from opening it:

1. die Berliner Mauer im Stadtbild
2. das Ampelmännchen
3. Pfand und Mülltrennung
4. die Sonntagsruhe
5. Schrebergärten
6. Deutsch in Österreich und der Schweiz
7. der Verein
8. Brot als UNESCO-Kulturerbe
9. das Deutschlandticket
10. das Amt als Genre
11. Bauhaus im Alltag — the movement through an everyday object
12. der Döner — migration through a familiar food
13. die Loreley — the Rhine through a place and a legend
14. Moin, Servus, Grüß Gott — regional German through an encounter
15. Tatort am Sonntag — a television ritual

Two standing decisions are recorded here rather than as items. **Committed audio stays deferred**
(P5-1 untouched): when the audio schema's `kind: asset` path needs exercising, the cheap path is
one CC-licensed audio asset inside one Entdecken piece, not a TTS replacement program. **Audit
extensions are added only with named consumers** — the grading-decisions integration names P6-1's
queue; the probe-debt row names the P5-11 audits and the P5-7 decision.

- Depends on: P9-1.
- Accept per piece: the editorial test; the validator; no mastery or review-debt semantics.

### P9-3 · Referenz lookup pages — `next` (M)

The largest non-blocked, learner-facing work that does not gate B1. Three pages, each derived or
canonical — never a second hand-maintained textbook. Ship one at a time (each is independently
shippable); match the existing `src/pages/referenz/*.astro` pattern.

- `/referenz/verbformen` — build-time-derived from the vocab YAML (`praesens_3sg`, `partizip2`,
  `aux`, `valence`); a verb table that cannot drift from the decks that teach the verbs.
- `/referenz/zahlen-datum-zeit` — numbers, dates and clock time, from a new
  `content/reference-data/` YAML shared with any lesson that needs it.
- `/referenz/briefe` — letter and message conventions (greeting, closing, register).

Lower priority, recorded so it is not re-invented as a page: a two-way-preposition visual belongs
inside the existing kasus reference, not on a new route.

- Accept: reference pages carry no completion state or evidence semantics; derived tables are
  computed at build time.

## Phase 5 — the entries still open

### P5-11 · Two-unit A2 evidence cycles — `doing` (recurring)

Run the just-in-time audit and post-pair snapshot review in
[a2-learning-led-program.md](a2-learning-led-program.md). The audit reports revision coverage,
response modes, overdue probes, productive-card lapses, persistent focus errors, structured
production changes, session workload, pair windows and pilot feedback.

The windows now include the learner-led `verben-mit-praepositionen` module after
`gesundheit-arzttermin`; the operating program is authoritative. Keep the cycle-one snapshot review
open until `einkaufen-reklamation` is completed. A2 closure remains open until the expanded
checkpoint and this module's 2/7/21-day evidence have been reviewed. Continues as recurring
practice; the Phase 6 instruments (the triage flow, the probe-debt row) feed it.

### P5-7 · Delayed evidence for listening — `todo` (M)

One competence is probed per topic, and in every one of the original sixteen topics the competence that
answers "did this lesson stick" turned out to be a production one. So **no listening outcome has a
retention curve** — listening is practised (`listen` dictation, `audio-comprehension`) but never
re-checked after an interval. That is a real hole, and it is stated here rather than papered over.

The fix is a second probe family per topic where a listening outcome deserves it (`probe-<topic>-hoeren`,
three parallel `listen` or `audio-comprehension` variants). It is not free: a due probe opens the
session and the cap is three, and seventeen families can now arm. Do it after the first cohort
reports (P3-6, 2026-08-02), when the real probe load is known rather than guessed. Precondition to
verify first: `probeFamilies()` supports two families per topic — a small code change if it turns
out to be keyed per topic.

- Accept: a listening outcome shows a 2/7/21-day curve; the probe load per session stays bounded.

### P5-1 · Expand committed neural-TTS audio — `deferred` (L)

Prefer generated assets with speech synthesis as a permanent fallback. Reconsider after usage shows
that audio quality, rather than content coverage, is the limiting factor. It does not: `listen` sits
at 76% and `audio-comprehension` at 8/8 on browser TTS.

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

### P5-6 · Recognition-only vocabulary cards — `deferred` (S)

`buildDeck()` turns every vocab entry into two cards, so there is no way to teach a word for
recognition alone. Language the learner must understand but will never produce — station
announcements, listing abbreviations, form headings — therefore lives in readings and article tables
and never in a deck. If A2 usage shows the review load is genuinely inflated by words that only need
recognition, a `cards: recognition | both` field on a vocab entry is the fix.

- Accept, when taken up: a recognition-only entry produces one card rather than two; existing card
  ids are unchanged; the Wortschatz table says which words are recognition-only.
