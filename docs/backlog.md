# Active Backlog

Companion to [roadmap.md](roadmap.md). Statuses are `todo` → `doing` → `done`. **A finished item
moves to an archive, keeping at most one line here** — done entries never accumulate detail in this
file. Completed P0–P3 items: [the learning-foundations archive](archive/2026-07-learning-foundations.md);
completed Phase 4–9 items: [the phases 4–9 archive](archive/2026-07-phases-4-9.md).

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

## Phase 10 · Close the A2 grammar standard — `doing`

A2 was called content-complete on the strength of its **lexical** figure (Wortliste 100%). Nothing
measured *structure*, and when a manifest was finally written the honest number was **20/30 —
67%**. The gap is not scattered: the B1 blueprint plans to teach `als`/`wenn`, relative clauses,
infinitive with *zu*, future intention and *trotzdem* inside B1 units, so six A2-standard
structures had been pushed a level up and would have stayed invisible as A2 debt.

Closing them is therefore not a detour from B1 — it **de-duplicates** B1, which then spends its
grammar budget on the Konjunktiv II paradigm, full Passiv, proper Genitiv, indirect speech and
n-Deklination instead of re-teaching A2. Owner ruling 2026-07-18: **A2 closes fully before B1
authoring starts**, and a documented deferral is not a defence when the standard requires the
structure.

Measured with `bun scripts/grammar-coverage.ts A2`; the count is pinned in
`tests/grammar-coverage.test.ts`, so each closed point is a visible, deliberate change.

- **P10-1 · the manifest** — `done` 2026-07-18. `data/grammar-inventory.yaml`,
  `src/lib/grammar-coverage.ts`, the report script, validator wiring and the tripwire test.
- **P10-2 · `infinitiv-mit-zu`** — `done` 2026-07-18. Infinitiv mit *zu* + *um … zu*, tags
  `zu-infinitiv` and `um-zu-zweck`; A2 grammar 67% → **73%**. Inserted after `nebensaetze-plaene`
  rather than appended: the topic is taught against the modal's bare infinitive and the
  *dass*-clause it alternates with, both of which must already be there. It `deepens`
  `nebensaetze-plaene` on `nebensatz-verbende` — a real edge, since the zu-versus-*dass* choice
  keeps the learner building *dass*-clauses. The deck is 13 entries and thin on purpose:
  *versuchen*, *hoffen*, *planen*, *anfangen*, *vergessen*, *Lust*, *Zeit* and *wichtig* are all
  already taught, so the unit recycles them and owns only the language of intending and deciding
  — headed by *vorhaben*, the flagship verb of the structure, which appeared nowhere in the course.
- **P10-3 · `relativsaetze`** — `done` 2026-07-18. Nominativ + Akkusativ only, tag
  `relativpronomen-kasus`; A2 grammar 73% → **77%**. The A2 blueprint's "relative clauses"
  exclusion is corrected rather than deleted: it recorded an assumption that they belonged to B1,
  which the manifest showed to be a gap. `deepens: [nebensaetze-plaene]` on `nebensatz-verbende`
  (a Relativsatz *is* a Nebensatz); `akkusativ` is a prerequisite but deliberately not deepened,
  because the confusion added here is where the case *comes from*, not how `den` is built.
  `vocab: []` — pure syntax, and the lexis it describes people and things with is already taught.
- **P10-4 · `verbindungen-folgen`** — `done` 2026-07-18. Konjunktionaladverbien with inversion
  (*deshalb*, *deswegen*, *trotzdem*, *schließlich*) and *als* vs *wenn* for past time; tags
  `konjunktionaladverb-inversion` and `als-wenn-vergangenheit`. A2 grammar 77% → **83%**.
  Placed after `biografie-erfahrungen`, because every *als*-clause worth writing needs a past to
  talk about and that is the unit teaching *war*/*hatte*. **First topic in the course with two
  probe families** — it teaches two independent structures and closes two manifest points, and
  one mixed family would measure each competence at only one interval, which is not a retention
  curve. `probeFamilies` keys by setId, so the two are discovered and armed independently
  (verified at runtime, not assumed). B1 keeps *obwohl*; only the adverb *trotzdem* moves to A2.
- **P10-5 · extensions, not units** — `done` 2026-07-18. A2 grammar 83% → **90%**. Futur I
  (`futur-werden`) joins **`infinitiv-mit-zu`**, not `nebensaetze-plaene` as first planned: that
  node is already at the four-outcome maximum, and the plans-and-intentions topic is the better
  host anyway, since stating an intention is what A2 Futur I is for. Reflexiv im Dativ
  (`reflexiv-dativ`) joins `gesundheit-arzttermin` as planned, reusing `beschwerden-beschreiben`
  (*Ich habe mir den Fuß verletzt* is a symptom description) rather than adding a fifth outcome.
  Both are **non-primary** sets appended after the existing ones, and both host articles gained an
  Erklärung section — a structure that is drilled but never explained is not taught.
  **The four-outcome ceiling is worth remembering when planning an extension**: it decides where
  new grammar can go, and it is easy to discover only after the content is written.
- **P10-6 · `man` und Besitz** — `todo`. Indefinitpronomen (`indefinitpronomen`) and the Genitiv-s
  on proper names with *von* + Dativ as the everyday alternative (`genitiv-eigenname`). `man` is
  used in eight A2 articles already and taught in none.
- **P10-7 · Passiv Präsens, rezeptiv** — `todo`. Tag `passiv-rezeptiv`. The exam wants
  comprehension, not production — but recognition that is never checked is not evidence, so it
  still needs drilled items, and it still needs no deck.
- **P10-8 · publish the figure** — `todo`. Über states the computed grammar coverage beside the
  Wortliste one, and the roadmap's "A1 and A2 are content-complete" line is corrected until it is
  true again.

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

## Done phases — one line per item, details in [the archive](archive/2026-07-phases-4-9.md)

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

### P9-3 · Referenz lookup pages — `next` (M) — the current build target

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
