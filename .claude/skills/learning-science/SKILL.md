---
name: learning-science
description: >-
  Evidence-based learning-science lens for reviewing and designing Deutsch-Atlas
  content and features. Use whenever authoring or revising a topic article,
  exercise set, vocab file, reading text, pretest, drill, or any learning feature
  (SRS/flashcards, the daily session, mixed training, the progress dashboard,
  mastery tiers) — it maps each artifact to the best-tested findings: retrieval
  practice, spacing, interleaving, generation/pretesting, explanatory feedback,
  desirable difficulties, cognitive load, calibration, comprehensible input,
  pushed output/productive recall, and intrinsic motivation. Also use to AUDIT
  existing content or a feature against these principles, or when the user asks
  "is this pedagogically sound", "does this follow learning science", "how do I
  make this stick / improve retention", "review this exercise/topic/deck", "is
  this too gamified", or wants better content quality without gamification.
  Trigger even when "learning science" is not named but the task is teaching
  German effectively or judging whether a learning design is sound.
---

# Learning Science — review & design lens for Deutsch-Atlas

Deutsch-Atlas exists to make German *stick*, not to feel productive. This skill
encodes the best-tested findings from the science of learning and applies them in
two modes:

- **Design mode** — authoring or revising content or a feature. Apply the
  principles *as you build*, reusing the mechanisms the app already has.
- **Review mode** — auditing existing content or a feature. Produce concrete,
  ranked findings tied to a named principle and a fix.

First decide which mode the request is (it can be both — design a thing, then
review it). Then work through the relevant section below. The compact principle
table is your working memory; the two reference files hold the depth.

> Content quality is the product. A pedagogically weak topic that validates is
> still a defect — this skill catches what `bun run validate` cannot.

## The principles (compact)

Full evidence, citations, and trade-offs: **`references/learning-principles.md`**.
Where each already lives in the repo: **`references/deutsch-atlas-map.md`**.

| # | Principle | The finding, in one line | Honored looks like | Anti-pattern |
|---|-----------|--------------------------|--------------------|--------------|
| 1 | **Retrieval practice** | Recalling > re-reading; retrieval *is* the learning event | Every touch produces an answer before seeing it | Show answer beside prompt; passive re-read |
| 2 | **Spaced practice** | Same reps spread out beat massed | Scheduler revisits at the edge of forgetting; small daily | Review-all-daily, or weekly binge |
| 3 | **Interleaving** | Mixing types forces *which rule?* discrimination | Cross-topic mix; drills choose *between* confusables | 10 identical items in a row → autopilot |
| 4 | **Generation / pretest** | Guessing before being taught aids the correction | Pretest before the article; guess a gloss | All explanation first, then test |
| 5 | **Elaboration** | "Why", contrast, and prior-knowledge hooks stick | Reasons + L1/L2 contrast in explanations | Bare rule statements; MT-ese translations |
| 6 | **Explanatory feedback** | Retrieval only pays off if errors are corrected *with why* | Every item's `explain` teaches on wrong answers | "✗ Incorrect" with no explanation |
| 7 | **Desirable difficulty** | Harder-now conditions aid long-term retention | Typed production over MC where production is the skill | Removing all struggle **or** adding brittle/ambiguous UX |
| 8 | **Worked examples / load** | Novices need models; manage working-memory load | 5–10 examples; one confusion/item; CEFR ceiling | Straight to production; above-level example sentences |
| 9 | **Calibration** | Fluency feels like knowing; testing corrects it | Progress from real retrieval (tiers, attempts) | "Read" = "learned"; page-view progress bars |
| 10 | **Dual coding** | Complementary channels (verbal+visual+audio) reinforce | Tables, TTS audio, dictation | Audio reading on-screen text verbatim (redundancy) |
| 11 | **Comprehensible input** | Meaningful input at i+1 drives acquisition | Graded reading at level, 6–10 glosses | Above-level vocab → input becomes incomprehensible |
| 12 | **Pushed output** | Producing L2 (esp. L1→DE) beats recognizing it | Typed both-direction cards; `translate`, dictation | Recognition-only; matching so lax nothing is pushed |
| 13 | **Transfer-appropriate** | Practice in the *form* of real use | Produce (typed/spoken) if the goal is production | MC-only training, then expect free production |
| 14 | **Frequency / contrastive** | High-frequency first; pre-empt L1 interference | Focus-tag taxonomy incl. Russian-interference errors | Rare vocab early; ignoring systematic RU→DE errors |
| 15 | **Self-determination** | Autonomy + honest competence + purpose > rewards | Skippable daily session; tiers = real progress | Points/badges/coins; guilt-streaks (overjustification) |

The **five load-bearing levers** (strongest evidence, highest utility): retrieval,
spacing, interleaving, explanatory feedback, and comprehensible input + pushed
output. Everything else tunes how well those land. When you can only check a few
things, check these.

## Mode: Design (authoring or revising)

Follow the `CLAUDE.md` content contract for *structure and schema*; use this
skill for *pedagogical soundness*. They compose — validation is necessary, not
sufficient.

For each artifact, apply the principles that own it:

### Topic article
- **Generation (§4):** it should have a `pretest` (3 `mc` items on the core rules)
  rendered *before* the article. If designing a topic, plan the pretest first — it
  frames what the article must answer.
- **Elaboration (§5):** each `<Bilingual>` half is a *complete, independent*
  explanation with the *why*. RU contrasts with Russian; EN uses L2-internal hooks
  or English false friends ("must not" ≠ *muss nicht*). Never machine-translate one
  half into the other.
- **Worked examples (§8):** `## Beispiele` gives 5–10 models before any exercise.
  Every example sentence stays at or below the topic's CEFR level — an above-level
  word spends the learner's load on decoding instead of the target pattern.
- **Error correction (§5/§6/§14):** `## Häufige Fehler` names the confusion; the RU
  half foregrounds Russian-interference errors, the EN half its own framing.

### Exercise set
- **Retrieval + transfer (§1/§13):** prefer formats that make the learner *produce*
  German (`cloze`, `translate`, `listen`, `order`) over pure recognition when the
  target skill is production. Reserve `mc` for genuine discrimination/comprehension.
- **Explanatory feedback (§6):** *every* item needs a bilingual `explain` — this is
  where teaching happens. An item without one is incomplete, even if it validates.
- **Interleaving-ready (§3/§14):** give each single-confusion item its `focus` tag
  from the taxonomy so mixed training and weakness detection can aim at it later.
  Leave genuinely mixed/comprehension items untagged.
- **Desirable, not undesirable, difficulty (§7):** difficulty should come from the
  German, never from ambiguous prompts or answer-matching that rejects correct
  variants. Use `accept` for real word-order/wording variants.
- **Acquisition vs discrimination (§3/§8):** a brand-new rule earns a little
  *blocked* practice in its own set to form the concept; `/training` and the daily
  session then interleave it against confusables.

### Vocab file
- **Productive recall (§12):** remember every entry becomes *two* cards; the L1→DE
  direction is the harder, higher-value rep — respect that both are first-class.
- **Frequency (§14):** favor high-frequency, communicatively useful words first.
- Schema completeness (gender+plural, verb `partizip2`/`aux`/`praesens_3sg`/
  `valence`) is also *pedagogical* — the productive card can't teach the article or
  the form if the data isn't there.

### Reading text
- **Comprehensible input (§11):** ~90–130 words at the topic's level; 6–10 glosses
  so comprehension never breaks. Above-level vocabulary that *isn't* glossed is the
  main failure mode.
- **Generation + retrieval (§1/§4):** 2–4 `mc` comprehension questions turn passive
  reading into an active check.

### Feature design
Reuse the existing mechanisms rather than inventing parallel ones (see the map):
spacing → FSRS; interleaving → MixedTraining; generation → pretests; calibration →
mastery tiers from real attempts. For any new progress/engagement surface, apply
§9 + §15 as a gate: **does this signal reflect demonstrated retrieval (honest
competence feedback), or is it a manufactured reward?** If the latter, it risks
overjustification — redesign it toward autonomy and honest competence.

## Mode: Review (auditing)

Audit the target (a file, a set of files, or a feature) against the principles.
Read the actual content — for German content, judge it *as the target learner*
(the CEFR level; a Russian native reading the RU halves).

1. **Scope & read.** Identify what you're reviewing and read it fully. For a
   feature, read the components/lib that implement it.
2. **Walk the levers.** For each principle in the table, ask: honored, underused,
   or violated *here*? Weight the five load-bearing levers most. Use
   `references/deutsch-atlas-map.md` to know what implements each one.
3. **Diagnose by principle, not symptom.** Name the underlying principle — "no
   pushed output: the deck is recognition-only (§12/§13)" beats "add more cards".
4. **Check the tension points** (bottom of the map): matching strictness, blocking
   vs interleaving, honest-vs-gamified progress, input level. These are where
   well-intentioned content quietly goes wrong.

### Findings format

Report findings ranked by impact on actual learning (a violated load-bearing lever
outranks a minor polish). For each:

```
### [severity] Short title — §principle(s)
**Where:** file:line or feature/screen
**What:** the pedagogical gap, stated as a principle violation
**Why it matters:** the effect on retention/transfer/motivation (the mechanism)
**Fix:** the concrete change, reusing an existing mechanism where possible
```

Severity = **high** (a load-bearing lever violated, or content that actively
teaches wrong), **medium** (a lever underused where it easily could apply),
**low** (polish; a smaller lever). Close with the 2–3 highest-leverage changes.

Be honest when something is *already good* — say so and why, so it isn't
"fixed" into something worse. Not every lever applies to every artifact; forcing
retrieval onto a reference table or gamifying an honest streak makes it worse.

## Guardrails

- **Balance, don't maximize.** The skill is about *trade-offs* (see each
  principle's trade-off line). Adding difficulty, feedback, or channels past the
  point of usefulness *hurts* (undesirable difficulty, feedback dependence, the
  redundancy and expertise-reversal effects).
- **Evidence, not vibes.** If you invoke a principle, it's one of the tested ones
  in `references/learning-principles.md`. Don't smuggle in folk theories (learning
  styles, "some people are visual learners", massed cramming).
- **This learner, this language.** Vitaly is ~A1/A2→B2, Russian native, bilingual
  EN+RU. The RU lens carries contrastive analysis (§14); the EN lens must never
  assume Russian. Keep CEFR discipline (§8/§11).
- **Not gamified, by design.** §15 is a first-class constraint, not an afterthought
  — resist any suggestion to add points/badges/rewards; prefer honest competence
  and autonomy.
