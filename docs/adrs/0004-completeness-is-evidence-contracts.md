# ADR 0004: Course completeness is a set of evidence contracts against named anchors

Status: accepted · 2026-10-18

## Context

"Is A2 done?" has at least five honest answers, and a single percentage hides all of them. An
internal grammar list can reach 100% of itself while missing what the published standard expects;
a level can cover every grammar point once and practise each too thinly to stick; a coverage figure
can be true while the learner retains nothing. Each of these was mistaken for the others before
the instruments were split.

## Decision

**Completeness is published as separate contracts, each with its own command, and never as one
score.**

1. **External alignment.** Each level's denominator is anchored to a named published inventory
   (`data/strukturenlisten/`, `data/handlungslisten/`, `data/themenlisten/`), or says
   `anchored: false`. An inventory row cites entries (`claims: [<source>:<key>]`) only once the
   cited structure is actually taught. A claim is phrased against its audience: `100% des
   DTZ-Inventars`, never "all of B1".
2. **Internal coverage.** Every grammar point the course promises is taught by a registered focus
   tag on a `practice` or `drill` item. Adding an inventory row before its content is correct: the
   percentage falls and the hole becomes work.
3. **Depth.** Items, production and probe families per confusion, read against the level median
   (`grammar-depth`). Breadth never substitutes for depth.
4. **Lexical completeness is entry by entry.** Every Goethe Wortliste row is a productive card, a
   justified recognition card, or a `~` earned by the taught surface.
5. **Learner mastery** comes only from attempts ([ADR 0003](0003-the-evidence-model.md)). It never
   moves a curriculum figure, and no curriculum figure predicts it.

**Only labels cross the copyright line.** An anchor file transcribes structure names, section order
and page numbers. It never reproduces a source's example sentences, and a source's own errors are
recorded as `note:`, not silently corrected.

**Diagnostics name the failed contract.** `blocking`, `attention` and `info` are severities, not a
quality score.

## Consequences

- Every figure in prose carries the command that produced it; a percentage without its `[audience]`
  line is misread.
- Anchor transcriptions are held against their PDFs by `bun scripts/anchor-check.ts`, which skips
  where the local-only PDF is absent.
- The explanation-language halves are reported separately and gate nothing here.
