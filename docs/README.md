# Deutsch-Atlas documentation

This is the canonical documentation index — the wiki home. `CLAUDE.md` is authoritative for
project-wide authoring rules; code, schemas and tests remain authoritative for runtime behaviour.
Each subdirectory carries its own README with a closer view of its documents.

## Root

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`../CLAUDE.md`](../CLAUDE.md) | Authoring rule digest and “read before doing X” map | authoritative | an enforced authoring rule changes |
| [`design.md`](design.md) | Stable technical map, identities and data flow | active | a subsystem boundary or source of truth moves |
| [`roadmap.md`](roadmap.md) | Current product direction and gates | active | priorities or milestone gates change |
| [`backlog.md`](backlog.md) | Executable, calendar-blocked and deferred work | active | work starts, finishes or becomes blocked |

## [`curriculum/`](curriculum/README.md)

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`curriculum/a2-b1.md`](curriculum/a2-b1.md) | Frozen A2/B1 identities, ownership and unit contracts | authoritative | an owner-approved curriculum amendment is recorded |
| [`curriculum/b1-authoring-handoff.md`](curriculum/b1-authoring-handoff.md) | Claude handoff contract for the current B1 two-unit window | active prompt | a unit window closes, or the frozen B1 contract or authorship gate changes |
| [`curriculum/a2-learning-led-program.md`](curriculum/a2-learning-led-program.md) | Evidence cadence and drill decision rules | active procedure | the operating cadence or gate dates change |

## [`authoring/`](authoring/README.md)

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`authoring/article-prose.md`](authoring/article-prose.md) | How an explanation article is shaped, and the paragraph ceiling | authoritative companion | the prose-shape rules or the cap change |
| [`authoring/item-authoring.md`](authoring/item-authoring.md) | Exercise and vocabulary contracts | authoritative companion | an item schema or grading rule changes |
| [`authoring/focus-tags.md`](authoring/focus-tags.md) | Registered confusion taxonomy | generated parity contract | a focus tag is added or removed |
| [`authoring/authoring-checklists.md`](authoring/authoring-checklists.md) | Topic, drill and release checklists | active | the lesson/review workflow changes |
| [`authoring/coverage-instruments.md`](authoring/coverage-instruments.md) | How lexical and grammar coverage are earned | active | an instrument or published figure changes |
| [`authoring/lautschrift.md`](authoring/lautschrift.md) | IPA field conventions and review procedure | active | pronunciation authoring changes |
| [`authoring/future-content-directions.md`](authoring/future-content-directions.md) | Admission contract for Entdecken, documents and editorial media | active | a new optional artifact class is admitted |
| [`authoring/product-protection.md`](authoring/product-protection.md) | Ownership, licensing and authorship-provenance contract | authoritative | ownership, licence scope or the provenance gate changes |

## [`architecture/`](architecture/README.md)

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`architecture/runtime-contracts.md`](architecture/runtime-contracts.md) | Compact engineering invariants and source/test map | active | a runtime contract changes |
| [`architecture/cloud-sync.md`](architecture/cloud-sync.md) | Accounts and snapshot sync: operations, setup and the sign-in runbook | active | an endpoint, secret, deploy step or recovery procedure changes |

## [`quality/`](quality/README.md)

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`quality/a1-learning-audit.md`](quality/a1-learning-audit.md) | Learning-system audit and unit quality gate | active baseline | a gate finding changes |
| [`quality/a1-linguistic-qa.md`](quality/a1-linguistic-qa.md) | A1 linguistic review ledger | ledger | an A1 review ruling lands |
| [`quality/a2-linguistic-qa.md`](quality/a2-linguistic-qa.md) | A2 linguistic review ledger | ledger | an A2 review ruling lands |
| [`quality/audio-retirement-ledger.md`](quality/audio-retirement-ledger.md) | Retired recordings, with the reason each one left | ledger | a recording is retired or kept with reasons |

## [`adrs/`](adrs/README.md)

Architecture Decision Records: accepted decisions with their context and consequences. Numbered,
never reused, never silently rewritten — see the [ADR index](adrs/README.md).

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`adrs/0001-bilingual-explanation-halves.md`](adrs/0001-bilingual-explanation-halves.md) | Explanation-language, Ukrainian and German-medium design | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0002-advisory-only-writing-assistant.md`](adrs/0002-advisory-only-writing-assistant.md) | Local writing-assistant contract (advisory only, never evidence) | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0003-opaque-snapshot-sync-and-approval-accounts.md`](adrs/0003-opaque-snapshot-sync-and-approval-accounts.md) | Why the sync server stores opaque bytes and sign-in grants nothing | accepted | never rewritten — superseded by a new ADR |

## Archive

[`archive/`](archive/) holds completed roadmaps, full historical backlogs, superseded rationale and
dated evidence reviews. Archived files explain why a rule exists; they do not override an active
contract, and their links are frozen with them. The Goethe Wortliste PDF
(`Goethe-Zertifikat_B1_Wortliste.pdf`) and `ui.png` at this level are supporting source/artifact
files, not active instructions.
