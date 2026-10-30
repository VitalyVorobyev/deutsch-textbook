# Backlog

The executable queue, one file per area. The [roadmap](../roadmap.md) owns direction and
[proposals](../proposals/README.md) own undecided directions. A finished entry is deleted in the
change that finishes it; `git log` and [`../../CHANGELOG.md`](../../CHANGELOG.md) are the record of
what shipped.

## Entries

An entry states:

- **what** the problem is, with **why** in one line;
- **where the evidence is**: a command or a `file:line`;
- **the first step**.

**IDs are stable identities.** An entry keeps the ID it was filed under, because commits and docs
cite them. Code and content never do: a comment states what is true and why, and the entry is
deleted when the work is done (`tests/source-hygiene.test.ts`). The `P`, `C` and `F` series are the
older numbering and stay as they are. A new entry takes its area's prefix and the next free number
in that file: `CON`, `APP`, `INS`, `STO`, `TON`, `RED` or `WS`. A number is never reused.

| Area | File |
| --- | --- |
| Course content | [`content.md`](content.md) |
| Learner app and learner feedback | [`learner-app.md`](learner-app.md) |
| Instruments and gates | [`instruments.md`](instruments.md) |
| Desktop and storage | [`storage.md`](storage.md) |
| Redaktion | [`redaktion.md`](redaktion.md) |
| Tonwerk | [`tonwerk.md`](tonwerk.md) |
| Workspace and tooling | [`workspace.md`](workspace.md) |

## Doing

- **P27 · Redaktion**: the milestones in [`redaktion.md`](redaktion.md), in order.
- **TON-1…TON-5 · Tonwerk studio**: one app, Bibliothek, Figuren and voice quality, the timeline
  editor, then production and the learner integration ([`tonwerk.md`](tonwerk.md)), in order.
- **P9-2 · Entdecken pieces.** Recurring, one or two reviewed pieces per PR, each passing
  [future-content-directions.md](../authoring/future-content-directions.md).

## Calendar gates

- **A2 checkpoint review.** Read the A2 checkpoint's 2/7/21-day evidence as a B1 revision trigger.
  `bun run progress:audit --profile vitaly --pull` says whether it can be read yet.
- **P5-11 · Evidence cadence.** Drain the grading queue, rerun `bun run progress:audit --profile
  vitaly`, then decide whether content or drills need revision — never from a pre-triage weak-focus
  table. Standing read: every persistent weak tag has a serving drill, so the owed action is the
  learner taking training; production assembly (`translate` under `cloze` and `mc`) is the durable
  weakness. Confirm both against the current audit before acting on either.

## Deferred

Each needs a measured learning or usability need first: committed neural-TTS expansion,
pronunciation assistance, runtime and branching missions, spoken-mode placement (P13-1), a
next-level placement offer (P13-2), the listening retention pilot after the A1 gate (P5-7), and the
DTZ §9.2 Wortliste cross-check (P26-17 — a one-off report whose extraction is a project).
