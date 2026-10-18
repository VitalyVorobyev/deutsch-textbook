# Entdecken, documents and editorial content

Status: active admission and authoring contract.

## Admission test

An optional artifact ships only when all answers are yes:

1. Does it serve a real language action, cultural understanding or a precise lookup need?
2. Is the German level-appropriate, or is difficult source language deliberately scaffolded?
3. Does it carry information that the existing article, exercise or reference does not?
4. Is its provenance honest and its presentation usable on mobile and with assistive technology?
5. Can it remain optional, with no completion state, mastery evidence or review debt?

Reject decorative media, authenticity theatre, trivia without language work, and content whose
maintenance cost exceeds its learning job.

## Artifact choices

| Need | Use | Do not use |
| --- | --- | --- |
| Extract facts from a form, listing, receipt or notice | `content/documents/` stimulus, visible during its task | A prose description of a document |
| Explain a spatial or temporal relation | Semantic HTML/SVG or a controlled generated scene | Decorative character art |
| Provide dense lookup | `/referenz` projection from canonical data | A second hand-maintained copy |
| Add culture, place or history | Reviewed `content/discovery/` article | A fact list or stereotype |
| Build reading volume | Connected extensive-reading strand | A long intensive text relabelled “extensive” |

## Documents and images

- Real and adapted material requires `attribution` and `license`; course-created simulations
  declare `sourceClass: simulated`. This is a provenance label, not a claim of human authorship,
  originality or copyrightability.
- Generated raster artwork contains no load-bearing words, arrows, article forms or case labels.
  Exact instructional information belongs to HTML/SVG.
- A document remains visible while its questions are answered. Viewing it is input, never evidence.
- Preserve the source’s communicative shape while removing accidental difficulty that is unrelated
  to the outcome.
- Every essential visual relationship has an EN/RU/UK text equivalent and a cue beyond colour.

## Leben-in-Deutschland lesson figures

A LiD lesson (`content/lid/lessons/<id>.mdx`, [ADR 0009](../adrs/0009-third-party-and-official-material.md))
declares its maps and pictures under `figures:` and shows each with `<Figure id="…" />`, or two or
three small ones in a row with `<Figure ids="… …" />` (`src/components/lid/LidFigure.astro`).

- The tag stands outside any `<Translation>`, after the German it illustrates and before the
  section's `<Translation>`, so it shows under every Lernsprache.
- A figure carries `alt_de` and a `caption` with `de`, `en`, `ru` and `uk`. The caption describes
  what the picture shows in short B1 German and states no fact the section's text lacks. A map
  that marks things by flag or colour alone names them in the caption.
- `sourceClass: official` is a picture of the BAMF catalogue already under `/lid/`, credited as the
  catalogue, and never one the bank marks `withheld`. `real` and `adapted` files live under
  `/lid/lessons/` and name `attribution`, `license`, `license_url` and `source_url`. A `simulated`
  one also needs its `data/asset-provenance.yaml` record.
- A diagram the course draws is an SVG under `/lid/lessons/`: a `viewBox` and root `width` and
  `height` equal to it — without them the picture has no size of its own and the panel shrinks it
  to 300 px — German labels, a verb on every arrow, text of at least ~13 px at
  phone width, system sans-serif. It carries no script, event handler, `<foreignObject>` or
  reference outside the file, because the figure also opens on its own as a page of this site.
- `bun run validate` checks the rest: every tag names a figure of its own lesson, every figure is
  shown, ids are unique across lessons, the file exists with the declared pixel size (an SVG's
  root `width`/`height`, else its `viewBox`), an SVG carries none of the above, and it is at
  most 300 KB, because every file ships in the desktop bundle.

## Entdecken contract

An Entdecken piece lives at `content/discovery/<level>/<id>.mdx`, declares `status: reviewed`,
contains independently authored language halves required by its wave, and links to topics only as
navigation. It creates no cards, mastery, “done” state or automatic recommendation.

Prefer one small experiment over a new content platform. Review learner usefulness separately from
delayed transfer; a positive page rating is not causal evidence of learning.

## Active portfolio

- additional task-bound documents only when a topic has a named extraction or action gap; the
  apartment listing and floor plan, registration form, receipt/product comparison and train
  disruption notice are shipped reference implementations;
- form or appointment letter for Ämter;
- receipt and product comparison for Einkaufen;
- additional connected extensive reading;
- at most one or two reviewed discovery pieces per PR.

Maps and live information require a stable maintenance plan. YouTube, news and external media stay
link-only unless rights, longevity and a precise listening/reading task are all resolved.
