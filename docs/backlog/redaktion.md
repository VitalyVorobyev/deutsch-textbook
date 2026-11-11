# Backlog · Redaktion

The editorial workbench. The format and the ID rule are in the [backlog README](README.md).

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

- **RED-4 · The evidence desk.** Redaktion shows nothing of what the learner did, so the owner's
  weekly editorial work (ruling a rejected rendering, finding the item behind a confusing
  answer) happens in a Claude session over `bun run progress:audit`. A view over the local
  snapshot and `data/grading-decisions.yaml`: per item its attempts, score and rejected
  renderings, worst first; from a row, accept or constrain a rendering (writes the ruling), open
  the source, or file an Anliegen. Reuse the audit's readers (`buildAudit`,
  `scripts/progress-audit.ts`) through `apps/redaktion/plugin/corpus.ts`; never a second grader.
  First step: the owner's findings from a hands-on session, then the read-only list.
