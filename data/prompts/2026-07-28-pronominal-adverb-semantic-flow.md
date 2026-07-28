# Approved brief — pronominal-adverb semantic flow

Date: 2026-07-28
Selected by: Vitaly Vorobyev
Implementation assistance: OpenAI Codex

## Semantic job

Show the deterministic choice that follows a governed verb–preposition pair:

- the preposition remains fixed;
- a thing uses `wo(r)-` for the question and `da(r)-` for the reference;
- a person keeps the preposition separate before `wen` or a personal pronoun;
- linking `r` appears only before a preposition beginning with a vowel.

## Selected composition

Start with one shared `warten auf` token and branch into two labelled paths:
`Sache` and `Person`. The thing path visibly composes `wo + r + auf → worauf`
and `da + r + auf → darauf`. The person path composes `auf + wen → auf wen`
and `auf + sie → auf sie`.

Use deterministic HTML/CSS and small inline SVG marks only. Pair every colour
with headings, formula structure and written labels. Stack the paths at narrow
widths and provide complete EN/RU/UK text descriptions. The figure is model
input and creates no learner evidence.
