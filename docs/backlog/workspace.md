# Backlog · Workspace

Repository structure, toolchain and agent tooling. The format and the ID rule are in the [backlog README](README.md).

- **P30-3 · Type-aware Oxlint.** `oxlint --type-aware` (needs `oxlint-tsgolint`, which runs on TS
  7) reports 117 findings across 9 rules: `unbound-method` 57 (mostly destructured React hooks in
  `apps/tonwerk/src/views/`), `restrict-template-expressions` 14, `await-thenable` 13,
  `no-base-to-string` 12, `no-floating-promises` 9, `no-misused-spread` 6, three rules at ≤ 2.
  First step: triage `await-thenable` and `no-floating-promises` — either can hide a real ordering
  bug — switch off what fires only on React idiom, then add `--type-aware` to `lint`. `bun audit`
  still reports one moderate build-time advisory, `postcss-selector-parser` 6 via
  `@tailwindcss/typography`.
- **WS-1 · `scripts/validate.ts` is one 2,571-line script** (`wc -l scripts/validate.ts`), so no
  rule can run on its own. Redaktion needs exactly that to validate only the file it saved
  (P26-16). First step: list the rule families and their inputs. Then move them, one family per
  change, into a registry in `@da/content` whose rules each declare the files they read, with
  `validate.ts` as a thin runner.
- **WS-2 · Every test lives in `tests/`**: 110 files, and none beside the package or app it tests
  (`find packages -name '*.test.*' -not -path '*/node_modules/*'` finds none). A package's tests cannot run, move or be read with the
  package. First step: move `@da/grading`'s tests beside its sources and make `bun test` pick both
  up. Then decide per package.
- **WS-3 · The learner snapshots are still in git history.** `progress/<profile>/` is untracked
  since #301, but 16 MB of personal history remains reachable in a public repository. Purging it
  rewrites history and invalidates every clone: an owner decision. First step: the decision. Then
  `git filter-repo --path progress/vitaly --invert-paths` on a fresh mirror, with a force-push.
