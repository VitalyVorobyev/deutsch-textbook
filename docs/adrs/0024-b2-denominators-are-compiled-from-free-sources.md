# ADR 0024: B2's denominators are compiled from free sources, and a syllabus is never a percentage

Status: accepted · 2026-11-22

## Context

[ADR 0004](0004-completeness-is-evidence-contracts.md) makes every completeness claim a contract
against a published list. For A1 to B1 those lists exist free: the Goethe Wortlisten, the Goethe
*Prüfungsziele* inventories and the DTZ handbook. For B2 they do not. The Goethe-Zertifikat B2
*Prüfungsziele* names 14 exam themes and delegates grammar and vocabulary to *Profile deutsch*, a
purchased book. The telc Deutsch B2 *Lernzielbeschreibung* declines to list either. The BAMF goal
catalogue for the Berufssprachkurse lists Sprachhandlungen with a B2 column and states that it
gives no grammatical or lexical progression. No B2 word list is published, and the frequency list
that could stand in for one (DeReWo) may be passed on only with its documentation and never
commercially, which an open repository cannot promise.

The owner ruled that no book is bought, and that B2 is authored now. A level with no anchor
reports `anchored: false`, which is honest and leaves thirteen units with nothing to be checked
against. A list written by the author of the units would be checked against itself, which is how
three levels once read 100% of an incomplete inventory.

## Decision

1. **B2's denominators are compiled from free, published documents, one file per document**, under
   the same boundary as every other anchor: labels only, in the source's order, the file local and
   gitignored ([ADR 0009](0009-third-party-and-official-material.md)), the transcription held to
   its PDF by `bun scripts/anchor-check.ts`.
2. **A source says what kind of document it is.** An exam's `inventory` states what a level
   requires. A `syllabus` is one course's choice of what to teach. B2's structural source is a
   syllabus: the grammar column of the Goethe-Institut's own B2 online course.
3. **A level anchored only by a syllabus is reported in counts, never as a percentage.** The
   report says how many syllabus entries an inventory row claims and names the source as a
   syllabus. No B2 structural coverage figure is published anywhere, `/about` included.
4. **What the course teaches beyond the syllabus is written down as its own decision.** The
   curriculum contract lists those structures and their units; each is an inventory row citing no
   source, and the report lists it as `beyond`.
5. **Themen stay the exam's own list.** The 14 Prüfungsthemen are an inventory and are measured as
   one.
6. **Vocabulary gets no denominator.** A B2 deck makes no coverage claim.
7. **Sprachhandlungen wait for a transcription** of the BAMF catalogue's B2 column. Until then no
   figure is published for them, and outcomes are held to the six production functions of the
   Goethe *Prüfungsziele*.

## Consequences

- B2 can be checked: `bun scripts/structures.ts B2` and `bun scripts/themen.ts B2` name every
  entry no unit has claimed yet. It cannot be called complete against an exam, and nothing may say
  it is.
- The syllabus is one course's lesson list. Its gaps are real, so a unit is designed from a
  reference grammar and the exam's formats and then held against the syllabus, never authored
  from it.
- If a formal B2 inventory is ever held, it becomes a second source file and the percentage
  returns for the level; the syllabus stays as it is.
- The position that B2 waits for *Profile deutsch* is withdrawn.
