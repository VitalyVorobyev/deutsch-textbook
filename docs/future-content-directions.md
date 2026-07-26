# Entdecken, documents and editorial content

Status: active admission and authoring contract. Earlier research, shipped pilots and rejected
directions are [archived](archive/2026-07-future-content-directions-full.md).

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
