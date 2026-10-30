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

1. **The tools on lab-ui** ([proposal](proposals/ui-on-lab-ui.md)). Redaktion first, then Tonwerk.
   The authoring work below will be done in these tools, so they come first. The owner has started
   the **Tonwerk studio** ahead of the rest
   ([ADR 0012](adrs/0012-editorial-tools-and-the-tonwerk-studio.md), [queue](backlog/tonwerk.md)).
   Its editor is the first Tonwerk surface built on lab-ui.
2. **The lesson task system** ([proposal](proposals/lesson-task-system.md)) and **characters and
   stories** ([proposal](proposals/characters-and-stories.md)), decided together. A story is a
   kind of input inside a lesson, so neither design is complete without the other. Tonwerk's cast
   becomes content-level characters that readings, scenes and tasks reference.
3. **The learner app on lab-ui**, once its visual language is written down and the tools have
   proved the theme layer.

### Then: B2

B2 starts from the same evidence contracts as A1–B1. Before any B2 topic is authored, the course
needs:

- a curriculum contract (`docs/curriculum/b1-b2.md`): units, owned structures and frozen
  identities;
- named anchors for the denominator. The Goethe B2 *Prüfungsziele* is held locally (gitignored,
  [ADR 0009](adrs/0009-third-party-and-official-material.md)). Whether a published lexical list
  exists for B2 is an open question, to be checked before the Wortliste instrument is extended;
- the decision on the lesson task system, so B2 is authored once, in its final shape.

## Tools at full power

**Redaktion** is done when an editor can locate a grammar line, follow its course evidence, edit
YAML and MDX with conflict protection, read local and corpus diagnostics, and mark a topic
`reviewed` only through the green gate, in the packaged macOS app. The open milestones are in
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
