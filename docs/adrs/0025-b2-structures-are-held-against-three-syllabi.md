# ADR 0025: B2's structures are held against three syllabi

Status: accepted · 2026-11-22

Supersedes the last sentence of decision 2 in
[ADR 0024](0024-b2-denominators-are-compiled-from-free-sources.md), which names one syllabus. The
rest of ADR 0024 stands.

## Context

ADR 0024 anchored B2's structures in one document: the grammar column of the Goethe-Institut's B2
online course. One syllabus has gaps nobody can see from inside it, so the curriculum contract
listed six structures as this course's own decision, citing no source. That is the weakest claim
the repository allows, and it was resting on one course's lesson list being short.

Two publishers offer the contents pages of a B2 coursebook as a free download, each with its
grammar named per chapter: Klett's *Aspekte neu B2* and Schubert's *Erkundungen B2*. Both books
prepare for the Goethe-Zertifikat B2. Read against the contract, they name four of the six
self-certified structures outright and part of the other two, and they hold eight entries no B2
unit accounted for.

Two other free documents were examined and are not anchors. The vocabulary list telc publishes
for *Einfach besser! 500* is the glossary of one vocational course. The "Sprachliche Handlungen"
lines in the *Erkundungen* contents describe that book's lessons, not functions of the level.

## Decision

1. **B2's structures are held against three syllabi**, one file each under
   `data/strukturenlisten/`, all `kind: syllabus`, under the boundary ADR 0024 sets: labels only,
   in the source's order, each file held to its PDF by `bun scripts/anchor-check.ts`.
2. **The report stays a count.** Three overlapping lesson lists are no more a denominator than
   one. `bun scripts/structures.ts B2` says how many of their entries are claimed and that the
   lists overlap. No percentage is published.
3. **A structure two or three syllabi name is common practice at B2; one that none names is
   `beyond`** and is listed in the curriculum contract with how far the course takes it.
4. **An entry a coursebook repeats from a lower level is claimed by the row that already owns
   it.** The report then shows the level at which this course delivers the structure. Such a claim
   says the structure is taught, not that it is taught to the depth the B2 book reaches.
5. **An entry that names no structure stays unclaimed, and the contract says which and why.**
6. **Vocabulary still has no denominator, and Sprachhandlungen still wait** for the transcription
   ADR 0024 names.

## Consequences

- The contract's self-certified class shrinks to two rows, and the guessing modal verbs, which
  *Erkundungen* teaches in its C1 book, are understood at B2 and not produced.
- The syllabi put four things into units that had not carried them: *sollen* for a reported claim,
  negation, *es* with purpose, and place with the uses of *werden*.
- A fourth syllabus would be one more file. It would not change what the report can claim.
- Coursebook contents pages are publishers' material. Only the grammar labels are transcribed;
  chapter titles appear as section headings and nothing else of the page is taken.
