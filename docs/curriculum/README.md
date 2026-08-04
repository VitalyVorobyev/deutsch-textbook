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

## How the three documents relate

| Document | Role |
| --- | --- |
| [`a2-b1.md`](a2-b1.md) | **The contract.** Frozen A2/B1 unit identities, ownership, focus tags, deck partitions and the amendment record. |
| [`b1-authoring-handoff.md`](b1-authoring-handoff.md) | **The prompt.** The active Claude handoff for the current B1 two-unit window; authors units *from* the contract, under the authorship-provenance gate. Only the two unit names change as windows close. |
| [`a2-learning-led-program.md`](a2-learning-led-program.md) | **The cadence.** The repeatable A2 operating checklist: evidence reads (`bun run progress:audit`), drill decision rules, and the calendar/B1-gate decision record the blueprint's status line points at. |

The blueprint decides *what*; the handoff executes the current window of it; the program decides
*when the evidence is read* and what a read may trigger. Product direction stays in
[`../roadmap.md`](../roadmap.md) and implementation status in [`../backlog.md`](../backlog.md).
