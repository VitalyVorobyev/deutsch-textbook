# Backlog · Redaktion

The editorial workbench. The format and the ID rule are in the [backlog README](README.md).

- **P27 · Redaktion milestones.** In [roadmap](../roadmap.md#tools-at-full-power) order: Themen workspaces (P27-3),
  the Materialien index (P27-4), Qualität and Referenzen (P27-5), hardening and macOS delivery
  (P27-6). Also owed: renderer parity — nine image and reference figures still use named semantic
  editor representations instead of the learner's React components; P27-1 close (subdividing
  over-broad grammar tracks, a persisted graph cache, point→focus→topic→material desktop tests,
  watcher tests, a packaged macOS smoke run); P27-2 next (structured controls over the same source
  buffer, visible background-job status). Track acceptance: traversal, symlink, type and size
  security tests; byte-exact no-op, stale-revision, invalid YAML/MDX and corpus-invalid-draft tests;
  all renderer fixtures; checkout, watcher, save, refetch and relaunch integration; keyboard and
  screen-reader navigation at 1440/1024/768; a `.app`/`.dmg` smoke build.
- **P26-16 · Redaktion rebuilds the whole corpus after a one-field write** — ~6.6 s for the next
  `/__graph` plus ~6 s of validation. Invalidate per file and verify only the touched file's rules,
  before the editable-field allowlist grows.
