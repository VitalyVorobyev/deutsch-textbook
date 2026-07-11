---
name: learning-science
description: >-
  Evidence-based learning-science lens for reviewing and designing Deutsch-Atlas
  content and features. Use whenever authoring or revising a topic article,
  exercise set, vocab file, reading text, pretest, drill, or any learning feature
  (SRS/flashcards, the daily session, mixed training, the progress dashboard,
  mastery tiers, the curriculum spine) — it maps each artifact to the best-tested
  findings: retrieval practice, spacing, interleaving, generation/pretesting,
  explanatory feedback, desirable difficulties, cognitive load, calibration,
  comprehensible input, pushed output/productive recall, CEFR action orientation
  and four-skill balance, and intrinsic motivation. Also use to AUDIT existing
  content or a feature against these principles, or when the user asks "is this
  pedagogically sound", "does this follow learning science", "how do I make this
  stick / improve retention", "review this exercise/topic/deck", "is this too
  gamified", or wants better content quality without gamification. Trigger even
  when "learning science" is not named but the task is teaching German
  effectively or judging whether a learning design is sound.
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
  `translate`, dictated-from-meaning sentences, free writing (planned `write`).

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
   `translate` with fresh sentences, `write` (planned) with a communicative
   goal. New contexts, same rule — never a re-skin of a drilled item.
5. **Delayed check** — retention measured later: FSRS reviews, mastery's
   ≥2-day requirement, delayed probes with parallel variants (Phase 3).

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
- **Mode fit (§1/§13):** choose the format for the skill: production formats
  (`cloze`, `translate`, `listen`, `order`) when production is the goal; `mc`
  for genuine discrimination/comprehension decisions.
- **Explanatory feedback (§6):** every item needs a bilingual `explain` — this is
  where the teaching happens.
- **Interleaving-ready (§3/§14):** single-confusion items get a `focus` tag;
  genuinely mixed/comprehension items stay untagged.
- **Scoring granularity:** multi-part items (`cloze`, `match`, `table`) report
  `correctParts`/`totalParts`; `attemptScore` (src/lib/scoring.ts) weights every
  accuracy consumer. Design parts to be independently meaningful — six cells
  that all hinge on one insight are one part pretending to be six.
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
- **Intensive graded input (§11):** the current readings are *intensive* input —
  ~90–130 words, glossed, mined by comprehension questions. Author them as
  such: density of target structures is a feature. Do **not** call this
  extensive reading; the extensive-reader gap (long, easy, volume-driven texts)
  is a known hole scheduled as Phase 4 (backlog P4-2).
- **Glossing (§11/§8):** 6–10 glosses so comprehension never breaks; an
  unglossed above-level phrase is the main failure mode.

### Audio (any artifact)
Judge audio by its **listening/phonological purpose**, never as generic
"dual coding": dictation trains the sound→spelling mapping; hearing a dialogue
at natural pace trains parsing connected speech; a pronunciation model attaches
sound to a new word. TTS speaking text the learner is simultaneously reading is
the *redundancy effect* — channel competition, not reinforcement. Ask of every
audio use: what does the ear learn here that the eye doesn't already have?

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
   `progress/<profile>/*.json` and report, as numbers:
   - **attempts per mode/itemType** (`mc`/`cloze`/`match`/`order`/`table`/
     `translate`/`listen`, reading attempts under `reading:*`) — the mode
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
5. **Diagnose by principle, not symptom.** "No measured production: zero
   `translate` attempts despite available items (§12/§13/§15)" beats "add more
   exercises".
6. **Check the tension points** (bottom of the map) — where well-intentioned
   content quietly goes wrong.

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
