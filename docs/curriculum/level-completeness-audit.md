# Level-completeness audit — A1 against the Goethe inventory, A2 placement verdicts

Date: 2026-08-12. Trigger: the owner's review of the preposition strand. A1's instruments
reported complete (22/22 grammar points, 100% Wortliste) while material the Goethe A1 exam
tests kept landing at A2 — the A1 grammar-inventory **denominator itself was missing rows**,
so 100% measured coverage of an incomplete list. This audit rebuilds the denominator from
the official source and rules on the placement of every A2 topic.

## Method and evidence classes

Local primary source: `docs/GeotheInstitute/A1_SD1_Wortliste_02.pdf` (official Goethe
*Start Deutsch 1 Wortliste*, VS_02; local-only per ADR 0009). Extraction:

```
pdftotext -layout docs/GeotheInstitute/A1_SD1_Wortliste_02.pdf -
```

Seite numbers below are the document's printed page footers. Three evidence classes, in
descending strength:

1. **Wortgruppenliste membership** (Seite 6–8) — a functional requirement: the exam expects
   the whole group (Uhrzeit, Datum, Wochentage incl. *am Wochenende*, Tageszeiten, Monate,
   Jahreszeiten, Ordinalzahlen).
2. **Alphabetical-list example sentence** — attests the construction at A1, receptively at
   minimum (each headword ships official example sentences).
3. **Repo inventory row** (`data/grammar-inventory.yaml`) — the project's own productive
   teaching commitment.

The SD1 grammar inventory proper (*Prüfungsziele / Testbeschreibung*) is **not** among the
local materials; nothing below cites it. Interpretive rule: a Wortliste example attests the
**word in a pattern**, not a productive structure requirement — verdicts therefore
distinguish chunk-level competence (A1) from system-level competence (A2), the same split
the inventory already documents for `perfekt`.

## Part 1 — A1 denominator diff

| # | Candidate | Wortliste evidence (Seite) | Current coverage | Disposition |
| --- | --- | --- | --- | --- |
| 1 | **Place prepositions by place type, as chunks** (wohin/wo/woher) | *an*: „Wir treffen uns am Bahnhof“ (9) · *in*: „Ich wohne in Wiesbaden“, „wir gehen ins Kino“ (17) · *zu*: „Der Bus fährt zum Bahnhof“ (26) · *bei*: „Ich wohne bei meinen Eltern“ (11) · *nach*: „nach Hause / nach München“ (20) · *aus*: „aus Brasilien“ (10) · *von*: „von Köln / von zu Hause“ (25) · *auf*: „auf der Straße“ (10) · *wo/wohin/woher* all headwords (27) | **No A1 row at all.** A1 `wohnen` teaches fixed phrases only; the system lives in `a2/ort-richtung-praepositionen` | **Close at A1**: re-author and move `ort-richtung-praepositionen` → A1; row `lokale-praepositionen-ortstyp` `standard_level: A2 → A1`. Lands in its own PR, row and content together |
| 2 | **Temporal expressions beyond um/am/im** | *von…bis*: „Unterricht von 8.00 bis 12.00 Uhr“ (25) · *bis*: „Ich warte bis morgen“ (12) · *in*: „Der Zug kommt in fünf Minuten“ (17) · *vor*: „Der Termin war vor einer Stunde“ (25) · *seit*: „Ich wohne seit drei Jahren in Köln“ (23) · *zwischen*: „Zwischen 8 und 10 Uhr“ (27) | `zeitangaben` row = um/am/im calendar only (owner `alltag-zeit`); *seit/vor* is an **A2** row (`seit-vor`, owner `gesundheit-arzttermin`); *ab*, *bis*-system, bare accusative in `zeitangaben-system` (A2) | **Patch at A1** (own PR): `alltag-zeit` gains *von…bis* and the chunk-level *in fünf Minuten*; `zeitangaben` note documents the A1-chunk / A2-system split. `seit-vor` **stays A2** as the productive two-way backward look — the A1 attestation is word-level. *ab* is ABSENT from the A1 list (see below), confirming `zeitangaben-system` at A2 |
| 3 | **Static local über/unter/zwischen/vor** | *über*: „im zweiten Stock über Familie Meier“ (24) · *unter*: „Unter uns wohnt…“ (25) · *zwischen*: „Heidelberg liegt zwischen…“ (27) · *vor*: „Das Auto steht vor der Tür“ (25) | No A1 row; the nine-way productive system is A2 (`wechselpraepositionen`, owner `wohnen-umzug`) | **No new A1 row.** Receptive attestation only; the productive case system is correctly A2. A1 readings may gloss them. Backlog: consider receptive exposure in an A1 reading |
| 4 | **es gibt + Akkusativ** | *geben*: „Es gibt keine Karten mehr“ (15) | Taught and drilled at A1 (`akkusativ`, `wohnen`; items in `a1/akkusativ`, `probe-wohnen`, `checkpoint-a1`) under the accusative rows | **No gap** — covered; no row needed |
| 5 | **Ordinals, dates, clock** | Wortgruppenliste: Ordinalzahlen, Datum, Uhrzeit a/b (6) | `zahlen-uhrzeit` row, `reference_only`, `taught_in: [alltag-zeit]` | **No gap** — covered by design |

Confirmed **absent** from the A1 Wortliste (supports current A2 placement): **ab**, **neben**,
**hinter** — none has a headword entry. `zeitangaben-system`, `wechselpraepositionen` and the
dative system remain correctly A2.

## Part 2 — A2 placement verdicts (all 25 topics)

Evidence: atlas spine + dependency graph + inventory rows (session exploration, 2026-08-12).
Verdict values: **stays** (correctly A2) · **spiral** (A2 full system over an A1 core the
inventory documents) · **moves**.

| Topic | Verdict | Reason |
| --- | --- | --- |
| dativ | stays | The productive dative system; prereq of 10 topics. A1 meets dative forms only inside chunks |
| trennbare-verben | **spiral** | Point `trennbare-verben` is `standard_level: A1`, closed by A1 `alltag-zeit`; A2 owns separable-vs-inseparable. Row note documenting the split added with this audit |
| modalverben | **spiral** | Point `modalverben` is A1, closed by A1 `freizeit-koennen`; A2 owns the full paradigm, darf-nicht/muss-nicht and möchte. Row note added with this audit |
| perfekt-haben-sein | **spiral** | Already documented in the `perfekt` row note — the pattern the other two now follow |
| alltag-tagesablauf | stays | Communicative routine unit on A2 lexis; deepens A1 `alltag-zeit` |
| termine-vereinbaren | stays | Appointment negotiation; A2 can-dos |
| wohnen-umzug | stays | Owns `wechselpraepositionen` — the productive nine-way case system is A2 |
| reisen-verkehr | stays | A2 can-dos (announcements, problems) |
| einkaufen-reklamation | stays | Komparativ/Superlativ + complaint register are A2 |
| adjektive-deklination | stays | Adjective declension is A2 (zero in-edges, but correctly placed) |
| gesundheit-arzttermin | stays | Owns `seit-vor`, reflexives — A2 systems |
| verben-mit-praepositionen | stays | Governed prepositions + da-/wo-words are A2 |
| arbeit-beruf | stays | A2 work-domain can-dos |
| nebensaetze-plaene | stays | `nebensatz-verbende` is A2; heaviest hub in the level |
| infinitiv-mit-zu | stays | A2 structures |
| relativsaetze | stays | A2 structure |
| biografie-erfahrungen | stays | Präteritum (war/hatte/modals) is A2 |
| verbindungen-folgen | stays | Konnektoren + als/wenn are A2 |
| man-und-besitz | stays | Indefinitpronomen, Genitiv-s, receptive Passiv are A2 |
| freunde-feste | stays | aber/sondern + invitation register |
| lernen-verstehen | stays | Indirect questions are A2 |
| aemter-dienstleistungen | stays | Formal register, höflicher Konjunktiv |
| **ort-richtung-praepositionen** | **moves → A1** | A1-standard can-dos; the chunk system is what SD1 tests (Part 1 row 1); zero incoming edges; case theory stays at A2 in `wohnen-umzug` |
| verben-mit-kasus | stays | Verb government as vocabulary is A2 |
| zeit-praepositionen | stays | The integrating system (seit/ab/bis/von…bis + bare accusative choice) is A2; its A1 core is already owned by `alltag-zeit` and gets the Part 1 row 2 patch |

Owner decisions backing the two non-obvious verdicts (2026-08-12): full-audit scope chosen;
`zeit-praepositionen` kept at A2 with the A1 patch, `ort-richtung-praepositionen` moved.

## Part 3 — inventory hygiene (this PR)

- `perfekt` (`standard_level: A1`) sat under the `# --- A2` section comment — re-sorted into
  the A1 block, beside `trennbare-verben` and `modalverben`, the other two spiral rows.
- `modalverben` and `trennbare-verben` rows gained the spiral note the `perfekt` row already
  had, so all three A1-core/A2-system splits are documented the same way.
- `adjektiv-nullartikel` (`standard_level: B1`) sits in the A2 adjective block — checked and
  **left in place**: the placement is deliberate and documented twice, in the row's own note
  ("listed here so the deferral is visible") and in the B1 section header's scope-boundary
  comment. Not a defect; recorded here so the next audit does not re-flag it.

## What this audit does not claim

- Nothing about B1 (not audited; it just exited the #169–#178 review loop).
- A Wortliste attestation is not a productive requirement — dispositions above say which of
  the two each row means.
- Material completeness of the other 24 A2 topics' article systems (the missing-*an* defect
  class) is a separate instrument: the batched review loop tracked as the follow-up to this
  audit. Batch 1 = the preposition/time/case strand (PR #185); batch 2 = dativ,
  trennbare-verben, alltag-tagesablauf, modalverben, termine-vereinbaren (2026-08-12 — the
  missing paradigm member this time was the habitual *-s* adverbs beside the *am/um/in der*
  system; the dativ paradigms themselves enumerated complete). Batch 3 = perfekt-haben-sein,
  wohnen-umzug, reisen-verkehr, einkaufen-reklamation, adjektive-deklination (2026-08-12 —
  two missing members this round: the *gemischt* Partizip class the formation table could not
  generate, and *hoch*/*nah* behind a closed "three irregulars" claim; plus the systemic RU/UK
  article-indeterminacy class across `adjektive-deklination`'s translate items, fixed with
  constraining instructions where the determiner selects the graded ending and accepts where it
  does not; reisen-verkehr clean). Batch 4 = gesundheit-arzttermin, verben-mit-praepositionen,
  arbeit-beruf, nebensaetze-plaene, infinitiv-mit-zu (2026-08-12 — two missing members: the
  obligatory imperative *-e* after -t/-d/-ig stems that the stated bare-stem rule contradicted,
  and *uns*/*euch* absent from the reflexive paradigm the topic's own imperative table already
  uses; one false absolute, "*denn* never opens a sentence", in four places; and the modal/lexeme
  underdetermination class on probes — «нужно» licenses *soll*, «придёт» licenses *kommt*,
  «Хочешь…?» licenses *wollen* — fixed with accepts, pin unions and one RU/UK prompt rewrite).
  Batch 5 = relativsaetze, biografie-erfahrungen, verbindungen-folgen, man-und-besitz,
  freunde-feste (2026-08-12 — the paradigm member this round was *es → ihm*, absent from an
  article table whose own primary practice drills it; the "whole family" modal-Präteritum claim
  opened for *sollte* and *mochte*; *wann* added as the third renderer of «когда»; one outcome's
  mode corrected to the task that measures it — the only mode mismatch across the batch's
  nineteen outcomes; a B1 Präteritum passive rewritten out of a graded distractor; plus the
  determinacy class on both objects of the two-object probe family, whose header had already
  made the argument for the thing but not the person). Batch 6 = lernen-verstehen,
  aemter-dienstleistungen (2026-08-12 — the false facts this round were *d.h.* printed without
  its space in the table that teaches abbreviation spacing, and "the possessive ends in -em"
  stated as a consequence of the dative while *mit einer Kopie* sat in the same sentence; the
  dominant class was grading, not prose: accepted synonyms left unpinned so the focus tag
  silently stopped firing — *anfängt, aufmacht, zumacht, ist, will, soll* now join their pins —
  plus the *bitte* the RU/UK prompts never carried, required by every accepted rendering of four
  polite-request items including all three probe variants). **The batched review loop is closed:
  all 25 A2 topics audited** (PRs #185, #186, #192, #193, #194 and the batch-6 PR). The
  unpinned-synonym class turned out to be corpus-wide and gate-invisible — its permanent fix is
  the P25-21 validator rule.
