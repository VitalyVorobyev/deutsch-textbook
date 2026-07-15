# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P3 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v5 snapshot import and pass the full repository gate. What A2 teaches, in what order,
with which identities, is decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) — read it
before authoring anything.

Phases 0–5 are done: the learning system, the Atlas, complete A1 and A2 curriculum spines, the
hardened learning loop, and the pre-1.0 evidence foundation. B1 remains provisional until
representative A2 use, its checkpoint and delayed evidence have been reviewed. Phase 6 below leads
the queue and exits through the B1 gate in [roadmap.md](roadmap.md); Phases 7–9 run in parallel and
never gate B1.

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

## Current — Phase 6: learning quality — finish A2 on honest signal

Instrument first, then content. The 2026-07-14 audit shows thirty-two rejected production
renderings awaiting a linguistic ruling with 35 attempts withheld from the focus signals behind
them (its own display showed fourteen — the queue section's silent top-ten cap, removed by P6-1,
was hiding the rest), probe
debt that will compound once all seventeen A2 families arm, and the worst weak focus staying weak
*despite an existing drill*. A drill authored against a distorted weak-focus table drills the wrong
confusion, so P6-1/P6-2 precede P6-4/P6-5. The phase's exit criterion is **the B1 gate** in
[roadmap.md](roadmap.md).

P5-7 (delayed evidence for listening) is scheduled inside this phase and keeps its ID: after the
2026-08-02 cohort read (P3-6) **and** after P6-3, when the real probe load is known and paced.
Precondition to verify first: `probeFamilies()` supports two families per topic
(`probe-<topic>-hoeren` beside the production family) — a small code change if it turns out to be
keyed per topic.

### P6-1 · Grading-decisions instrument — `done` 2026-07-14 (M)

The grading-review queue is derived from the attempt log and has no memory: there is no place to
record a linguistic ruling, so the queue can never drain. Thirty-two rejected renderings across
twenty-eight `translate` items currently hold 35 production attempts out of the focus signals —
the audit's queue section displays only the top ten items, a silent cap this item also removes: a
queue that hides rows cannot drain. Give rulings a committed home.

- `data/grading-decisions.yaml`, with a Zod schema in `src/lib/schemas.ts`: entries
  `{item: <setId>:<itemId>, given, decision: accept|constrain|confirm, note, decidedAt}`; `given`
  is matched via `normalizeTranslation`.
- Decision semantics. **accept** — the rendering is correct, target-preserving German: the same PR
  adds it to the item's `accept` list and bumps `revision`; the withheld attempts stay excluded,
  because they were never errors. **constrain** — the rendering is good German that bypasses the
  target: the same PR adds a bilingual `instruction` constraint and bumps `revision`; attempts stay
  excluded. **confirm** — the rejection was right: the queue row clears and the attempts' exclusion
  lifts — but they re-enter `focusSignals` with attribution **recomputed under today's grading
  contract**, never with the stored historical `focus` tag. The audit already re-grades every
  queued rendering, so it knows whether today's scorer attributes the divergence to the item's
  focus; many rows are queued precisely because it does not, and a stale attribution from an older
  grader re-entering the weak-focus table is exactly the false entry the weakness signal must not
  contain. A confirmed attempt counts as wrong; it counts *against a focus* only if today's grader
  says so.
- Audit integration: `gradingReview()` in `scripts/progress-audit.ts` loads the decisions and
  reports **undecided renderings only**, applying the exclusion rules above.
- Validator: a decision's item ref must exist; an `accept`-decided rendering must pass today's
  grader (re-graded via `gradeTranslation` — an accepted rendering the scorer would still reject is
  a stale claim); an orphaned decision, whose rendering is no longer queueable (e.g. after a future
  normalization change), **warns rather than fails**.
- `CLAUDE.md` gains its grading-decisions pointer in this PR: the rule ships with the instrument it
  describes, not before it.

- Accept: the audit reports undecided-only; each decision type demonstrably applies its exclusion
  rule, including that a confirmed attempt whose stored focus today's grader would not attribute
  re-enters **unattributed** (tests in `tests/`); the validator fails on a dangling item ref and on
  an accept-decided rendering the grader rejects, and warns on an orphan.

### P6-2 · Triage the queued renderings — `done` 2026-07-14 (M)

All of them — thirty-two once the queue is uncapped — using `--item <set>:<item>` evidence: each
rendering gets a linguistic ruling in
`data/grading-decisions.yaml` and — for accept/constrain — its paired content edit and `revision`
bump in the same change. Notes record any real confusion worth a future drill item. After the
merge: rerun `bun run progress:audit --profile vitaly` and re-read the weak-focus table **before
any drill authoring** — 35 attempts entering or leaving the signals changes what the table says.

- Depends on: P6-1.
- Accept: zero undecided renderings; the withheld-attempts line drops accordingly; the post-triage
  weak-focus table is recorded — it is the input to P6-4 and P6-5.

### P6-3 · Probe catch-up pacing — `done` 2026-07-15 (M)

Nine probes due, three overdue, a cap of three per session — once seventeen A2 families arm, debt
compounds faster than it drains. Chosen over raising the cap: nine probes before practice turns a
session into an exam, and fatigue confounds the measurement.

- When due probes exceed `MAX_PROBES_PER_SESSION`, Heute shows a **"Probe-Rückstand"** card that
  opens a probes-only run: up to five, most-overdue first, nothing else in the visit —
  measurement-clean by construction. Ordinary sessions keep the cap at three.
- One new audit row: probe debt plus the distribution of actually-elapsed intervals. Its named
  consumers are the P5-11 audits and the P5-7 expansion decision — audit extensions are added only
  with named consumers.
- Overdue probes are *not* invalid data: the probe report already reports the interval that
  actually elapsed rather than the scheduled one. This item targets debt compounding, nothing else.

- Accept: with more than three probes due, the card appears and its run drains most-overdue first;
  ordinary sessions still open with at most three probes; the audit reports the debt row.

### P6-4 · Dative-cluster drill — `done` 2026-07-15 (M)

`content/exercises/a2/drill-dativ-ausloeser.yaml` (`role: drill`, attached to `dativ`'s
`exercises` — drills never touch `pathDone` or `primaryPractice`), authored against the
**post-P6-2** audit rather than today's numbers. Production-heavy: `translate` items whose
`key_tokens` pin the case-marked articles and pronouns (both ends wherever word order is graded),
contrastive `cloze` on dative-vs-accusative triggers, and 2–3 `listen` dictations where the article
is the point. Covers `verben-mit-dativ`, `dativ-praepositionen` and `dativ-artikel`.

The same PR carries an instrument check: a test asserting the new items enter `buildSession`'s
weak-focus band for these tags. `dativ-artikel` is the worst weak focus *despite an existing drill*
(10/24) — before authoring more items, prove that drills are actually served, production-shaped,
when their tag is weak.

- Depends on: P6-2 (its audit rerun is this item's input).
- Accept: the items clear the validator's `key_tokens` and item-mix rules; the `buildSession` test
  proves weak-focus serving.

### P6-5 · Verb-forms drill — `done` 2026-07-15 (S, conditional)

Only if the post-triage audit still shows the verb-morphology cluster (`modal-konjugation` 4/12
and `verb-endungen` 6/33 on today's pre-triage table): `drill-verbformen.yaml` on `modalverben`,
the same production-heavy shape as P6-4, in the same PR as P6-4 when the signal confirms.

Shipped split by tag ownership: the `verb-endungen` half lives in `a1/drill-verbendungen` on
`praesens-wortstellung`, the tag's owning topic — probe-arming hygiene, since probes arm from the
earliest verified attempt on any of a topic's practice/drill sets, so a set may only contain items
practising its own topic's competence (`drill-verbformen` stays modal-only).

- Depends on: P6-2; ships with P6-4 when taken.
- Accept: as P6-4 — or a recorded decision that the post-triage signal did not justify the drill.

### P6-6 · Desktop microphone permission — `done` 2026-07-15 (S)

`speak` recording works in the browser and fails in the desktop app, and the failure is
config-only: `src-tauri/` has no `Info.plist`, so macOS has no `NSMicrophoneUsageDescription` to
show. Add the plist (Tauri v2 merges it into the bundle); no app-code change expected. Test
protocol: `bun tauri dev` → open a `speak` item → the permission prompt appears → record and replay
work; `tccutil reset Microphone` between runs. If wry needs prompt handling beyond the plist
(tauri#10898 / #11951), **report the finding and rescope the item — never silently expand the PR**.

- Accept: the mic prompt appears in the desktop app and record/replay works — or the wry finding is
  recorded and the item rescoped.

**Status note (2026-07-15):** the plist shipped. The pinned wry (0.55.1) implements the WKWebView
media-capture delegate with auto-grant, so the OS-level TCC prompt — which is what needed the
usage description — should be the whole story. `doing` until the manual protocol above has been
run on a real macOS session; flip to `done` after that verification, not before.

**Verified (2026-07-15):** the manual protocol ran on a real macOS session — record and replay
work in the desktop app. The learner's verdict on the *flow* ("there is no automatic feedback on
the recording, and I can hear myself without recorded sound") became P6-7.

### P6-7 · Minimal-ceremony open production — `done` 2026-07-15 (M)

The P6-6 verification found the speak item technically working and didactically hollow — and the
owner's ruling cut deeper than the widget: **the app cannot verify free speech or free writing**
(speech is too variative to compare against a model answer; a multimodal grader is out of scope),
so the staged self-assessment flows — mandatory before/after checklists, forced second attempts —
were fake ceremony: many button presses charged for feedback that never actually happens.

Both open-production items are now single-pass. `Speak.tsx`: speak (recording optional) → one
press → model answer beside the learner's own take; a stopped take **auto-plays** (autoplay refusal
falls back to a prominent listen button — the `onstop` handler can outlive the Stop click's
transient activation, especially in WKWebView), and re-recording stays available on the compare
screen, where a new take auto-plays but the old one is never replayed. `Write.tsx`: draft → one
press → model beside the learner's text, which **stays editable** — revision is an option, not a
stage — with the Schreib-Assistent (the one real feedback channel) attached right there.
`checklist`/`requirements` render as guidance text, never as gated forms; the schema fields are
unchanged, so no content was touched. Payloads slim to `{kind: 'writing', draft, revision}` /
`{kind: 'speaking', recorded}`; `before`/`after` stay in the snapshot schema as optional legacy
fields, and legacy staged `SavedWriting` records restore onto the compare screen. Typical speak
run: 4 presses, down from ~11.

- Accept: `tests/speak.test.tsx` and the rewritten `tests/practice-flow.test.tsx` /
  `tests/write-assist.test.tsx` cover auto-replay, the blocked-autoplay fallback, the ungated
  advance, guidance-not-buttons criteria, byte-exact minimal payloads, legacy-record restore, and
  unmount URL revocation. CLAUDE.md's open-production contract rewritten to match.

## Parallel — Phase 7: Schreib-Assistent

Local advisory feedback on `write` drafts, specified in [assist-design.md](assist-design.md) —
read it before touching any of these items. The boundary is absolute and restated here: assist
output is **advisory only, never evidence** — it never touches accuracy, mastery, attempts or the
snapshot, and the feature self-hides when no local model answers. This phase does **not** reopen
P5-3: pronunciation assistance stays deferred.

### P7-1 · Assist library — `done` (M)

`src/lib/assist.ts` per [assist-design.md](assist-design.md): `probeAssist()` and `reviewDraft()`,
the JSON-schema-constrained request, the hallucination filter with its single corrective retry, and
the `da:assist` / `da:assist:model` device preferences. Tests with mocked fetch: probe, happy path,
quote filter, retry, abort. No UI in this PR.

- Accept: tests cover the design doc's failure-mode table; a test asserts nothing is written to
  attempts or the snapshot.

### P7-2 · Write.tsx advisory panel — `done` (M)

The revise-stage, on-demand panel per [assist-design.md](assist-design.md): praise line, hint list,
failure states, the gear popover, and an "advisory — never a score" footnote mirroring the
done-stage disclaimer. Pilot manually against the live local model with 2–3 real drafts **before**
opening the PR — expect prompt iteration — and finalize the design doc with whatever the pilot
changed.

- Depends on: P7-1.
- Accept: the panel is absent with Ollama stopped and renders hints with it running; it cannot open
  before the before-assessment is complete; zero writes to attempts or the snapshot, verified in
  test.

### P7-3 · Tauri transport — `done` 2026-07-15 (S)

Per [assist-design.md](assist-design.md): `tauri-plugin-http` as a dependency, a capability scoped
to `http://localhost:11434/*`, and the transport switch in `assist.ts` (behind `isTauri()`, like
every other Tauri API in the repo). Shipped as `assistFetch`, the one transport seam used by both
fetch sites: under Tauri it dynamically imports the plugin (the web bundle never loads it, same
pattern as syncdir.ts), elsewhere it resolves the global fetch at call time so test mocks keep
working. The plugin's fetch honors `RequestInit.signal`, so abort/timeout semantics are unchanged.

- Depends on: P7-1.
- Accept: assist reaches a running Ollama from `bun tauri dev`; the capability allows the Ollama
  origin and nothing else.

## Parallel — Phase 8: Sprachen

Two independent axes — per-profile UI language (chrome) and Ukrainian as a third explanation
language (content) — specified in [i18n-design.md](i18n-design.md); read it first. Machinery is
P8-1…P8-5 (~5 PRs); content is the C3 translation waves (~15–22 PRs), concurrent with B1 authoring
and never gating it.

### P8-1 · Strings module and per-profile language preferences — `todo` (M)

Per [i18n-design.md](i18n-design.md): `src/lib/strings.ts` with `UiLang` (`de | en | ru | uk`),
`t(key, uiLang)` and a `useUiLang()` hook; `<html data-ui-lang>` applied pre-paint; per-profile
keys `da:lang:<profileId>` / `da:uilang:<profileId>` with the legacy device-level `da:lang` copied
forward on first read (the legacy key remains as the device default for other profiles); static
Astro chrome rendered as CSS-toggled spans. Default `uiLang: 'de'` — zero visual change under the
classification rule in [i18n-design.md](i18n-design.md): a string is chrome iff it is German
today; helper text that follows the explanation language stays an `ExplainLang` surface and is
never reclassified by the sweep.

- Accept: the default build is visually unchanged; switching profiles re-applies both language
  attributes; the copy-forward migration is tested.

### P8-2 / P8-3 · The ternary sweep, in two halves — `todo` (M each)

Mechanically replace the ~136 inline `lang === 'ru' ? … : …` ternaries with hoisted
`pick(lang, {en, ru})` records, so `uk` later widens each record in exactly one place. Two PRs of
roughly half the components each; lean on `bun run check`. `GRADE_BUTTONS` and `VerdictChip`
labels are chrome, not content — they move to the strings table. See
[i18n-design.md](i18n-design.md) for the sweep strategy.

- Depends on: P8-1.
- Accept: no visible change at the current languages; the swept components contain no inline
  language ternaries.

### P8-4 · Ukrainian content machinery — `todo` (L)

Per [i18n-design.md](i18n-design.md): optional `uk` on `bilingualSchema` plus the parallel
optionals (`title_uk`; vocab `uk` and `example_uk`; `prompt_uk`; outcome `uk`). Validator
letter-set checks: і/ї/є/ґ in an `ru` field fails, ы/э/ъ/ё in a `uk` field fails — not watertight,
but it catches cross-pasting. Parity is per-file — any `uk` in a file means every ru-bearing field
in that file carries `uk` — and per-node for `content/atlas.yaml`. Glosses grow to
`[[de::en::ru::uk]]`: three or four fields, all-or-none per reading. `Uk.astro` + `.lang-uk` CSS;
`ExplainLang` gains `'uk'`; `pick()` falls back `uk→en` (decided — the design doc records why EN
and not RU).

- Depends on: P8-2/P8-3 (so `uk` lands in hoisted records, not in new ternaries).
- Accept: a file with partial `uk` fails parity; a Ukrainian letter in an `ru` field fails; a
  four-field gloss renders under `uk` and existing three-field glosses stay valid; zero changes
  required to existing content.

### P8-5 · Ukrainian UI surfaces — `todo` (S)

The meaning side of a card becomes `${en} · ${pickSecond(card)}` — the front of the `x-de`
production card and the back of the `de-x` recognition card, and only those; the `de-x` front
stays the German answer and the Hören dictation mode is unchanged. Display-only: card identity
`<deck>::<de>::<direction>` is untouched, so no SRS history resets (asserted in test, not
assumed). The header language toggle gains UK, and the Über page gains a build-time UK-coverage
figure — computed, never hand-written, per the earned-claims rule.

- Depends on: P8-4.
- Accept: card keys unchanged in test; the Über figure is computed at build time.

### C3 · Ukrainian translation waves — `todo` (recurring)

A1 first (~6–8 PRs), then A2 (~10–14). The quality bar is the same as Russian's: each wave is
**authored** idiomatically — the `uk` half may contrast German with Ukrainian (відмінки,
«бути»-dropping) — never machine-translationese; every wave passes the validator letter checks and
a review before merge.

- Depends on: P8-4.

## Parallel — Phase 9: Entdecken & Referenz

### P9-1 · Discovery schema evolution — `todo` (M)

`images[]` entries carrying `sourceClass`, `attribution` and `licence`, with a `superRefine`
mirroring `visualDocumentSchema` (real/adapted assets require attribution and licence metadata);
`links[]` for curated external material, rendered visibly **online-only** so a dead link never
breaks anything; migrate `berlin-ubahn-karte` and drop the bare `image` field. `CLAUDE.md` gains an
"Entdecken & Dokumente" section in this PR — the rules ship with the schema that enforces them.

- Accept: the validator rejects a real/adapted image without attribution and licence; the existing
  piece renders unchanged after migration; links are visibly marked online-only.

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

### P9-3 · Referenz lookup pages — `todo` (M)

Three pages, each derived or canonical — never a second hand-maintained textbook:

- `/referenz/verbformen` — build-time-derived from the vocab YAML (`praesens_3sg`, `partizip2`,
  `aux`, `valence`); a verb table that cannot drift from the decks that teach the verbs.
- `/referenz/zahlen-datum-zeit` — numbers, dates and clock time, from a new
  `content/reference-data/` YAML shared with any lesson that needs it.
- `/referenz/briefe` — letter and message conventions (greeting, closing, register).

Lower priority, recorded so it is not re-invented as a page: a two-way-preposition visual belongs
inside the existing kasus reference, not on a new route.

- Accept: reference pages carry no completion state or evidence semantics; derived tables are
  computed at build time.

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
- Accept: every A2 topic exercises every mode A1 does; `pathDone` is unchanged for the original sixteen
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

All three bundles shipped. A learner-led seventeenth A2 unit, `verben-mit-praepositionen`, was later
inserted after `gesundheit-arzttermin`; it preserves all existing identities and extends the current
checkpoint by stable item IDs. **A2 has eleven expansion units**, and the four units of bundle 3 use *weil* and
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

The windows now include the learner-led `verben-mit-praepositionen` module after
`gesundheit-arzttermin`; the operating program is authoritative. Keep the cycle-one snapshot review
open until `einkaufen-reklamation` is completed. A2 closure remains open until the expanded
checkpoint and this module's 2/7/21-day evidence have been reviewed.

**Disposition (2026-07-14):** continues unchanged as recurring practice inside Phase 6 — the
phase's items feed it (the P6-2 audit rerun, the P6-3 probe-debt row) rather than replace it.

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

One competence is probed per topic, and in every one of the original sixteen topics the competence that
answers "did this lesson stick" turned out to be a production one. So **no listening outcome has a
retention curve** — listening is practised (`listen` dictation, `audio-comprehension`) but never
re-checked after an interval. That is a real hole, and it is stated here rather than papered over.

The fix is a second probe family per topic where a listening outcome deserves it (`probe-<topic>-hoeren`,
three parallel `listen` or `audio-comprehension` variants). It is not free: a due probe opens the
session and the cap is three, and seventeen families can now arm. Do it after the first cohort
reports, when the real probe load is known rather than guessed.

**Disposition (2026-07-14):** scheduled inside Phase 6, keeping this ID — after the 2026-08-02
cohort read (P3-6) and P6-3, when the real probe load is known and paced. Precondition to verify
first: `probeFamilies()` supports two families per topic (`probe-<topic>-hoeren` beside the
production family); a small code change if it turns out to be keyed per topic.

- Accept: a listening outcome shows a 2/7/21-day curve; the probe load per session stays bounded.

### P5-6 · Recognition-only vocabulary cards — `deferred` (S)

`buildDeck()` turns every vocab entry into two cards, so there is no way to teach a word for
recognition alone. Language the learner must understand but will never produce — station
announcements, listing abbreviations, form headings — therefore lives in readings and article tables
and never in a deck. If A2 usage shows the review load is genuinely inflated by words that only need
recognition, a `cards: recognition | both` field on a vocab entry is the fix.

- Accept, when taken up: a recognition-only entry produces one card rather than two; existing card
  ids are unchanged; the Wortschatz table says which words are recognition-only.
