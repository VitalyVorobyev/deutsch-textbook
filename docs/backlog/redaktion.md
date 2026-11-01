# Backlog · Redaktion

The editorial workbench. The format and the ID rule are in the [backlog README](README.md). The
governance entries implement [ADR 0014](../adrs/0014-material-governance.md), in this order.

- **RED-2 · The census covers every kind.** Level ownership is done; what is left:
  - Add as graph elements: readings, documents, listening scenes, planned scenes, reading-audio
    slots, Referenz pages (with the focus tags each covers), Wortnetze and LiD lessons.
  - Index grading rulings and provenance by topic.
  - Derive Materialien's tabs from element kinds.

  Evidence: Bestand filters for kind `referenz`, which no element has, and its Übungen tab lists
  no `pruefungspraxis` (`apps/redaktion/src/views/Bestand.tsx`).
- **RED-3 · Review ledger and Prüfen.** Add `data/review-ledger.yaml` (file, state, revision hash,
  by, at, note), owner-only `owner-reviewed` writes that set B1 provenance `humanReview`, and the
  Prüfen inbox with a diff against the reviewed revision. Retire topic `status:`: carry the ten
  reviewed topics into ledger rows, derive topic review from the ledger, and update the validator,
  `/about` and the docs that read the field. A ledger write invalidates no content graph: it is
  served from its own endpoint and the watcher skips it, because a review pass is many one-file
  writes. First step: `grep -rn "status: reviewed\|'reviewed'"`
  over `scripts/`, `packages/`, `src/` and `apps/` to list the readers.
- **RED-4 · The shared queue.** Add `data/redaktion-queue.yaml` (id, target, type, from, text,
  state, answer), filing from any element in Redaktion, a root `CLAUDE.md` line that reads it at
  session start, and Qualität and topic profiles that show open entries. Move the per-file
  findings of `docs/backlog/content.md` into it (`grep -cE '^- \`[ab][12]/' docs/backlog/content.md`).
  Like the ledger, a queue write never invalidates the graph.
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
