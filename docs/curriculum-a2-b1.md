# A2–B1 curriculum blueprint

Status: **The A2 authoring contract is complete; B1 remains a provisional north star** (2026-07-13).

The required A1/A2 spine is now fully authored. Until representative A2 use, the A2 checkpoint and
delayed evidence are reviewed, new work stays inside the existing levels: optional connected
readings, cultural context, real-world documents and deliberately selected formulaic chunks.

This is the source of truth for what A2 teaches, in what order, with which identities. It exists
because the ten remaining A2 units share prerequisites, vocabulary and confusions, and deciding
those unit by unit produces a level that does not add up. Everything here that names an identity —
a topic id, an outcome id, a focus tag — is **frozen**: it becomes a persisted key in the learner's
progress the moment its unit ships, and renaming it destroys their history.

What this document is *not*: a second authoring contract. The rules for how any single artifact is
written live in [`CLAUDE.md`](../CLAUDE.md), and the bar a finished unit must clear is the twelve-point
A2 unit quality gate in [the A1 learning audit](a1-learning-audit.md). This document decides the
*curriculum* — what the units are, what they own, and what they may not touch.

## Product and progression principles

A2 moves the learner from rehearsed A1 exchanges to independent handling of predictable everyday
situations: housing, travel, shopping, health, work, socializing and public services. The course
teaches practical action, not a grammar inventory. Grammar is embedded in the situation that needs
it, and gets its own node only when the contrast is reusable across many situations — which at A2
is true exactly once, for subordinate clauses.

Every unit:

- centres on one real-world scenario and 2–4 observable **Ich kann …** outcomes;
- pairs meaningful input with retrieval, interaction approximation and fresh-context production;
- follows pretest → model → explanation → scaffold → fade → transfer → delayed check;
- revisits earlier language through explicit `deepens` edges and cumulative retrieval;
- keeps the path soft and the evidence honest: open production is practice, never verified mastery.

### Missions are an authoring convention, not a feature

The audit requires each unit to provide "a coherent real-world mission joining multiple skills",
while the backlog defers the mission *feature* (P5-4) as the most code for the least measured
learning gain. Both are right, and the resolution is that a mission is a **content** rule:

> A unit's article examples, reading, listening, practice and transfer task all take place in one
> concrete scenario with the same people and the same problem, and the unit ends with a
> fresh-context production task in which the learner does the thing the scenario was about.

That costs no code, needs no new schema, and is exactly what "combine several skills in a coherent
mission rather than merely lengthen the article" asked for. A branching or resumable mission engine
remains deferred.

## Vocabulary policy

**The lexical fields are already ~85% spent.** Twenty-five decks hold 711 headwords, and the
validator hard-fails a headword that appears in two decks. Eleven of those decks are deliberately
*unowned* — they were authored for the Goethe-A1 Wortliste completion pass and gate their fresh
cards on the learner's level rather than on a topic (`eligibleFreshCards`, `src/lib/decks.ts`);
`termine-zeit`, once counted among them, is `level: A2` and owned by `termine-vereinbaren`.
They already own most of the words a new A2 unit reaches for: `umsteigen`, `Gleis` and `Fahrplan`
(reisen-urlaub); `stehen`, `stellen`, `legen` and `liegen` (wohnen, verben-grundwortschatz);
`passen` (termine-zeit, owned); `weil`, `dass`, `wenn` and `denn` (kernwortschatz-a2); `bedeuten` and
`wiederholen` (kommunikation-medien).

Two rules follow, and they are not negotiable.

**Recycle, never adopt.** An A2 unit must not list an existing A1 deck in its `vocab:` frontmatter.
Doing so flips that deck's fresh-card eligibility from "any A1 topic has been opened" to "this A2
topic has been opened", which would push hundreds of A1 Wortliste words behind an A2 gate and
quietly break the 100% A1 coverage claim in practice. Instead the unit **recycles** the A1 field
deck in its article examples, reading and exercises — which is what finally gives those words the
communicative home the level-completion decks never had.

**Each unit owns one thin new A2 deck.** `content/vocab/<unit-id>.yaml`, `level: A2`, holding only
language that no deck already teaches: the genuinely A2 words, and the multi-word chunks that carry
the function (`Wo muss ich umsteigen?` is a distinct headword from `umsteigen`, and is the more
useful card). Before authoring, list the forbidden headwords for the field — every `de` in
`content/vocab/*.yaml` — and check against it. Expect **12–24 new entries per unit**, lower for a
grammar-heavy unit, and treat the number as a load guardrail rather than a target.

**Receptive-only language never enters a deck.** `buildDeck()` turns every vocab entry into two
cards, a recognition card and a production card; there is no recognition-only representation. So a
station announcement, a listing abbreviation or a form heading — language the learner must
understand but will never produce — belongs in a reading, a gloss or an article table, and nowhere
near `content/vocab/`. (The draft of this blueprint asked authors to budget "new receptive"
vocabulary; that category is deleted. If A2 usage shows the SRS load is genuinely inflated by words
that only need recognition, a `cards: recognition | both` field is the fix, and it is a backlog
item, not an authoring workaround.)

**Coverage is measured, not asserted.** A2 is checked against the Goethe-Zertifikat A2 Wortliste in
`data/goethe-a2-wortliste.txt` exactly as A1 is: units drive authoring, a completion pass at the end
of the level closes the remaining gap, and the Über page computes the real figure. No count on a
user-facing page is ever hand-written.

**And a `~` is measured too.** A manifest word marked `~` (addressed as grammar, no flashcard) counts
toward that figure. It used to count on the manifest's say-so alone — nothing checked that the course
taught the word — and when the claim was finally audited, **nine of the marks were false**: `außer`,
`außerhalb`, `gegenüber`, `wegen`, `einig-`, `manch-`, `darauf` and `darüber` occurred nowhere in
`content/` at all, and A1's `euer` occurred only inside English prose *about* German, because the
possessive table in `menschen-familie.mdx` stopped at the `sie` row. A1's 100% was not fully earned.
`goetheCoverage()` now demotes an unearned `~` into `missing` and `bun run validate` hard-fails on it
(`taughtSurface` in `src/lib/coverage.ts`). A `~` you cannot pay for with an article table, a reading
or a practice item is a word that needs a flashcard instead.

## The Wortliste completion pass (A2)

The units are authored; 716 headwords remain. This is the partition that closes them. It exists so
that batches can be authored in parallel without colliding: the validator hard-fails a headword owned
by two decks, and `bun scripts/coverage.ts A2 --check-deck <file>` rejects any entry that is not on
the current missing list — which is, by construction, a word no other deck owns. **Run it per deck,
before `bun run validate`.**

Three rules govern the pass:

1. **Every completion deck is unowned and `level: A2`.** No topic lists it in `vocab:`. Listing one
   would flip its fresh-card gate from *"≥1 A2 topic opened"* to *"this topic opened"* — the same trap
   that "recycle, never adopt" exists to prevent. The unit decks keep their 12–24 entries: completion
   words are not lesson words.
2. **Regroup, don't mirror the manifest.** Its sections are a transcription convenience (its own
   header says so): four carry 60–92 missing words, six carry 1–5. Coverage is blind to filing —
   `deckHeadwords()` unions every deck — so regrouping into decks of 15–45 entries costs the
   measurement nothing.
3. **A word gets a card iff an A2 learner could plausibly *produce* it.** Rarity is not a licence to
   `~`. See the exclusions below — each one has to be paid for with content, and the validator checks.

| deck | drains |
| --- | --- |
| `kleine-woerter-a2`, `richtung-position-a2`, `redemittel-chunks-a2` | funktionswoerter-chunks (72) |
| `bewertung-a2`, `eigenschaften-dinge-a2`, `charakter-eigenschaften-a2` | eigenschaften-bewertung (60), personen-… adjectives (21) |
| `verben-handlungen-a2-1`, `verben-handlungen-a2-2`, `dinge-sachen-a2` | alltag-handlungen (69) |
| `menschen-beziehungen-a2`, `gefuehle-reflexive-a2` | personen-familie-gefuehle (39), Familienmitglieder (7), Familienstand (2) |
| `berufe-a2`, `laender-nationalitaeten-a2` | Berufe (43), Länder und Nationalitäten (20) |
| `schule-faecher-a2`, `arbeit-ausbildung-a2` | Schule und Schulfächer (16), arbeit-schule-ausbildung (27), Anweisungssprache (4) |
| `sport-freizeit-a2`, `kultur-unterhaltung-a2`, `digital-medien-a2` | freizeit-sport-kultur-medien (92), Abkürzungen (5) |
| `reisen-orte-a2`, `verkehr-unterwegs-a2`, `natur-tiere-a2` | reisen-verkehr-orte (34), Himmelsrichtungen (4), natur-wetter-tiere (14) |
| `essen-trinken-a2`, `einkaufen-geld-a2`, `haushalt-geschirr-a2`, `koerper-pflege-a2` | essen-trinken (26), einkaufen-geld-… (27), wohnen-haushalt (21), koerper-gesundheit (15) |
| `zeit-termine-a2`, `zeitadverbien-a2`, `zahlen-masse-a2` | zeit-termine (22), Tageszeiten/Wochentage (18 of 32), Zahlen (11), Feiertage (5), Währungen und Maße (3), Jahreszeiten/Zeitmaße/Uhrzeit (3) |
| *(append to the unowned `kleidung-farben`)* | Farben (3) |

### What does not get a flashcard

Every exclusion below is a new `~`, and therefore a content debt the validator collects.

| words | why no card | earned by |
| --- | --- | --- |
| `ca.`, `d.h.`, `usw.`, `z. B.` | written reading conventions — a production card would ask the learner to type a punctuation pattern | an article table |
| `Antwortbogen`, `Prüfer`, `Prüferin` | exam-room language the learner only ever reads | the exam-orientation reading shipped with the checkpoint |
| the fourteen `am Montag` / `am Abend` chunks | pure `um-am-zeit`, an existing focus tag; a card `am Montag` beside a card `montags` is two production cards for one rule | the existing um/am table (13 of the 14 already pass) |
| `hin`, `her`, `heraus`, `herein` | directional grammar, no citation form to produce | a hin/her table in `trennbare-verben` |
| `hunderteins`, `zweihundert`, `zweitausendeins` | the PDF's number-*formation* demos, not words | the number-building table |
| **every `stem-` headword** — `all-`, `ander-`, `einig-`, `manch-`, `meist-`, `eigen-`, `letzt-`, `lieb-`, `geehrt-`, `Lieblings-`, `einzel-` | coverage matches a deck's `de` against the manifest string **exactly**, so covering `eigen-` means a flashcard whose front literally reads *"eigen-"*. That is not a word anyone can produce. | an article table (see below) |
| `Disko`, `Klub` | spelling variants of `Disco`/`Club`; four production cards for two words is SRS interference | the `example_de` of `Disco` / `Club` |

**The stem rule, and why the first draft of this table got it wrong.** The draft said `eigen-`,
`letzt-` and `lieb-` should keep cards, on the grounds that they have real free forms and the
manifest's trailing hyphen is a transcription artifact. That is true about German and false about the
instrument: `ownedBy` keys on the exact `de` string, so the *only* way to cover the headword `letzt-`
is a deck entry whose `de` is `letzt-` — a flashcard whose front reads "letzt-". So every stem is a
`~`, as `all-`, `ander-`, `meist-`, `einig-` and `manch-` already were.

That makes the *teaching* the thing to check, and the check alone will not do it — the stem matcher
accepts `lieb-` on the strength of `lieber`, which in this course only ever appears as the
**comparative of `gern`**, a different lexeme entirely. A word can pass the earned-`~` test and still
not be taught. So each stem now has a real lesson: `lieb-` opens an invitation in `freunde-feste`
(*Liebe Anna,* / *Lieber Tom,* — the warm counterpart to the *Sehr geehrte* that
`aemter-dienstleistungen` already teaches), `letzt-` is the past-time table in `biografie-erfahrungen`
(*letzte Woche*, *letztes Jahr*, and why the ending changes), and `eigen-`/`Lieblings-`/`einzel-` are
the word-building table in `wohnen-umzug`.

**But these keep their cards, against the temptation:** `PC`, `SMS`, `ICE`, `WC`, `Lkw` (spoken nouns
with gender and plural — *Wo ist das WC?*; their IPA is hand-written as letter names, `veːˈtseː`);
`markieren`, `Punkt`, `Teil`, `Text` (general vocabulary that merely also appears in rubrics —
`~`-ing them would be laundering); the `-s` adverbs `montags`, `abends`, `tagsüber`; `raus` and
`rein`; all 43 **Berufe** (*Ich bin Krankenpfleger* is the A2 speaking task); all 20
**Länder/Nationalitäten**; all 16 **Schulfächer**.

`wegen` and `außerhalb` were `~` and are now **cards**: they carry translatable meanings ("because
of", "outside of"), and teaching them as case grammar would drag the Genitiv into A2.

## The A2 spine

The six A2 topics that already ship keep their ids and their spine positions. They are strengthened
in place, never duplicated under a thematic name.

| # | Topic id | Kind | What it owns | Deepens |
| ---: | --- | --- | --- | --- |
| 11 | `dativ` | grammar | *(ships)* dative articles, pronouns, prepositions, dative verbs | stadt-wege |
| 12 | `trennbare-verben` | grammar | *(ships)* separable prefixes and the bracket | — |
| 13 | `modalverben` | grammar | *(ships)* modal meanings and the bracket | freizeit-koennen |
| 14 | `perfekt-haben-sein` | grammar | *(ships)* auxiliary choice, Partizip II, the Perfekt bracket | — |
| 15 | `alltag-tagesablauf` | vocab-field | *(ships)* daily routine, sequencing | alltag-zeit |
| 16 | `termine-vereinbaren` | communication | *(ships)* appointments, register | — |
| 17 | `wohnen-umzug` | vocab-field | Wechselpräpositionen (Wo?/Wohin?), stehen/stellen, liegen/legen, hängen | wohnen, akkusativ, dativ, stadt-wege |
| 18 | `reisen-verkehr` | communication | travel prepositions, movement Perfekt, sequence connectors | stadt-wege, perfekt-haben-sein, termine-vereinbaren |
| 19 | `einkaufen-reklamation` | vocab-field | Komparativ/Superlativ, passen/gefallen + Dativ, zu + Adjektiv | essen-trinken, dativ, akkusativ |
| 20 | `gesundheit-arzttermin` | communication | Imperativ, sollen, seit/vor + Dativ, reflexive chunks | termine-vereinbaren, dativ, modalverben |
| 21 | `verben-mit-praepositionen` | grammar | governed prepositions; da(r)-/wo(r)-; thing/person selection | gesundheit-arzttermin |
| 22 | `arbeit-beruf` | vocab-field | obligation and permission at work, polite requests, temporal order | modalverben, alltag-tagesablauf, termine-vereinbaren |
| 23 | `nebensaetze-plaene` | grammar | weil, dass, wenn, denn; verb-final; the fronted subordinate clause | praesens-wortstellung, modalverben |
| 24 | `biografie-erfahrungen` | communication | Präteritum of sein/haben/modals, vor/seit, narrative sequence | perfekt-haben-sein, menschen-familie, nebensaetze-plaene |
| 25 | `freunde-feste` | communication | invitations, two-object patterns, weil/aber/sondern | freizeit-koennen, dativ, nebensaetze-plaene |
| 26 | `lernen-verstehen` | communication | indirect questions, repair chunks, dass/weil frames | erste-schritte, modalverben, nebensaetze-plaene |
| 27 | `aemter-dienstleistungen` | communication | formal Sie, lexical könnte/würde gern, reason clauses | termine-vereinbaren, erste-schritte, nebensaetze-plaene |

`aemter-dienstleistungen` additionally `deepens: [lernen-verstehen]`: asking a clerk *Können Sie mir
sagen, welche Unterlagen ich brauche?* is the indirect question taught one slot earlier, in the
register this unit lives in.

Rows 23–26 each gained `nebensaetze-plaene` as a prerequisite, which the first draft of this table
did not give them. That was an oversight of exactly the kind the reorder exists to prevent: these are
the four units that were *supposed* to stop tiptoeing around subordinate clauses, and every one of
them now declines an invitation, gives a reason at a counter or asks an indirect question with the
verb at the wall. A unit that cannot be written without *weil* depends on the unit that teaches it.
Each of the four also `deepens: [nebensaetze-plaene]` on `nebensatz-verbende` — the shared tag is the
edge's only runtime channel, so an error on the verb-final rule anywhere in these four resurfaces the
Nebensatz lesson's own items in mixed training.

### Why Nebensätze sit in the middle

The first draft of this blueprint put subordinate clauses last, as a final consolidation unit
(`gruende-plaene`). That order does not survive contact with the validator, and it should not: four
of the units that would precede it — work, biography, invitations, public services — cannot say
anything worth saying without *weil* and *dass*. "Leider kann ich nicht, weil …" is not an advanced
flourish; it is how an A2 learner declines an invitation. Declaring the `weil` items `preview: true`
across three units would be a way of admitting the order is wrong without fixing it.

So `nebensaetze-plaene` is a grammar node at position 22, and the four units after it spiral
subordinate clauses instead of tiptoeing around them. The consolidation function that the final unit
was supposed to serve moves to the cumulative A2 checkpoint, which is what a checkpoint is for.

### Atlas groups

Three new **leaf** groups are needed; a node must sit in a group that is nobody's parent, and its
strand must match the group's.

| Group id | Strand | Parent | Holds |
| --- | --- | --- | --- |
| `arbeit-bildung` | vocabulary | `wortschatz` | `arbeit-beruf` |
| `lernen-kurs` | communication | `kommunikation` | `lernen-verstehen` |
| `behoerden-services` | communication | `kommunikation` | `aemter-dienstleistungen` |

The rest fit existing leaves: `wohnen-umzug` → `wohnen-zuhause`; `reisen-verkehr` → `unterwegs`;
`einkaufen-reklamation` → `essen-einkaufen`; `nebensaetze-plaene` → `satzbau`;
`gesundheit-arzttermin` → `transaktionen-termine`; `biografie-erfahrungen` and `freunde-feste` →
`person-alltag`.

**The same mistake was made twice in this table, and the rule above is what catches it both times.**
An earlier draft gave `gesundheit-arzttermin` a `gesundheit-koerper` group of its own under
`wortschatz`. That cannot exist: the group would be `vocabulary`, the node is `communication` (it is
a unit about *getting an appointment and understanding the advice*, not about a word field — the
body-part lexis it needs is already taught by the A1 `koerper-gesundheit` deck). The unit sits in the
communication leaf it belongs to. The draft then put `lernen-verstehen` into `arbeit-bildung`, which
fails the same way: `arbeit-bildung` is `vocabulary`, and `lernen-verstehen` teaches indirect
questions and repair strategies — it is a `communication` node, and no amount of shared subject
matter ("Bildung") makes it a word field. It gets `lernen-kurs`, a communication leaf of its own,
rather than being bent into a vocabulary one to satisfy a table. `arbeit-bildung` keeps only
`arbeit-beruf`; a future B1 vocabulary node on education is its natural second tenant.

## Outcomes

Two to four per node, globally unique, and every one of them must be referenced by at least one
non-pretest exercise item or reading question — an outcome nothing measures is decoration, and the
validator now rejects it. Modes are spread deliberately: a level whose outcomes are all `writing`
cannot claim to teach a language.

| Topic | Outcome ids (mode) |
| --- | --- |
| `wohnen-umzug` | `wohnungsanzeige-lesen` (reading), `wohnung-beschreiben` (writing), `wo-wohin-position` (writing), `nachbarn-bitte` (spoken-interaction) |
| `reisen-verkehr` | `verbindung-waehlen` (reading), `durchsage-verstehen` (listening), `reise-problem-loesen` (spoken-interaction), `reise-berichten` (spoken-production) |
| `einkaufen-reklamation` | `produkte-vergleichen` (writing), `gefallen-passen-sagen` (spoken-interaction), `umtausch-begruenden` (spoken-interaction), `reklamation-schreiben` (writing) |
| `gesundheit-arzttermin` | `beschwerden-beschreiben` (spoken-production), `praxis-anweisungen-verstehen` (listening), `ratschlag-geben` (spoken-interaction), `krankmeldung-schreiben` (writing) |
| `arbeit-beruf` | `aufgaben-beschreiben` (spoken-production), `arbeitszeit-aushandeln` (spoken-interaction), `arbeitsanweisung-verstehen` (listening), `berufliche-nachricht-schreiben` (writing) |
| `nebensaetze-plaene` | `weil-grund` (spoken-production), `dass-satz` (writing), `wenn-bedingung` (writing), `nebensatz-vorfeld-stellung` (writing) |
| `biografie-erfahrungen` | `lebensstationen-ordnen` (writing), `praeteritum-war-hatte` (writing), `erfahrungen-fragen` (spoken-interaction), `profil-schreiben` (writing) |
| `freunde-feste` | `einladen-zusagen-absagen` (spoken-interaction), `absprachen-aushandeln` (spoken-interaction), `glueckwuensche-formeln` (spoken-production), `einladung-schreiben` (writing) |
| `lernen-verstehen` | `nachfragen-klaeren` (spoken-interaction), `kursanweisungen-verstehen` (listening), `lernstrategien-sagen` (spoken-production), `kursanfrage-schreiben` (writing) |
| `aemter-dienstleistungen` | `formular-verstehen` (reading), `anliegen-nennen` (spoken-interaction), `unterlagen-erfragen` (spoken-interaction), `formelle-nachricht-schreiben` (writing) |

An outcome's `mode` is what the curriculum *targets*. It is not a claim about what the learner did:
attempts record their own `responseMode`, and a written multiple-choice item never becomes spoken
evidence because the outcome it serves says `spoken-interaction`.

## Focus tags

The taxonomy is an allowlist. A tag must appear in the CLAUDE.md table **and** in
`focusIntroducedBy` (`scripts/validate.ts`), naming the topic that introduces it, or validation
fails. These are the A2 additions, decided here so the taxonomy stays coherent instead of accreting
one unit at a time. Each is registered in the pull request that lands its introducing topic.

| Tag | Introduced by | The confusion it names |
| --- | --- | --- |
| `wo-wohin` | `wohnen-umzug` | two-way prepositions: Wo? + Dativ (position) vs Wohin? + Akkusativ (direction) |
| `stellen-stehen` | `wohnen-umzug` | the placement/position verb pairs stellen/stehen, legen/liegen, hängen |
| `komparativ-als` | `einkaufen-reklamation` | comparison with *als*, and the irregular forms (gut → besser, gern → lieber) |
| `superlativ-am` | `einkaufen-reklamation` | the superlative *am …-sten* |
| `imperativ-form` | `gesundheit-arzttermin` | imperative forms for du, ihr and Sie (Nehmen Sie …, Nimm …) |
| `seit-vor-zeit` | `gesundheit-arzttermin` | *seit* + Dativ (since/for, still true) vs *vor* + Dativ (ago, finished) |
| `reflexiv-akkusativ` | `gesundheit-arzttermin` | reflexive pronouns in the accusative: ich fühle **mich**, er ruht **sich** aus |
| `nebensatz-verbende` | `nebensaetze-plaene` | the conjugated verb goes last in a weil-, dass- or wenn-clause |
| `weil-denn` | `nebensaetze-plaene` | *weil* sends the verb to the end, *denn* does not |
| `nebensatz-vorfeld` | `nebensaetze-plaene` | a fronted subordinate clause fills position 1, so the main verb comes straight after it |
| `aber-sondern` | `freunde-feste` | *sondern* only after a negation, replacing what was denied — elsewhere *aber* |
| `praeteritum-sein-haben` | `biografie-erfahrungen` | war/hatte and the modal Präteritum, used where Perfekt is not |
| `indirekte-frage` | `lernen-verstehen` | indirect questions send the verb to the end (Wissen Sie, wo der Kurs **ist**?) |
| `hoeflich-konjunktiv` | `aemter-dienstleistungen` | the lexical polite forms *könnte* and *würde gern*, learned as chunks, not as a paradigm |

Two confusions that look new are not, and must reuse the existing tag: choosing between accusative
and dative in a two-way-preposition sentence is `wechsel-akk-dat`, and register is `du-sie`.

## The units

Each entry below fixes the scenario, the language, the recycled lexis, the transfer task, the likely
confusions and — most importantly — **what the unit may not touch**. The exclusions are what keep an
A2 article readable by an A2 learner.

### A2.0 · The six shipped topics — strengthen in place

They predate the hardened loop and are below its bar: across all six there are zero `write` items,
zero `speak` items, zero `audio-comprehension` items, zero probe families and no extensive reader,
and four declared outcomes (`dativ-pronomen`, `dativ-praepositionen`, `dativ-verben`,
`modal-konjugation`) are measured by nothing at all. Bringing them up is a prerequisite for the ten
units that build on them, not a tidy-up.

Per topic: a hidden-transcript listening task, a `write` task with the draft → checklist → revision
loop, a `speak` task with record and replay, and a faded discrimination set against the material it
is confusable with. Give each topic one scenario its artifacts share. Add items to **non-primary**
practice sets, or to a new practice set appended *after* the existing ones — appending to a topic's
`primaryPractice` set silently un-finishes it for a learner who had completed it.

**Exclude:** two-way prepositions (they belong to `wohnen-umzug`), subordinate clauses, workplace
duties, long narratives.

### A2.1 · `wohnen-umzug` — Wohnen & Umzug

**Scenario:** find a flat, move in, and get one thing fixed.
**Input:** a listing, a floor plan, a handover note, house rules, a message to the landlord.
**Language:** two-way prepositions with Wo?/Wohin? and the contractions (im, ins, am, ans);
stehen/stellen, liegen/legen, hängen; compound stress in the vocabulary of rooms and costs.
**Recycles:** `wohnen`, `haushalt-geraete`, `verben-grundwortschatz` (the position verbs are already
cards there — teach the *contrast*, do not re-deck the words), `dativ`, `akkusativ`.
**New deck:** Umzug, Nachbar, Vermieter, Kaution, Nebenkosten, Regal, Teppich, hängen, plus the
chunks *Die Wohnung liegt …*, *Wie hoch ist die Miete?*, *Könnten Sie bitte …?*
**Transfer:** choose a listing, write an enquiry, and say where the furniture goes.
**Confusions:** `wo-wohin`, `stellen-stehen`, `wechsel-akk-dat`, `dativ-artikel`, `akkusativ-artikel`.
**Exclude:** tenancy law, formal defect notices, the passive, dense listing abbreviations as
production.

### A2.2 · `reisen-verkehr` — Reisen & Verkehr

**Scenario:** plan a journey, then recover when the train is cancelled.
**Input:** a timetable, a ticket screen, a platform announcement, a booking confirmation, a
reception dialogue.
**Language:** travel prepositions (nach, zu, in, mit); the movement Perfekt with *sein*; the
sequence connectors zuerst/dann/danach/am Ende (recycled, not re-decked); numbers, platforms and the
phrasing of announcements as listening.
**Recycles:** `reisen-urlaub`, `stadt-wege`, `trennbare-verben` (einsteigen, umsteigen, abfahren and
ankommen are already cards), `perfekt-verben`.
**New deck:** Verspätung, ausfallen, Anschluss, Durchsage, Schaffner, entwerten, Sitzplatz, plus
*Wo muss ich umsteigen?*, *Der Zug fällt aus*, *Ich habe meinen Koffer verloren*.
**Transfer:** reroute after a cancellation and send an arrival message.
**Confusions:** `haben-sein`, `perfekt-satzklammer`, `dativ-praepositionen`, `trennbar-wortstellung`.
**Exclude:** compensation claims, fare systems, Konjunktiv II, travel essays.

### A2.3 · `einkaufen-reklamation` — Einkaufen & Reklamation

**Scenario:** compare two products, buy one, and take it back when it breaks.
**Input:** labels, a receipt, a product page, a shop dialogue, a returns policy, a service chat.
**Language:** the comparative with *als* and the superlative *am …-sten*, including gut/besser and
gern/lieber; passen and gefallen with the dative; *zu + Adjektiv*.
**Recycles:** `einkaufen-geschaefte`, `kleidung-farben`, `essen-trinken` (Preis, Kasse, kosten,
bezahlen are already cards), `dativ-verben` (gefallen), `termine-zeit` (passen).
**New deck:** umtauschen, Reklamation, Quittung, zurückgeben, Garantie, günstig, Bon, plus
*Das passt mir nicht*, *Ich möchte das umtauschen*, *Es ist kaputt gegangen*.
**Transfer:** compare, choose, then negotiate a return in a shop that is not the one in the article.
**Confusions:** `komparativ-als`, `superlativ-am`, `passen-dativ`, `dativ-pronomen`.
**Exclude:** the full adjective-ending paradigm (attributive endings stay out of A2 here), consumer
law, legal complaints.

### A2.4 · `gesundheit-arzttermin` — Gesundheit & Arzttermin

**Scenario:** you have been ill for three days; get an appointment, understand the advice, tell work.
**Input:** a voicemail, a symptom dialogue, a medication label, pharmacy advice, a sick note.
**Language:** *Mir tut … weh* and the body-part constructions; *seit* + Dativ for duration against
*vor* + Dativ for "ago"; the imperative for du/ihr/Sie; *sollen* for advice; the frequent reflexive
chunks (sich fühlen, sich ausruhen).
**Recycles:** `koerper-gesundheit`, `termine-zeit`, `kernwortschatz-a2` (krank and gesund are
already cards), `dativ-pronomen`.
**New deck:** Rezept, Husten, Schnupfen, untersuchen, Krankschreibung, Beschwerden, Salbe, plus
*Seit wann haben Sie …?*, *Mir tut der Hals weh*, *Sie sollten viel trinken*.
**Transfer:** leave a voicemail for the practice, then relay the doctor's instructions to someone else.
**Confusions:** `seit-vor-zeit`, `imperativ-form`, `reflexiv-akkusativ`, `dativ-pronomen`, `du-sie`.
**Exclude:** diagnosis, emergency medicine beyond calling for help, anything that reads as medical
advice, the full reflexive paradigm.

### A2.5 · `verben-mit-praepositionen` — Darüber sprechen

**Scenario:** a German-course group chooses an activity, asks what others think or wait for, and
refers back to plans without repeating each noun.
**Language:** six productive verb-preposition constructions; wo(r)- questions and da(r)- references;
linking *r* before vowels; things versus people; productive *vorher/danach* against receptive *zuvor*.
**New deck:** eight contextual phrase targets, each with a unique verb construction on the production cue.
**Transfer:** ask about and respond to a fresh group plan in writing and speech.
**Confusions:** `verb-praeposition`, `da-wo-woerter`.
**Exclude:** exhaustive lists of governed verbs and productive formal *zuvor*.

### A2.6 · `arbeit-beruf` — Arbeit & Beruf

**Scenario:** describe what you do, then swap a shift with a colleague.
**Input:** a job profile, a rota, a note, a short internal message, a spoken instruction.
**Language:** obligation and permission at work (müssen, dürfen, sollen); polite requests
(Könnten Sie …?); temporal order; *denn* as a coordinating reason — which sets up the contrast that
`nebensaetze-plaene` completes.
**Recycles:** `schule-arbeit`, `alltag-tagesablauf` (Arbeit, Büro, Pause and Feierabend are already
cards), `termine-zeit`, `modalverben`.
**New deck:** Schicht, Überstunden, zuständig, übernehmen, Abteilung, Vertrag, plus
*Ich bin zuständig für …*, *Könnten Sie das übernehmen?*, *Ich komme später, denn …*
**Transfer:** explain your duties and negotiate a shift change by message.
**Confusions:** `modal-satzklammer`, `duerfen-muessen`, `du-sie`, `trennbar-modal`.
**Exclude:** applications and interviews (those are B1), labour law, specialist vocabulary.

### A2.7 · `nebensaetze-plaene` — Nebensätze & Pläne

**Scenario:** explain a decision — why you cannot come, what you think, what you will do if it rains.
**Input:** an advice exchange, a personal message, a short opinion, a planning dialogue.
**Language:** verb-final *weil*, *dass* and *wenn*; *denn* against *weil*; the main clause after a
fronted subordinate clause (Wenn ich Zeit habe, **komme** ich); plans expressed with the present
plus a time phrase, and the lexical *würde gern*.
**Recycles:** `kernwortschatz-a2` (weil, dass, wenn and denn are already cards — this unit teaches
the *syntax*, so it must not re-deck them), `praesens-wortstellung`, `modalverben`.
**New deck:** deliberately thin — the connectors are already taught. Chunks only: *Ich glaube, dass …*,
*Wenn …, dann …*, *Ich würde gern …*, *Deshalb …*
**Transfer:** solve a familiar planning problem in several connected sentences.
**Confusions:** `nebensatz-verbende`, `weil-denn`, `nebensatz-vorfeld`, `verbzweit`.
**Exclude:** indirect speech, the Konjunktiv II paradigm, essay writing. Relative clauses are *not*
excluded from A2 — they were, on the assumption that they belonged to B1, and the grammar manifest
showed that to be a gap rather than a decision. They now have their own A2 unit (`relativsaetze`,
Nominativ and Akkusativ only) immediately after this one; what this unit must not do is teach them
early, which is a different claim.

### A2.8 · `biografie-erfahrungen` — Biografie & Erfahrungen

**Scenario:** tell someone your story, and ask them for theirs.
**Input:** a timeline, a profile, interview turns, a short narrative, a personal email.
**Language:** Perfekt consolidated for narration; *war*, *hatte* and the modal Präteritum, which is
where German actually uses the simple past in speech; *vor* and *seit*; sequence connectors.
**Recycles:** `menschen-familie` (geboren, verheiratet, Geburtstag are already cards),
`perfekt-verben`, `schule-arbeit`, `verben-grundwortschatz` (heiraten).
**New deck:** Lebenslauf, Station, Erfahrung, Ausbildung, damals, plus *Als Kind …*,
*Danach habe ich …*, *Damals war ich …*
**Transfer:** interview a partner from notes, then write a profile of someone you have not met.
**Confusions:** `praeteritum-sein-haben`, `haben-sein`, `perfekt-satzklammer`, `seit-vor-zeit`.
**Exclude:** *als*-clauses as a taught structure (they appear only as fixed chunks here), the
literary Präteritum of full verbs, CV conventions.

### A2.9 · `freunde-feste` — Freunde, Einladungen & Feste

**Scenario:** organize a birthday in a group chat, and handle the person who has to cancel.
**Input:** an invitation, a group chat, a notice, a voice message.
**Language:** two-object patterns (Ich bringe **dir** **einen Kuchen** mit); reflexive social verbs;
*weil* for declining; *aber* against *sondern*; congratulation formulas as chunks.
**Recycles:** `freizeit-koennen` (Einladung, Party, feiern are already cards), `trennbare-verben`
(einladen, mitbringen), `termine-zeit` (absagen, verschieben), `funktionswoerter-chunks`
(Herzlichen Glückwunsch), `dativ`.
**New deck:** Gastgeber, Geschenk, Überraschung, sich freuen, mitfeiern, plus *Hast du Lust …?*,
*Leider kann ich nicht, weil …*, *Ich bringe … mit*.
**Transfer:** coordinate the event through chat turns that keep changing.
**Confusions:** `nebensatz-verbende`, `wechsel-akk-dat`, `dativ-pronomen`, `trennbar-modal`.
**Exclude:** slang, relationship talk, broad cultural surveys.

### A2.10 · `lernen-verstehen` — Lernen & Verstehen

**Scenario:** you are in a course and you did not understand — repair it.
**Input:** a course description, spoken instructions, a feedback note, an email, a clarification
dialogue.
**Language:** indirect questions with the verb at the end (Können Sie mir sagen, wo …?); repair
chunks; *dass* and *weil* in useful frames; pronoun reference across sentences.
**Recycles:** `kommunikation-medien` (bedeuten, wiederholen, Antwort, Frage are already cards),
`schule-arbeit`, `erste-schritte` (buchstabieren), `kernwortschatz-a2`.
**New deck:** Bedeutung, Beispiel, üben, Aussprache, Wörterbuch, Fehler, plus
*Was bedeutet das?*, *Wie schreibt man das?*, *Können Sie das bitte wiederholen?*
**Transfer:** repair three misunderstandings in a lesson you have not seen, and write a learning plan.
**Confusions:** `indirekte-frage`, `nebensatz-verbende`, `du-sie`, `verbzweit`.
**Exclude:** academic argument, reported speech, abstract pedagogy vocabulary.

### A2.11 · `aemter-dienstleistungen` — Ämter & Dienstleistungen

**Scenario:** you must register your address; find out what you need and ask for it politely.
**Input:** a form, an appointment letter, an opening-hours notice, a counter dialogue, a formal email.
**Language:** formal Sie throughout; the lexical *könnte* and *würde gern*; reason clauses with
*weil*; the language of documents, attachments and next steps; names, dates and reference numbers as
listening.
**Recycles:** `stadt-wege` (Post, Bank), `schule-arbeit` (Formular, Ausweis), `reisen-urlaub`
(Rathaus, Polizei), `termine-zeit`.
**New deck:** Amt, Antrag, beantragen, Unterlagen, Anmeldung, Bescheinigung, Unterschrift, Gebühr,
plus *Ich möchte … beantragen*, *Welche Unterlagen brauche ich?*, *Im Anhang finden Sie …*
**Transfer:** extract the requirements from a notice, fill in the data, and ask for the step that is
missing.
**Confusions:** `hoeflich-konjunktiv`, `du-sie`, `nebensatz-verbende`, `dativ-praepositionen`.
**Exclude:** legal advice, the tax and insurance systems, authentic letters written above A2.

## The A2 checkpoint and the transition to B1

The cumulative checkpoint samples the level's outcomes rather than every fact in it, following
`content/exercises/a1/checkpoint-a1.yaml`: hidden-transcript listening, practical reading,
automatically scored constrained production, and one fresh-context writing task that is recorded as
practice and never as verified mastery. It is reachable only when the A2 path is done, it never
enters ordinary training, and finishing it is not a claim that the learner speaks A2 German.

B1 readiness means the learner connects several sentences, recovers from a predictable
misunderstanding, and still has the high-value A2 language weeks later. It does not require every A2
badge to read *mastered*.

## Provisional B1 architecture

**Do not add any of this to `content/atlas.yaml`.** Boundaries, budgets and ids stay provisional
until representative A2 usage and the A2 checkpoint have been reviewed. B1 grows discourse length,
independence and genre range; it is not simply more grammar.

| Proposed id | Mission | Language and discourse | Depends on / uncertainty |
| --- | --- | --- | --- |
| `erfahrungen-erzaehlen` | Tell a connected story, understand an interview, write a narrative message | als/wenn time relations, the Perfekt–Präteritum distribution, reference across sentences | A2 biography; confirm narrative control is retained |
| `leben-veraendern` | Discuss housing and relocation, compare options, justify a choice | useful relative clauses, comparison, infinitive with *zu* | A2 housing and reasons; keep the boundary practical |
| `arbeit-bewerbung` | Read a vacancy, present experience, write an application, handle interview turns | formal register, broader subordinate clauses, polite Konjunktiv II | A2 work and public services; depth depends on the learner's goals |
| `gesundheit-wohlbefinden` | Explain a history, understand recommendations, discuss habits | reflexive and prepositional verbs, advice, cause and effect | A2 health; stays non-diagnostic |
| `meinung-medien` | Understand a report, summarize its point, support an opinion | opinion frames, connectors, indirect questions, reported information | A2 reasons and plans; test the mediation load |
| `konsum-umwelt` | Compare choices, understand notices, negotiate a practical solution | passive recognition, relative clauses, consequences | A2 shopping and housing; avoid abstract policy |
| `reisen-probleme` | Manage less predictable disruption and make a complaint | narrative plus formal request, prepositional verbs, hypotheticals | A2 travel and complaints; exclude legal detail |
| `lernen-zukunft` | Discuss learning and career goals, summarize, plan next steps | infinitive clauses, future intention, conditions, justification | confirm whether work and education need separate variants |
| `gesellschaft-zusammenleben` | Join a familiar community discussion and resolve a disagreement | obwohl/trotzdem, modal nuance, relative clauses | cultural content must stay action-oriented |
| `informationen-vermitteln` | Relay the main points of a notice, message or conversation | paraphrase, reported information, reference control, summary | cumulative; needs a workable task and rubric model |

Pronunciation shifts toward clause grouping, sentence accent, reductions and connected speech. No B1
unit may assume that a structure met once at A2 was retained.

## Authoring and release workflow

1. Freeze the identities above before authoring. Never rename a persisted id for tidiness.
2. Author one complete unit per bundle: atlas node and unit slot, article, three-item pretest,
   practice sets clearing the item-mix bar, a probe family, an intensive reading, the thin vocab
   deck, and the focus tags registered in both CLAUDE.md and `scripts/validate.ts`.
3. Review each unit against the twelve-point A2 unit quality gate in the audit and the
   `learning-science` skill before it lands.
4. Run the full gate: `bun run validate && bun test && bun run check && bun run lint && bun run build`.
5. After every two or three units, read the newest snapshot in `progress/<profile>/`: mode
   distribution, focus errors, card lapses, delayed-probe retention and novel transfer. Adjust the
   units that follow; add to the units that shipped without renaming anything.
6. Close the level with the checkpoint, the Wortliste completion pass, and an honest Über page.

## Acceptance gates

- Every A2 unit clears the twelve-point A2 unit quality gate in [the audit](a1-learning-audit.md).
- Every declared outcome is measured by at least one non-pretest item or reading question.
- No A2 deck re-teaches a headword another deck owns, and no A2 topic adopts an A1 deck.
- Receptive-only language appears in readings and articles, never in a deck.
- The six shipped A2 topics are strengthened in place, never duplicated under a thematic name.
- B1 remains provisional and creates no learner-visible completeness claim.
- This document, [roadmap.md](roadmap.md), [backlog.md](backlog.md) and `CLAUDE.md` agree.
