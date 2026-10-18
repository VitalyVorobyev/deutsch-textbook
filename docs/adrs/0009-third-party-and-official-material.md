# ADR 0009: What third-party and official material may enter the repository

Status: accepted · 2026-10-18

## Context

A public repository under CC BY-SA sits beside material it may not republish: the Goethe-Institut's
exam sets and Wortlisten, published grammar inventories, press photographs. Other material it may
republish: public-domain classics and the Leben-in-Deutschland catalogue, an annex to a federal
regulation. The two kinds are easy to confuse, and confusing them in either direction costs
something: a leaked exam set, or a trainer that withholds the very text the test certifies.

## Decision

**Copyrighted exam material never enters the repository.** The Goethe PDFs, audio, video, sliced
segments, rendered pages and the manifest's task texts stay local (gitignored). The trainer is
committed code plus a local manifest. A build without the materials says so plainly instead of
shipping empty players. Exam results are calibration ([ADR 0003](0003-the-evidence-model.md)).

**Published inventories cross as labels only.** Structure names, section order and page numbers
may be transcribed; example sentences may not. Wortliste glosses and examples are original course
text.

**Official works ship verbatim, with their source named.** The Leben-in-Deutschland bank is Anlage
1 of the EinbTestV, unprotected under §5 UrhG. `data/lid/bank.yaml` and `public/lid/` hold it
unchanged, typos included, outside `content/` and its licence. A photograph the catalogue credits to
a third party is **withheld**: §5 frees the official text, not the photographer's work. The answer
key is cross-checked against independent sources, and a re-import that would change one stops for
explicit acceptance. The course's own notes and lessons live apart in `content/lid/`.

**Public-domain texts are adapted, and the source stays diffable.** The classics corpus lives
verbatim in `sources/klassiker/`. Each adaptation is an extensive reading carrying `attribution` and
`license`, which the validator enforces. It creates no cards, no mastery and no review debt.

**Every generated or adapted asset carries provenance**: `data/asset-provenance.yaml`,
`data/authorship-provenance.yaml` and the `authorship-provenance` skill. Real and adapted documents
require `attribution` and `license`.

## Consequences

- A clean checkout and CI never see the Goethe materials. Tests and anchor checks that need them
  skip honestly.
- Operational detail: [`../architecture/exam-trainer.md`](../architecture/exam-trainer.md) for the
  Goethe trainer and [`../architecture/lid-trainer.md`](../architecture/lid-trainer.md) for the LiD
  bank, its import and its store.
