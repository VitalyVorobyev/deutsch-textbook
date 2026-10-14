# Roadmap

Direction and the gates in front of it. The [curriculum contract](curriculum/a2-b1.md) owns
identities; the [backlog](backlog.md) owns executable work.

## Product direction

Deutsch-Atlas is a local-first German course whose success criterion is delayed retention and
transfer to a new context, not content volume or page views. Five boundaries hold throughout:

- recommendations are soft and never lock deliberate exploration;
- input, retrieval, interaction and production are distinct learning touches;
- optional documents, references and illustrations create no mastery and no review debt;
- progress claims come from current instruments and reproducible commands;
- content quality and CEFR discipline outrank feature count.

## Current sequence

1. **Evidence between the windows (P5-11).** Drain the grading queue to zero, rerun the audit, and
   only then read the weak-focus table. The A2 checkpoint read is the next revision trigger.
2. **The open tracks below**, in the order the owner sets.

Two standing constraints: add a semantic figure only when a named relation is clearer spatially than
in prose or a table, and keep the authentic-document and extensive-reading streams growing without
turning exploration into obligation.

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

## Open tracks

### Redaktion · P27

A local, repository-backed editorial workstation, built vertically: each milestone leaves one
complete editorial path usable. Standing: ADR 0013 and the A1–C2 grammar contract, the checkout
picker and restricted Bun sidecar, the Grammatikatlas from a point through focus, topic and
material, the shared non-executable preview, editor mode, revision conflicts and atomic Save.
Next, in order: Themen workspaces (P27-3), the Materialien index (P27-4), Qualität and Referenzen
(P27-5), hardening and macOS delivery (P27-6); renderer parity is owed before pixel parity can be
claimed. Done means the full editor journey: locate a grammar line, follow its course evidence,
edit YAML/MDX with conflict protection, read local and corpus diagnostics, and mark a topic
reviewed only through the green gate. [ADR 0013](adrs/0013-redaction-repository-workbench.md).

### Mobile and performance

The phone is where the daily loop runs. Open: the seven-tab navigation (P25-8), the Wortschatz deck list (P25-1), touch targets (P25-3) and a phone-width sweep (F-11).

### Cross-links, Referenz and readings

Every "see also" edge is derived from data the curriculum already owns, never hand-maintained
([ADR 0007](adrs/0007-derived-cross-links-never-hand-maintained.md)). Open: in-page navigation for
the long reference pages and finer edges (P24-5), in-text references as links (F-1), search (F-2),
a system for readings (F-3), and the written-forms practice surface with its index (P21-1, P21-2).

### Audio studio

The planned listening corpus is published and approved. The studio is Tonwerk plus the local
engine; what it owes is in the backlog's Tonwerk section. Volume never substitutes for
intelligibility, and automatic transcription is a defect detector, never proof of natural
pronunciation. A recurring character ensemble remains **proposed**
([ADR 0008](adrs/0008-character-ensemble-and-audio-studio.md)).

### Standing streams

Not scheduled; they continue as authoring windows allow. Semantic learning visuals —
responsive generated scenes only where physical context helps, deterministic HTML/SVG for grammar,
sentence topology and time. Entdecken and documents — authentic tasks, explicit provenance, no
completion state. Language quality — the RU/UK calque review (C6-1) and EN/RU/UK/DE parity.

## Next milestone: B1 complete

All fourteen contracted units and the six further B1 topics have shipped with their grammar,
outcome-valid practice, readings, probes and vocabulary, and the coverage commands pass. What is
left, now that every B1 topic has had its topic-quality pass: an empty grading queue and an honest
read of the delayed evidence.
Shipping the catalogue was never a claim that a competence was retained.
