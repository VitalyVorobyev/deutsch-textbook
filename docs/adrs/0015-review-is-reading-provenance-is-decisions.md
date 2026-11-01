# ADR 0015: A review records what the owner read, and provenance records only the decisions the owner made

Status: accepted · 2026-11-01

## Context

[ADR 0014](0014-material-governance.md) derives a topic's review from the review ledger. It also
made the owner's mark on a B1 topic write that topic's authorship-provenance `humanReview`, so that
the existing rule still held: a B1.4+ topic was not reviewed until its record listed the owner's
concrete selection, rewriting or arrangement decisions.

The owner reads German at A2–B1, the level the course teaches. The owner can judge whether a
text is clear, whether a task is fair and whether material belongs in the course. The owner
cannot write the German alternatives that a "substantive contribution" means. A gate that demanded
one would either keep every B1 topic in draft for good, or invite a record written on the owner's
behalf. The provenance rules forbid exactly that fabrication.

## Decision

**Review and provenance answer different questions, and neither stands in for the other.**

- **Review** is the ledger. A topic is reviewed when the owner has read every file it owns and
  accepted it at its current bytes. The same rule applies at every level. A ledger row is the
  evidence that the review happened: who read which bytes, and when.
- **Provenance** describes how the material came about. A record's `humanReview` lists only
  decisions the owner actually made, such as an approved brief, a choice among alternatives
  Claude offered, or a finding the owner filed that changed the material. It stays `pending`
  until there is such a decision. Nothing is ever written in it on the owner's behalf.
- No review state depends on the provenance record, and no provenance state depends on a review.
  A topic manifest declares no review status.

This supersedes ADR 0014's clause that an owner mark writes the provenance record's human review.
The rest of ADR 0014 stands.

## Consequences

- B1 topics can be reviewed the way A1 and A2 topics are, by reading them.
- Authorship records stay honest, and many of them will stay `pending`. That is a weaker record of
  human contribution, accepted because the alternative is a false one. The validator still
  requires a record for every B1 topic, with its brief and its drafting tools.
- A review does not claim authorship, and a provenance record does not claim quality.
