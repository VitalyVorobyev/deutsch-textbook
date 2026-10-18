---
name: german-first-translation
description: Write or translate an explanation half of a Deutsch-Atlas text from the German — the B1 German-first `<Translation>` folds, RU/UK halves, LiD lesson translations, or a new language half — and verify it sentence by sentence. Use for any DE→EN/RU/UK translation or half-authoring job, including delegating it to a subagent or a cheaper model.
---

# Translate or author a half from the German

The contract is ADR 0005 (`docs/adrs/0005-explanation-languages.md`):

- **Every half is written from the German, never from a sibling half.** Having the sibling on
  screen is enough to produce its defects.
- **B1 articles are German-first.** Each section with German prose closes with:
  - a collapsed `<Translation>`: the German translated, nothing added, `<En>` required, `<Ru>` and
    `<Uk>` all-or-none per file, `open` only on `## Kurz gesagt`;
  - then `<Erklaerung>`, holding the authored halves whole.

  The validator rule is `germanFirstTopicProblems`.
- No Cyrillic in an `en` field, no і/ї/є/ґ in `ru`, and no ы/э/ъ/ё in `uk`.

## Brief

Give the translator, human or subagent:

- **the German only.** Never the sibling translation.
- **the line "translate faithfully, and REPORT any German that is false or too absolute; do not
  fix it."** Translating forces a commitment to each claim. This brief line is what surfaced a
  false grammar claim in almost every batch of the B1 German-first conversion.
- **the defect classes to check:**
  - time words (*nach* / *erst* / *noch* / *mehr*);
  - modals;
  - negation scope;
  - word sense;
  - Russianisms in UK;
  - terminology consistent with the course's notes.

  One wrong time word can flip a rule. Those are exactly the words exam distractors turn on.

## Verify

1. **A full sentence-level fix pass over every block**, never a sample. A cheaper model's first
   draft (Sonnet) looked fluent and carried a meaning error or a Russianism in about one block in
   five.
2. **Read every fix-pass diff against the German in the main context.** A fix can shift meaning
   too.
3. **For each reported false claim:**
   - grep it across every half, *Häufige Fehler* and the items' `explain`;
   - fix all instances in the same PR;
   - check whether the claim was drilled. If it was, the item is wrong as well.
4. `bun run validate`. Ship through the `pr-cycle` skill.
