# Curriculum

What the course teaches, in what order, with which frozen identities — and the operating
procedures that put it into practice.

## The blueprint is a frozen contract

[`a2-b1.md`](a2-b1.md) is the source of truth for what A2 and B1 teach: the units, what each owns,
and what it may not touch. Everything in it that names an identity — a topic id, an outcome id, a
focus tag — is **frozen**: it becomes a persisted key in the learner's progress the moment its
unit ships, and renaming it destroys their history. The blueprint is not a second authoring
contract: how any single artifact is written is `CLAUDE.md`'s job, and the bar a finished unit
must clear is the unit quality gate in
[`../quality/a1-learning-audit.md`](../quality/a1-learning-audit.md).

**Amendments are appended, dated and owner-approved.** The contract is never silently rewritten:
a change lands as a dated `## Amendment YYYY-MM-DD: …` section at the end of the blueprint,
recording the trigger and the decision (see the 2026-07-24, 2026-07-26 and 2026-07-27 amendments
there for the shape). Prose earlier in the file may point forward to the amendment that revised
it, but the original decision stays readable.

## How the two documents relate

| Document | Role |
| --- | --- |
| [`a2-b1.md`](a2-b1.md) | **The contract.** Frozen A2/B1 unit identities, ownership, focus tags, deck partitions and the amendment record. |
| [`a2-learning-led-program.md`](a2-learning-led-program.md) | **The cadence.** The repeatable A2 operating checklist: evidence reads (`bun run progress:audit`), drill decision rules, and the calendar/B1-gate decision record the blueprint's status line points at. |

## The audit ledgers

Four standing records of what the course has been measured against. Each is a ledger: it is appended
to as findings land, and it is not a plan.

| Document | What it holds |
| --- | --- |
| [`a1-b1-completeness-audit.md`](a1-b1-completeness-audit.md) | The completeness contract: which denominators a level is called complete against, and where each stands. |
| [`level-completeness-audit.md`](level-completeness-audit.md) | Per-level readings of those denominators. |
| [`grammar-structure-audit.md`](grammar-structure-audit.md) | The inventory audit against the published external Strukturenlisten. |
| [`learning-activity-audit.md`](learning-activity-audit.md) | The activity architecture pass under [ADR 0014](../adrs/0014-learning-activity-architecture.md). |
| [`topic-quality-audit.md`](topic-quality-audit.md) | The topic-by-topic A1–B1 quality ledger; corpus evidence kept separate from human approval. |

The blueprint decides *what*; the program decides *when the evidence is read* and what a read may
trigger. The authoring rules a unit is written under are `CLAUDE.md`'s and
[`../../.agents/skills/authorship-provenance/SKILL.md`](../../.agents/skills/authorship-provenance/SKILL.md)'s. Product direction stays in
[`../roadmap.md`](../roadmap.md) and implementation status in [`../backlog.md`](../backlog.md).
