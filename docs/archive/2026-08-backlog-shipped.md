# Archived backlog: items closed 2026-07-28 → 2026-08-02

Companion to [roadmap.md](../roadmap.md) and [backlog.md](../backlog.md). Everything here is done.
Entries keep the *decision and its reason* — the part that is still worth reading — and drop the
progress narrative. Earlier closures: [the 2026-07-26 archive](2026-07-backlog-full.md).

## Instruments

**P12-4 · Focus evidence separated from answer constraints** (2026-07-31). `focus_evidence`
predicates now produce explicit `retained` / `failed` / `unknown` attempt data; `key_tokens`
continues to constrain answer grading and still attributes where no predicates are declared. An
attempt carries a verdict only where its item declares a contract, so historical attempts keep
their earlier contract.

**P12-5 · Inserted-token attribution** (2026-07-31). Failed predicates can name an inserted form
directly, so `uebersetzen-modal-ohne-zu` distinguishes a spurious *zu* (failed) from a lexical
substitution such as *kommen* (unknown) instead of charging both to `zu-infinitiv`.

**P19-4 / P5-11d · Outcome-keyed probe arming** (2026-07-31). Families commit exact verified
`setId::itemId` arming sources; validation rejects unresolved, non-practice and unverified ones,
and runtime no longer falls back to broad outcomes. This also removed the coupling that made a
second probe family expensive — see the 2026-08-02 amendment in
[curriculum-a2-b1.md](../curriculum/a2-b1.md).

**P19-2 · `a1/probe-erste-schritte` audit label** (2026-07-31). The family stays honestly untagged
for scoring; the audit shows its outcome identity rather than an unreadable `(untagged)` label, and
it remains excluded from focus-retention verdicts.

**P17-6 · Item-scoped document stimuli** (2026-07-31). An item's optional `stimulus` overrides the
set stimulus, with reference validation and rendering tests. Set-scoped documents keep their old
behaviour.

## Content

**P19-1 · A1 backfill of five late grammar points** (2026-07-31). Perfekt, Imperativ, trennbare
Verben, *darf/muss nicht* and *du/Sie* gained A1 explanations, scaffolded retrieval, open production
and delayed transfer. Boundary report: `22 covered · 0 late · 0 missing`. The broader participle
system stays at A2.

**P17-1–4 · Semantic visual families** (2026-07-26). The responsive Wohnen pilot gained three
deterministic successor families: a sentence rail for V2, separable verbs, modal/Perfekt brackets
and verb-final clauses; a clock/preposition visual with a `seit`/`vor` timeline; a city-route map
plus a `mit dem Zug` / `in den Zug` / `im Zug` contrast. Body and participant-role figures and
task-bound apartment, form and receipt practice shipped with them. Generated pixels carry no
load-bearing language; exact labels are HTML/SVG; viewing creates no evidence. All passed semantic,
accessibility and 320–1100 px overflow review.

**P9-2 · Entdecken** (2026-07-26). Two reviewed pieces: reading a simulated Behördenbrief, and the
shared-space structure of Schrebergärten.

## Audio

**P22-2 · WAV master vs published derivative** (2026-08-02). Decided before the first recording was
committed, as the entry required. The WAV master stays in the studio; a 64 kbps mono MP3 is
published into `content/listening/`. The manifest carries both `master_audio_sha256` (what the
editor approved and QA ran on) and `published_audio_sha256` (what a learner downloads), and the
validator checks the published derivative.

**P22-3 · Adapter switch could save an unloadable payload** (2026-08-02). The Studio's script form
applied `model_copy()`, bypassing `RevisionPayload.consistent()`, so switching `tts_adapter` while
lines still carried the previous adapter's voices wrote a revision every later `Store.get()`
rejected — the project became unreachable through its own interface. The form now builds and
validates a complete `RevisionPayload`.

**P22-4 · `bun tauri dev` served no reviewed recording** (2026-08-02). `astro:build:done` never
fires on the dev server, so every recording 404'd in the one command anyone would use to check
playback. Fixed with an `astro:server:setup` middleware serving from `content/listening/`, plus an
`<audio>` `onError` fallback to TTS that also covers a missing or corrupt file in a shipped build.

## Evidence reads

**P5-11 operating cadence, reads of 2026-07-26 / 07-28 / 07-30.** Across all three: production
assembly is the bottleneck (`translate` ~41–43% against `cloze` ~85%), `order` is saturated at 98%
so no new order items, and **every persistent weak focus already has a serving drill** — the owed
action is the learner taking training, not authoring. One correction worth keeping: the
`zu-infinitiv` drill was recorded as "owed" by the 2026-07-26 read when `a2/drill-zu-infinitiv` had
already shipped in #116 the same day; the stale line survived into the next read's first draft. The
2026-07-30 accepts moved `nebensatz-verbende` to 16/48 and flipped it to recovered.

**P5-11a · Lapse-entry review** (2026-07-28) closed clean: the `zu-infinitiv` drill had shipped, and
all four 2+-lapse cards in the flagged decks checked out — `Angebot` and `Aufgabe` fixed by #116's
collision pass, `Kaution` and `Erdgeschoss` collision-free with disambiguated glosses. Simply hard,
left alone per the program rule.

**P3-6 · A1 retention cohort read** (2026-08-02). Ran on its gate date. A1 missed both bars — 1 of 8
readable competences at ≥80% retention, free production at 60% against 70% — with eight further
competences unarmed because the P19-1 backfill lessons were never opened. The read and the rule
amendment it triggered are recorded in [roadmap.md](../roadmap.md#retention-gate).
