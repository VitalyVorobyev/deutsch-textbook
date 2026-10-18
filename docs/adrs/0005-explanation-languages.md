# ADR 0005: Explanations are authored per language, and B1 reads German first

Status: accepted · 2026-10-18

## Context

The course serves a Russian-speaking learner first, Ukrainian readers second and English as the
always-complete axis, and it aims at a learner who will eventually read German explanations.
Interference is language-specific: a Russian reader needs *быть* and the case system contrasted,
an English reader needs "must not" ≠ *muss nicht*. A half translated from a sibling half carries
the sibling's contrasts into the wrong language, and review found exactly that defect whenever a
sibling was on screen during authoring.

## Decision

**The chrome is German; the explanation language is the learner's choice.** One selector,
*Lernsprache* (`ExplainLang`: `en | ru | uk | de`, per profile). Chrome strings stay in German as
high-frequency sight vocabulary.

**Each explanation half is authored from the German, never from a sibling half.**

- `en` is required everywhere and is the fallback for every missing half; a Ukrainian reader is
  never silently handed Russian.
- `ru` and `uk` are complete, independently written explanations that may diverge to serve their
  reader. `uk` is all-or-none per file.
- The English surface never assumes Russian: no Cyrillic in an `en` field, and under `en` a card
  shows English and German only. Letter-set checks keep `ru` and `uk` apart.

**A1 and A2 articles are bilingual** (`<Bilingual>` with `<En>`/`<Ru>`/optional `<Uk>`), with
German examples and tables always visible.

**B1 articles are German-first.** The body is German at the reader's level. Each section with
German prose closes with a collapsed `<Translation>` (translated from the German, nothing added;
`<En>` required) and a collapsed `<Erklaerung>` holding the authored halves whole.
`## Kurz gesagt` opens its translation. Under `de` both folds are hidden. Nothing authored is lost
and nothing is relabelled a "translation" that is not one. The Leben-in-Deutschland lessons use
the same shape.

## Consequences

- Four halves cost about twice what two do (`bun scripts/lang-cost.ts`). The cost is accepted,
  and it buys a check: a new half audits the old ones, and in practice it keeps finding false
  claims.
- A calque — a half mirroring a sibling sentence for sentence — passes every gate. Only the
  reviewer → editor skill loop catches it.
- Validator rules carry the contract: letter sets, per-file `uk` parity, the German-first
  structure (`germanFirstTopicProblems`) and the 120-word paragraph cap.
