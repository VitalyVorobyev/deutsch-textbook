# Active backlog

Status: active. The [roadmap](roadmap.md) owns direction; this file contains only executable or
calendar-blocked work. Completed detail through 2026-07-26 is
[archived](archive/2026-07-backlog-full.md).

## Visual work completed in this PR

### P17-2–3 · Sentence, time and route families — done 2026-07-26

The accepted, responsive Wohnen pilot now has three deterministic successor families:

1. a sentence rail for V2, separable verbs, modal/Perfekt brackets, verb-final
   clauses, indirect questions and `zu`-infinitives;
2. a clock/preposition visual and a `seit`/`vor` timeline;
3. a city-route map for `geradeaus` and the second street, plus a travel contrast for
   `mit dem Zug`, `in den Zug` and `im Zug`.

Generated pixels carry no load-bearing language. Exact labels belong to HTML/SVG; viewing creates
no evidence. All families passed semantic, accessibility and 320–1100 px overflow review.
Body/participant roles and task-bound apartment, form and receipt additions shipped in P17-4.

## Doing

### P5-11 · Evidence-led operating cadence

After every two B1 units: drain the grading queue, rerun `bun run progress:audit --profile vitaly`,
then decide whether content or drills need revision. Never author from a pre-triage focus table.

### P9-2 · Entdecken pieces

Recurring, at most one or two reviewed pieces per PR. Each must pass the editorial and provenance
contract in [future-content-directions.md](future-content-directions.md).

## Calendar gates

### P3-6 · Read the A1 retention cohort — blocked until 2026-08-02

Run `bun run progress:audit --profile vitaly --project 2026-08-02`, then the current audit. Read
only competences with at least three attempts. Pass bar: at least 80% of readable A1 competences
retain their target, with free-production retention at least 70%. A miss stops B1 authoring and
opens revision work; it does not retroactively alter logged evidence.

### A2 checkpoint review — approximately 2026-08-14

Review the checkpoint’s completed 2/7/21-day evidence as a B1 revision trigger.

## Open

- **P12-4 · Separate `key_tokens` purposes** — distinguish focus attribution, target-retention
  scoring and answer constraints without changing the pre-2026-08-02 cohort underneath it.
- **P13-1 · Spoken-mode placement evidence** — document or prototype only when the app can collect
  mode-valid evidence; written selection must never masquerade as speech.
- **P13-2 · Next-level placement offer** — surface a newly available level test without hard-locking
  the learner.
- **C6-1 · Ukrainian calque audit** — review halves written before the German-first authoring
  ruling; language quality, not alphabet parity, is the target.
- **P5-7 · Listening retention pilot** — after the A1 gate, pilot only
  `termine-vereinbaren` and `reisen-verkehr`, then observe a complete 2/7/21-day cycle.

## Deferred

- committed neural-TTS expansion;
- pronunciation assistance;
- runtime mission grouping;
- branching missions.

These require a measured learning or usability need. They do not block the curriculum.

## Recently completed

- **P9-2 (2026-07-26):** two reviewed Entdecken pieces—reading a simulated Behördenbrief and
  understanding the shared-space structure of Schrebergärten.
- **P17-3 (2026-07-26):** responsive route and train-movement semantic figures.
- **P17-4 (2026-07-26):** body pain, body-care and giver–recipient role figures; task-bound
  apartment listing, registration form and receipt/product-comparison practice.
- **P17-1 (2026-07-26):** responsive Wohnen semantic figures, multilingual text equivalents and
  provenance guard.
- **B1.1–B1.3 (2026-07-24/25):** first three units under the frozen B1 contract.
- **A2 close (2026-07-24):** checkpoint taken; B1 authoring began with dated revision triggers.
