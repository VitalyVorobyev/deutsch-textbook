---
name: progress-review
description: >-
  Procedure for reviewing learner progress in Deutsch-Atlas. Use when reviewing
  learner progress or snapshots, running or reading `bun run progress:audit`,
  interpreting weak-focus tables, planning drills from evidence, or triaging the
  grading-review queue of rejected translate renderings. Trigger for questions
  like "how is the learner doing", "what should be drilled next", or "should
  this rendering be accepted", even when no tool is named.
---

# Progress review — the procedure

The decision rules live in [docs/a2-learning-led-program.md](../../../docs/a2-learning-led-program.md);
this skill is the procedure that gets you to them with clean inputs.

## 1. Read the audit, never the raw snapshot

`progress/<profile>/*.json` files run 300 KB+; Reading one wholesale blows the context for nothing.

- Always: `bun run progress:audit --profile <slug>` (this repo's historical folder is `vitaly`).
- `--item <set-id>:<item-id>` for focused evidence on one item — prompts, answers, every attempt.
- `--json` only when piping into another tool, never for reading.

## 2. Triage instrument-first

A surprising number is guilty until the instrument that produced it is cleared. Both of P4-4's
review findings and the Wortliste `~` audit were "content" defects that turned out to live in the
scorer, the validator or the manifest check (see backlog.md). Order of suspicion:

1. **Instrument** — could the scorer, validator or audit itself have produced this number?
2. **Grading-review queue** — rulings on rejected renderings (below). Withheld attempts distort
   every downstream signal, so the queue drains before anything is diagnosed from those signals.
3. **Only then content** — drills, item fixes, lesson revisions.

## 3. Grading-review rulings

Each rejected rendering in the audit's queue gets one linguistic ruling:

- **accept** — correct, target-preserving German → add it to the item's `accept` list and bump
  `revision`.
- **constrain** — good German that bypasses the target → add a bilingual `instruction` constraint
  and bump `revision`.
- **confirm** — the rejection was right → no content change; the row clears, and the attempts
  re-enter the focus signals with attribution recomputed by today's grader (a stale stored
  `focus` tag never re-enters on its own).

The linguistic criteria are CLAUDE.md's `translate`/`accept` and `key_tokens` rules — apply those,
do not restate or improvise them. (Planned: P6-1 gives rulings a committed decisions file so the
queue can drain; until it ships, a ruling lands directly as its content edit.)

## 4. Drills only after triage and an audit rerun

Never author a drill from a pre-triage table: withheld attempts distort the weak-focus table, in
either direction. Triage the queue, merge, rerun the audit, re-read the table — then follow
CLAUDE.md's "Drills from progress" for the how, and the operating program's bar for the whether
(errors across multiple items plus recent or probe evidence).

## 5. Reading the tables

- **Focus signals:** `persistent` requires attributed errors on ≥2 distinct items plus a recent or
  probe error; `historical` is not a drill recommendation. The runtime weakness bar is separate
  (`weakFocuses`, `src/lib/weakness.ts`): last ~30 attempts per focus, weak = ≥4 attempts and ≥35%
  errors — that is what drives training priority, and a drill exists to be served by it.
- **Recovery column:** whether the learner has answered that focus correctly since its last error.
  "yes" over old wrongness argues against a drill; "no" with recent errors argues for inspection.
- **Probe workload** is reported per **day**; `MAX_PROBES_PER_SESSION` caps a *session* — "4 due"
  against a cap of 3 is not a violation. Overdue probes remain valid data: the report gives the
  interval that actually elapsed, not the scheduled one. What debt implies is a pacing question,
  not a validity one.
- **Lapse tables:** skew toward `x-de` (production) is the expected asymmetry — monitor, don't
  react. Two productive-direction lapses on one lexeme trigger a review of that entry's forms,
  contrast and context (program decision rules), not an automatic card change.
