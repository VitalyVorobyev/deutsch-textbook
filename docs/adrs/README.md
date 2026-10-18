# Architecture Decision Records

An ADR records a **foundational decision**: one that a new contributor must know before changing
the system, that holds after the code moves, and whose reversal would change what the product is.
It states the decision as it stands, with the forces behind it and the costs accepted.

**What is not an ADR:**
- an incident fix or its post-mortem — the mechanism goes in `architecture/`, and the lesson in a
  test;
- an operational runbook — it lives with its subsystem;
- a feature spec;
- a direction still under discussion — that is a [proposal](../proposals/README.md).

If a record needs function names, constants or line numbers to make its point, it is in the wrong
place.

## Format

Every ADR is one file, `NNNN-<slug>.md`:

1. **H1 title**: `ADR NNNN: <the decision, stated as a rule>`.
2. **Status line**: `Status: accepted · YYYY-MM-DD`, or `superseded by NNNN · YYYY-MM-DD`.
3. `## Context`: the situation and the forces that made a decision necessary.
4. `## Decision`: what was decided, as the rule it is.
5. `## Consequences`: the guarantees bought, the costs accepted, and what the decision
   deliberately does not do.

Keep one under ~80 lines. Link operational detail; do not carry it.

## Numbering and change

Four digits, zero-padded, next free number. **Never reuse a number.** An accepted ADR is not edited
for substance: a changed decision is a new ADR that supersedes it, and the old one's status line
names its successor. Fixing a broken link or a typo is not a change of substance.

Every `ADR NNNN` mention anywhere in the repository must name an existing record, and
`tests/docs-links.test.ts` fails if one does not.

## Index

| ADR | Decision |
| --- | --- |
| [`0001`](0001-repository-is-the-content-database.md) | The repository is the content database |
| [`0002`](0002-topic-manifests-and-learning-activities.md) | A topic is one manifest, and its exercises are organised as learning activities |
| [`0003`](0003-the-evidence-model.md) | What counts as learning evidence, and what never does |
| [`0004`](0004-completeness-is-evidence-contracts.md) | Course completeness is a set of evidence contracts against named anchors |
| [`0005`](0005-explanation-languages.md) | Explanations are authored per language, and B1 reads German first |
| [`0006`](0006-local-first-durable-learner-state.md) | Learner state is local-first, and the store never fails silently |
| [`0007`](0007-opaque-snapshot-sync-and-approval-accounts.md) | Sync stores opaque snapshots, and an account grants nothing until approved |
| [`0008`](0008-delivery-static-site-desktop-shell-worker.md) | The course ships as a static site, a thin desktop shell and one Worker |
| [`0009`](0009-third-party-and-official-material.md) | What third-party and official material may enter the repository |
| [`0010`](0010-editorial-tools-are-separate-apps.md) | Editorial tools are separate applications over the checkout |
| [`0011`](0011-shared-ui-from-vitavision-packages.md) | Shared UI comes from the `@vitavision/*` packages, and each app's identity is a theme |

All eleven were accepted on 2026-10-18. They restate, as one foundational set, the decisions of an
earlier series of 22 records. That series is in git history (`git show fa110bd:docs/adrs/`), and
none of it is in force except as restated here.
