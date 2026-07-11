# Backlog

Companion to [roadmap.md](roadmap.md). Items carry stable IDs (`P<phase>-<n>`), a size
(S ≈ ≤half day of agent work, M ≈ a day, L ≈ multi-session), dependencies, files touched, and an
acceptance check. Every item must leave `bun run validate` green; code items must not break
import of existing v1–v3 progress snapshots.

Statuses: `todo` → `doing` → `done`. Update this file in the same change that closes an item.

## Phase 0 — Correctness & honesty fixes

### P0-1 · Training eligibility filter — `done` (M)

Exclude pretests and never-opened topics from mixed training and the daily session pool.

- Pretest sets (`*-pretest` / any set referenced by a topic's `pretest` field) never enter the
  pool. Non-pretest sets are eligible only when their topic is opened (`topics[id].readAt` in
  the store) **or** is the current recommended-next topic.
- Note: "opened" is learner state in IndexedDB, so the filter must run client-side in
  `MixedTraining` — the `.astro` pages can only annotate sets (e.g. `isPretest`, `topicId`).
- Files: `src/pages/training.astro`, `src/pages/session.astro`,
  `src/components/training/MixedTraining.tsx`, `src/lib/store.ts` (read helper if missing).
- Depends on: — (P0-3 refines what "recommended-next" means; use current suggestion until then).
- Accept: with a fresh profile that has read only `praesens-wortstellung`, `/training` and the
  session serve items exclusively from that topic's non-pretest sets (+ recommended-next);
  pretest item ids never appear in logged attempts with training/session origin.

### P0-2 · Fresh-vocab gating — `done` (M)

New (never-graded) cards enter the queue only from opened or recommended-next topics; due cards
are always reviewed regardless of origin.

- Map deck → owning topic(s) via topic frontmatter `vocab: [ids]` (`getTopicNodes()` already
  carries `vocabIds`). Decks referenced by no topic (e.g. `kernwortschatz-a2`) are gated by
  their `level`: fresh cards become eligible once ≥1 topic at that level has been opened.
- Explicit navigation to `/vocab/<deck>` remains an opt-in override — studying a deck directly
  is a deliberate act and stays ungated.
- Files: `src/lib/srs.ts` (`splitQueue` or a filter before it),
  `src/components/srs/FlashcardSession.tsx`, `src/components/session/SessionFlow.tsx`,
  `src/pages/review.astro` → later `/ueben` (pass topic-deck mapping down).
- Depends on: —
- Accept: fresh profile, no topics read → `/review` offers 0 new cards from A2 decks; after
  opening `essen-trinken`, its deck's fresh cards appear; already-due cards from any deck
  always appear.

### P0-3 · Unify next-topic selection with real mastery — `done` (S)

Retire the attempts-only `topicMastery()` shortcut; `suggestNextTopic` consumes the same
tier logic as the dashboard (`topicTier`/`effectiveTier`), which needs attempts + cards + topics
state as inputs.

- Files: `src/lib/mastery.ts` (delete `topicMastery`, rework `suggestNextTopic` signature),
  `src/components/today/NextTopic.tsx` (load card/topic state alongside attempts).
- Depends on: — (P0-5 changes what `effectiveTier` means; keep in sync if concurrent).
- Accept: a topic massed in one day (5 correct attempts, no reviewed cards) is *not* treated as
  mastered for sequencing; NextTopic and the Fortschritt topic list never disagree on a
  topic's tier.

### P0-4 · Partial-credit scoring (`correctParts`/`totalParts`) — `done` (M)

Add optional `correctParts`/`totalParts` to `Attempt`; multi-part items report them; accuracy
math weights parts. `correct` stays and means "fully correct" (back-compat).

- Emitters: `Cloze` (per gap), `Match` (`max(0, pairs − errors)` — errors are unbounded, credit
  must clamp at zero), `TableFill` (per asked cell); single-part types (`mc`, `order`,
  `translate`, `listen`) omit the fields. Plumb through the `onResult` payloads in
  `ExerciseSet.tsx` and `MixedTraining.tsx`.
- Consumers: one shared helper (`attemptScore(a): number` — `correctParts/totalParts` when
  present, else `correct ? 1 : 0`) used by **every** accuracy aggregation: `src/lib/weakness.ts`,
  `masteryGaps` in `src/lib/mastery.ts`, `dailyActivity`/`focusTrends` in `src/lib/trends.ts`,
  the dashboard's headline accuracy + session log (`src/components/progress/`), and the in-run
  end-of-set summaries in `ExerciseSet.tsx` and `MixedTraining.tsx` (currently
  `answered.filter((a) => a.correct).length`). No consumer may keep treating a partial as a
  full miss. `totalParts`, when present, must be ≥ 1 (schema-enforced) so `attemptScore` can
  never divide by zero.
- Files: `src/lib/store.ts`, `src/components/exercises/{Cloze,Match,TableFill}.tsx`,
  `src/components/exercises/ExerciseSet.tsx`, `src/components/training/MixedTraining.tsx`,
  `src/lib/weakness.ts`, `src/lib/mastery.ts`, `src/lib/trends.ts`, `src/components/progress/`.
- Depends on: —
- Accept: a 5-of-6 table attempt logs `{correct: false, correctParts: 5, totalParts: 6}`;
  weakness error-rate for its focus tag moves by 1/6, not 1, and the dashboard/trends **and the
  end-of-run summary screens** show the same parts-weighted number; a match with more errors
  than pairs logs `correctParts: 0`, never negative; importing the existing
  `progress/vitaly/2026-07-10.json` snapshot still works and old attempts score as before.

### P0-5 · Self-assessment separated from measured mastery — `done` (S)

The manual `learned` flag no longer maps to the mastered tier; it becomes a visibly separate
self-rating shown next to the measured tier. `reopened` may keep capping the tier at practiced
(capping down is honest; overriding up is not).

- Existing stored `learned` values are preserved and re-interpreted as self-assessment — no
  store migration.
- Files: `src/lib/mastery.ts` (`effectiveTier`), `src/components/topic/TopicProgress.tsx`,
  `src/components/topic/TopicsProgress.tsx`, `src/components/progress/` (topic list).
- Depends on: —
- Accept: a topic with zero attempts marked `learned` shows tier *read/untouched* + a distinct
  "self-assessed: learned" marker; nothing in sequencing (P0-3) or the dashboard treats it as
  mastered.

## Phase 1 — Structure

### P1-1 · Curriculum spine in `atlas.yaml` — `todo` (M)

Extend `content/atlas.yaml` with `units` (ordered per level: id, bilingual titles, ordered
`topics` list) and per-node optional `deepens: [<topic-ids>]` (a list — one unit may deepen
several bases, e.g. Wohnen & Umzug → akkusativ + dativ) and `outcomes` (can-do statements,
de/en/ru). Content-only — **no learner state in content**; outcome/unit status is derived at
runtime from the profile store.

- Schema in `src/lib/schemas.ts` (`atlasSchema`); validator rules in `scripts/validate.ts`:
  every topic in exactly one unit, unit order consistent with prerequisites (no topic ordered
  before its prerequisite), `deepens` targets exist and appear earlier in the spine (a target
  may ALSO be a prerequisite — both meanings can apply, e.g. two-way prepositions deepen *and*
  require akkusativ/dativ), prerequisite graph stays acyclic. Runtime loader `src/lib/curriculum.ts` (atlas.yaml becomes a runtime data source for
  the first time — decide between a content collection and a build-time import).
- Depends on: —
- Accept: `bun run validate` fails on: topic missing from units, unit order contradicting
  prerequisites, unknown `deepens` target; `getCurriculum()` returns the ordered spine for the
  10 existing topics.

### P1-2 · Recommended-path engine — `todo` (S)

Linear path = units in order → topics in unit order. `recommendedNext(spine, state)` returns the
first topic whose *measured* tier (per P0-3/P0-5) is below mastered. Consumed by NextTopic, the
Atlas, and eligibility (P0-1/P0-2's "recommended-next").

- Files: `src/lib/curriculum.ts` or `src/lib/mastery.ts`; `src/components/today/NextTopic.tsx`.
- Depends on: P0-3, P1-1.
- Accept: path order is deterministic and documented; NextTopic follows the spine, not
  id-alphabetical order.

### P1-3 · Atlas map view at `/topics` — `todo` (L)

The graph rendered as the default Themen view: level bands, prerequisite edges, `deepens` edges
styled distinctly, per-node tier badges (same `effectiveTier` as everywhere), recommended path
highlighted, click → topic page. List (current grid) stays as toggle and no-JS/mobile fallback.

- Suggested shape: layered SVG computed from the spine (units as columns/rows inside level
  bands) in a React island `src/components/atlas/AtlasMap.tsx` + pure layout util
  (`src/lib/atlas-layout.ts`) so layout is unit-testable; reuse `TierBadge`; wide map scrolls
  inside its own container.
- Files: `src/pages/topics/index.astro`, new `src/components/atlas/`, reuse of
  `src/components/topic/TopicsProgress.tsx` patterns.
- Depends on: P1-1, P1-2 (renders path), P0-5 (badges show honest tiers).
- Accept: all nodes + edges visible without horizontal page scroll (map pans/scrolls in its own
  box); badges match the Fortschritt dashboard; toggle to list works; works under `bun run dev`
  and in the Tauri shell.

### P1-4 · Merged Üben tab — `done` (M)

`/ueben` with three sub-views — Wiederholen (`FlashcardSession`, all cards, `newLimit` honoring
P0-2), Training (`MixedTraining`), Wortschatz (deck list with due badges). Nav slims to
Heute / Themen / Üben / Fortschritt. `/review`, `/training`, `/vocab` redirect (Astro redirects);
`/vocab/[id]` deck pages stay prerendered and reachable from the Wortschatz sub-view.

- Sub-views as sub-routes (`/ueben/wiederholen|training|wortschatz`) for linkability; `/ueben`
  redirects to the Wiederholen sub-view; `Base.astro`'s `startsWith` active-state logic covers
  all of them; wrap links in `withBase()`.
- Files: new `src/pages/ueben/*.astro`, `src/layouts/Base.astro`, redirects in
  `astro.config.mjs` or stub pages; delete/redirect old pages.
- Depends on: P0-1, P0-2 (so the merged tab ships with honest pools) — soft dependency, can
  land before with current behavior.
- Accept: 4 nav tabs; every old URL lands somewhere sensible; session flow (`/session`)
  untouched; resume state (`src/lib/resume.ts`) keyed surfaces still work.

### P1-5 · Learning-science skill rewrite — `todo` (M)

Rewrite `.claude/skills/learning-science` per roadmap §4/Phase 1: calibrated evidence claims,
input/retrieval/interaction/production balance instead of "every touch produces an answer",
model → scaffold → fade → transfer → delayed check progression, four-skill + mode-distribution
audit that inspects real snapshots, review checks for distractors/alternatives/natural
German/scoring granularity; current readings described as intensive (not extensive) input; TTS
no longer sold as dual coding. Keep the non-gamification stance.

- Files: `.claude/skills/learning-science/SKILL.md`, `references/*.md`.
- Depends on: — (do before Phase 2 authoring starts; every unit is reviewed under this skill).
- Accept: the flagged framings are gone; the skill's audit mode requires reading the newest
  snapshot and reporting attempts-per-mode.

## Phase 2 — A1 completion

### P2-1 · A1 spine authored (~10 units) — `todo` (S)

Write the A1 `units` into `atlas.yaml` per roadmap §Phase 2 (consolidation of codex's 14),
with outcomes per unit. Existing 4 topics slot in; new topics get placeholder nodes only when
their content lands (validator keeps spine and topics consistent).

- Depends on: P1-1.
- Accept: validate passes; Atlas shows the A1 path with existing topics live and planned units
  visible in this file (not as dead nodes).

### P2-2 · Lesson-cycle template + authoring convention — `todo` (M)

Codify pretest → model dialogue → explanation → recognition → constrained production →
transfer → delayed check as a documented topic skeleton (extends CLAUDE.md's current skeleton),
including support-fading rules. Model dialogue reuses the reading machinery (a `dialog`-flavored
reading) rather than a new content type, unless a schema gap forces one.

- Files: `CLAUDE.md` (authoring rules), possibly `src/lib/schemas.ts` (reading `kind: dialog`).
- Depends on: P1-5 (conventions must agree with the rewritten skill).
- Accept: one existing topic (e.g. `essen-trinken`) retrofitted as the reference example.

### P2-3 · `write` task type — `todo` (M)

Bilingual situation + communicative goal + required content points; learner writes freely;
local save; model answer + checklist after submission. Logs **practice evidence** via a
separate evidence kind (e.g. `kind: 'practice'` on the attempt record) that every accuracy
consumer excludes *before* scoring — never via a `totalParts: 0` convention, which would make
`attemptScore` divide by zero (P0-4 forbids zero denominators at the schema level). Practice
evidence never enters accuracy/mastery math but shows on the dashboard as production activity.

- Files: `src/lib/schemas.ts`, new `src/components/exercises/Write.tsx`, `ExerciseSet.tsx`
  wiring, `src/lib/store.ts` (evidence kind), dashboard surfacing.
- Depends on: P0-4 (attempt shape settled first).
- Accept: a write task saves the response locally (survives reload via resume/store), reveals
  the model only after submission, and produces zero effect on any accuracy metric.

### P2-4 · `audio-comprehension` task type (TTS-based) — `todo` (M)

Multi-turn dialogue spoken via speechSynthesis with alternating voices/rates
(`src/lib/speech.ts` grows utterance-sequencing), transcript hidden until answered, limited
replays, then `mc` questions with `explain`. Degrades explicitly: no German voice → show
transcript and label the item as reading, never silently score listening.

- Files: `src/lib/schemas.ts`, `src/lib/speech.ts`, new
  `src/components/exercises/AudioComprehension.tsx`, `ExerciseSet.tsx` wiring.
- Depends on: P0-4.
- Accept: works in Chrome + Tauri; with voices disabled the fallback path visibly relabels the
  task; attempts log with the item's `focus` tag.

### P2-5 · Author 6 new A1 units — `todo` (L, 6× per-topic checklist)

Erste Schritte · Menschen & Familie · Alltag & Zeit · Wohnen · Stadt & Wege · Freizeit & Können.
Each follows the full new-topic checklist (topic MDX, exercises ≥8 items/≥3 types, pretest,
reading, vocab 20–40 entries with reviewed IPA, atlas node + unit slot) **plus** the P2-2 lesson
cycle and, where outcomes call for it, ≥1 `write` and ≥1 `audio-comprehension` task.

- Depends on: P2-1..P2-4. Author sequentially in spine order; each unit is its own change.
- Accept per unit: validate green; CEFR discipline (A1-only grammar/vocab); reviewed under the
  learning-science skill.

### P2-6 · Strengthen 4 existing A1 topics — `todo` (M each)

Per codex §4: `praesens-wortstellung` (+question formation, negation),
`artikel-genus` (+plural patterns, kein/nicht outcomes), `essen-trinken` (recall → full
transactions: menus, quantities, substitutions, bill), `akkusativ` (+governed prepositions,
varied contexts). Extend — don't rename ids or vocab headwords (card identity!).

- Depends on: P2-2.
- Accept: each topic gains production/transfer items; no flashcard history reset (no headword
  or file-id renames).

### P2-7 · A1 checkpoint — `todo` (M)

Cumulative four-skill-within-our-means assessment set covering the A1 spine; excluded from
mixed training; feeds outcome status.

- Depends on: P2-5, P2-6, P3-2 mechanics not required (checkpoint exclusion comes from P0-1's
  pretest-style filtering, generalized).
- Accept: reachable from the Atlas at the end of the A1 band; results visible on Fortschritt.

## Phase 3 — A2 completion + spiral

### P3-1 · A2 spine authored (~10 units) — `todo` (S)

Per roadmap §Phase 3, with `deepens` edges (Wohnen & Umzug → akkusativ/dativ; Gesundheit &
Termine → termine-vereinbaren; Biografie → perfekt-haben-sein). Depends on: P1-1.

### P3-2 · `deepens` semantics in training — `todo` (S)

Practicing a deepening topic re-activates its base topics' focus tags (all entries in its
`deepens` list) in weakness aggregation and training priority; Atlas already renders the
edges (P1-3).

- Files: `src/lib/weakness.ts`, `src/components/training/MixedTraining.tsx`,
  `src/lib/curriculum.ts`.
- Depends on: P1-1, P1-3.
- Accept: errors in a deepening topic's items raise the shared focus tags' weakness; base-topic
  drills resurface in training.

### P3-3 · Unit checkpoints + delayed probes — `todo` (L)

Cumulative checkpoint set per unit (mixes the unit's outcomes with earlier ones; excluded from
ordinary training). Delayed probes: outcome re-checks scheduled at increasing intervals
(store-level schedule like card due dates), selecting parallel item variants rather than the
identical item; reserve a share of each session for broad cumulative practice.

- Files: `src/lib/store.ts` (probe schedule), `src/components/session/SessionFlow.tsx`,
  `src/lib/schemas.ts` (variant grouping, e.g. shared `variantOf`/outcome ref), content.
- Depends on: P0-1, P1-1, P2-7 (pattern proven at A1 level first).
- Accept: a failed probe reappears later with a different variant; session log shows the
  cumulative-practice share.

### P3-4 · Author 10 A2 units — `todo` (L, per-unit)

Same per-unit bar as P2-5, at A2 CEFR discipline. Depends on: P3-1, P2-2..P2-4.

### P3-5 · Strengthen 6 existing A2 topics — `todo` (M each)

Per codex §4, all six existing A2 topics: `dativ` (common governed prepositions, meaningful
Akkusativ-vs-Dativ choice in varied contexts — two-way prepositions stay in the Wohnen & Umzug
deepening unit), `perfekt-haben-sein` (narrative practice: sequencing, recounting yesterday),
`modalverben` (communicative functions + darf nicht/muss nicht), `trennbare-verben` (authentic
contexts + imperative/Perfekt interactions), `alltag-tagesablauf` (frequency/chores/weekend
contrast), `termine-vereinbaren` (branching calls, voicemail, rescheduling by message).
Depends on: P2-2.

### P3-6 · A2 checkpoint — `todo` (M)

As P2-7 for the A2 band. Depends on: P3-4, P3-5.

## Phase 4 — Deferred (explicitly optional, in priority order)

### P4-1 · Pre-generated neural-TTS audio assets — `deferred` (L)

Offline generation script (spirit of `gen:ipa`: dev-only tool, committed output), assets under
`public/audio/`, `audio-comprehension` prefers assets with speechSynthesis fallback; must work
in web and Tauri; watch repo size (consider per-release pruning). Reason deferred: content must
never block on audio; TTS path (P2-4) ships first and proves the item type.

### P4-2 · Extensive readers — `deferred` (M per reader)

250–400 words late A1, 500–800 late A2, alongside (not replacing) the intensive readings.
Reason deferred: needs a mostly-complete vocab/grammar base to be comprehensible input.

### P4-3 · `speak` task type — `deferred` (L)

Prompt → local recording → replay → model audio/transcript → self-check. Evidence labelled
unverified, never grants mastery. Reason deferred: no verification → weakest learning value per
effort; revisit if local speech recognition becomes practical in web+Tauri.

### P4-4 · Scenario grouping — `deferred` (M)

Several tasks sharing one real-world mission (frame, no branching engine). Reason deferred:
pure presentation-layer sugar until checkpoints (P3-3) exist.

## Dropped (decided 2026-07-11, with reasons)

- **Mediation mode** — CEFR-complete but overkill for a single-learner A1–A2 tool; five modes
  remain.
- **Per-outcome `status` in `curriculum.yaml`** — learner state does not belong in content;
  status is derived at runtime from the profile store (see P1-1).
- **Team-style QA gates** (native reviewer, independent EN/RU reviewers, pilot cohort) —
  replaced by validator rules + learning-science-skill review + real snapshot audits.
- **Authored multi-speaker recorded audio** — replaced by the P2-4 TTS path now and P4-1
  generated assets later; recording sessions with voice talent are out of scope.
