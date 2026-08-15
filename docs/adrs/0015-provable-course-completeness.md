# ADR 0015: Course completeness is a set of evidence contracts, never one score

Status: accepted · 2026-08-14

## Context

Deutsch-Atlas had several truthful measurements that became misleading when read together. A
grammar point counted as present after one teaching item, an external structure counted as aligned
after one inventory citation, and learner mastery was inferred from neither but was still discussed
as though a green curriculum number implied it. Lexical coverage had a similar escape hatch: a
headword could disappear behind an alias, an `ignored` marker or a rounded percentage without a
learner ever meeting it.

The DTZ audit made the distinction concrete. The course cited 277 of 300 A2 entries and 141 of 164
B1 entries, while internal grammar coverage was 24/28 at A1, 35/38 at A2 and 32/32 at B1. Those
figures answer different questions. The 23 uncited DTZ entries included one structure already taught
exactly (`so … wie`), several coherent missing slices, and no licence to call the whole of German
grammar complete. The only current learner's productive results also remain much weaker than
selection results. A single score would conceal every one of those facts.

## Decision

**Completeness is published as four separate contracts.**

1. **External alignment** asks whether every row of a named external inventory has an exact
   `claims:` edge. A claim is added only after the cited structure can be pointed to in teaching
   evidence; similarity of wording or a broad parent category is insufficient. A1 is reported
   against its named Goethe inventory, and B1 is written as `100% des DTZ-Inventars` when it reaches
   164/164 — never as all conceivable B1 grammar.
2. **Internal catalog coverage** asks whether every grammar point the course promises is taught by
   a registered focus tag in `practice` or `drill`. Adding a row before its content is correct: the
   percentage falls and the missing id becomes work.
3. **Teaching depth** asks whether a productive point has an owning topic and addressable article
   subsection, scaffolded retrieval, productive fade or transfer in another context, and a delayed
   three-variant probe family. Counts and medians remain visible by function; they are not collapsed
   into a score.
4. **Learner mastery** comes only from attempts, delayed retrieval, retention and transfer. It never
   changes a curriculum-completeness figure and a curriculum figure never predicts it.

**Lexical completeness is entry-by-entry.** Every official Wortliste row is accounted for by a
productive card (`cards: both`), a justified receptive card (`cards: recognition`), or `~` backed by
actual grammar teaching. `ignored`, percentage rounding and aliases that do not denote the same
lexical item are not coverage mechanisms. Morphological fragments and frames belong to grammar only
when the course teaches how they work.

**Diagnostics name the failed contract.** `blocking`, `attention` and `info` are severities, not a
quality score. A missing source claim, missing teaching item, missing transfer and missing probe are
distinct findings even when they refer to the same point. A topic remains `draft` until its complete
profile passes; file-local valid drafts may still be saved.

**The German-medium edition is independent.** EN/RU/UK/DE language coverage reports authored
explanation halves. It neither raises nor lowers A1–B1 grammar or Wortliste completeness, and German
backfill is not a gate for this program.

## Consequences

- `100%` always names its denominator, down to source id and entry count. There is no global course
  percentage.
- A source claim cannot be used to make an untaught point look complete; the corresponding internal
  row and depth diagnostics remain visible.
- Existing content ids may change when a pedagogically incoherent activity is replaced. Preserving
  one pilot learner's history is secondary to a better course, while gratuitous id churn remains
  undesirable.
- The 23-entry DTZ tail is worked as coherent teaching slices, not 23 token exercises. Its first
  exact match, `mod-wie`, is already taught in `einkaufen-reklamation`; the other 22 remain
  unclaimed until the slices recorded in the audit ship.
- The final acceptance gate is conjunctive: external alignment, internal catalog coverage, depth,
  lexical coverage and zero A1–B1 attention findings must each pass independently.

## Alternatives considered

- **One weighted quality score.** Rejected because weights would be editorial guesses and a strong
  vocabulary number could hide missing productive grammar or probes.
- **Claim every broad parent row, then audit content later.** Rejected because it makes the external
  metric green before the learner-facing evidence exists.
- **Protect every historical exercise id.** Rejected as a primary constraint. There is one pilot
  learner, and retaining a meaningless activity is a larger loss than resetting its history.
