# Architecture Decision Records

An ADR here is an **accepted decision with its reasoning attached**: what the situation was, what
was decided, and what follows from it — including the costs. It is the durable half of a design
doc: the operational half (endpoints, commands, runbooks) lives with the subsystem it operates
(e.g. [`../architecture/cloud-sync.md`](../architecture/cloud-sync.md)), while the ADR holds the
part that stays true after the code moves.

## Format

Every ADR is one file:

1. **H1 title** — `ADR NNNN: <decision>`.
2. **Status line** — `Status: accepted · YYYY-MM-DD`, dated from the decision recorded in the
   source material; where no decision date was recorded, `Status: accepted · reframed <date> from
   <original path>`. Never invent a date.
3. `## Context` — the situation and the forces; what made a decision necessary.
4. `## Decision` — what was decided, stated as the rule it is.
5. `## Consequences` — what follows: the guarantees bought, the costs accepted, the things the
   decision deliberately does not do.

## Numbering

Four digits, zero-padded, next free number — **never reuse a number**, including a withdrawn
one. A reversed decision is not edited or deleted: a new ADR supersedes it and both note the
relationship.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [`0001`](0001-bilingual-explanation-halves.md) | Bilingual explanation halves — Sprachen, Ukrainian and the German-medium half | accepted · 2026-07-14 |
| [`0002`](0002-advisory-only-writing-assistant.md) | Schreib-Assistent — local, advisory-only writing feedback, never evidence | accepted · 2026-07-14 |
| [`0003`](0003-opaque-snapshot-sync-and-approval-accounts.md) | Opaque snapshot sync and approval accounts | accepted · reframed 2026-08-04 |

Rationale that predates this ADR practice — completed roadmaps, superseded design notes, dated
evidence reviews — lives in [`../archive/`](../archive/), frozen as it shipped.
