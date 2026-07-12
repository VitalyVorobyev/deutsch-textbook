# Where each learning lever lives in Deutsch-Atlas

The map from principle → the concrete artifact or file that implements it. Use it
two ways:
- **Review:** to know *what to inspect* when auditing a principle ("is retrieval
  practice honored?" → look at exercise types + flashcard directions).
- **Design:** to know *what to reuse* instead of reinventing ("this topic needs a
  generation step" → add a `pretest`, don't invent a new mechanism).

If a file path here disagrees with the repo, trust the repo — this map is a guide,
not a spec. `CLAUDE.md` is the authoritative content/authoring contract.

## Principle → implementation

| Principle | Lives in | Notes |
| --- | --- | --- |
| **Retrieval practice** (§1) | `content/exercises/**`, flashcards (`src/components/srs/`, `src/lib/srs.ts`), typed input (`src/lib/typing.ts`) | Every vocab entry → two cards; review artifacts demand production. Input artifacts (readings, Beispiele) are paired with retrieval, not converted into it. |
| **Spaced practice** (§2) | FSRS scheduler `src/lib/srs.ts`; daily session `src/components/session/SessionFlow.tsx`; `sessions` log in `src/lib/store.ts`; mastery's ≥2-day rule (`src/lib/mastery.ts`); delayed probes `src/lib/probes.ts` | Small daily sessions; mastery requires multi-day evidence, not one massed day. A due probe opens the session as step 0, before review and training — a probe answered after twenty minutes of practice on the same material measures the practice, not the interval. |
| **Interleaving** (§3) | `/training` `src/components/training/MixedTraining.tsx` over the **eligibility-gated pool** (`src/lib/training.ts` `eligibleTrainingSets`) | Never two consecutive items from one topic; pool limited to opened/practiced/recommended-next topics — pretests never enter. Priority: recently-wrong → weak focus → never-attempted. |
| **Generation / pretest** (§4) | Topic `pretest` field → `content/exercises/<level>/<id>-pretest.yaml`; "Was weißt du schon?" callout | 3 `mc` items before the article; excluded from training and from mastery accuracy (guesses by design). |
| **Elaboration** (§5) | `<Bilingual><En>/<Ru></Bilingual>` prose; RU half contrasts with Russian, EN half uses L2-internal hooks | Two independent, complete explanations — divergence is a feature. |
| **Feedback** (§6) | Every exercise item's `explain` (bilingual), shown on wrong answers | "Where the teaching happens." Missing/empty `explain` is a defect. |
| **Desirable difficulties** (§7) | Typed production (EN/RU→DE) over MC; strict-but-fair matching `src/lib/typing.ts` | The typed-input decision *is* a desirable-difficulty decision. |
| **Worked examples / load / fading** (§8) | Article skeleton `## Beispiele` (5–10 examples); CEFR ceiling; one-confusion-per-item; the arc model→scaffold→fade→transfer→delayed check across article → topic sets → mixed training → SRS | Support is heaviest in the article, absent in training. Every topic follows the lesson cycle; `CLAUDE.md` holds the convention. |
| **Metacognition / calibration** (§9) | Measured tiers `src/lib/mastery.ts` (`topicTier`/`masteryGaps`); **self-assessment split**: manual `learned` is a separate self-rating that never raises the measured tier, `reopened` only caps down (`effectiveTier`); dashboard `src/components/progress/` | Tiers derive from attempts + cards + days. The self-rating is displayed *next to* the measured tier, never merged into it. |
| **Multimedia / dual coding** (§10) | Grammar tables (German, outside Bilingual); gender-color conventions | Tables are the spatial channel for verbal rules. **Audio is not filed here** — see the next row; TTS reading visible text is the redundancy anti-pattern. |
| **Listening & phonology** (§10–§13) | TTS `src/lib/speech.ts` + `SpeakerButton`/`SpeakButton.astro`; `listen` dictation; `audio-comprehension`; flashcards' "Hören" mode; vocab `ipa` | Each audio use has a stated ear-purpose. Audio comprehension hides the transcript and visibly relabels its no-audio fallback as reading. |
| **Comprehensible input — intensive & extensive** (§11) | Graded readings `content/reading/**` → `ReadingText.tsx`; `[[phrase::en::ru]]` glosses; each reading's `kind` (`intensive` or `extensive`); CEFR discipline | An **intensive** reading is ~90–130 words, 6–10 glosses, 2–4 comprehension questions. An **extensive** reader is 250–400 words, at most 2 gist questions and roughly one gloss per 40 words — bounds the validator enforces, because a long text quizzed line by line is just a long intensive text. One pilot reader ships (`content/reading/a1/lena-1-der-erste-tag.yaml`); the gap now is volume, not existence — a series is backlog P5-2. Never call an intensive reading extensive. |
| **Pushed output / productive recall** (§12) | EN/RU→DE typed flashcards; `translate`; `listen`; revision-based `write`; local record/replay `speak`; the **item-mix bar** in `scripts/validate.ts` | `write` and `speak` log practice evidence, not verified accuracy. Audit measured and unverified output separately, using the actual `responseMode`. The bar is enforced per topic over the union of its `role: practice` sets — at least 2 `translate` items, `mc` at most a third, `mc`+`match`+`order` at most 45% — so a new unit cannot drift back into a recognition quiz. |
| **Transfer / authenticity / varied contexts** (§13) | `translate`, `listen`, typed production; drills in fresh contexts; delayed probes with parallel variants (`src/lib/probes.ts`, `content/exercises/a1/probe-*.yaml`) | Watch for items answerable from item memory. A probe family holds several parallel variants of the same outcome (`variant-a`, `variant-b`, …) and `nextVariant()` serves one the learner has not met, so an outcome is re-checked without recycling the identical item. |
| **Frequency / contrastive** (§14) | Vocab ordering; the **focus-tag taxonomy** in `CLAUDE.md`; RU explanation halves; weakness detection `src/lib/weakness.ts`, trends `src/lib/trends.ts`; free-production scoring `src/lib/production.ts` + an item's `key_tokens` | Focus tags name the confusions, incl. L1-interference (`kopula-sein`, `artikel-pflicht`, case transfer). The weakness signal is only worth aiming at if it is true: a one-token near-miss outside the tokens the tag grades is a spelling slip (shown, scored correct, no focus error), and a real failure is attributed to the `focus` tag only when a token that tag grades is what diverged. An honest gap in the signal beats a false entry in it. |
| **CEFR action orientation / mode balance** (§15) | Per-topic can-do `outcomes` in `content/atlas.yaml`; item-type spread per set (validator nudges ≥3 types); the snapshot mode-distribution audit (below) | Outcomes are actions, not knowledge claims. Mode balance is judged from logged attempts, never from the catalog. |
| **Curriculum spine / sequencing** | `content/atlas.yaml` `units:` (file order = spine) → `src/lib/curriculum.ts` `getCurriculum()`; `recommendedNext` in `src/lib/mastery.ts`; consumed by NextTopic, training + fresh-card gating | One suggestion function; first spine topic below mastered. The path is **soft** — it orders recommendations and automatic pulls, it never locks content (§16). `deepens` edges mark spiral revisits; they are declared and validated, but training does not yet act on them (backlog P4-2). |
| **Scoring granularity** (§9/§13) | `attemptScore`/`scoreTotal` in `src/lib/scoring.ts`; `correctParts`/`totalParts` on attempts (`src/lib/store.ts`), emitted by `Cloze`/`Match`/`TableFill` | Partial credit exists and every accuracy consumer is parts-weighted (weakness, mastery gaps, trends, dashboards, end-of-run summaries). A 6-cell table is no longer one coin flip — new item types must keep this contract. |
| **Self-determination / anti-gamification** (§16) | Skippable "nothing to decide" session; honest heatmap + streak; measured tiers; soft recommended path; local profiles + data ownership `src/lib/profile.ts` | No points/badges/coins. Streak informs, does not punish. Eligibility gating controls automatic pulls only — the learner may open anything. |

## The snapshot audit (mandatory in review mode for features/course)

Read the newest `progress/<profile>/*.json` (historical folder:
`progress/vitaly/`) and report **numbers**, not impressions:

1. **Attempts per mode/itemType** — count `mc`, `cloze`, `match`, `order`,
   `table`, `translate`, `listen`, `audio-comprehension`, `write`, `speak` (and
   `reading:*` setIds), and read each attempt's own `evidence` and
   `responseMode` rather than inferring them from the item type. This is the
   headline: a course can offer production while the learner logs none.
2. **Concentration** — attempts per topic and per focus tag; one topic
   absorbing most attempts is a sequencing/eligibility finding.
3. **Card evidence** — graded cards per deck and per direction (`::x-de` vs
   `::de-x`), lapses; zero productive-direction reps is a §12 finding.
4. **Score quality** — use `attemptScore` semantics (parts-weighted); perfect
   MC streaks are calibration warnings, not competence evidence.
5. **Engagement vs learning** — attempts, sessions and streaks are engagement.
   The learning metrics are **delayed retention** (probe attempts at 2/7/21
   days, reported at the interval that actually elapsed; due-card outcomes; the
   ≥2-day mastery requirement) and **novel transfer** (success on variants and
   contexts not seen before). Report both classes separately and never let the
   first stand in for the second.

## The personalization loop (error-driven learning made operational)

Principles §1/§3/§14 combine in the loop documented in `CLAUDE.md` → "Drills from
progress":
1. Read newest `progress/<profile>/*.json`; aggregate **parts-weighted** error
   rates per focus tag (same logic as `weakFocuses` in `src/lib/weakness.ts`:
   last ~30 attempts, weak = ≥4 attempts and ≥35% errors) and high-`lapses` cards.
2. Diagnose by the *confusion* (the focus tag names it), not the individual item.
3. Author a drill set targeting that confusion, tag every item, attach it to the
   topic. Future snapshots keep measuring the same tag → closed feedback loop.

This is retrieval practice (§1) aimed by real calibration data (§9), interleaved
(§3), at the learner's specific L1-interference and developmental errors (§14).

## Known tension points to watch (where levers pull against each other)

- **Matching strictness (§7 vs §12):** too lenient → no pushed output; too
  brittle → extraneous load. `src/lib/typing.ts` is the balance point; `accept`
  lists are the balance point for `translate`/`order`/`listen`.
- **Interleaving vs initial acquisition (§3 vs §8):** a brand-new rule needs a
  little blocked practice before mixed drills discriminate it. Topic-owned sets
  block; training and the session interleave.
- **Generation vs frustration (§4 vs §6):** pretests must be short, low-stakes,
  immediately corrected — and must stay out of every practice pool.
- **Progress signals (§9 vs §16):** a tier or streak must reflect demonstrated
  retrieval. The self-assessment split exists precisely so confidence and
  measurement can disagree *visibly*.
- **Recommended path vs autonomy (§15 vs §16):** the spine orders and gates
  automatic pulls (training pool, fresh cards); it must never lock a topic or
  shame a detour. If a gating change would prevent a learner from deliberately
  opening content, it has crossed the line.
- **Input level (§11 vs §8):** every above-level word in a reading/example
  spends load on decoding instead of the target pattern. CEFR ceiling is the
  guard.
- **Audio purpose (§10 vs §8):** audio that duplicates visible text competes
  with reading (redundancy). Audio must carry something the eye doesn't have —
  or be dropped.
