# Roadmap

Where the course is going and the gates in front of it. The [backlog](backlog/README.md) owns
executable work, [proposals](proposals/README.md) own directions not yet decided, and the
[curriculum contract](curriculum/a2-b1.md) owns identities.

## Product direction

Deutsch-Atlas is a local-first German course. Its success criterion is delayed retention and
transfer to a new context, not content volume or page views. The learner aims at B2. Five
boundaries hold throughout:

- recommendations are soft and never lock deliberate exploration;
- input, retrieval, interaction and production are distinct learning touches;
- optional documents, references and illustrations create no mastery and no review debt;
- progress claims come from current instruments and reproducible commands
  ([ADR 0003](adrs/0003-the-evidence-model.md), [ADR 0004](adrs/0004-completeness-is-evidence-contracts.md));
- content quality and CEFR discipline outrank feature count.

## Where it stands

A1, A2 and B1 are authored and their denominators closed. The current figures are the commands
listed in [`CLAUDE.md`](../CLAUDE.md) (`coverage.ts`, `grammar-coverage.ts`, `structures.ts`,
`themen.ts`, `handlungen.ts`). Every B1 topic has had its topic-quality pass, and every B1 article
reads German-first. Shipping the catalogue was never a claim that a competence was retained.

## Horizons

### Now: evidence, language debt, a clean workspace

1. **Read the evidence honestly.** Drain the grading queue to zero, rerun
   `bun run progress:audit --profile vitaly --pull`, and only then read the weak-focus table. The
   A2 checkpoint's 2/7/21-day read is the next revision trigger.
2. **Pay the language debt** that no gate sees: the RU/UK halves of the B1 translations (C6-3) and
   the RU/UK calque review (C6-1).
3. **Finish the workspace restructuring.** Foundational ADRs, proposals, an area-split backlog,
   Tonwerk as one app, and an agent layer scoped by directory.

### Next: three initiatives, decided before they are built

Each goes **proposal → ADR → backlog** and starts only when its ADR is accepted. The owner sets
the order. The suggested order follows the dependencies:

1. **The tools on lab-ui** ([proposal](proposals/ui-on-lab-ui.md)). Tonwerk and Redaktion are on
   it: both frames are `@vitavision/workbench`, and each app's look is a theme of `@vitavision/ui`
   ([ADR 0011](adrs/0011-shared-ui-from-vitavision-packages.md)). The learner app comes last. The
   **Tonwerk studio** ([ADR 0012](adrs/0012-editorial-tools-and-the-tonwerk-studio.md),
   [queue](backlog/tonwerk.md)) and Redaktion's governance work ([queue](backlog/redaktion.md))
   continue on that base.
2. **The lesson task system and the recurring cast**, decided together in
   [ADR 0016](adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md). A lesson becomes tasks
   built on one stimulus each. A character becomes content, and a voice stays casting. Genre lives
   in the reading serials. The first four people, Lena, Mira, Timo and Frau Kern
   ([ADR 0017](adrs/0017-the-first-four-are-the-lena-serials-cast.md)), have records that the
   validator holds. Each speaks through one of the twelve roster voices, and the rest speak the
   walk-on roles ([ADR 0018](adrs/0018-the-twelve-roster-voices-are-the-whole-pool.md)). The steps
   run in order: the rollout of the task shape that the A2 and B1 pilots proved (CON-10), the
   recasts (TON-6), the continuity debt (CON-9), then the Krimi serial (CON-7).
3. **The learner app on lab-ui**, once its visual language is written down and the tools have
   proved the theme layer.

### Then: B2

B2 starts from the same evidence contracts as A1–B1. Before any B2 topic is authored, the course
needs:

- the units of the curriculum contract, [`curriculum/b1-b2.md`](curriculum/b1-b2.md). Its anchors
  and rules are written, and its units are not;
- the lexical and structural anchor. Goethe publishes no B2 list and points to *Profile deutsch*
  instead (P26-7, to buy);
- the task shape, which A2 `freunde-feste` and B1 `gesellschaft-zusammenleben` now pilot, so that
  B2.1 is authored once, in its final shape.

## Tools at full power

**Redaktion** is done when an editor can locate a grammar line, follow its course evidence, edit
YAML and MDX with conflict protection, read local and corpus diagnostics, see every kind of
material with its owner and its review state, review what Claude changed and file findings into
the shared queue ([ADR 0014](adrs/0014-material-governance.md)), in the packaged macOS app. The open milestones are in
[`backlog/redaktion.md`](backlog/redaktion.md).

**Tonwerk** is done when it starts as one app and a scene goes from script to published audio
entirely in the UI and the engine's publish command. That means a roster with stable voices, a
library of everything it made, edits on a timeline that only ever change the scene document,
every explanation half editable, renders measured and approved by exact bytes, and no CLI-only
step left except installation and publishing. Content-level characters follow once the tracks
are good enough to carry them. The open work is in [`backlog/tonwerk.md`](backlog/tonwerk.md).

## Retention gate

A competence is readable only after at least three delayed attempts. The A1 gate passes when at
least 80% of readable competences retain the graded target and the free-production channel reaches
70%.

```sh
bun run progress:audit --profile vitaly --project <date>   # can the gate be read by then?
bun run progress:audit --profile vitaly                    # what the evidence says now
```

Engagement, same-day accuracy and page views cannot substitute for either. **A miss opens revision
work; it does not stop authoring**, because applied literally the rule would halt the curriculum on
evidence that covers part of a level.

## Standing streams

These are not scheduled; they continue as authoring windows allow:

- **Learner app on the phone.** The daily loop runs on the phone. Open items: navigation, touch
  targets and the Wortschatz list ([`backlog/learner-app.md`](backlog/learner-app.md)).
- **Cross-links, Referenz and readings.** Every "see also" edge is derived from data, never
  hand-maintained ([ADR 0001](adrs/0001-repository-is-the-content-database.md)).
- **Semantic learning visuals.** Generated scenes only where physical context helps;
  deterministic HTML/SVG for grammar, sentence topology and time.
- **Entdecken and documents.** Authentic tasks, explicit provenance, no completion state.
- **Language quality.** EN/RU/UK/DE parity, and the calque review.

Two constraints hold across all of them:

- Add a semantic figure only when a named relation is clearer spatially than in prose or a table.
- Keep the authentic-document and extensive-reading streams growing without turning exploration
  into obligation.
