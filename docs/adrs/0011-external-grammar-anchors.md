# ADR 0011: The grammar denominator is anchored to published inventories, labels only

Status: accepted · 2026-08-14

## Context

`data/goethe-<level>-wortliste.txt` makes the *lexical* completeness claim checkable: a headword
list transcribed from a published PDF, page by page, against which `scripts/coverage.ts` measures
what the decks teach. The structural claim had no counterpart. `data/grammar-inventory.yaml` was
authored by the same process that authors the content, and `scripts/grammar-coverage.ts` measured
the content against it — so a structure nobody thought of was absent from both, and the figure read
100% anyway.

This is not hypothetical. On 2026-08-12 the A1 rows turned out to be missing structures the Goethe
A1 exam tests, found only because the owner happened to review the preposition strand. That audit
recorded, in its own method section, that "the SD1 grammar inventory proper (Prüfungsziele /
Testbeschreibung) is **not** among the local materials" — and stopped there. Nobody asked whether it
could be obtained.

It can. The Goethe-Institut publishes *Prüfungsziele, Testbeschreibung* per level as free PDFs, and
each contains a chapter **"Inventare — Grammatik: Morphologische und syntaktische Strukturen"**:
every structure the exam tests, in sections, with examples. The same institute whose Wortliste this
repo already tracks. The header of `data/grammar-inventory.yaml` had claimed these documents as its
source for months while no one had opened one.

Three further facts, established from the documents themselves, shape what can be anchored at all:

- **B2 has no Goethe inventory.** §4.4 delegates it: "Eine Zusammenstellung der sprachlichen Mittel
  (Grammatik und Wortschatz) … findet sich auf der CD-ROM zu **Profile deutsch** (2005)."
- **C1 and above have none, deliberately.** §4.4: "Wortschatz- und Grammatikinventare zum
  Goethe-Zertifikat C1 gibt es aus folgenden Gründen nicht …"
- **The A1 inventory governs comprehension, not production**: "Für die mündliche und schriftliche
  Produktion ist die Grammatik-Liste dagegen von untergeordneter Bedeutung" (S. 100).

And one that shapes the licensing: the documents are copyrighted, and this repository is public.

## Decision

**1 · Every level's denominator is anchored to a named published inventory, or explicitly is not.**
`data/strukturenlisten/<source-id>.yaml`, one file per **source document** rather than per level,
because a level can have several authorities and a row has to be able to say which one it rests on.
Each carries a full `source:` block: publisher, edition, chapter, page range, URL, retrieval date.

**2 · A row cites its entries, machine-checkably.** `claims: [<source-id>:<entry-key>]` on the
inventory row; `bun scripts/structures.ts` then sorts every published entry into **claimed**,
**unclaimed** (a hole in the denominator) or **beyond** (a row citing no source at an anchored
level — legitimate here, since the course aims at B1 and follows a coursebook progression, but
visible rather than assumed). A `claims:` ref that resolves to nothing is a validator failure: a
citation to a document that does not say it is worse than no citation.

**3 · A level with no source reports `anchored: false`, never 100% of nothing.** Calling all 32 B1
rows unanchored would read as 32 defects when it is one unbought book, so `beyond` is not computed
where nothing exists to be beyond. `data/strukturenlisten/README.md` names the missing documents and
what each costs.

**4 · Placement is two levels, not one.** `level: {reception, production}` replaces
`standard_level`. The published lists are reception standards and this is a production course; with
one field, "meet the dative in fixed chunks at A1, produce the paradigm at A2" was indistinguishable
from being a level late. `reception` may never follow `production`.

**5 · Only labels cross the copyright line.** Structure names, in the document's own section order,
with its page numbers — the same boundary `data/goethe-a1-wortliste.txt` already states ("the
official glosses and examples are copyrighted; all translations and examples in `content/vocab/` are
original"). **No example sentence from a source is reproduced anywhere in this repository.** The PDFs
themselves stay under `docs/GeotheInstitute/`, gitignored, per ADR 0009. That a structure is tested
at a level is a fact; the sentence a booklet chose to illustrate it with is not ours to take.

**6 · What the transcription had to decide is written down, not smoothed.** A missing legend, an
overview that disagrees with its own detail table, an error in the source — each gets a `note:` on
the entry. Two are already there: the A1 booklet's unexplained asterisks (resolved against the
combined handbook's legend, and said so), and Fit-in-Deutsch-2's printed `zu + Akkusativ`, which is
wrong and is corrected with the printed form recorded. A source quietly improved is a source that
can no longer be checked.

## Consequences

- **The published figures fell, and that is the point.** A1 23/23 → **24/28**, A2 32/32 → **35/37**.
  Six structures the exams list had no row: the coordinating conjunctions (which the *lexical*
  manifest had been claiming as taught grammar all along, with nothing able to see the
  disagreement), both Wortbildung sections, the demonstrative and interrogative determiners, and the
  reciprocal pronoun. `tests/grammar-coverage.test.ts` became a countdown again, naming the open ids.
- **B1's 100% is now labelled.** It measures every row that was written, against no external list.
  Closing that costs one book.
- **Adding a source is a bounded job**: PDF into the gitignored folder, one YAML, run the script,
  and every new entry starts life `unclaimed` — the size of the work visible before any of it is done,
  which is what the B1 manifest got right by being authored at 0%.
- **A per-row `source:` free-text field exists and is deliberately empty.** Every citation this repo
  can verify is a `claims:` ref; a free-text source field is exactly where unearned citations
  accumulate, so it stays reserved for an authority with no machine-readable list.

## Alternatives considered

- **Keep the self-authored list and review it harder.** Rejected: it had just been reviewed hard, by
  a targeted audit, which found rows missing and still concluded the source document was
  unobtainable. The failure was not effort.
- **Transcribe the inventories in full, with examples.** Rejected on copyright, and unnecessary: the
  label is what a denominator needs, and the page number sends a disputed row back to the PDF.
- **One file per level rather than per document.** Rejected: A2 has three candidate authorities (the
  current youth exam, the retired Start Deutsch 2, the unbought adult exam) that disagree in scope,
  and merging them would make a row's authority unreadable — the defect this ADR exists to end.

## Amendment, 2026-08-14 — the DTZ, and three things it changed

The Deutsch-Test für Zuwanderer Prüfungshandbuch (Goethe-Institut | telc, 2009) is free, and its
§8.4 is a **164-entry grammar inventory covering A2 *and* B1**. B1's "100% against no external
list" is over: it now reads **141/164**, with 23 named holes.

Three consequences the original decision did not anticipate:

- **`audience` had to become load-bearing, not documentation.** For one day A2 read 138/138 = 100%,
  and the list it was 100% of was *Fit in Deutsch 2* — the exam for teenagers. The adult A2
  Prüfungsziele is not published free and Start Deutsch 2 is retired, so a youth exam was the only
  current A2 anchor and nothing in the report said so. `scripts/structures.ts` now prints
  `[audience]`, `[mode]` and `[kumulativ]` beside every source it counted. The ADR's original
  rejection of one-file-per-level is what made this fixable: the authorities were still separable.
- **`cumulative: true` is a new property of a source.** The DTZ is one exam scored to A2 *or* B1, so
  §8.4 assigns no level: two entries carry a B1-only footnote and 162 carry nothing. A cumulative
  source is measured at every declared level at or above each entry's floor. Encoding it at A2 alone
  would have left B1 unanchored a second time; at B1 alone it would have made the DTZ say something
  about A2 that it does not.
- **`mode: production` finally appears.** Every anchor so far was `reception` or `unstated`, which
  meant the course's *production* claim rested on nothing external. §8.4 opens with "Strukturen, die
  Prüfungsteilnehmende **aktiv und passiv** beherrschen sollen" — the first published list that
  measures what this course actually trains.

### The transcription itself became checkable

`bun scripts/anchor-check.ts` reads the source with `pdftotext` and holds every `de:` label against
it. This closes a hole the original ADR left open: it argued that labels-only keeps the boundary
legal, but nothing checked that a label was a label the document *printed*. On its first run three
of the four existing files failed — they had expanded the source's own wording into fuller
grammatical terms (`Indefinitpronomen: man` for the printed `Indefinit: man`; `Attributives
Adjektiv`, where the booklet never uses the word *attributiv* at all). The entries were right and
the denominator was the right size; the labels were paraphrases, and a paraphrased denominator
cannot be checked against the document it claims to come from.

The check is not a CI gate, on purpose: the PDFs are local-only (ADR 0009), so a clean checkout
cannot run it and an absent source skips rather than fails — the contract `exam:ingest` already
keeps. Each source therefore also declares `pdf_pages`, the PDF pages holding its printed `pages`.
That is declared outright rather than as an offset because Start Deutsch 2's PDF is a two-up scan
whose every page carries two printed pages.
