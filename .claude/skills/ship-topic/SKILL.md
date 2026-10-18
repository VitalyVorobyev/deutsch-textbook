---
name: ship-topic
description: Author and ship a new Deutsch-Atlas topic or unit end to end — manifest, article, activities, pretest, probes, reading, vocab, atlas slot — with the subagent pipeline and the main-context review that catches what the gates cannot. Use when the user asks for a new topic, a new unit, a B1/B2 unit from the curriculum contract, or "the next unit".
---

# Ship a topic

The contract is the nine-line checklist under *Shipping a topic* in `content/CLAUDE.md`. Each
line's reasoning is in `docs/authoring/authoring-checklists.md`, and what the unit owns and may not
touch is in `docs/curriculum/`. This skill is the **procedure** that has shipped every B1 unit.

## 0. Before drafting

- Read the unit's section of the curriculum contract and the previous unit's files. They are the
  structural model.
- Choose focus tags from `bun scripts/grammar-depth.ts <level> --thin` before inventing new ones;
  a new tag joins `docs/authoring/focus-tags.md` and `focusIntroducedBy` together.
- Vet any pasted or generated outline against `data/grammar-inventory.yaml`, the Wortliste and a
  reference grammar. Its gaps are the first thing to look for.
- From B1.4 on, open or update the record in `data/authorship-provenance.yaml` (the
  `authorship-provenance` skill) and fill `aiAssistance.tools` in the same commit as the draft.

## 1. Two subagents, one at a time

Run them sequentially, never in parallel. Forbid git in their brief: they share your working tree.

1. **Prose:** the article (skeleton and German-first rules for B1), the intensive reading and the
   vocab deck. Brief it to **report** any German claim it finds false or too absolute, and not to
   fix it silently.
2. **Semantics:** the core Grundübung (8–15 items), the application set, any extension or
   remediation set, the pretest, the probe family or families, the atlas slot, focus tags and the
   ratchet numbers in the tests.

## 2. The main-context review: read all five fields of every item

Read instruction, answer, `accept`, `explain` and `focus` together. The gates pass when these five
disagree. The defect classes that recur:

1. RU/UK case slips in explanation prose.
2. References to Russian inside an `en` field. The validator catches Cyrillic, not mentions.
3. Cross-language conventions in translate items: never grade an ordinal such as a floor number
   that RU counts differently.
4. Accept-list combinatorics. Close the item's *declared* variation (tense × lexical variants) and
   verify each cell through `gradeTranslation`. If the verb carries no part of the focus, name it
   in the instruction instead.
5. Prompt/answer faithfulness: a prompt word (*очень*) that invites an unaccepted German word
   (*sehr*).
6. RU/UK halves that calque the EN half's rhetoric. Run the `textbook-text-reviewer` →
   `textbook-text-editor` loop on fresh RU/UK halves *before* this review.

Also check every taught heuristic against counterexamples a learner at this level will meet
(*teilnehmen an* against "almost always accusative"). A probe family is one retention curve: its
variants share one form and register. And the practice items that drill a family's forms share
the family's outcome.

## 3. Gates and ship

```sh
bun run validate && bun run activity:audit && bun scripts/grammar-coverage.ts <level> \
  && bun scripts/coverage.ts <level> && bun test tests/
```

Then run `bun scripts/prose-shape.ts content/topics/<level>`, fill and **review** `ipa` with
`bun run gen:ipa --only <deck>`, and scan produced answers for off-Wortliste German. Parse every deck
with the yaml package; never grep. Ship through the `pr-cycle` skill. The topic stays
`status: draft` until the owner's explicit review.
