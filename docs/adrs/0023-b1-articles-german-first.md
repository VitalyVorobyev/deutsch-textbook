# ADR 0023: B1 articles are German-first, with the translation and the authored explanation folded

Status: accepted · 2026-10-17 · partially supersedes [ADR 0001](0001-bilingual-explanation-halves.md)
§ "The German explanation half (`de`)" for B1 topic articles

## Context

ADR 0001 gave B1 a fourth explanation half, `<De>`, beside `<En>`, `<Ru>` and `<Uk>`, and chose
the learner's language as the default view: a learner saw German only after switching the
Lernsprache to `de`. It also rejected a hide-the-prose mode, because an article stripped of its
explanation is a table collection.

The Leben-in-Deutschland lessons (ADR 0021) then tried the other default and it worked: German as
the text, each section closed by a collapsed `<Translation>`. The owner asked for B1 to read the
same way (2026-10-17), with two conditions:

- **Nothing authored is lost.** The EN/RU/UK halves were written for their reader, not translated.
  They contrast with Russian cases and with English false friends, and they often say more than the
  German half does. Relabelling them "translation" would be false.
- **A real translation of the German is added**, English first.

## Decision

**A B1 topic article's body is German.** Each `##`/`###` section with German prose closes with two
collapsed blocks, in this order:

1. **`<Translation>`** — the section's German translated, nothing added. `<En>` is required; a `<Ru>`
   or `<Uk>` half is optional and, like every optional half, all-or-none per file. Until a fold has
   a Russian half, a Russian-mode reader sees its English (CSS fallback). `## Kurz gesagt` has
   `<Translation open>`.
2. **`<Erklaerung>`** ("Ausführliche Erklärung") — the authored halves, kept whole: `<En>`, `<Ru>`,
   and `<Uk>` once the file carries it.

A section with only tables, examples or subsections takes neither block. Under the `de` Lernsprache
both folds are hidden. Tables, examples and ❌/✅ lines stay German and visible, as before.

This is not the mode ADR 0001 rejected. Nothing is stripped: the explanation is in German at the
reader's level, and the learner's language is one click away in each section.

**Enforcement.** `germanFirstTopicProblems` (`packages/content/src/german-first.ts`), run by
`bun run validate`, checks four things:

- the blocks, their order and their halves;
- no `<Bilingual>` and no `<De>`;
- no Cyrillic outside a `<Ru>`/`<Uk>` half;
- the 120-word paragraph cap on the German body.

A file opts in by using `<Translation>` while B1 is being converted. Once it is, the rule becomes
required for every B1 article.

## Consequences

- **The Lernsprache keeps its job elsewhere.** A1/A2 articles, exercises and readings are
  unchanged, and their `explain` fields keep their `de` halves where they exist.
- **The comprehensibility instrument now counts the explanation German.** It reads German outside a
  half, and that German is now what the learner reads first. B1 input-load rows rise accordingly
  and are read against their level median, as before.
- **Coverage is unchanged.** `taughtSurface` already counted the `<De>` half, because it strips
  only `<En>` and `<Ru>`.
- **Redaktion's language coverage counts `<Erklaerung>` blocks.** A German-first file is complete in
  `de`; an English-only `<Translation>` does not make RU "partial".
- **Owed:** RU and UK translation halves, written from the German, never from a sibling half
  (backlog).
