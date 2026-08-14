# Strukturenlisten — the external anchors for the grammar denominator

`data/goethe-<level>-wortliste.txt` makes the *lexical* claim checkable against a published list.
Until 2026-08-14 the *structural* claim had no such anchor: `data/grammar-inventory.yaml` was
measured only against itself, which is how three levels came to report 100% while the A1
denominator was found to be missing rows two days earlier.

These files are the missing counterpart. One file per **source document**, not per level — because
a level can have several authorities and a row has to be able to say which one it rests on.

| file | level | status | free |
| --- | --- | --- | --- |
| `goethe-a1-sd1.yaml` | A1 | current | yes |
| `goethe-a2-fit2.yaml` | A2 (Jugendliche) | current | yes |
| `goethe-start-deutsch-2.yaml` | A2 | **retired** | yes |
| — | A2 (Erwachsene) | current | no — Prüfungsziele not published free |
| — | B1 | current | no — ISBN 978-3-19-031868-1 |
| — | B2 | current | no — Goethe delegates to *Profile deutsch*, ISBN 978-3-468-49410-9 |
| — | C1+ | — | Goethe states no inventory exists, and why |

The last four rows are the honest state of the world, not a to-do list that was forgotten: B2's
Prüfungsziele §4.4 says the inventory "findet sich auf der CD-ROM zu Profile deutsch (2005)", and
C1's §4.4 says inventories "gibt es aus folgenden Gründen nicht". A level with no anchor here is
measured against the coursebook progression alone, and `bun scripts/structures.ts` reports its rows
as `beyond` rather than pretending otherwise.

## What a file contains, and what it must never contain

**Structure labels only, in the document's own section order.** No example sentences. This is the
boundary the Wortliste manifests already keep — "the official glosses and examples are copyrighted;
all translations and examples in `content/vocab/` are original" — and it holds for the same reason:
*that the exam tests the dative after `helfen`* is a fact, and the sentence the booklet chose to
illustrate it with is not ours to take. Every German example in this repo is written here.

A `note:` records anything the transcription had to decide: a missing legend, an overview that
disagrees with a detail table, an error in the source. A source is not improved by being quietly
corrected — it is made unverifiable.

## How a row cites one

```yaml
# data/grammar-inventory.yaml
- id: dativ-verben
  claims: [goethe-a1-sd1:pron-personal-dativ-verben, goethe-a2-fit2:pron-personal-dativ]
```

`bun scripts/structures.ts <A1|A2>` then sorts every entry into three classes:

- **claimed** — a source entry some inventory row covers;
- **unclaimed** — a source entry no row covers, i.e. a hole in the denominator;
- **beyond** — an inventory row citing no source entry at this level. Legitimate: this course aims
  at B1 and follows a coursebook progression, so it teaches structures Start Deutsch never tested.
  It must be *visible* as a choice rather than invisible as an assumption.

## The reception/production distinction

The A1 document states that its inventory governs **comprehension**: "Für die mündliche und
schriftliche Produktion ist die Grammatik-Liste dagegen von untergeordneter Bedeutung" (Seite 100).
So a structure the source puts at A1 and this course produces at A2 is a sequencing decision, not a
gap — which is why every inventory row carries `level: {reception, production}` and not a single
`standard_level`. Each source file records its own reading in `source.mode`
(`reception` · `production` · `unstated`); never assume one.

## Adding a source

1. Put the PDF in `docs/GeotheInstitute/` (gitignored, ADR 0009) and record it in `SOURCES.md` there.
2. Add `data/strukturenlisten/<source-id>.yaml` with a full `source:` block — publisher, edition,
   chapter, page range, URL, retrieval date, and `mode`.
3. Transcribe labels section by section, keeping the source's order and page numbers.
4. `bun scripts/structures.ts <level>` — every new entry starts life `unclaimed`, and that is the
   point: the size of the job is visible before any of it is done.
