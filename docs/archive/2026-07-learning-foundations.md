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

## Superseded input

The broader initial analysis remains available as
[codex-plan-a1-a2.md](codex-plan-a1-a2.md). Its diagnosis informed the roadmap, but its larger
module count and some proposed evidence semantics were deliberately revised.
