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

Each rejected rendering in the audit's queue gets one linguistic ruling, committed to
`data/grading-decisions.yaml` (`{item, given, decision, note, decidedAt}`; `given` is matched via
`normalizeTranslation`). The queue is derived from the attempt log and has no memory — the
committed ruling is what makes it drain. A decided rendering leaves the queue; the audit's
"Grading rulings" line counts ruled vs awaiting.

- **accept** — correct, target-preserving German. Paired in the same change: add it to the item's
  `accept` list and bump `revision` — unless the scorer's slip-forgiveness already covers it (the
  queue row says "current grader no longer rejects this response"), in which case the ruling alone
  suffices. Either way `bun run validate` re-grades the rendering and fails a stale claim. The
  attempts stay excluded from focus signals: they were never grammar errors.
- **constrain** — good German that bypasses the target → add a bilingual `instruction` constraint
  and bump `revision`. Attempts stay excluded, same reason.
- **confirm** — the rejection was right → no content change. The exclusion lifts and the attempts
  re-enter the focus signals with attribution recomputed under today's grader — never the stored
  historical tag, which may be an older scorer's false attribution.

Record any real confusion worth a future drill item in the `note` ("drill note: …") — drill
authoring reads the notes. The linguistic criteria are CLAUDE.md's `translate`/`accept` and
`key_tokens` rules — apply those, do not restate or improvise them.

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
