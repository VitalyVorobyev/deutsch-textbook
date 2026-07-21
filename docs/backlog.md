# Active Backlog

Companion to [roadmap.md](roadmap.md). Statuses are `todo` → `doing` → `done`. **A finished item
moves to an archive, keeping at most one line here** — done entries never accumulate detail in this
file. Completed P0–P3 items: [the learning-foundations archive](archive/2026-07-learning-foundations.md);
completed Phase 4–10 items: [the phases 4–10 archive](archive/2026-07-phases-4-9.md); the P12–P14
items closed by the 2026-07-20 instrument review and the 2026-07-21 pre-B1 review:
[the instrument-review archive](archive/2026-07-instrument-reviews.md).

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v6 snapshot import and pass the full repository gate. What A2 teaches, in what order,
with which identities, is decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) — read it
before authoring anything.

Phases 0–8 are done: the learning system, the Atlas, complete A1 and A2 curriculum spines (including
the Ukrainian explanation half), the hardened learning loop, the pre-1.0 evidence foundation, the
honest-signal instrument pass, the Schreib-Assistent, and the learner-language machinery. Only
Phase 9 (Entdecken & Referenz) runs in parallel now, and it never gates B1. B1 remains provisional
until representative A2 use, its checkpoint and delayed evidence have been reviewed — the B1 gate
lives in [roadmap.md](roadmap.md).

## Completed work — one line here, detail in the archive

Where a finished item left a live commitment behind, that commitment is the indented bullet under
it; everything else lives in the archive.

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
- **P9-1 · Discovery schema evolution** — `done` 2026-07-15. Provenance-checked `images[]`, online-only
  `links[]`, strict schema, local committed `src` only; see [the phases 4–10 archive](archive/2026-07-phases-4-9.md).
- **P9-4 · Multilingual Wortnetze** — `done` 2026-07-18. Canonical schema, four pilot networks,
  `/referenz/wortnetze` and compact card-back context off the same data; a parallel reference track
  that does not gate B1; see [the phases 4–10 archive](archive/2026-07-phases-4-9.md).
- **Phase 10 · close the A2 grammar standard** — `done` 2026-07-18. Structural coverage moved from 20/30 to 30/30; see [the phases 4–10 archive](archive/2026-07-phases-4-9.md).
- **P11 · A2 linguistic corpus pass** — `done` 2026-07-18. All 30 manifest points are signed off with zero open high/medium findings; see [the QA ledger](a2-linguistic-qa.md).
- **P12-1 · The probe channel was a `translate` monoculture** — `done` 2026-07-20 for A1 and 16 of the
  17 safe A2 topics: 8 A1 `cloze` families (24 items) and 48 A2 cloze items, so a delayed result is
  attributed to the graded token instead of being lost among an eight-decision sentence. Verified by
  rebuilding the families with and without the new files: **zero** taken probes changed their day
  label. See [the instrument-review archive](archive/2026-07-instrument-reviews.md).
  - Open: three A2 topics (`probe-perfekt-haben-sein`, `probe-alltag-tagesablauf`, `probe-modalverben`)
    plus `essen-trinken` after the cohort read; and the outcome under-tagging that leaves two of those
    families arming off a *sibling* outcome — both measured, both blocked on the same `revision`-bump
    hazard, both recorded in the archive.
- **P12-2 · Multi-family arming discarded the older family's cohort** — `done` 2026-07-20. Item-level
  `armingItemKeys` replaced outcome-only arming, which silently re-dated the *existing* family
  (a real 4-day retention result would have been filed as a 1-day one) because 552 of 1221 logged
  attempts carry no `outcomes`. All 34 families' `armedAt` verified unchanged; see [the instrument-review archive](archive/2026-07-instrument-reviews.md).
- **P12-3 · Four smaller instrument findings** — `done` 2026-07-20. B1 grammar inventory authored to
  31 points (honest 0/31, ratcheted); pretest attempts excluded from weakness evidence (**27 tags
  changed error rate**, and the weak set swapped a member); `order` capped at 2 per set; every
  pretest's first item converted `mc` → `cloze` (94% of 100 pretest attempts were correct). See
  [the instrument-review archive](archive/2026-07-instrument-reviews.md).
  - **Not a defect, recorded so it is not mistaken for one:** flashcard direction asymmetry is x-de
    53 lapses / 156 cards vs de-x 5 / 173. Production recall is ~10× harder; FSRS handles it per card.
- **P12-5 · Two source files were invisible to grep** — `done` 2026-07-20. A literal NUL byte in
  `scripts/progress-audit.ts` and `src/lib/grading-decisions.ts` made grep, ripgrep and editor search
  skip both files *silently* while every gate passed; replaced with the escape and pinned by
  `tests/source-hygiene.test.ts`. See [the instrument-review archive](archive/2026-07-instrument-reviews.md).
- **P12-6 · Items that graded which word the author had in mind** — `done` 2026-07-21. Six ambiguous
  *denn*/*weil* `translate` items ruled 4 constrain / 1 accept by asking whether the connector carries
  the tag, and one `table` stub that graded back as *weil weil …*; both rules are validator-enforced
  and were watched failing first. The rule it produced: **an item is determinate only if it is
  determinate when served alone.** See [the instrument-review archive](archive/2026-07-instrument-reviews.md).
  - Deferred: `a2/probe-nebensaetze-plaene:variant-a` has the same defect and is frozen — constraining
    it needs a `revision` bump, which drops its attempt out of the re-graded retention reading before
    2026-08-02. Safe to wait: its one logged attempt used *weil* unprompted, so the ambiguity has not
    yet cost a data point. The validator **warns** rather than passing silently, so the exemption
    cannot be forgotten; remove it and the `DEFERRED` entry in `contracts.test.ts` together.
  - Not repaired: the one logged `konjunktionaladverb-inversion` failure is preserved as a known
    revision mismatch and still reads as a real error in the weak-focus table. `data/grading-decisions.yaml`
    rules `translate` renderings only, so there is no mechanism to retract a `table` attempt. Weight that
    tag accordingly until it has post-fix evidence.
- **P13 · Level placement tests** — `done` 2026-07-20. `role: placement`, one set per level, discovered like checkpoints; per-topic verdicts that take a topic off the path without ever raising its measured tier. 70 items shipped (A1 24, A2 46). Contract in CLAUDE.md; two open limitations below (P13-1 spoken modes, P13-2 offering the next level's test).
- **P13-2 (first half) · An interrupted placement test could not be resumed** — `done` 2026-07-21,
  found by Codex on PR #89. `FirstSteps` gated on `attempts.length === 0` and `logAttempt` fires per
  item, so one answered question hid the only link to the test; the rule is now
  `hasStartedLearning` (`src/lib/placement.ts`), pure and regression-tested. See
  [the instrument-review archive](archive/2026-07-instrument-reviews.md). The second half is open below.
- **P14-1 · Vocabulary cards that printed their own answer** — `done` 2026-07-21. `CardDef.note` now
  reaches the card back, so a construction hint no longer has to hide in the gloss — which is the
  *question* side of a production card. **22 gloss fields flagged before the fix, 0 after**, with no
  cognate caught in either direction (~104 glosses legitimately contain their headword); 4 entries
  gained `accept`; all **3238** card ids unchanged. See [the instrument-review archive](archive/2026-07-instrument-reviews.md).
  - Not repaired, and recorded so the number is not misread: at least one of the 53 x-de lapses is
    instrument rather than learner. There is no retraction mechanism for card attempts —
    `data/grading-decisions.yaml` rules `translate` renderings only — the same gap the P12-6 `table`
    note names.
- **P14-2 · Answers the learner had no way to type** — `done` 2026-07-21. `é` joined the input bar,
  and the rule written to prevent the next one — `checkAnswerIsTypeable` — immediately found **Ä/Ö/Ü**
  missing from it: eleven live cards were a permanent soft miss for anyone without a German keyboard.
  The three copies of the key list are now one `GERMAN_INPUT_KEYS` (`src/lib/typing.ts`). See
  [the instrument-review archive](archive/2026-07-instrument-reviews.md).
  - Worth weighing after 2026-08-02, not now: whether `Cafe` should be a *soft* miss like `ae/oe/ue`
    rather than plain correct. It touches `foldUmlauts`, which is flashcard-only and therefore does not
    move the retention figure — but it does change grading for every card, so it is not a change to
    make in the same breath as a bug fix.
- **P14-3 · Ask whether the retention gate can be read, not only what it says** — `done` 2026-07-21.
  `bun run progress:audit --project YYYY-MM-DD` projects readability forward from arming dates and the
  interval schedule instead of from attempts already taken: **A1 1 readable now, 8 still reachable by
  2026-08-02, 4 not — needing 12 more probe attempts actually taken** (A2: 1 / 8 / 25). See
  [the instrument-review archive](archive/2026-07-instrument-reviews.md).

## The open gate

### P3-6 · Read the A1 retention cohort — `blocked on 2026-08-02` (a calendar gate, not a task)

The engineering half shipped with P3-1: the probe report on Fortschritt, reporting delayed results
apart from practice accuracy and at the interval that *actually* elapsed rather than the scheduled
one. The other half runs on wall-clock. Probes armed on 2026-07-12; the 21-day cohort completes
**2026-08-02**.

**The exit bar, stated so that it can fail:**

> **The A1 delayed probes retain their target competence in ≥ 80% of readable competences, with the
> free-production channel at ≥ 70%.**
>
> **Retained** = the item's graded target survived: correct under today's contract, or wrong with
> the divergence outside the tokens the item's `focus` grades. **Failed** = the target itself
> diverged. Competences group by focus tag, pooled across families, read per level. A competence is
> **readable** only at ≥ 3 attempts (one per scheduled interval); below that it is pending, excluded
> from the percentage, never counted as a pass. An untagged family cannot fail its target by
> construction and is excluded as an instrument gap.

`bun run progress:audit` prints this as *Retention by competence*. The bar's numerator used to be
`correct` — whole-sentence flawlessness — which measures sentence-building rather than retention of
the competence the interval tests. That reading puts the cohort at **18%**; target retention puts it
at **59%**. Neither clears 80%: the restatement makes the gate *readable*, not passed. See
[the roadmap](roadmap.md#the-retention-gate) for why it must not be tuned until it passes.

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

## Open — the 2026-07-20 instrument review and the 2026-07-21 pre-B1 review

### P12-4 · `key_tokens` conflates three different reasons to pin a token — `todo` (M)

A token is pinned for one of three reasons, and the scorer cannot tell them apart:

| Pinned for | Example | Wanted behaviour |
| --- | --- | --- |
| **form** — the tag grades which word this is | `dem` in a `dativ-artikel` item | never forgiven, attributes to `focus` |
| **position** — the tag grades where it sits | `schwimmen` in a `modal-satzklammer` item | forgive a typo; attribute only a *displacement* |
| **presence** — it must be right, but its error belongs to another tag | `geflogen` in a `haben-sein` item | never forgiven, attributes to **nothing** |

All three get form treatment today. There is also a fourth, separate blind spot in the same
function: **`misplacedGraded` requires equal token counts** (`production.ts`), so an *insertion or
deletion* can never be attributed even when it is precisely the confusion the tag grades.

The five wrong attributions live in the log, all four kinds represented:

| Item's tag | Learner wrote | Should be | Today |
| --- | --- | --- | --- |
| `modal-satzklammer` ×2 | `schimmen` for `schwimmen` | forgiven (typo, position pin) | wrong + tagged |
| `haben-sein` | `geflügen` for `geflogen` | `partizip2-form` (presence pin) | wrong + tagged |
| `modal-satzklammer` | `Sie sollten … **zu** nehmen` | tagged — a modal takes a bare infinitive | wrong, **untagged** |
| `passen-dativ` | `Passt **es zu** dir …` for `Passt dir …` | tagged — this *is* the confusion | wrong, **untagged** |

The last two are the length guard, and they are the more serious kind: the scorer is blind to the
drill's own signature error.

**Do not "fix" this by dropping the pins.** All 54 attributions that change if `key_tokens` goes
empty were reviewed one at a time: **52 of the 54 belong to a different tag than the item's** — a
fumbled article inside a perfect `trennbar-modal` bracket, a nominative-for-accusative pronoun
inside a perfect `konjunktionaladverb-inversion`. So the pins cost 5 and buy back 52. The cheap
workaround is ~10× worse than the defect.

Shape: `key_tokens` stays the form list; add optional sibling lists (working names
`position_tokens`, `present_tokens`) rather than a per-token object, so every existing item keeps
parsing unchanged and no revision bump is needed to adopt it. `gradeTranslation` gets three sets
instead of one — rule 1 forgives a one-edit miss on a position token, `misplacedGraded` reads the
position set, and a divergence on a presence token returns `{ kind: 'wrong' }` with no `focus`.
The length guard needs its own answer: align the diff and ask whether a graded token moved
*relative to its neighbours*, rather than requiring the sentences to be the same length.

**Sequencing hazard — both halves must wait for 2026-08-02.** Retrofitting live items bumps
`revision`, which makes `revisionKnownMismatch` stop re-grading those attempts and deletes data
points from the retention reading. **The scorer change is not safe to land early either** — the
retention figure is computed by re-grading, so changing the grader moves the number the gate
reads. Measured: **7 of the 16 probe attempts currently counted as retained are length-mismatched**
(`probe-perfekt-haben-sein`, `probe-alltag-zeit`, `probe-reisen-verkehr`,
`probe-einkaufen-reklamation`, `probe-termine-vereinbaren`, `probe-arbeit-beruf`,
`probe-erste-schritte`) and could flip to failed under the length-guard fix alone. Land the whole
of P12-4 after the cohort is read, and re-read the gate under both graders so the movement is
attributable.

### P13-1 · Placement cannot evidence the spoken modes — `todo` (S), and it is a limitation, not a bug

The placement test scores three response channels — selection, writing and listening — because those
are the three that can be scored at all. `write` and `speak` are validator-rejected in a placement
set: open production is never verified, and since "every item answered" is half the pass condition,
one unscorable item would make its topic permanently *unplaceable*.

The consequence is stated plainly rather than papered over: **32 of A2's 83 outcomes and 13 of A1's
37 are spoken-production or spoken-interaction, and a topic carrying them is placed on written
evidence.** No A1 or A2 topic is spoken-*only* (checked, not assumed), so every topic does get
evidence in a mode it can be graded in — but a learner who writes German far better than they speak
it will place out of topics whose can-do statements are about speaking.

Deliberately not fixed by a mode-coverage rule over the *outcome's* CEFR mode: an ordinary typed item
referencing a `spoken-interaction` outcome would satisfy such a rule while measuring nothing spoken,
which buys the appearance of coverage and none of it. A real fix needs scorable speech, which the app
does not have and which the open-production contract says it must not pretend to have.

### P13-2 (second half) · Offer the next level's placement test — `todo`

`src/pages/index.astro` links `getPlacements()[0]` only, deliberately, so a learner cannot skip to A2
while A1 is untouched (the rule `dueCheckpoint` already encodes). Closing it is the `dueCheckpoint`
analogue — **offer level N+1's test once level N is placed or passed**, surfaced from
`PlacementResults` after *Ergebnis übernehmen*. This half really is a new entry surface with its own
eligibility question: it has to decide what "level N is done" means for a learner who placed out of
half of it, and it must not become a second path the learner feels obliged to walk.

### P14-4 · Two learning-science findings, recorded rather than acted on — measured 2026-07-20

The closed half (open production's revision loop — investigated, **no defect found**, and left alone
because minimal ceremony is the contract) is in
[the instrument-review archive](archive/2026-07-instrument-reviews.md). Two live records remain:

- **Deferred: two more formats have stopped discriminating.** `audio-comprehension` is
  **25/25 = 100%** and `match` **97%** over 55 attempts — the saturation signature that got `order`
  capped at 2 per set in P12-3. Not acted on in this window: converting items is a `revision` bump,
  which drops their attempts out of the re-graded retention reading before 2026-08-02. Revisit with
  P12-4.
- **Not evidence, and not to be planned against.** The audit's *Optional-content feedback* row for
  `discovery:a2/berlin-ubahn-karte` (*useful: no / wants more: no*) is timestamped
  **2026-07-19T09:22Z — 4h38m before #85** fixed the invisible Entdecken toggles, and "off" is exactly
  what a double-press on an unresponsive toggle produces. Treat Entdecken feedback as starting from
  #85; do not plan authoring volume against it.

## Parallel — Phase 9: Entdecken & Referenz

### P9-2 · Entdecken pieces — `todo` (recurring, ~1–2 per PR)

Optional editorial pieces from the fifteen-theme backlog, each passing the editorial test in
[future-content-directions.md](future-content-directions.md) — a language reason to exist, level
control, and no review obligation from opening it:

1. die Berliner Mauer im Stadtbild
2. das Ampelmännchen
3. Pfand und Mülltrennung — shipped
4. die Sonntagsruhe
5. Schrebergärten
6. Deutsch in Österreich und der Schweiz
7. der Verein
8. Brot als UNESCO-Kulturerbe
9. das Deutschlandticket — shipped
10. das Amt als Genre
11. Bauhaus im Alltag — the movement through an everyday object
12. der Döner — migration through a familiar food — shipped
13. die Loreley — the Rhine through a place and a legend
14. Moin, Servus, Grüß Gott — regional German through an encounter — shipped
15. Tatort am Sonntag — a television ritual

Two standing decisions are recorded here rather than as items. **Committed audio stays deferred**
(P5-1 untouched): when the audio schema's `kind: asset` path needs exercising, the cheap path is
one CC-licensed audio asset inside one Entdecken piece, not a TTS replacement program. **Audit
extensions are added only with named consumers** — the grading-decisions integration names P6-1's
queue; the probe-debt row names the P5-11 audits and the P5-7 decision.

- Depends on: P9-1.
- Accept per piece: the editorial test; the validator; no mastery or review-debt semantics.

### P9-3 · Referenz lookup pages — `next` (S — one page left)

Three pages were planned, each derived or canonical — never a second hand-maintained textbook.
**Two shipped in PR #70**: `/referenz/verbformen` (build-time-derived from the vocab YAML —
`praesens_3sg`, `partizip2`, `aux`, `valence` — so the verb table cannot drift from the decks that
teach the verbs) and `/referenz/zahlen-datum-zeit` (numbers, dates and clock time from
`content/reference-data/zahlen-datum-zeit.yaml`, shared with any lesson that needs it). One remains;
match the existing `src/pages/referenz/*.astro` pattern.

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
