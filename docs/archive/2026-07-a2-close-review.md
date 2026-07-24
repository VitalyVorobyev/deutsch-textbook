# A2 study-close review — 2026-07-24

The learner finished studying all seventeen A2 units and took the A2 checkpoint on 2026-07-24.
This is the milestone review: what the evidence says, what was triaged and shipped from it, and
the recorded decision to begin B1 authoring before the delayed-evidence reviews. Every figure
comes from `bun run progress:audit --profile vitaly` against `progress/vitaly/2026-07-24.json`
(v6, committed in this change) unless a different command is named.

## Headline

- **Engagement:** 1747 attempts, 14 sessions, 154 reading-question attempts, 32 topics touched.
- **The checkpoint was taken in one sitting** (22 items in ~22 minutes, morning of 2026-07-24):
  18/21 verified items correct (86%), errors on one cloze and two translates — one of them the
  `meiner neuen Adresse anmelden` case error ruled in this change — plus one write task recorded
  as practice evidence, never verified mastery. Command:
  `jq '[.attempts[] | select(.setId=="a2/checkpoint-a2")]' progress/vitaly/2026-07-24.json`.
- **Delayed retention, the metric that matters:** 340/440 delayed repeats (≥2 days) correct
  (77%). Novel probes: 24/62 correct under the current contract, 17 more retained the graded
  target while missing elsewhere, 21 failed the target.
- **The learner's own report:** learning with Russian-primary explanations "feels like actual
  learning." The bilingual voice is doing its job and stays the default for B1.

## The instrument was the bottleneck, twice

- **Probe pacing.** 33 probes due, 30 of them overdue; actual first-interval delays ran 8–9
  days (8d ×15, 9d ×9) against the nominal 2/7/21. The caps (3/session, 5/day), not the
  learner, were setting the pace — they were raised to 5/12 in PR #97, which also closed the
  cross-surface leak that had allowed 8 probes on the peak day.
- **Withheld attempts.** 24 renderings sat in the grading queue; until this change drained it,
  `translate` read 44% while every other type read 77–100% — a number about the queue, not the
  learner. Post-triage the queue is empty (111 rulings total, 0 awaiting).

## Grading triage (this change)

22 renderings ruled into `data/grading-decisions.yaml` (2026-07-24 block; two of the queue's 24
rows were duplicates of one item): **4 accepts**, each paid with an accept-list entry and a
revision bump — the full-sentence *Wir warten auf die Antwort*, the idiomatic *Mein Zug fällt
aus*, the family-name *zu Oma*, and *Ich fahre nicht mit* (the most literal rendering of the
Russian prompt) — and **18 confirms**, mostly genus/case errors and misspellings (*nach View*,
*Mondag*, *Schuche gefalen*). One item improvement rode along: *Welche Schuhe gefallen **Ihnen**
am besten?* joins the accept list — English *you* fixes no person, the same reasoning as
`translate-worauf`.

## Weak focuses and the two new drills

Post-triage, the same ten focuses remain persistent (table unchanged by the rulings — the
confirmed errors were already attributed). Eight had owned drills in rotation; the two that did
not both still met the program bar (errors across ≥2 items + recent or probe evidence):

- **`a2/drill-da-wo-woerter`** (11 items) — wo(r)- asks, da(r)- refers, people take preposition
  + pronoun; probe evidence and no recovery since the last error.
- **`a2/drill-indirekte-frage`** (11 items) — verb-final in embedded questions and the ob/wenn
  («ли»/«если») trap; 7 recent errors across 6 items.

Watch items, not drills (decision rules: review before duplicating): `dativ-praepositionen` and
`akkusativ-pronomen` show no recovery despite owned drills — review those drill sets if the next
audit still shows no recovery. The genus/article confirm cluster (kein Zeit, meinen Schicht, Der
Jacke, ins Keller) is already `drill-der-dem-den` territory. Recurring in rulings twice:
reflexive *sich* dropped on *anmelden* — a sich-verb drill candidate if it recurs at B1.

## Retention readability, honestly

Readable now: 4 A1 and 2 A2 competences (of 13 / 34 with any probe data). The A1 cohort read
stays calendar-gated on 2026-08-02; `bun run progress:audit --profile vitaly --project 2026-08-02`
says reaching the remaining rows needs the probe attempts actually taken — the 5/12 caps exist
so that is possible. Single-family competences cap at exactly 3 attempts ever, the readability
floor with no margin; widening that is second-family authoring work, which is deliberately
**post-08-02** (a second family re-arms its topic — `armedAt` must be measured before and after).

Cards: 374 graded; lapses 78 `x-de` vs 5 `de-x` — the expected production asymmetry, monitored,
not acted on. Open production stays minimal-ceremony: 22 write and 11 speak attempts logged as
practice evidence. Measured listening: 85 `listen` + 37 `audio-comprehension` attempts.

## The recorded decision: B1 authoring begins now

The operating program said *freeze B1 identities after the checkpoint's 2/7/21-day evidence
review, not before*, and roadmap gates 1–3 were still pending. On 2026-07-24 the owner decided
to begin B1 authoring immediately. The rule is overridden, not ignored — same shape as the
recorded A2 precedent ("A2 authoring proceeded before the read on purpose"):

- Gates 1–3 convert to dated **revision triggers**: the 2026-08-02 A1 cohort read and the
  ~2026-08-14 checkpoint delayed-evidence review each may stop B1 authoring and send shipped B1
  units back for revision. Gates 4–5 were met in this change (queue empty, no drill-less
  persistent focus).
- The accepted risk, named: B1 identities frozen and units written before those reads may need
  rework if either read fails its bar.
- What the override does **not** unlock: the revision-bump lock on pre-08-02 cohort items
  (P12-6) and the P12-4 scorer fix stay calendar-bound — they protect the instrument, not the
  authoring schedule.

Follow-up dates: checkpoint delayed evidence at 2026-07-26 / 2026-07-31 / ~2026-08-14; A1
cohort read on or after 2026-08-02.
