# Learning-System Foundations — completed July 2026

This archive preserves the rationale and stable backlog IDs for completed work. It is historical,
not an execution queue. Current direction is in [../roadmap.md](../roadmap.md), and active tasks
are in [../backlog.md](../backlog.md).

PR [#10](https://github.com/VitalyVorobyev/deutsch-textbook/pull/10) delivered the post-
implementation hardening tranche, evidence contracts, Lernpfad redesign, task foundations and
the `Erste Schritte` reference unit. Earlier Phase 0/1 work was already present in the branch
reviewed by that PR.

## Phase 0 — correctness and honesty

### P0-1 · Training eligibility filter — `done`

Ordinary mixed training admits only practice/drill sets owned by opened or genuinely practiced
topics. Pretests, checkpoints, probes and unread recommendations stay out. This prevents automatic
practice from exposing untaught material.

**Acceptance retained:** fresh profiles receive no ordinary exercises from unread topics; pretest
item IDs never enter mixed-training attempts.

### P0-2 · Fresh-vocabulary gating — `done`

Fresh cards require an opened owning topic or an explicitly selected deck. Due cards remain
eligible regardless of ownership so scheduled retention is never lost.

**Acceptance retained:** unopened A2 decks contribute no new cards; due cards remain reviewable;
direct deck study is an intentional override.

### P0-3 · Unified next-topic mastery — `done`

Recommendation and the progress dashboard use the same measured tier rather than an attempts-only
shortcut. One massed practice day cannot complete a topic for sequencing.

**Acceptance retained:** recommendation and Fortschritt agree for every topic state.

### P0-4 · Partial-credit scoring — `done`

Attempts may carry `correctParts`/`totalParts`; a shared score helper is used by mastery,
weaknesses, trends, session summaries and progress. Historical boolean attempts retain their old
meaning.

**Acceptance retained:** multi-part work receives clamped fractional credit; v1–v3 snapshots
import unchanged.

### P0-5 · Separate self-assessment — `done`

The learner's `learned` marker is displayed as self-assessment and cannot promote measured
mastery. Historical values remain stored without migration.

**Acceptance retained:** a self-assessed topic with no evidence is not mastered or skipped by the
recommended path.

## Phase 1 — course structure

### P1-1 · Curriculum spine and outcomes — `done`

`atlas.yaml` became the authoritative ordered curriculum with bilingual units, topic
prerequisites, optional `deepens` relations and learner-facing outcomes. Validation enforces
ownership, order, acyclicity and relationship integrity.

### P1-2 · Recommended-path engine — `done`

The first non-mastered topic in spine order is the single recommendation used by Heute and
Themen. The path stays soft: it guides automation without locking navigation.

### P1-3 · Themen learning-path surface — `done`

The initial full-canvas graph was replaced by a server-rendered Lernpfad and a focused semantic
relationship explorer. The current unit has the only dominant accent and the next action is
available without interpreting dependency edges.

**Acceptance retained:** no clipped titles or horizontal page overflow at 390, 768 or 1280 px;
unit status and direct relationships are keyboard- and screen-reader-readable.

### P1-4 · Unified Üben navigation — `done`

Review, mixed training and vocabulary live under linkable Üben subroutes. Old routes redirect,
deck pages remain addressable, and the primary navigation has four entries.

### P1-5 · Learning-science skill rewrite — `done`

The authoring review now checks calibrated evidence claims, model/scaffold/fade/transfer,
mode balance, task validity, natural language and dated snapshot evidence. It distinguishes
pretesting from practice and intensive from extensive reading.

## Phase 1.5 — post-implementation hardening

### P1.5-1 · Untaught-content and resume gating — `done`

Unread recommended topics no longer feed ordinary training or fresh cards. Restored queues are
revalidated and rebuilt when their saved content is no longer eligible.

### P1.5-2 · Pretest/mastery separation — `done`

Pretest-only activity is retained diagnostically but cannot produce `Geübt` or contribute to
accuracy/mastery.

### P1.5-3 · Curriculum/evidence contracts — `done`

Outcomes have stable global IDs, modes and optional domains. Exercise sets have explicit roles;
items reference owned outcomes and may mark intentional later-structure previews. Attempts record
outcome IDs and `verified` or `practice` evidence. Open production is activity, not accuracy.

### P1.5-4 · Themen redesign — `done`

The default view became the balanced one-column Lernpfad with a continuation panel, filters and
contextual actions. Zusammenhänge shows only prerequisites, unlocks and deepening around one
selected topic, using semantic lists at narrow widths.

### P1.5-5 · Domain regression suite — `done`

Pure tests cover recommendation, measured tiers, pretest exclusion, partial credit, training and
fresh-card eligibility, queue invalidation, curriculum ordering and v1–v3 compatibility.

## Phase 2 — reusable A1 foundations

### P2-1 · A1 spine structure and live-unit policy — `done`

The A1 order is established, and units enter `atlas.yaml` only when their real content lands.
This avoids dead destinations while preserving deterministic progression.

### P2-2 · Lesson-cycle convention — `done`

Every topic follows pretest → model → explanation → scaffold → fade → transfer → delayed check.
`essen-trinken` provides the first retrofit and `Erste Schritte` the complete new-unit reference.

### P2-3 · Open-writing task — `done`

`write` provides a bilingual situation, required points, locally saved response, model answer and
unverified practice evidence. It cannot affect accuracy or mastery.

### P2-4 · Audio-comprehension task — `done`

`audio-comprehension` supports TTS dialogue or committed assets, hides the transcript until the
answer and visibly relabels itself as reading when no usable German voice is available.

## Phase 2 — A1 completion (shipped in v0.2.0)

A1 is complete: ten units from `erste-schritte` to `freizeit-koennen`, each with the full lesson
cycle, a cumulative checkpoint, and 100% Goethe-A1 Wortliste coverage (673/673 — run
`bun scripts/coverage-a1.ts` for the live figure).

### P2-5 · The four remaining A1 units — `done`

`alltag-zeit`, `wohnen`, `stadt-wege`, `freizeit-koennen`, each a complete unit.

### P2-6 · Depth for the four existing A1 topics — `done`

`praesens-wortstellung` (questions, negation), `artikel-genus` (plurals, `kein`/`nicht`),
`akkusativ` (governed prepositions, pronouns), `essen-trinken` (menu, quantity, payment).

Growing these practice sets is what exposed the recommended-path bug fixed in v0.2.0: a lesson
completed against the old, shorter set silently became incomplete again. See `pathDone` in
`src/lib/mastery.ts` — item-level completion alone can never settle a topic.

### P2-7 · Cumulative A1 checkpoint — `done`

`a1/checkpoint-a1`, reachable once every A1 lesson is done, excluded from ordinary training, with
outcome-level results on Fortschritt.

## Phase 3 — hardening the A1 learning loop

Shipped 2026-07-12. Driven by [the A1 learning audit](../a1-learning-audit.md), which judged the
course as a learning system rather than as a valid content collection.

**The sequencing was the hard call, and it is worth preserving.** P3-1 (probes) was the only item
with a *calendar* cost, so the instinct was to ship it first. But probes read the same scorer as
everything else, and until P3-0 landed that scorer was writing wrong `correct` flags and wrong
`focus` tags. A retention cohort measured with a broken instrument is a cohort that has to be
re-run. Fixing the instrument first cost two days of clock and bought data worth trusting.

### P3-0 · Fix free-production scoring and error attribution — `done`

The 671-attempt snapshot exposed two defects, each verified against the answer keys. **Spelling
slips were scored as grammar failures**: 12 of 29 failed translations were single-token slips
(`Kanst`, `heite`, `Artzt`), and a translate item asks for a whole sentence, so one mistyped
character sank it *and* was recorded as a failure of the grammar it drilled. **The `focus` tag was
attached to the item, not to the error**: `Sie ist zu Hause gebliebt` counted as `haben-sein`
evidence although the auxiliary is correct.

The consequence was not academic. `a2/drill-mir-mich` — the most-practiced set in the entire corpus,
73 attempts — had been authored for a mir/mich confusion the learner does not have. The
personalization loop aimed at a phantom.

`src/lib/production.ts` now scores a typed sentence by two rules: a one-token near-miss outside the
graded tokens is a spelling slip (shown, scored correct, logging no focus error), and a real error is
attributed to the item's tag only when a token that tag grades is what diverged. Closed-class words
are never forgiven — `den`/`dem` are one edit apart *and* are exactly what the taxonomy grades.
Items declare `key_tokens`.

**Acceptance retained:** replaying the snapshot moved the weak-focus list (`trennbar-modal` left it
entirely — it was a phantom; `verben-mit-dativ` 33%→20%) while leaving the genuine weaknesses
(`kein-nicht`, `dativ-artikel`) intact.

### P3-1 · Scheduled parallel probes — `done`

Local 2/7/21-day outcome probes with parallel variants (`src/lib/probes.ts`, ten A1 probe families
in `content/exercises/a1/probe-*.yaml`). A due probe opens the session as step 0 — before review and
training, because a probe answered after twenty minutes of practice on the same material measures
the practice, not the interval.

**No new snapshot key was needed.** Probe state is *derived* from the attempt log rather than stored,
so scheduling survives export and import by construction. Two things the implementation had to get
right, both found by running it against the real snapshot: arming cannot depend on
`attempt.outcomes` (551 of 671 attempts predate that field), and the session resume point cannot be
`step` alone (step 1 is both "past the probes" and the default, so one reload silently cancelled a
due probe).

**Acceptance retained:** probe state survives export/import; probes stay out of ordinary training;
each attempt records its variant as the item id; `MAX_PROBES_PER_SESSION = 3`.

### P3-1b · Reserved broad-retrieval share — `done`

`BROAD_RETRIEVAL_SHARE = 0.25` in `src/lib/training.ts`. The three priority bands — answered wrong,
weak focus, never seen — could always fill a session on their own, so a learner with any backlog
would never meet an older topic again. An old topic answered correctly weeks ago is exactly the
material whose retention has decayed most. Recency and weakness are the loudest signals, not the
most informative ones. Queue building moved into `buildSession` so it is pure and testable.

### P3-2 · Mode-valid evidence — `done`

Each item has an actual response mode, persisted on attempts and reported separately from the
curriculum outcome's target mode. A written multiple-choice item targeting a spoken outcome is
reported as written selection, not spoken interaction.

### P3-3 · Open production upgraded — `done`

`write` became draft → requirement checklist → revision, preserving both versions as unverified
practice. `speak` added, with local record/replay, a model, a checklist and a required second
attempt. No cloud recognition, no automatic mastery.

### P3-4 · Item mix rebalanced — `done`

The trainable catalog was 44% `mc`/`match`/`order` and only 13% `translate` — and the pilot learner
scored 93% on `mc`, 94% on `match` and 45/45 on `order` against 54% on `translate`. The constrained
formats had stopped carrying information. Now enforced per topic by `bun run validate` over the
union of its `role: practice` sets: ≥ 2 `translate`, `mc` ≤ ⅓, `mc`+`match`+`order` ≤ 45%. Nine of
sixteen topics failed the bar; 30 production items were authored to clear it.

**Placement mattered more than authoring.** `pathDone` treats a topic as finished once its
`primaryPractice` items have all been attempted, so appending an item to that set would have
silently un-finished the topic and reopened the Lernpfad. New items went to non-primary sets, to
mastered topics, or into new practice sets appended *after* the existing ones.

### P3-5 · Sustained input piloted — `done`

`content/reading/a1/lena-1-der-erste-tag.yaml` — 262 words, a recurring character, three glosses, one
gist question. Readings now declare `kind: intensive | extensive`, held apart by the validator,
because the difference is what the text is *for*: an extensive reader is 250–400 words, at most two
questions, roughly one gloss per 40 words. A long text quizzed line by line is just a long intensive
text, and the volume input it exists to provide never happens. The UI says so too, so the learner
reads it straight through instead of parsing it.

## Superseded input

The broader initial analysis remains available as
[codex-plan-a1-a2.md](codex-plan-a1-a2.md). Its diagnosis informed the roadmap, but its larger
module count and some proposed evidence semantics were deliberately revised.
