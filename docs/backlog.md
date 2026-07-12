# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P2 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v4 snapshot import and pass the full repository gate.

Phases 0–2 are done: the learning system, the Atlas, and a complete A1 (v0.2.0).

## Now — Phase 3: A2 completion and retention

### P3-1 · Author the complete A2 spine — `todo` (S)

Use [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) to define the final A2 unit order,
stable outcomes and `deepens` relationships. First incorporate the pre-A2 learning-audit findings
into its entry assumptions, unit boundaries and vocabulary budgets. Add each live unit only with
its complete content bundle; planning-only units remain in the blueprint and never become empty
Atlas nodes.

- Depends on: P2-7 pattern and current curriculum contracts.
- Accept: the blueprint's detailed A2 section reflects the completed pre-A2 audit; ordering respects
  prerequisites; every live topic belongs to one unit; outcome IDs are unique; existing persisted
  A2 identities are preserved; validation passes.

### P3-2 · Apply `deepens` semantics in training — `todo` (S)

When a learner practices a deepening topic, include its base topics' relevant focus tags in
weakness aggregation and training priority without duplicating base lessons.

- Depends on: P3-1.
- Accept: an error in a deepening topic can resurface an applicable base drill; unrelated base
  content does not enter the queue; focused relationship labels remain accurate.

### P3-3 · Add unit checkpoints and delayed probes — `todo` (L)

Add cumulative checkpoint sets, scheduled outcome probes with parallel variants, and a reserved
broad-retrieval share in mixed sessions. Probe scheduling must be local-first and snapshot-safe.

- Depends on: P2-7 and P3-1.
- Accept: checkpoint/probe roles never enter ordinary training; a due probe uses a parallel
  variant rather than the identical item; the session log exposes cumulative practice.

### P3-4 · Author ten A2 units — `todo` (L)

Use the same complete-unit bar as P2-5 with A2-calibrated language, genres and outcome modes.
Author in spine order and land one complete unit per change.

- Depends on: P3-1 and the completed Phase 2 task machinery.
- Accept per unit: complete lesson cycle and content bundle; learning-science review and full
  validation pass.

### P3-5 · Strengthen the six existing A2 topics — `todo` (M each)

Extend Dativ, Perfekt, Modalverben, trennbare Verben, Alltag/Tagesablauf and Termine into authentic
case choices, narratives, communicative functions, varied time frames and real scheduling tasks.
Keep two-way prepositions in the later Wohnen & Umzug deepening unit.

- Depends on: Phase 2 lesson-cycle convention.
- Accept: each topic gains faded production and transfer without duplicate content or renamed
  persisted identities.

### P3-6 · Build the cumulative A2 checkpoint — `todo` (M)

Create the end-of-course checkpoint using the proven A1 pattern and stable A2 outcome IDs.

- Depends on: P3-3 through P3-5.
- Accept: reachable at the end of the Lernpfad; provides honest outcome coverage; remains excluded
  from ordinary mixed training and compatible with snapshots.

## Later — Phase 4 (deferred)

### P4-1 · Commit generated neural-TTS audio — `deferred` (L)

Prefer generated assets with speech synthesis as a permanent fallback. Reconsider after A1 usage
shows that audio quality, rather than content coverage, is the limiting factor.

### P4-2 · Add extensive readers — `deferred` (M per reader)

Add 250–400 word late-A1 and 500–800 word late-A2 readers after the vocabulary and grammar base is
complete enough to keep them comprehensible.

### P4-3 · Add local speaking capture — `deferred` (L)

Record, replay and self-check locally. Keep all resulting evidence unverified unless a trustworthy
local assessment method exists.

### P4-4 · Add scenario grouping — `deferred` (M)

Group several existing tasks under one real-world mission after checkpoints prove that the
additional presentation layer improves the learning workflow.
