# Backlog · Redaktion

The editorial workbench. The format and the ID rule are in the [backlog README](README.md). The
governance entries implement [ADR 0014](../adrs/0014-material-governance.md), in this order.

- **P26-16 · Redaktion rebuilds the whole corpus after a one-field write** — ~6.6 s for the next
  `/__graph` plus ~6 s of validation. Invalidate per file and verify only the touched file's rules.
  First, because every ledger row and queue entry is a one-file write, and so is every Prüfen
  action.
- **RED-1 · One naming convention for teaching sets, with an attempt-key migration.** 77 of the
  227 teaching sets carry no topic prefix, and more use `-anwenden` or a level suffix (the
  set-name comparison in `git show db6e513:docs/proposals/material-governance.md`, appendix).
  Their attempts number at most 213 of the learner's log (snapshot 2026-11-01, counted per set
  id). First step: generate the old-to-new map from each set's `topic`, `stage` and `activity`,
  and read it once by hand before anything is renamed. Then apply it in one change:
  - rename the files;
  - rewrite manifests, probe `arming:` lists and grading rulings;
  - add the map at snapshot import, store open and in `progress:audit`, next to the card-id map;
  - add a validator rule for the convention, and watch it fail.
- **RED-2 · The census covers every kind, and the level owns level-wide material.**
  - Add as graph elements: readings, documents, listening scenes, planned scenes, reading-audio
    slots, Referenz pages (with the focus tags each covers), Wortnetze and LiD lessons.
  - Index grading rulings and provenance by topic.
  - Give checkpoints, placements and exam practice sets (with the scenes and documents only they
    use) a level owner and no `topic:`.
  - Derive Materialien's tabs from element kinds.

  Evidence: Bestand filters for kind `referenz`, which no element has, and lists no exam practice
  (`apps/redaktion/src/views/Bestand.tsx`).
- **RED-3 · Review ledger and Prüfen.** Add `data/review-ledger.yaml` (file, state, revision hash,
  by, at, note), owner-only `owner-reviewed` writes that set B1 provenance `humanReview`, and the
  Prüfen inbox with a diff against the reviewed revision. Retire topic `status:`: carry the ten
  reviewed topics into ledger rows, derive topic review from the ledger, and update the validator,
  `/about` and the docs that read the field. First step: `grep -rn "status: reviewed\|'reviewed'"`
  over `scripts/`, `packages/`, `src/` and `apps/` to list the readers.
- **RED-4 · The shared queue.** Add `data/redaktion-queue.yaml` (id, target, type, from, text,
  state, answer), filing from any element in Redaktion, a root `CLAUDE.md` line that reads it at
  session start, and Qualität and topic profiles that show open entries. Move the per-file
  findings of `docs/backlog/content.md` into it (`grep -cE '^- \`[ab][12]/' docs/backlog/content.md`).
- **P27 · Hardening and delivery.**
  - Renderer parity: nine image and reference figures still use named editor representations
    instead of the learner's React components.
  - Subdivide over-broad grammar tracks.
  - Persist the graph cache.
  - Desktop tests of the point → focus → topic → material path, and watcher tests.
  - Structured controls over the same source buffer, and visible status for background jobs.
  - A packaged macOS `.app`/`.dmg` smoke build.

  Acceptance:
  - security tests for traversal, symlinks, file types and sizes;
  - tests for a byte-exact no-op, a stale revision, invalid YAML/MDX and a draft that breaks the
    corpus;
  - all renderer fixtures;
  - integration of checkout, watcher, save, refetch and relaunch;
  - keyboard and screen-reader navigation at 1440, 1024 and 768 px.
