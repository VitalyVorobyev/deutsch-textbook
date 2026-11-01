# ADR 0014: Every kind of material has one owner, one review state that expires, and one shared queue

Status: accepted · 2026-11-01 · its provenance clause superseded by [0015](0015-review-is-reading-provenance-is-decisions.md) · 2026-11-01

## Context

The owner asked for Redaktion to give "clear overview, management, governance of material",
because readings, grammar summaries and lesson exercises were "still a mess". A review of every
kind of material found the following:

- Redaktion's quality queue showed no findings, while the open work sat in Markdown backlogs and in
  20 pending provenance records.
- Only topics carried a review status (10 of 57), and that status never expired when a topic's
  files changed.
- The content graph did not model six kinds of material, and Redaktion's material index missed
  three more.
- 77 of 227 teaching sets were not named after their topic, in at least four conventions.
- The 12 exam practice sets, the checkpoints and the placement tests were attached to topics they
  have nothing to do with, only to fix a position in the course.

The figures and their commands are in the review, at `git show db6e513:docs/proposals/material-governance.md`.

Owner and Claude cooperated through chat and pull requests only. Neither side had a durable place
to file a finding against a file and see it answered.

## Decision

**Every kind of material is an element of the content graph with exactly one owner: a topic or a
level.** Readings, documents, listening scenes, Referenz pages, Wortnetze, LiD lessons, planned
listening scenes and reading-audio slots all become elements; a planned item counts as an
absence. Checkpoints, placement tests and exam practice sets belong to their level, which their
directory already names. They carry no topic, and the scenes and documents only they use belong to
the level too. Where an instrument needs a position on the spine, a level-owned element sits at the
end of its level. Probes stay topic-owned, because each tests one topic's competence.

**A teaching set's name says its owner and its job, in one convention:**

| Name | Job |
| --- | --- |
| `<topic>` | the core lesson set |
| `<topic>-produktion` | the topic's transfer set |
| `<topic>-<point>` / `<topic>-<point>-transfer` | one point's extension set and its application |
| `<topic>[-<point>]-ausblenden` / `-remediation` | a fading step and a remediation step |
| `<topic>-hoeren` / `<topic>-diktat` / `<topic>-dokument` | listening scene, dictation, document task |
| `drill-<focus>` | a remediation drill, named by the focus it serves |

Off-convention names are renamed once. A set id is half of every attempt key, so the rename ships
with a permanent old-to-new map. The map is applied wherever learner state enters: snapshot import,
store open and the progress audit. This is the pattern the card-id migration already uses, and
every reference in the repository is rewritten in the same change. The validator then rejects a
new teaching set whose name breaks the convention.

**Review state lives in one committed ledger, per file, keyed by a hash of the reviewed bytes.**
The states are `draft → claude-reviewed → owner-reviewed`, and a file with no row is a draft. A
review expires when the file changes, and Redaktion shows the file as changed since review.
`owner-reviewed` means the same at every level: the owner read the file in Redaktion and accepts
it as what the course should teach. Only the owner sets it. For a B1 topic it also writes the
provenance record's human review, so the existing gate keeps working. Topic `status: reviewed`
becomes derived and the manifest field is retired. A topic is reviewed when its manifest, its
article and every element it owns are `owner-reviewed` at their current revision.

**Owner and Claude work one committed queue of findings, requests and questions.** Each entry
targets a file, an item, a topic or a kind. The owner files entries in Redaktion, and Claude reads
the queue at the start of every session. Claude answers an entry in the pull request that resolves
it, and a closed entry is deleted. A pull request that changes material writes `claude-reviewed`
rows, with a note on what to check, for every material file it touched. Redaktion's **Prüfen**
view is the owner's inbox for those rows. The per-file findings in the content backlog move into
the queue. Backlog entries with IDs stay where they are, because they are work items, not findings
on a file.

## Consequences

- One status means one thing for every kind of material, and it cannot outlive the bytes it
  covers. The debt is visible per kind and level instead of being hidden behind "reviewed".
- Redaktion's material index is derived from element kinds, so a new kind appears without a
  second edit.
- The rename costs one migration that must never be removed, like the card-id map. A client that
  predates it can still write an old id, and the next current client to open the store migrates
  that attempt as well.
- Redaktion still does no Git (ADR 0012), and the repository stays the database (ADR 0001). The
  ledger and the queue are ordinary files that the owner or Claude commits.
- No review state becomes a validator failure, apart from the existing B1 provenance rule.
  Nothing is backfilled, except the ten topics whose `status: reviewed` is carried into ledger
  rows when the field retires.
- Not decided here: merging sets in topics that `bun run activity:audit` reports as dense, and the
  names of probe families. Each is a separate question that needs its own measurement.
