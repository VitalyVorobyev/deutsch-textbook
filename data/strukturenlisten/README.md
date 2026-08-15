# Strukturenlisten — the external anchors for the grammar denominator

`data/goethe-<level>-wortliste.txt` makes the *lexical* claim checkable against a published list.
Until 2026-08-14 the *structural* claim had no such anchor: `data/grammar-inventory.yaml` was
measured only against itself, which is how three levels came to report 100% while the A1
denominator was found to be missing rows two days earlier.

These files are the missing counterpart. One file per **source document**, not per level — because
a level can have several authorities and a row has to be able to say which one it rests on.

| file | level | audience | mode | entries | status | free |
| --- | --- | --- | --- | --- | --- | --- |
| `goethe-a1-sd1.yaml` | A1 | Erwachsene | reception | 93 | current | yes |
| `goethe-a2-fit2.yaml` | A2 | **Jugendliche** | unstated | 102 | current | yes |
| `goethe-start-deutsch-2.yaml` | A2 | Erwachsene | reception | 36 | **retired** | yes |
| `goethe-dtz.yaml` | A2 **+ B1** | Erwachsene | **production** | 164 | current | yes |
| — | A2 (Erwachsene) | — | — | — | current | no — Prüfungsziele not published free |
| — | B1 (Zertifikat) | — | — | — | current | no — ISBN 978-3-19-031868-1 |
| — | B2 | — | — | — | current | no — Goethe delegates to *Profile deutsch*, ISBN 978-3-468-49410-9 |
| — | C1+ | — | — | — | — | Goethe states no inventory exists, and why |

The empty rows are the honest state of the world, not a to-do list that was forgotten: B2's
Prüfungsziele §4.4 says the inventory "findet sich auf der CD-ROM zu Profile deutsch (2005)", and
C1's §4.4 says inventories "gibt es aus folgenden Gründen nicht". A level with no anchor here is
measured against the coursebook progression alone, and `bun scripts/structures.ts` reports its rows
as `beyond` rather than pretending otherwise.

## Whose exam is the denominator? — read the `audience` column first

For one day in August 2026, A2 read **138/138 = 100%**. The list it was 100% of was *Fit in
Deutsch 2*, the exam for **teenagers**: the adult A2 Prüfungsziele is not published free, Start
Deutsch 2 is retired, and nothing in the report said so. This course is written for an adult
learner. A percentage that does not name the exam behind it is not a percentage anyone can act on,
which is why `bun scripts/structures.ts` now prints `[audience]`, `[mode]` and `[kumulativ]` beside
every source it counted.

Adding the DTZ moved A2 from 138/138 to **277/300**. Neither number was wrong; they answer different
questions, and only one of them is about an adult.

## Two properties a source declares about itself

**`mode`** — `reception` · `production` · `unstated`, never assumed. The A1 document states that its
inventory governs comprehension: "Für die mündliche und schriftliche Produktion ist die
Grammatik-Liste dagegen von untergeordneter Bedeutung" (Seite 100). The DTZ states the opposite —
"Strukturen, die Prüfungsteilnehmende **aktiv und passiv** beherrschen sollen" (§8.4) — and is
therefore the first anchor here that measures what this course actually trains. A structure a source
puts at A1 and this course produces at A2 is a sequencing decision, not a gap, which is why every
inventory row carries `level: {reception, production}` and not one `standard_level`.

**`cumulative`** — the source assigns no level to its entries, and an entry's `level` is the floor at
which the source first requires it rather than the level it belongs to. The DTZ is one exam scored to
A2 *or* B1, so §8.4 levels nothing: two entries carry a B1-only footnote and the other 162 carry
nothing. A cumulative source is measured at every declared level at or above each entry's floor —
the only reading true at both. Encoding that list at A2 alone would have left B1 unanchored for a
second time; encoding it at B1 alone would have made the DTZ say something about A2 that it does not.

## Verifying a transcription

```
bun scripts/anchor-check.ts                  # every anchor whose PDF is present locally
bun scripts/anchor-check.ts goethe-dtz       # one
bun scripts/anchor-check.ts goethe-dtz --unaccounted
```

It reads the source with `pdftotext` and holds every `de:` label against it: a label containing a
word the page does not contain is a fabrication, and a label shaped like a sentence is a leaked
example. It exists because neither failure is otherwise visible — the YAML parses, `bun run
validate` is green, and `structures.ts` reports a percentage of the wrong list.

It caught a real one on its first run. Three of the four files had **expanded the source's own
wording into fuller grammatical terms** — `Indefinitpronomen: man` where the booklet prints
`Indefinit: man`, `Attributives Adjektiv` where the booklet never uses the word *attributiv* at
all. The entries were right; the labels were paraphrases, and a paraphrased denominator cannot be
checked against the document it claims to come from.

So each source also declares **`pdf_pages`** — which pages of `local` hold `pages`. Declared
outright rather than as an offset, because Start Deutsch 2's PDF is a two-up scan whose every page
carries two printed pages, and no single addend maps one to the other.

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

`bun scripts/structures.ts <A1|A2|B1>` then sorts every entry into three classes:

- **claimed** — a source entry some inventory row covers;
- **unclaimed** — a source entry no row covers, i.e. a hole in the denominator;
- **beyond** — an inventory row citing no source entry at this level. Legitimate: this course aims
  at B1 and follows a coursebook progression, so it teaches structures Start Deutsch never tested.
  It must be *visible* as a choice rather than invisible as an assumption.

## Adding a source

1. Put the PDF in `docs/GeotheInstitute/` (gitignored, ADR 0009) and record it in `SOURCES.md` there.
2. Add `data/strukturenlisten/<source-id>.yaml` with a full `source:` block — publisher, edition,
   chapter, printed page range, `pdf_pages`, URL, retrieval date, `audience`, `mode`, and
   `cumulative` where the source levels nothing.
3. Transcribe labels section by section, keeping the source's order and page numbers.
4. `bun scripts/anchor-check.ts <source-id>` — prove the transcription against the PDF before
   anyone reads a number off it.
5. `bun scripts/structures.ts <level>` — every new entry starts life `unclaimed`, and that is the
   point: the size of the job is visible before any of it is done.
