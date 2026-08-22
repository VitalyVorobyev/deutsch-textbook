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
| [`a1-goethe-schreiben-helper.md`](a1-goethe-schreiben-helper.md) | Study aid: how Goethe A1 Schreiben is scored, and the strategy that follows | reference | the published exam format or scoring changes |

## [`curriculum/`](curriculum/README.md)

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`curriculum/a2-b1.md`](curriculum/a2-b1.md) | Frozen A2/B1 identities, ownership and unit contracts | authoritative | an owner-approved curriculum amendment is recorded |
| [`curriculum/a2-learning-led-program.md`](curriculum/a2-learning-led-program.md) | Evidence cadence and drill decision rules | active procedure | the operating cadence or gate dates change |
| [`curriculum/a1-b1-completeness-audit.md`](curriculum/a1-b1-completeness-audit.md) | The completeness contract: which denominators a level is called complete against | active | a denominator is added or a contract clause changes |
| [`curriculum/level-completeness-audit.md`](curriculum/level-completeness-audit.md) | Per-level readings of those denominators | ledger | an instrument is rerun |
| [`curriculum/grammar-structure-audit.md`](curriculum/grammar-structure-audit.md) | The inventory audit against the published external Strukturenlisten | ledger | an anchor list changes or is re-audited |
| [`curriculum/learning-activity-audit.md`](curriculum/learning-activity-audit.md) | The activity-architecture pass under ADR 0014 | ledger | an activity audit is rerun |
| [`curriculum/topic-quality-audit.md`](curriculum/topic-quality-audit.md) | Topic-by-topic A1–B1 quality ledger | ledger | a topic pass lands |

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

## [`apps/`](apps/README.md)

How to *use* the applications this repository ships, as opposed to how to change them.

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`apps/README.md`](apps/README.md) | The three apps, what each is for, and how to start it | active | an app is added or its entry command changes |
| [`apps/redaktion.md`](apps/redaktion.md) | Redaktion: setup, the editorial walkthroughs, the save contract and its boundaries | active | the editor workflow or safety boundary changes |
| [`apps/tonwerk.md`](apps/tonwerk.md) | Tonwerk: engine setup, the six sections, the narration and approval walkthroughs | active | the studio workflow, the engine's entry commands or the approval contract change |

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
| [`quality/tts-reliability.md`](quality/tts-reliability.md) | What the synthesis engine measurably does on this machine | measured | the engine, the machine or the pinned revision changes |
| [`quality/ux-audit-2026-08.md`](quality/ux-audit-2026-08.md) | Three-form-factor UX findings, ranked | ledger | a form-factor audit is rerun |

## [`adrs/`](adrs/README.md)

Architecture Decision Records: accepted decisions with their context and consequences. Numbered,
never reused, never silently rewritten — see the [ADR index](adrs/README.md).

| Document | Purpose | Status | Update when |
| --- | --- | --- | --- |
| [`adrs/0001-bilingual-explanation-halves.md`](adrs/0001-bilingual-explanation-halves.md) | Explanation-language, Ukrainian and German-medium design | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0002-advisory-only-writing-assistant.md`](adrs/0002-advisory-only-writing-assistant.md) | Local writing-assistant contract (advisory only, never evidence) | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0003-opaque-snapshot-sync-and-approval-accounts.md`](adrs/0003-opaque-snapshot-sync-and-approval-accounts.md) | Why the sync server stores opaque bytes and sign-in grants nothing | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0004-first-run-accounts-and-automatic-sync.md`](adrs/0004-first-run-accounts-and-automatic-sync.md) | Accounts offered at first run; sync is already automatic; cloud is recommended | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0005-one-surface-for-fortschritt-and-konto.md`](adrs/0005-one-surface-for-fortschritt-and-konto.md) | `/progress` absorbs account and sync; `/konto` becomes a redirect | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0006-public-domain-classics-as-extensive-reading-corpus.md`](adrs/0006-public-domain-classics-as-extensive-reading-corpus.md) | Public-domain classics as the second extensive-reading strand | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0007-derived-cross-links-never-hand-maintained.md`](adrs/0007-derived-cross-links-never-hand-maintained.md) | Cross-links derived from focus tags, `deepens` and reference keys | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0008-character-ensemble-and-audio-studio.md`](adrs/0008-character-ensemble-and-audio-studio.md) | Recurring character ensemble and audio-studio productization | proposed | promoted or rejected by a new ADR |
| [`adrs/0009-official-exam-materials-local-only.md`](adrs/0009-official-exam-materials-local-only.md) | Official exam materials stay local; the trainer degrades honestly without them | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0010-probe-failure-remediation.md`](adrs/0010-probe-failure-remediation.md) | What happens when a delayed check fails: a session-end card and a named exhausted state | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0011-external-grammar-anchors.md`](adrs/0011-external-grammar-anchors.md) | Published Goethe inventories as the grammar denominator's own denominator | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0012-topic-manifests.md`](adrs/0012-topic-manifests.md) | A topic declares itself in one file | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0013-redaction-repository-workbench.md`](adrs/0013-redaction-repository-workbench.md) | Redaktion's architecture, write path and security boundary | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0014-learning-activity-architecture.md`](adrs/0014-learning-activity-architecture.md) | Exercise files keep identity; learning activities own purpose and presentation | accepted | never rewritten — superseded by a new ADR |
| [`adrs/0015-provable-course-completeness.md`](adrs/0015-provable-course-completeness.md) | Completeness is a set of evidence contracts, never one score | accepted | never rewritten — superseded by a new ADR |

## Archive

[`archive/`](archive/) holds completed roadmaps, full historical backlogs, superseded rationale and
dated evidence reviews. Archived files explain why a rule exists; they do not override an active
contract, and their links are frozen with them. The Goethe Wortliste PDF
(`Goethe-Zertifikat_B1_Wortliste.pdf`) and `ui.png` at this level are supporting source/artifact
files, not active instructions.
