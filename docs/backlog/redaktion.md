# Backlog · Redaktion

The editorial workbench. The format and the ID rule are in the [backlog README](README.md). The
governance entries implement [ADR 0014](../adrs/0014-material-governance.md), in this order.

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
