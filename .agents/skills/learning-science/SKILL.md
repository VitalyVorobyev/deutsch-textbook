---
name: learning-science
description: >-
  Evidence-based lens for designing or auditing Deutsch-Atlas content and learning
  features. Use for topic articles, exercises, vocabulary, readings, pretests,
  drills, SRS/flashcards, daily sessions, mixed training, progress, mastery, or the
  curriculum spine. Applies retrieval, spacing, interleaving, pretesting,
  explanatory feedback, cognitive load, calibration, comprehensible input,
  productive recall, CEFR action orientation, skill balance, and intrinsic
  motivation. Trigger when evaluating pedagogy, retention, transfer, content
  quality, or gamification, even when "learning science" is not explicitly named.
---

# Learning Science — review & design lens for Deutsch-Atlas

Deutsch-Atlas exists to make German *stick and transfer to real use*, not to feel
productive. This skill encodes the best-tested findings from the science of
learning — with honest labels for how well-tested each one actually is — and
applies them in two modes:

- **Design mode** — authoring or revising content or a feature. Apply the
  principles *as you build*, reusing the mechanisms the app already has.
- **Review mode** — auditing existing content or a feature. Produce concrete,
  ranked findings tied to a named principle and a fix; for course/feature audits,
  ground them in the real snapshot data (mandatory, see below).

First decide which mode the request is (it can be both — design a thing, then
review it). Then work through the relevant section below. The compact principle
table is your working memory; the two reference files hold the depth.

> Content quality is the product. A pedagogically weak topic that validates is
> still a defect — this skill catches what `bun run validate` cannot.

## The four kinds of learning touch

Language learning is not one activity. Every artifact serves (mostly) one of:

- **Input** — comprehending meaningful German: readings, model dialogues,
  worked examples, listening. The goal is *understanding*, and an input artifact
  is not defective for lacking a question on every line.
- **Retrieval** — recalling from memory: flashcards, cloze, dictation, drills.
  The backbone of every *review* artifact — passive re-exposure is not review.
- **Interaction** — exchanges where the learner responds to turns and negotiates
  meaning (dialogue-shaped tasks, appointment calls). A single-learner app can
  only approximate this; approximate it rather than dropping the mode.
- **Production** — constructing German the learner was not just shown:
  `translate`, dictated-from-meaning sentences, free writing (`write`, which
  requires draft → checklist → revision) and speaking (`speak`, with local
  record/replay and a second attempt).

A healthy **unit** feeds all four in a deliberate progression (below). A healthy
**review session** is retrieval-centered. The old house rule "every touch must
produce an answer" is retired — it made input artifacts look broken and pushed
authoring toward recognition quizzes — but its kernel stands: anything that
*claims* to be practice or review must demand retrieval or production.

## The principles (compact)

Full evidence, citations, calibration and trade-offs:
**`references/learning-principles.md`**. Where each lives in the repo:
**`references/deutsch-atlas-map.md`**.

Evidence labels: **strong** = replicated, meta-analyzed, safe to lean on;
**moderate** = well-supported with real caveats; **promising** = solid in the
lab, thinner in classroom/L2 settings — use, but don't oversell; **conditional**
= real only under specific conditions, easy to misapply; **framework** = a
standard for organizing goals, not an experimental finding.

| # | Principle | Evidence | Honored looks like | Anti-pattern |
|---|-----------|----------|--------------------|--------------|
| 1 | **Retrieval practice** | strong | Review artifacts demand recall/production before showing the answer | "Review" that is re-reading; recognition substituting for recall |
| 2 | **Spaced practice** | strong | FSRS revisits at the edge of forgetting; small daily sessions | Review-all-daily, or weekly binge |
| 3 | **Interleaving** | promising | Cross-topic mix of *confusable* rules (Akk vs Dat) | 10 identical items → autopilot; mixing things never confused |
| 4 | **Generation / pretest** | promising | Short, low-stakes pretest before the article | All explanation first; pretest items leaking into training |
| 5 | **Elaboration** | moderate | Reasons + L1/L2 contrast in explanations | Bare rule statements; MT-ese translations |
| 6 | **Explanatory feedback** | strong | Every item's `explain` teaches on wrong answers | "✗ Incorrect" with no why |
| 7 | **Desirable difficulty** | frame | Typed production where production is the goal | Removing all struggle **or** brittle/ambiguous UX |
| 8 | **Worked examples / load / fading** | strong | Model → scaffold → fade → transfer → delayed check | Straight to production; above-level example sentences |
| 9 | **Calibration** | strong | Tiers from measured retrieval; self-rating shown separately | "Read" = "learned"; self-assessment overriding measurement |
| 10 | **Multimedia / dual coding** | conditional | Audio chosen for a listening/phonological purpose | TTS reading visible text sold as "dual coding" (redundancy) |
| 11 | **Comprehensible input** | conditional | Intensive graded readings, glossed, at level | Above-level input; calling short intensive texts "extensive reading" |
| 12 | **Pushed output** | moderate | Typed both-direction cards; production items | Recognition-only; matching so lax nothing is pushed |
| 13 | **Transfer & authenticity** | moderate | Practice in the form of real use, in varied contexts | MC-only training; items answerable by memorizing the item |
| 14 | **Frequency / contrastive** | strong / partial | High-frequency first; named RU→DE confusions (focus tags) | Rare vocab early; assuming every error is interference |
| 15 | **CEFR action orientation** | framework | Can-do outcomes; all four skills/modes get their share | Grammar-only course silently dropping listening/writing |
| 16 | **Self-determination** | moderate | Honest competence signals; soft recommended path | Points/badges/coins; guilt-streaks; hard locks |

The **load-bearing levers** — the ones with evidence strong enough to organize
the product around — are **retrieval, spacing, and explanatory feedback**, plus
the input/output pairing (§11+§12) that any language course lives on.
Interleaving, pretesting, and dual coding are worth having because they are
cheap here, not because they are equally settled — never present them as such.

## The lesson progression (design skeleton for every unit)

**model → scaffold → fade → independent transfer → delayed check**

1. **Model** — comprehensible input showing the target in use: reading/dialogue,
   `## Beispiele`. Support is maximal (glosses, translations).
2. **Scaffold** — blocked practice in the topic's own sets: one confusion per
   item, instruction visible, `explain` on every error.
3. **Fade** — mixed training interleaves the topic against confusables; hints
   and glosses are gone; support that outlives the novice stage *hurts*
   (expertise reversal).
4. **Independent transfer** — production in contexts the learner has not seen:
   `translate` with fresh sentences, `write` with a communicative goal, `speak`
   with a communicative task. New contexts, same rule — never a re-skin of a
   drilled item.
5. **Delayed check** — retention measured later: FSRS reviews, mastery's
   ≥2-day requirement, and the delayed probes (`src/lib/probes.ts`) that re-ask
   an outcome after 2, 7 and 21 days with a parallel variant, opening the daily
   session before any practice can contaminate the interval.

When authoring, place every item you write on this arc; when reviewing, look
for arcs that end at stage 2 (drilled but never transferred or re-checked).

## Mode: Design (authoring or revising)

Follow the `CLAUDE.md` content contract for *structure and schema*; use this
skill for *pedagogical soundness*. They compose — validation is necessary, not
sufficient.

### Topic article
- **Generation (§4):** plan the 3-item `pretest` first — it frames what the
  article must answer. Keep it a guess, not a lesson.
- **Elaboration (§5):** each `<Bilingual>` half is a complete, independent
  explanation with the *why*. RU contrasts with Russian; EN uses L2-internal
  hooks or English false friends. Never machine-translate one half into the other.
- **Worked examples (§8):** `## Beispiele` gives 5–10 models before any exercise;
  every sentence at or below the topic's CEFR level.
- **Outcomes (§15):** the topic's `outcomes` in `content/atlas.yaml` are can-do
  statements — action-oriented ("Ich kann einen Termin absagen"), not
  knowledge-oriented ("I know the dative table"). Content should teach to them.

### Exercise set
- **Contracts:** every set has an explicit `role`; every item references stable
  curriculum outcome IDs. `pretest`, `checkpoint`, and `probe` roles never enter
  ordinary mixed training.
- **Mode fit (§1/§13):** choose the format for the skill: production formats
  (`translate`, `cloze`, `listen`, `write`, `speak`) when production is the
  goal; `mc` for genuine discrimination/comprehension decisions. `order` hands
  the learner every token and asks only for the sequence — it is scaffolded
  first practice for a word-order rule, never a test of one.
- **The item mix is a bar, not a preference (§12/§13):** over the union of a
  topic's `role: practice` sets, `bun run validate` requires at least 2
  `translate` items, keeps `mc` to at most a third, and caps
  `mc`+`match`+`order` at 45%. Recognition items are cheap to write and cheap
  to answer, so a catalog drifts toward them on its own until it stops
  discriminating. Adding items to an existing topic is not free — see the
  `primaryPractice` warning in `CLAUDE.md`.
- **Explanatory feedback (§6):** every item needs a bilingual `explain` — this is
  where the teaching happens.
- **Interleaving-ready (§3/§14):** single-confusion items get a `focus` tag;
  genuinely mixed/comprehension items stay untagged.
- **Scoring granularity:** multi-part items (`cloze`, `match`, `table`) report
  `correctParts`/`totalParts`; `attemptScore` (src/lib/scoring.ts) weights every
  accuracy consumer. Design parts to be independently meaningful — six cells
  that all hinge on one insight are one part pretending to be six.
- **Evidence honesty:** automatically scored answers are `verified`; open
  writing/speaking is `practice`. Practice evidence belongs in activity and
  mode coverage but is excluded from accuracy and mastery.
- **Mode validity:** distinguish the curriculum outcome's target mode from the
  learner's actual response. Written MC can teach a spoken-interaction outcome,
  but it records selected-response evidence, never spoken evidence.
- **Difficulty source (§7):** difficulty comes from the German, never from
  ambiguous prompts or matching that rejects correct variants — maintain `accept`.
- **Blocked first, then mixed (§3/§8):** the topic's own sets may block; the
  eligibility-gated training pool interleaves.

### Vocab file
- **Productive recall (§12):** every entry becomes two cards; the L1→DE typed
  direction is the harder, higher-value rep.
- **Frequency (§14):** high-frequency, communicatively useful words first.
- Schema completeness (gender+plural, verb forms, valence) is pedagogical —
  the productive card can't teach what the data doesn't hold.

### Reading text
- **Decide the `kind` first (§11):** a reading is either *intensive* or
  *extensive*, and the two are different artifacts with different jobs. An
  **intensive** reading (the default) is ~90–130 words, densely glossed and
  mined by 2–4 comprehension questions; density of target structures is a
  feature. An **extensive** reader is 250–400 words with at most 2 gist
  questions and roughly one gloss per 40 words, read straight through for
  meaning — the validator enforces those bounds, because a long text that is
  quizzed line by line is a long intensive text and never delivers the volume
  input it exists for. Never describe an intensive reading as extensive.
- **The volume gap is narrowed, not closed:** five connected *Lena in Bremen*
  episodes now ship across A1–A2. That is a small strand, not a complete extensive-reading
  library; expansion remains backlog P5-2. Say so honestly.
- **Glossing (§11/§8):** enough glosses that comprehension never breaks — 6–10
  in an intensive text, sparse in an extensive one; an unglossed above-level
  phrase is the main failure mode either way.

### Audio (any artifact)
Judge audio by its **listening/phonological purpose**, never as generic
"dual coding": dictation trains the sound→spelling mapping; hearing a dialogue
at natural pace trains parsing connected speech; a pronunciation model attaches
sound to a new word. TTS speaking text the learner is simultaneously reading is
the *redundancy effect* — channel competition, not reinforcement. Ask of every
audio use: what does the ear learn here that the eye doesn't already have?

### Open writing and speaking
- **Revision (§6/§12):** require draft → task-specific checklist/model
  comparison → revised attempt. Revealing a model alone is not feedback use.
- **Speaking:** use model → first attempt → record/replay or explicit say-aloud
  fallback → self-check → improved attempt. Stress, rhythm and
  comprehensibility are targets; IPA and TTS alone are not a pronunciation
  curriculum.
- **Formulaic language:** retrieve high-frequency communicative chunks as
  usable units as well as composing via grammar rules.
- **Assessment honesty:** word count, completion, ASR text and automated AI
  feedback never become verified mastery without task-specific validation.

### Feature design
Reuse existing mechanisms (see the map): spacing → FSRS; interleaving →
MixedTraining over the eligibility-gated pool; sequencing → the spine +
`recommendedNext`; calibration → measured tiers with self-assessment shown
separately. For any new progress/engagement surface apply §9 + §16 as a gate:
does the signal reflect demonstrated learning, or is it a manufactured reward?
And keep the path **soft** — recommendations order, they never lock (§16).

## Mode: Review (auditing)

Audit the target against the principles. Read the actual content — for German,
judge it *as the target learner* (the CEFR level; a Russian native reading the
RU halves; an EN reader who knows no Russian).

1. **Scope & read.** Identify what you're reviewing and read it fully. For a
   feature, read the components/lib that implement it.
2. **Snapshot audit — mandatory for course/feature audits.** Read the newest
   `progress/<profile>/*.json`, report its export date, and warn explicitly when
   it is stale. Then report, as numbers:
   - **attempts per mode/itemType** (`mc`/`cloze`/`match`/`order`/`table`/
     `translate`/`listen`/`audio-comprehension`/`write`/`speak`, reading
     attempts under `reading:*`, probe attempts under `<level>/probe-*`) — the mode
     distribution is the headline finding;
   - attempts per topic (concentration vs spread) and per focus tag;
   - card evidence: graded cards per deck and direction, lapses;
   - what is *missing* (e.g. zero `translate`/`listen` attempts = zero
     measured production/listening, whatever the content offers).
   Distinguish **engagement metrics** (attempts logged, sessions done, streaks)
   from **learning metrics** — the primary criteria are **delayed retention**
   (success on items after a real interval: due-card outcomes, ≥2-day mastery)
   and **novel transfer** (success on variants/contexts not previously seen).
   High engagement with flat delayed retention is a warning, not a success.
3. **Walk the levers.** For each principle: honored, underused, or violated
   *here*? Weight by evidence strength — a retrieval/feedback violation
   outranks an interleaving quibble. Use the map to know what implements what.
4. **Run the item-level checks** (for content):
   - **Curriculum order:** does an item depend on a focus/outcome taught later in
     the spine? If intentional it must be marked as a preview; otherwise it is leakage.
   - **Distractor plausibility (mc):** every wrong option is an error a real
     learner at this level makes; no filler options that shrink the item to a
     coin flip.
   - **Valid alternatives:** try to produce a *correct* answer the key rejects
     (word-order variants, spelling variants); if you can, `accept` is
     incomplete.
   - **Natural German:** would a native say this sentence, in this register?
     No EN/RU calques, no textbook-ese.
   - **Item memorization vs transfer:** could the learner answer from having
     seen *this item* rather than knowing the rule? Look for parallel variants
     and fresh contexts across the set.
   - **Audio quality & purpose:** is the TTS rendering intelligible for this
     text (numbers as words, no abbreviations)? Does the task measure
     listening, or copying visible text?
   - **Scoring granularity:** do multi-part items report parts? Does anything
     still score a 6-cell table like one MC?
   - **Mode validity:** what did the learner actually do? Do not credit written
     selection as speech merely because the outcome targets interaction.
   - **Open-production loop:** does writing/speaking require self-check and a
     revised attempt, or stop after revealing a polished model?
5. **Diagnose by principle, not symptom.** "No measured production: zero
   `translate` attempts despite available items (§12/§13/§15)" beats "add more
   exercises".
6. **Check the tension points** (bottom of the map) — where well-intentioned
   content quietly goes wrong.
7. **Check course navigation:** the learner must see the next meaningful action
   without decoding the dependency graph. Relationships are secondary context.

### Findings format

Report findings ranked by impact on actual learning (a violated strong-evidence
lever outranks polish). For each:

```
### [severity] Short title — §principle(s)
**Where:** file:line or feature/screen
**What:** the pedagogical gap, stated as a principle violation
**Why it matters:** the effect on retention/transfer/motivation (the mechanism)
**Fix:** the concrete change, reusing an existing mechanism where possible
```

Severity = **high** (a strong-evidence lever violated, or content that actively
teaches wrong), **medium** (a lever underused where it easily could apply),
**low** (polish; a weaker or conditional lever). Close with the 2–3
highest-leverage changes.

Be honest when something is *already good* — say so and why, so it isn't
"fixed" into something worse. Not every lever applies to every artifact:
forcing retrieval onto an input text, or audio onto an artifact with no
listening purpose, makes it worse.

## Guardrails

- **Calibrated claims.** Say "strong evidence" only where the label says strong.
  i+1, pretesting, interleaving and dual coding are useful bets, not settled
  law — present them as such, in findings and in docs.
- **Balance, don't maximize.** Every principle has a trade-off line in the
  reference; difficulty, feedback and channels all have overdose effects
  (undesirable difficulty, dependence, redundancy, expertise reversal).
- **Evidence, not vibes.** If you invoke a principle, it's in
  `references/learning-principles.md`. No folk theories (learning styles,
  "visual learners", cramming).
- **This learner, this language.** Vitaly is ~A1/A2→B2, Russian native,
  bilingual EN+RU. The RU lens carries contrastive analysis (§14); the EN lens
  never assumes Russian. Keep CEFR discipline (§8/§11).
- **Not gamified, by design (§16).** No points/badges/rewards; honest
  competence feedback and autonomy. The recommended path stays soft — an adult
  may open any topic at any time; gating only controls what training pulls in
  automatically.
- **Learning metrics rule.** When judging whether anything "works", delayed
  retention and novel transfer are the criteria; engagement numbers are never
  the success measure.
- **Probe/pacing changes must protect measurement validity.** Probes run before
  practice (practice first contaminates the interval), a catch-up must never
  stack so many probes that fatigue confounds the result, and a seen variant is
  never re-presented — that measures recognition of the item, not retention.
