# Grammar-structure audit — the denominator's own denominator

Date: 2026-08-14. Trigger: the owner asked for a review of the grammar's logic and completeness,
using a pasted AI-generated grammar map (`docs/grammar-from-chatgpt.md`) as a checklist.

The course published **A1 23/23, A2 32/32, B1 32/32 — 100% at every level**. Two days earlier the
A1 denominator itself had turned out to be missing rows ([level-completeness-audit](level-completeness-audit.md)),
so 100% had been measuring an incomplete list. This audit asked whether that was one incident or a
property of the instrument. It is a property of the instrument, and three of the four defects below
had no gate that could have seen them.

## Method, and one correction to record

Four evidence classes, in descending strength:

1. **A published grammar inventory** — the official Goethe *Prüfungsziele, Testbeschreibung* per
   level, now in `data/strukturenlisten/`.
2. **A `~` in a Wortliste manifest** — the course's own claim that it teaches a word as grammar.
3. **A registered focus tag** — the course's own claim that a confusion exists and is drilled.
4. **The pasted map** — an outline, never a source. It is right about the cross-cutting systems and
   it misses two things this repo also misses (Modalpartikeln, Wortbildung); where it disagrees with
   the repo about placement, the repo is usually correct.

**Correction.** The first pass of this audit reported that no external authorised grammar reference
exists for German by CEFR level. What had actually been verified was that none is *in this repo* —
and the A1 audit had recorded the same thing two days earlier ("the SD1 grammar inventory proper …
is not among the local materials") without asking whether it could be obtained. It can, free, from
the same institute whose Wortliste this repo already tracks page by page. Everything in §1 follows
from a search that should have happened first.

## 1 · The external anchors

| Level | Inventory | Access | State |
| --- | --- | --- | --- |
| A1 | *Start Deutsch 1 — Prüfungsziele*, ch. Inventare, S. 100–105 | free PDF, goethe.de | **ingested** — `goethe-a1-sd1.yaml`, 95 entries |
| A2 | *Fit in Deutsch 2 — Prüfungsziele*, S. 104–108 | free PDF, goethe.de | **ingested** — `goethe-a2-fit2.yaml`, 102 entries |
| A2 | *Start Deutsch 1 und 2*, S. 192–201 (`*` = SD2) | free PDF, goethe.de | **ingested**, marked `retired` — `goethe-start-deutsch-2.yaml`, 36 entries |
| A2 (Erwachsene) | Goethe-Zertifikat A2 · Prüfungsziele | not published free | missing |
| B1 | Goethe-/ÖSD-Zertifikat B1 · Prüfungsziele | ISBN 978-3-19-031868-1 | **missing — B1 has no anchor at all** |
| B2 | Goethe delegates: "findet sich auf der CD-ROM zu **Profile deutsch** (2005)" (Prüfungsziele B2 §4.4) | ISBN 978-3-468-49410-9 | missing |
| C1+ | Goethe states none exists, with reasons (Prüfungsziele C1 §4.4) | — | does not exist |

Two findings settle the method. The **BAMF Rahmencurriculum** (free, official, Goethe-authored for
the BMI, basis of the DTZ) explicitly *refuses* to set a grammar progression — "Er leistet ebenso
wenig eine Sequenzierung der Lernziele innerhalb einer Niveaustufe wie die Festlegung einer
grammatischen Progression" (§1.3) — and calibrates its can-dos against Profile deutsch. It anchors
the outcome side, never the structure side. And the Goethe A1 inventory says of itself that it
governs **comprehension**: "Für die mündliche und schriftliche Produktion ist die Grammatik-Liste
dagegen von untergeordneter Bedeutung" (S. 100).

That second sentence is why `standard_level` had to go. This is a production course; the standard is
a reception standard; one field could not hold both, so a deliberate sequencing decision — meet the
dative inside fixed chunks at A1, produce the paradigm at A2 — was indistinguishable from being a
level late. Twelve rows now carry `level: {reception, production}` with the two differing.

**What entered the repo:** structure labels only, in the document's own section order, no example
sentences — the boundary the Wortliste manifests already keep. Full contract:
[`data/strukturenlisten/README.md`](../../data/strukturenlisten/README.md).

## 2 · What the anchor found

`bun scripts/structures.ts A1 A2` sorts every published entry into *claimed* / *unclaimed* /
*beyond*. Six structures were unclaimed by any row and became inventory rows in this pass:

| Row opened | Level | Evidence |
| --- | --- | --- |
| `koordination` — *und/oder/aber/denn*, position 0 | A1 | Listed at A1 **and** A2. `~und`, `~oder`, `~aber` were ~-claimed in `data/goethe-a1-wortliste.txt` — the lexical manifest asserting the curriculum teaches them as grammar — while the grammar inventory had no coordination row at any level. Two instruments disagreeing about what A1 contains, with nothing able to see it. |
| `wortbildung-nomen` | A1 | **Wortbildung is one of the eight top-level sections of both inventories** and had no row at any level — the largest single hole found. |
| `wortbildung-adjektiv` | A1 | *un-*, *-los*, *-bar*, *hellblau*. |
| `demonstrativartikel` | A1 | *dieser* listed at A1 and again at A2. |
| `reziprokpronomen` | A2 | *Wir sehen uns* — same form as the reflexive, none of its meaning. |
| `interrogativartikel` | A2 | *welch-* as a determiner, plus *alle*. |

Three more rows came from **internal** evidence — focus tags that were registered and drilled and
that no inventory row referenced, so the structure they teach was invisible to the structural
measure:

`partizip2-system` (A2, the complete Partizip II formation rule, split out of `perfekt` where it
lived as the second sentence of a `note:`) · `dativ-akkusativ-objekte` (A2, two-object verbs) ·
`will-moechte` (A2, register) · `haben-wendungen` (A1). All four orphan tags are now referenced.

**The figures after the pass** (`bun scripts/grammar-coverage.ts`, `bun scripts/structures.ts`):

| | A1 | A2 | B1 |
| --- | --- | --- | --- |
| grammar coverage | **24/28 (86%)** | **35/37 (95%)** | 32/32 (100%) |
| published entries claimed | 92/93 | 138/138 | *no anchor* |
| rows beyond every source | 2 | 9 | 32 |

The remaining unclaimed A1 entry is *über* as a duration marker (*über 20 Minuten*), taught nowhere.

## 3 · Depth was invisible, and is now measured

`bun scripts/grammar-depth.ts`. Coverage is binary by design — one practice/drill item marks a point
taught — which was the right bar for "is this structure in the course" and the wrong bar for the
question it kept being read as answering.

| per focus tag, median | A1 | A2 | B1 |
| --- | --- | --- | --- |
| teaching items | 12 | 8 | **4** |
| production items | 6 | 6 | **3** |
| distinct practice files | 4 | 3 | 2 |
| tags in exactly one practice file | 4 of 27 (15%) | 4 of 39 (10%) | **10 of 35 (29%)** |
| tags at ≤3 items | 4 | 2 | 9 |

All three levels published the same 100%. Thirteen structures are taught and never re-asked by a
probe — the delayed check that closes the lesson cycle. B1 has **one drill set (8 items)** against
A2's thirteen (170), so the remediation channel is effectively unbuilt there (this is what backlog
P23-3 sees from the other end), and B1 pretests carry **zero** focus tags where A2's carry 72 of 72.

There is deliberately **no threshold**: nobody has validated a correct number of items per confusion,
and inventing one would put a fabricated bar into a repo built on earned figures. The report prints
each level's median and reads every row against it, the `comprehensibility.ts` discipline.
`tests/grammar-depth.test.ts` is a ratchet on measured reality, not a bar.

## 4 · The spiral was prose, and the confusions have no anchor

Fifteen rows encoded "A1 teaches X, A2 deepens it to Y" inside a free-text `note:` — and
`scripts/grammar-coverage.ts:39` prints a note **only when a point is not covered**, so at 100%
every one of those relations was unprintable. They are `deepens:` edges now (37 of them), validated
for existence and direction, and drawn as ladders in the console's Strang view.

Separately: **20 of 49 articles have no `###` subsections inside `## Erklärung`** — including every
case topic (`a1/akkusativ`, `a2/dativ`), `a1/praesens-wortstellung`, `a2/modalverben`,
`a2/perfekt-haben-sein`. CLAUDE.md states the rule; `packages/content/src/prose-shape.ts:200-206` explicitly
leaves it to the author, so nothing checked it. `bun run validate` now warns (exit 0), because the
mechanical half of the rule is checkable even though the semantic half is not. It matters beyond
tidiness: the heading is the only addressable place a structure is explained, so without one an
inventory row, a cross-link and the console's Struktur page all have nowhere to point but the whole
article.

## 5 · What is already good

Worth recording so it is not "fixed" into something worse:

- `a2/verben-mit-kasus` teaches the pasted map's stated crux outright — *auf den Bus warten* is
  government, not direction, "even though *auf* is a Wechselpräposition and nothing in the sentence
  moves". The map calls this the most important conceptual transition after wo/wohin.
- *wann / wenn / als*, TeKaMoLo and the person/thing split in wo(r)-/da(r)- are all present.
- The **focus-tag table** is the strongest asset in the repo: each tag names its confusion, the L1
  hand pushing the error, and its boundary against neighbouring tags. Nothing here touched it.
- The lexical instrument was right all along, and is the model the structural one has now copied.

## What this audit does not claim

- **Nothing about whether the learner has learned any of it.** Every figure here is about the
  catalog. Delayed retention and novel transfer are `progress:audit`'s question, not this one.
- **Nothing about B1's completeness.** B1 reports 32/32 against a list with **no external anchor**;
  that is the state A1 was in when it read 100% while missing four structures. The B1 figure should
  be read as "every row we wrote is taught", never as "B1 is complete".
- **Nothing about the adult A2 exam.** The free A2 inventory is *Fit in Deutsch 2*, the youth exam.
- **No percentage for structures beyond the sources.** 43 rows across the three levels cite no
  published entry. That is a legitimate consequence of aiming at B1 and following a coursebook
  progression — and it is now visible instead of indistinguishable from an accident.

## Instruments this audit added

```sh
bun scripts/structures.ts <A1|A2> [--unclaimed-only] [--beyond]   # denominator vs published norm
bun scripts/grammar-depth.ts [<level>] [--thin] [--by-point]      # practice behind each confusion
bun run redaktion                                                 # the navigator: Sprachkarte, Stränge, Quellen, Lücken
```
