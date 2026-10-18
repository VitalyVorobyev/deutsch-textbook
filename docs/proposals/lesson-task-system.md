# Proposal: the lesson task system

Status: open · 2026-10-18. Authorizes nothing.

## The question

What does a lesson ask the learner to do, in what order, and how is each task built? Today the answer
is an article plus a list of exercise files, each with a `role`, `stage` and `activity`
([ADR 0002](../adrs/0002-topic-manifests-and-learning-activities.md)). It works, but it is
file-shaped. Tasks are whatever an exercise set happens to contain, and the lesson cycle (pretest →
model → explanation → scaffold → fade → transfer → delayed check) is a convention that validators
enforce piecewise rather than a structure the learner moves through.

## Constraints any answer keeps

- The evidence model ([ADR 0003](../adrs/0003-the-evidence-model.md)): what counts stays unchanged
  unless a superseding ADR says otherwise.
- Persisted identities: set ids, item ids and `revision` are in learner history. A redesign
  migrates them; it never renames them silently.
- The primary practice set's completion semantics, probes as delayed checks, and the item-mix
  bars, until they are deliberately replaced.
- Not gamified. Typed, active recall over recognition.

## Open decisions

1. Is the unit of design the *task* (one communicative job, several items) rather than the file?
2. Does the lesson cycle become explicit structure in the manifest, or stay a validator convention?
3. Where do listening, reading and story material enter the cycle (see
   [characters-and-stories](characters-and-stories.md))?
4. What do Redaktion and Tonwerk need to author and preview a task end to end?
5. Migration: which shipped topics are converted, and which stay on the file model?

## Inputs

- `bun run activity:audit` and `bun scripts/grammar-depth.ts --thin` for today's shape.
- The `learning-science` skill for the design lens.
- The learner's evidence: `bun run progress:audit --profile vitaly --pull`.
