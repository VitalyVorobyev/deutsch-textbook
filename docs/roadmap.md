# Deutsch-Atlas roadmap: durable A1–B1 learning

Status: active product direction. The [curriculum blueprint](curriculum-a2-b1.md) owns frozen
content identities; the [backlog](backlog.md) owns executable work. The completed A1–A2 roadmap is
[archived](archive/2026-07-roadmap-a1-a2.md).

## Product direction

Deutsch-Atlas is a local-first German course whose success criterion is delayed retention and
fresh-context transfer, not content volume or page views. A1 and A2 are complete. B1 is being
authored under its frozen fourteen-unit contract.

The course keeps five boundaries:

- recommendations are soft and never lock deliberate exploration;
- input, retrieval, interaction and production are distinct learning touches;
- optional documents, references and illustrations create no mastery or review debt;
- progress claims come from current instruments and reproducible commands;
- content quality and CEFR discipline outrank feature count.

## Current sequence

1. Author B1 in two-unit windows, with the grammar and identity ownership fixed in the blueprint.
2. Drain the grading queue and read the current snapshot after each window.
3. Treat the 2026-08-02 A1 cohort and approximately 2026-08-14 A2 checkpoint reads as revision
   triggers.
4. Add semantic figures only when a named relation is clearer spatially than in prose or a table.
5. Continue the authentic-document and extensive-reading streams without converting exploration
   into obligation.

## Retention gate

A competence is readable only after at least three delayed attempts. The A1 gate passes when at
least 80% of readable competences retain the graded target and the free-production channel reaches
70%. Run:

```sh
bun run progress:audit --profile vitaly --project 2026-08-02
bun run progress:audit --profile vitaly
```

The first command asks whether the gate can be read; the second reports what the evidence says.
Engagement, same-day accuracy and page viewing cannot substitute for either.

## Parallel tracks

- **Semantic learning visuals:** responsive generated scenes only where physical context helps;
  deterministic HTML/SVG for grammar, sentence topology and time.
- **Entdecken and documents:** authentic tasks, explicit provenance, no completion state.
- **Language quality:** Ukrainian calque review and ongoing EN/RU/UK/DE parity checks.
- **Written forms and cross-links:** give the standard written genres — Bewerbung, Beschwerde,
  formal e-mail — a practice surface that grades what a program can actually check (structure and
  register, never wording), an Entdecken index that gathers the material, and a single pass that
  links the graph both ways: topic → Referenz, Referenz → topic, topic → topic. Derive the edges
  from data the curriculum already owns, the way `/referenz/zeitformen` derives its lesson links
  from the focus-tag map, so they cannot drift. Backlog P21-1 · P21-2 · P21-3.
- **Audio:** build the reviewed corpus from `data/listening-plan.yaml`: first the twelve live units
  with explicit listening outcomes, then model/input audio for the remaining units. Neural audio
  remains publishable only after dry and final-mix QA plus named human review; volume is not a
  substitute for intelligibility.

## Definition of the next milestone

B1 is complete when all fourteen frozen units, their owned grammar points, outcome-valid practice,
readings, probes and vocabulary have shipped; the grammar and lexical coverage commands pass; the
grading queue is empty; and delayed evidence has been reviewed honestly. Shipping the catalog is
not a claim that every competence has been retained.
