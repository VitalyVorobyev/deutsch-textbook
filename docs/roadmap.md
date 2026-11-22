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
reads German-first with an English translation; Russian and Ukrainian halves are not authored for
B1 articles. Shipping the catalogue was never a claim that a competence was retained.

**B2 is open by the owner's ruling, not by the retention gate.** When it was opened, `translate`
stood at 47% and the readable competences at ≥80% retention at 8 of 24 in A1, 14 of 46 in A2 and
9 of 35 in B1 (`bun run progress:audit --profile vitaly`, snapshot 2026-11-21). The gate below is
still read, and a miss still opens revision work.

## Horizons

### Now: B2, authored once and in its final shape

The B2 contract is [`curriculum/b1-b2.md`](curriculum/b1-b2.md): its anchors, its rules and its
units. B2 has no purchased inventory behind it; its denominators are compiled from free formal
sources, which that file and [`data/strukturenlisten/README.md`](../data/strukturenlisten/README.md)
name ([ADR 0024](adrs/0024-b2-denominators-are-compiled-from-free-sources.md)). Each unit is
authored in the task shape of [ADR 0016](adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md)
from B2.1, with the `ship-topic` skill, one unit per PR. The queue is
[`backlog/content.md`](backlog/content.md).

The owner's entry point to all of it is the `atlas` skill: Claude opens the queue, the audit and
the tools, and files what he says.

### Beside it: three streams that B2 does not wait for

1. **The learning loop: production.** Selection and recognition hold; building a German sentence
   around a taught structure does not, and several B1 points do not survive three weeks (the
   *readable competences at ≥80%* lines, the `translate` score and the card lapses by direction in
   `bun run progress:audit --profile vitaly --pull`). A failed `translate` comes back once in the
   same run as a lighter form of the same sentence. About half of the failed translations miss
   the taught structure itself, the rest one word beside it (counted by re-grading every logged
   `translate` attempt with `gradeTranslation` and comparing a miss against its closest accepted
   rendering). Open: sessions that lean toward production where selection is already safe, the
   drills the audit names (P26-11), and confirming that the families whose sets were never served
   now arm (INS-10).
2. **The task shape and the cast in A1–B1**
   ([ADR 0016](adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md)). A lesson is tasks built
   on one stimulus each, and a character is content while a voice stays casting. The four serial
   characters, Lena, Mira, Timo and Frau Kern
   ([ADR 0017](adrs/0017-the-first-four-are-the-lena-serials-cast.md)), have records, voices
   ([ADR 0018](adrs/0018-the-twelve-roster-voices-are-the-whole-pool.md)) and faces. Two topics
   are converted; the rollout over the rest (CON-10) clears each topic's recasts (TON-6) and
   continuity places (CON-9) as it goes, in batches, as recording time allows.
3. **The tools.** Redaktion gets a weekly job: a desk over the learner's snapshot and the grading
   rulings, where the owner rules a rendering, opens the item's source or files a finding
   ([`backlog/redaktion.md`](backlog/redaktion.md)). Tonwerk: the owner's Hörprobe of the
   published dialogues, then the narration plan and the recast, so that each recording is
   synthesised once ([`backlog/tonwerk.md`](backlog/tonwerk.md)). Both are on lab-ui
   ([ADR 0011](adrs/0011-shared-ui-from-vitavision-packages.md)); the learner app follows once its
   visual language is written down ([proposal](proposals/ui-on-lab-ui.md)).

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
