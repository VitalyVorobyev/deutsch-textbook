# Deutsch-Atlas Roadmap: from lesson islands to an A1–A2 course

Status: **accepted** (2026-07-11). Derived from [codex-plan-a1-a2.md](codex-plan-a1-a2.md) after a
code-verified critical review, plus four structural decisions made by Vitaly. The itemized work
lives in [backlog.md](backlog.md); this file explains *what* we are building, *why*, and *in what
order*.

## 1. Where the codex plan is right (verified against the code)

Every load-bearing factual claim in the codex plan checks out:

- **Scoring is binary all-or-nothing.** `Attempt.correct: boolean` (`src/lib/store.ts`); a 6-cell
  table, a 5-pair match, and a one-click MC each log exactly one boolean. No partial credit
  exists anywhere.
- **Mixed training leaks.** `/training` and the daily session pool *every* exercise set: pretests
  (defeating their purpose — a pretest you've drilled is no longer a pretest) and sets from
  topics the learner has never opened. Fresh vocabulary enters the SRS queue from all decks,
  regardless of whether its topic was ever read.
- **Two mastery rule sets diverge.** The dashboard's `topicTier()` requires ≥5 recent attempts,
  ≥80% accuracy, **≥2 distinct practice days**, and ≥1 reviewed card; but next-topic selection
  runs on `topicMastery()` — attempts-only, no day or card requirement (its own docstring says
  "deliberately looser"). One massed day can mark a topic "mastered" for sequencing purposes.
- **The manual override lies.** Marking a topic `learned` fully overrides the measured tier.
- **The skill-mode audit is fair.** The only real snapshot (`progress/vitaly/2026-07-10.json`)
  has 40 attempts: 17/17 perfect MC, zero `translate`/`listen` attempts, 29 of 40 attempts on a
  single topic. Recognition-heavy, production-light, narrow — exactly as diagnosed.
- **There is no course spine.** No curriculum, unit, outcome, or checkpoint concept exists in
  the codebase; `content/atlas.yaml` is consumed only by the validator (its header still
  promises "the v2 map view will render this file" — no map exists).

## 2. Where the codex plan is corrected

The diagnosis is sound; parts of the prescription are not. The roadmap deviates deliberately:

1. **No learner state in content.** The plan puts per-outcome `status: uncovered/introduced/
   practiced/assessed` into `curriculum.yaml`. That is learner progress, not content — it would
   break multi-profile support and the local-first snapshot model. Rule: **content files define
   outcomes; status is derived at runtime from the profile store**, exactly like mastery tiers.
2. **Trimmed scope, explicit deferrals.** 27 modules + 3 new task types + authored multi-speaker
   audio + a scenario engine is a monolith. We consolidate to **~10 A1 + ~10 A2 units**, keep
   the `write` and `audio-comprehension` task types, and defer authored audio, `speak`, and
   scenario grouping to an optional Phase 4. Everything cut is listed in the backlog as
   *deferred* with a reason — nothing is silently dropped.
3. **Audio never blocks content.** "Authored audio with multiple speakers and natural prosody"
   is not realistically agent-authorable. Interim strategy: use browser TTS harder (dialogue
   turns, alternating voices, rate variation). Phase 4 upgrades to pre-generated neural-TTS
   assets committed to the repo, with speechSynthesis as the permanent fallback.
4. **`speak` is lowest priority, possibly never.** Locally recorded, self-assessed speech grants
   no verified evidence by the plan's own admission. It sits in Phase 4 behind everything else.
5. **QA is rewritten for a team of one (plus an agent).** "Native-level German review,
   independent EN/RU review, pilot evaluation" assume reviewers who don't exist. Acceptance here
   means: `bun run validate` rules, a pass under the (rewritten) learning-science skill, and
   Vitaly's actual usage data from progress snapshots.
6. **Mediation is dropped.** Five CEFR modes (listening, reading, writing, spoken production,
   spoken interaction) are plenty for a single-learner A1–A2 tool.
7. **The UI gap is filled.** The codex plan never touches navigation, ordering surfaces, or the
   topic graph. The four decisions below become the roadmap's structure phase.

## 3. The four structural decisions (confirmed 2026-07-11)

### 3.1 One practice tab: Üben

Wortschatz (`/vocab`), Wiederholen (`/review`), and Training (`/training`) merge into a single
**Üben** tab. All three already share the same IndexedDB progress store and mountable islands
(`FlashcardSession`, `MixedTraining`, the vocab deck list), so this is a navigation change, not a
state migration. New nav: **Heute / Themen / Üben / Fortschritt**. Old routes redirect; the
prerendered `/vocab/<deck>` detail pages stay.

### 3.2 The Atlas becomes real — as the default Themen view

`/topics` renders the topic graph as a map: level bands, prerequisite edges, per-node mastery
badges (same tiers as the dashboard), the recommended path highlighted, and spiral "deepens"
edges styled distinctly. The current level-grouped card list remains as a toggle and as the
mobile/no-JS fallback. This finally delivers what `content/atlas.yaml`'s header has promised
since v2 was named.

### 3.3 Explicit recommended order — yes, and it is soft

The curriculum spine defines units with an explicit topic order; a linear **recommended path**
falls out of it. The path drives the NextTopic suggestion and is drawn in the Atlas. **Nothing is
ever locked** — an adult learner may open any topic at any time. Eligibility gating (Phase 0)
only controls what mixed training and the fresh-card queue *pull in automatically*, never what
the learner may choose. This fits the project's non-gamified, autonomy-respecting ethos.

### 3.4 Spiral learning — yes, as explicit deepening topics

Revisiting a theme at increasing depth is well-supported practice, and the codex plan already
spirals implicitly (Akkusativ at A1 → Dativ and case choice at A2 → two-way prepositions later).
We make it explicit: a deepening topic declares `deepens: <base-topic-id>` in the spine. Rules:

- A deepening topic **re-activates the base topic's focus tags** in training rather than
  duplicating the base content.
- The Atlas renders `deepens` edges differently from prerequisites.
- Cumulative unit checkpoints (Phase 3) are the other spiral instrument: they mix earlier
  outcomes into later assessment instead of retesting each topic in isolation.

## 4. Phases

Order is strict: each phase makes the next one honest. There is no point authoring 16 new units
on top of a scoring system that can't tell a 6-cell table from a coin-flip MC.

### Phase 0 — Correctness and honesty fixes

Small code changes, no new concepts, immediate value for the existing content.

1. Training eligibility: exclude pretests and never-opened topics from mixed training/session.
2. Fresh-vocab gating: new cards only from opened or recommended-next topics (due cards always).
3. One mastery rule set: next-topic selection uses the dashboard's tier logic; retire the
   attempts-only shortcut.
4. Partial credit: backward-compatible `correctParts`/`totalParts` on attempts; accuracy math
   weights parts.
5. Self-assessment: the manual `learned` flag becomes a visibly separate self-rating that can
   never override the measured tier.

**Exit criteria:** a pretest item can no longer appear in training; a never-opened A2 topic
contributes nothing to training or the fresh-card queue; NextTopic and the dashboard agree on
every topic's state; a 5/6 table attempt is worth more than a failed MC and less than a perfect
one; old snapshots still import.

### Phase 1 — Structure (the four decisions)

1. **Curriculum spine** in `content/atlas.yaml`: `units` (ordered, per level, with bilingual
   titles) + per-node `deepens` and can-do `outcomes` (de/en/ru). Content-only; Zod schema +
   validator rules (unit order consistent with prerequisites, acyclic, every topic in exactly
   one unit).
2. **Atlas map view** at `/topics` (map default, list toggle).
3. **Üben tab** at `/ueben` with Wiederholen / Training / Wortschatz sub-views; redirects.
4. **Learning-science skill rewrite**: calibrated claims, model → scaffold → fade progression,
   four-skill balance, drop "every touch produces an answer" and TTS-as-dual-coding; add the
   review checks the codex plan lists (distractor plausibility, valid alternatives, natural
   German, scoring granularity, mode distribution in real snapshots).

**Exit criteria:** nav has 4 tabs; the Atlas renders the real graph with live mastery badges and
the recommended path; `bun run validate` rejects a spine that contradicts prerequisites; the
skill no longer contains the flagged framings.

### Phase 2 — A1 completion (trimmed to ~10 units)

The codex plan's 14 A1 items consolidate to ~10 units reusing all 4 existing topics. Working
sequence (final naming/split decided when the spine is authored):

1. **Erste Schritte** — alphabet, pronunciation, numbers, greetings, introductions (codex 1+2).
2. **Präsens & Wortstellung** — existing topic, extended (questions, negation) per codex §4.
3. **Artikel & Genus** — existing topic, extended (plurals, kein/nicht as outcomes).
4. **Menschen & Familie** — possessives, occupations, descriptions.
5. **Alltag & Zeit** — time, dates, weekdays, routines (feeds the existing A2 Alltag topic).
6. **Essen & Einkaufen** — existing topic extended into full transactions per codex §4.
7. **Akkusativ** — existing topic, extended (governed prepositions, pronouns in context).
8. **Wohnen** — rooms, furniture, es gibt, location basics.
9. **Stadt & Wege** — transport, directions.
10. **Freizeit & Können** — leisure, invitations, weather, abilities (codex 11+12 merged).

Plus an **A1 checkpoint** (cumulative, four-skill within our means). Codex's A1 body/health item
folds into the A2 Gesundheit unit rather than existing twice.

New machinery, built once and used by all units:
- **Lesson cycle** authoring convention: pretest → short model dialogue → explanation →
  recognition → constrained production → transfer in a new context → delayed check. Support
  (hints, translations) fades across stages.
- **`write` task type**: bilingual situation, required content points, local save, model answer;
  logs *practice evidence* that never counts as verified accuracy.
- **`audio-comprehension` task type** (TTS-based): multi-turn dialogue spoken with alternating
  voices/rates, transcript hidden until answered, MC comprehension questions.

**Exit criteria:** every A1 unit has topic + exercises + pretest + reading + vocab + spine entry;
`bun run validate` passes; at least one `write` and one `audio-comprehension` task per unit
where the unit's outcomes call for them.

### Phase 3 — A2 completion + spiral (trimmed to ~10 units)

1. **Wohnen & Umzug** — two-way prepositions; `deepens: akkusativ` + `dativ`.
2. **Reisen & Verkehr** — tickets, problems, directions.
3. **Einkaufen & Reklamation** — comparisons, returns, complaints.
4. **Gesundheit & Termine** — doctor/pharmacy, advice, imperatives; `deepens: termine-vereinbaren`.
5. **Arbeit & Beruf** — duties, simple professional messages.
6. **Lernen & Verstehen** — courses, learning strategies, asking for clarification.
7. **Biografie & Vergangenheit** — narrative Perfekt + Präteritum of sein/haben/modals;
   `deepens: perfekt-haben-sein`.
8. **Freunde & Feste** — invitations, social arrangements (merges codex 8 with parts of 9).
9. **Ämter & Alltag** — authorities, bank, post, forms.
10. **Nebensätze & Pläne** — weil/dass/wenn, future intentions, polite wishes (codex 11+12).

Plus an **A2 checkpoint**. Existing six A2 topics are strengthened per codex §4 (Perfekt as
narrative, modal functions, trennbare Verben in authentic contexts, Termine role-plays).

New machinery:
- `deepens` semantics in training (re-activate base focus tags).
- **Unit checkpoints**: cumulative sets mixing the unit's outcomes with earlier ones; excluded
  from ordinary mixed training.
- **Delayed probes**: outcome re-checks scheduled at increasing intervals, selecting parallel
  variants instead of recycling the identical item.

**Exit criteria:** full A1+A2 spine navigable in the Atlas; checkpoints and delayed probes run;
weakness targeting keeps a reserved share of every session for broad cumulative practice.

### Phase 4 — Deferred, explicitly optional

- **Pre-generated neural-TTS audio assets** (offline generation script in the spirit of
  `gen:ipa`; committed files; speechSynthesis fallback; must work in web + Tauri).
- **Extensive readers** — 250–400 words late A1, 500–800 words late A2.
- **`speak` task type** — local recording, self-assessed, labelled unverified.
- **Scenario grouping** — several tasks sharing one real-world mission.

Dropped entirely (with reasons in the backlog): mediation mode, per-outcome status in content,
team-style QA gates.

## 5. What "done" means for the whole roadmap

Vitaly can start at Erste Schritte and reach the A2 checkpoint through a visible, ordered path
in the Atlas; every session mixes due review, eligible training, and a clear next step; the
progress data distinguishes verified accuracy from practice evidence; and the snapshot-driven
drill loop (`progress/<profile>/*.json` → targeted drills) keeps working at every point along
the way — that loop is the product's soul and no phase may break it.
