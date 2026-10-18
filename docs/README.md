# Developer documentation

The index of every document for people who change Deutsch-Atlas. [`CLAUDE.md`](../CLAUDE.md) is
the rule digest and maps each kind of job to the doc to read first; code, schemas and tests stay
authoritative for runtime behaviour.

## Two rules for these documents

**A dev doc states the current contract, the current queue, or how to do a job — nothing else.**
Dated pass logs, ledgers of closed findings, superseded rationale and notes on shipped work are
deleted rather than archived: `git log` is the archive. A doc that has to explain how a rule came
to be is carrying history, and a reader pays for it on every visit. ADRs are the one exception,
because a decision record is dated by nature; they are superseded by a new ADR, never edited.
A direction still being argued is a proposal, not an ADR.

**User documents and developer documents never restate each other.** The user side is
[`README.md`](../README.md), [`CHANGELOG.md`](../CHANGELOG.md), [`NOTICE.md`](../NOTICE.md), the
app guides in [`apps/`](apps/README.md), and the site's `/about` and `/install` pages. It says what
the software does and how to use it. The developer side is everything else here, plus the root and per-directory `CLAUDE.md` files and
the skills in `.claude/skills/`; it says how the system works and how to change it. Each side links
to the other where a reader needs to cross, and copies nothing — duplicated text drifts.

## Map

| Document | What it is for |
| --- | --- |
| [`overview.md`](overview.md) | The system map: boundaries, pipelines, identities, evidence, storage, delivery |
| [`roadmap.md`](roadmap.md) | Current direction and the gates in front of it |
| [`backlog/`](backlog/README.md) | The executable queue, one file per area |
| [`adrs/`](adrs/README.md) | Foundational decisions, numbered, superseded rather than edited |
| [`proposals/`](proposals/README.md) | Directions under discussion; each ends in an ADR or is deleted |
| **Curriculum** | |
| [`curriculum/a2-b1.md`](curriculum/a2-b1.md) | What A2 and B1 teach, which unit owns what, what each may not touch |
| **Authoring** | |
| [`authoring/article-prose.md`](authoring/article-prose.md) | How an explanation article is shaped; the paragraph ceiling |
| [`authoring/item-authoring.md`](authoring/item-authoring.md) | Exercise and vocabulary contracts: `key_tokens`, item mix, placement, vocab entries |
| [`authoring/focus-tags.md`](authoring/focus-tags.md) | The registered confusion taxonomy, held equal to `focusIntroducedBy` by a test |
| [`authoring/authoring-checklists.md`](authoring/authoring-checklists.md) | What a finished topic owes; the decision rules and drills-from-progress procedure |
| [`authoring/content-quality-audit.md`](authoring/content-quality-audit.md) | The topic-profile review contract and the unit gate |
| [`authoring/coverage-instruments.md`](authoring/coverage-instruments.md) | How every coverage figure is earned, never asserted |
| [`authoring/lautschrift.md`](authoring/lautschrift.md) | IPA conventions and the review behind `bun run gen:ipa` |
| [`authoring/future-content-directions.md`](authoring/future-content-directions.md) | Admission contract for Entdecken, documents and editorial media; the LiD lesson-figure contract |
| [`authoring/product-protection.md`](authoring/product-protection.md) | Ownership, licensing and the authorship-provenance contract |
| **Architecture** | |
| [`architecture/runtime-contracts.md`](architecture/runtime-contracts.md) | The engineering invariants behind `src/lib/`, with their source and test map |
| [`architecture/content-graph.md`](architecture/content-graph.md) | The content graph, the package boundaries and Redaktion's write path |
| [`architecture/cloud-sync.md`](architecture/cloud-sync.md) | Accounts and snapshot sync: operations, setup, the sign-in runbook |
| [`architecture/exam-trainer.md`](architecture/exam-trainer.md) | The Goethe exam trainer and its local-only materials |
| [`architecture/lid-trainer.md`](architecture/lid-trainer.md) | The Leben-in-Deutschland bank: legal basis, import, answer key, progress, lessons |
| [`architecture/tts-reliability.md`](architecture/tts-reliability.md) | What Tonwerk's synthesis engine measurably does on this machine |

`Goethe-Zertifikat_B1_Wortliste.pdf` (gitignored) and `ui.png` at this level are supporting files,
not documents. `GeotheInstitute/` holds the local-only official exam materials
([ADR 0009](adrs/0009-third-party-and-official-material.md)).
