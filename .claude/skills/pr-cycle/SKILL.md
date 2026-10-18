---
name: pr-cycle
description: The Deutsch-Atlas pull-request cycle — branch, gates, CHANGELOG, PR, review gate, squash-merge. Use whenever you are about to commit, open a PR, answer a review, or merge in this repository, even if the user only says "ship it", "make a PR", "merge" or "push this".
---

# The PR cycle

Every merge to `main` deploys production. So a PR is a coherent batch of work, never a single
small change, and exactly **one PR is open per session**.

## 1. Branch and batch

- Branch off a fresh `main`. Never commit on `main`.
- Bundle a whole phase into one PR: all repair waves of one kind, or all grading rulings with the
  drills they justify. Do not split work into PRs smaller than about an hour of authoring.
- While one PR waits on CI, prepare the next batch on a **local** branch off `main`. Commit it,
  but do not push it and do not open its PR until the open one has merged.
- Never stack PRs on each other.

## 2. Gates, before every push

```sh
bun run validate && bun test tests/ && bun run check && bun run lint && bun run fmt:check
```

Add `bun run build` when pages, components or content collections changed. Add
`bun run tonwerk:check && bun run tonwerk:test` when `apps/tonwerk/ui` changed. Run
`uv run ruff check . && uv run mypy && uv run pytest` in `apps/tonwerk/engine` when the engine
changed. A change that needs a gate run must say so: report failures with their output, and never
claim a gate you did not run.

## 3. CHANGELOG

Write the learner-visible lines under `## [Unreleased]` in `CHANGELOG.md`, saying what a learner
sees or can now do. Tooling-only work gets one plain line. **Do not bump a version or push a tag**:
releases are cut per batch with the `cut-release` skill.

## 4. Commit and open

- Write the message to a file and use `git commit -F`. Inside `-m "…"`, zsh command-substitutes
  backticks and silently eats the quoted names.
- End commit messages and PR bodies with the attribution lines the session specifies.
- The PR body says what changed, why, and how it was verified, including the gates run and any
  watched failure for a new rule.

## 5. Review and merge

- Wait for CI, then run `bun run review:gate`. It checks:
  - the PR is not a draft;
  - CI is green;
  - no actionable thread is unresolved;
  - no change request is outstanding.
- **It waits for no reviewer.** When it passes, squash-merge:

  ```sh
  gh pr merge <n> --squash --delete-branch
  ```

- If a review has already landed, answer **only the first round**.
  - Fix material findings: those that change what the learner sees, does or is measured on.
  - File the rest as backlog entries (`docs/backlog/<area>.md`).
  - Reply to each thread with a verdict, the fix and its scope, then resolve the thread.
  - Never push and wait for a second round.
- A finding you caused yourself is still a backlog item when it is not material.

## 6. After merging

- `git checkout main && git pull`.
- A pull that deletes a file which was tracked on `main` but is gitignored on your branch also
  deletes your local copy. Check `progress/<profile>/` after any change to tracking, and restore
  from the pre-merge commit if needed.
- Continue with the prepared local branch, if there is one.
