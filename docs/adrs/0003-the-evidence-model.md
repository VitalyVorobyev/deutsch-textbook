# ADR 0003: What counts as learning evidence, and what never does

Status: accepted · 2026-10-18

## Context

The course's success criterion is delayed retention and transfer, not activity. Every surface that
looks like progress is a candidate to be mistaken for it: an opened page, a played recording, a
self-rating, a placement pass, a model's opinion of a draft. Each of these was proposed as evidence
at some point, and each would have made the measured picture flatter and wronger. The rules below
are scattered across the runtime as invariants; this record states them as one decision.

## Decision

**Only a scored attempt by the learner, on an item whose answer key the course owns, is
measurement.** Everything else has a named, smaller role.

| Signal | Class | What it may do |
| --- | --- | --- |
| Scored `practice`/`drill`/`checkpoint` attempt | verified evidence | accuracy, mastery tiers, `weakFocuses` |
| Delayed `probe` attempt | verified evidence, delayed | retention reads; feeds `weakFocuses`. Probe *items* never re-enter ordinary training |
| `pretest` attempt | diagnostic | nothing: never weakness, never training, never "Geübt" |
| Passed `placement` | a third class | removes topics from the recommended path; **never raises the measured tier** |
| Open `write`/`speak` | unverified practice | logged and visible; never accuracy, never mastery. Attempt → model answer → done, no gated checklists |
| Self-rating (`learned`) | navigation | may complete a Lernpfad step; never a badge |
| Opening a reading, reference, document or discovery piece; playing audio | none | no mastery, no review debt, no completion state |
| Writing assistant (local model) | advice | never stored in attempts or snapshots |
| Goethe exam simulator | calibration | separate local store, never synced, never mastery |
| LiD practice | learning in its own domain | FSRS-scheduled under its own store key; the mock exam is calibration |

Three rules make the table hold:

1. **Navigation and badges answer different questions.** `pathDone` (mastered, primary practice
   done, or self-rated) moves the path; the badge reads evidence only. Neither is derived from the
   other.
2. **Probe state is derived from the attempt log, never stored.** A due probe runs before review
   and training, so practice cannot contaminate it. A failed family is shown with its owning topic
   and one recommended set, preferring a `translate`-heavy drill. Nothing is gated.
3. **Logged results are history.** An attempt keeps the result and item revision it was scored
   under; a later answer key never re-grades it.

## Consequences

- A feature that wants to "count" something must name its row here or add one in a superseding
  ADR. "Engagement" has no row.
- Some real learning (extensive reading, listening volume) is invisible to every instrument by
  construction. That is accepted: the alternative is a metric that rewards opening pages.
- Grading rulings (`data/grading-decisions.yaml`) are part of the evidence chain, so a rejected
  rendering is triaged before any weak-focus table is read.
