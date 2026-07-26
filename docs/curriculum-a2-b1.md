# A2–B1 curriculum blueprint

Status: **A2 is authored and studied through its checkpoint; the B1 curriculum contract below is
frozen and authoring proceeds under the 2026-07-24 owner decision** — the 2026-08-02 / ~2026-08-14
evidence reads are revision triggers, not sequencing gates
([decision record](a2-learning-led-program.md#calendar-and-b1-gates)) (2026-07-24).

The required A1/A2 spine is now fully authored. This paragraph used to keep new work inside the
existing levels until the delayed-evidence reviews; the 2026-07-24 decision retires that
restriction — B1 authoring proceeds now, and the two evidence reads act as revision triggers on
whatever has shipped. Optional connected readings, cultural context, real-world documents and
formulaic chunks remain a parallel track at every level.

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

**Receptive-only language never enters an A2 deck.** At A2, `buildDeck()` turns every vocab entry
into two cards, and that stays true: A2 decks predate `cards: recognition` and are never
retrofitted (flipping a shipped entry deletes its production card's SRS history). So at A2 a
station announcement, a listing abbreviation or a form heading — language the learner must
understand but will never produce — belongs in a reading, a gloss or an article table, and nowhere
near `content/vocab/`. **From B1 on the rule changes shape**: the `cards: recognition | both`
field shipped 2026-07-23 (P5-6, exactly for B1's Wortliste tail), so understand-only language may
enter a *new* deck as a single recognition card — the two-card default remains for anything the
learner should produce.

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

The taxonomy is an allowlist. A tag must appear in the [focus-tag table](focus-tags.md) **and** in
`focusIntroducedBy` (`src/lib/focus-tags.ts`), naming the topic that introduces it, or validation
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

## The B1 curriculum contract (frozen 2026-07-24)

**Frozen means what it meant at A2:** every identity named below — a unit id, topic id, outcome
id, focus tag, deck id, set path-id or reading id — becomes a persisted key in the learner's
progress the moment its unit ships, and renaming it destroys their history. Insert, never
renumber. **Atlas nodes and unit slots still land only in each unit's shipping PR** — nothing here
enters `content/atlas.yaml` ahead of its content. The 2026-08-02 and ~2026-08-14 evidence reads
are revision triggers on this contract ([decision record](a2-learning-led-program.md#calendar-and-b1-gates)).
B1 grows discourse length, independence and genre range; it is not simply more grammar.

**Identity scheme, one rule for all fourteen units** (`<id>` is the topic id, one topic per unit):
article `content/topics/b1/<id>.mdx`; sets `b1/<id>` (primaryPractice — its item list never grows
after shipping), `b1/<id>-produktion`, `b1/<id>-pretest`; **one probe family per competence**,
`b1/probe-<id>` for the unit's first and `b1/probe-<id>-<competence>` for each further one (3
parallel variants each, one competence each — [amended 2026-07-24](#amendment-2026-07-24-probe-families-unit-count-and-deck-size));
reading `b1/<id>` (`kind: intensive`); deck `content/vocab/<id>.yaml`. Every B1
topic carries `<En>`, `<Ru>`, `<Uk>` **and `<De>`** halves from authoring (the machinery landed
before unit 1 — roadmap soft preference, met; cost on record: 1.98x localized,
`bun scripts/lang-cost.ts content/discovery/b1/sonntagsruhe.mdx`).

**Grammar ownership is exhaustive:** the 31 manifest points of `data/grammar-inventory.yaml`'s B1
section (including `adjektiv-nullartikel`, filed with the A2 adjective block) are each owned by
exactly one unit below — 3+3+4+3+3+2+2+2+3+3+0+0+0+3 = 31, carried by 34 proposed focus tags. The
three zero addends are the genre units B1.11–B1.13, which own no manifest point by design: they
carry lexis and discourse range, recycle existing tags, and **must ship with the
`tests/grammar-coverage.test.ts` ratchet unchanged** — a genre unit that moves the grammar number
has silently adopted a point some other unit owns. A tag
becomes real in the commit that ships its unit (registered in `focusIntroducedBy` **and**
`docs/focus-tags.md`, ratchet in `tests/grammar-coverage.test.ts` raised in the same commit).
**Only a new B1 tag closes a B1 point** — recycled A2 tags carry the `deepens` edges and never
count. Command behind the figure: `bun scripts/grammar-coverage.ts B1`.

**Six structures left this table in Phase 10 and are now taught at A2**, where the standard puts
them: relative clauses (Nom/Akk), the *zu*-infinitive and *um … zu*, *als* vs *wenn*, Futur I, the
adverb *trotzdem*, and passive recognition. They were listed here because A2 was believed complete
on the strength of its Wortliste figure, and nothing measured structure until the grammar manifest
was written. The units below are corrected: B1 may **revisit** any of them at greater depth — the
dative relative pronoun, the produced passive, *obwohl* as a conjunction — but must not re-teach
them from scratch, and each unit's grammar list names only the added depth.

**Unit order rationale, recorded:** narrative first (B1.1 deepens the biografie material the
learner just finished); the Konjunktiv II chunks-before-paradigm split puts advice (B1.3,
`konjunktiv2-ratschlag`) before the unreal paradigm (B1.8, `konjunktiv2-irreal`); the passive
spans two adjacent units (B1.6 forms and past, B1.7 the modal passive under rules and
consequences) — **this reverses the original "the passive block coheres in one unit" rationale**,
which put three passive forms plus `konsekutivsatz-sodass` behind a single article, practice set
and probe; the genre units B1.11–B1.13 carry lexis and discourse range without new grammar; the
cumulative mediation unit still closes the level (B1.14).

### B1.1 · `erfahrungen-erzaehlen` — Erfahrungen erzählen

**Mission:** tell a connected story, understand an interview, write a narrative message.
**Grammar (3):** `praeteritum-vollverben` → tag `praeteritum-vollverben`; `plusquamperfekt` →
`plusquamperfekt-nachdem`; `temporalsatz` → `temporal-nebensatz`.
**Outcomes (frozen ids):** `praeteritum-erzaehlen` (writing — "Ich kann ein Erlebnis schriftlich
im Präteritum erzählen."), `vorzeitigkeit-ausdruecken` (writing — "Ich kann mit nachdem und
Plusquamperfekt sagen, was zuerst geschah."), `interview-verstehen` (listening — "Ich kann einem
Interview über Erfahrungen die Hauptpunkte entnehmen."), `muendlich-nacherzaehlen`
(spoken-production — "Ich kann eine Geschichte mündlich zusammenhängend nacherzählen.").
**Deepens (A2, never re-taught):** `biografie-erfahrungen` (als/wenn, praeteritum-sein-haben),
`perfekt-haben-sein` — the Perfekt–Präteritum register split is the teaching point.
**Exclude:** Plusquamperfekt outside nachdem-frames, literary narration, indirect speech (B1.14).

### B1.2 · `leben-veraendern` — Leben verändern

**Mission:** discuss housing and relocation, compare options, justify a choice.
**Grammar (3):** `relativsatz-dativ` → tags `relativpronomen-dativ`, `relativ-praeposition`;
`komparativ-attributiv` → `komparativ-attributiv`; `genitiv-vollstaendig` → `genitiv-form`.
**Outcomes:** `wohnsituation-vergleichen` (spoken-production — "Ich kann Wohnsituationen
vergleichen und eine Wahl begründen."), `relativsatz-praezisieren` (writing — "Ich kann mit
Relativsätzen im Dativ und nach Präpositionen genauer beschreiben, was ich meine."),
`veraenderung-berichten` (writing — "Ich kann über eine Lebensveränderung berichten und Vor- und
Nachteile nennen.").
**Deepens:** `wohnen-umzug`, `relativsaetze` (Nom/Akk taught at A2 — the Dativ and preposition
cases are the added depth).
**Exclude:** tenancy law, genitive relative pronouns (dessen/deren as production), attributive
superlatives beyond fixed phrases.

### B1.3 · `gesundheit-wohlbefinden` — Gesundheit & Wohlbefinden

**Mission:** explain a history, understand recommendations, discuss habits; stays non-diagnostic.
**Grammar (4):** `reflexiv-praeposition` → tag `reflexiv-praeposition`; `konjunktiv2-ratschlag` →
`konjunktiv2-ratschlag`; `lassen` → `lassen-verwendung`; `adjektiv-nullartikel` →
`adjektiv-nullartikel` (frisches Obst, warmes Wasser — the strong declension earns its keep here).
**Outcomes:** `beschwerden-schildern` (spoken-interaction — "Ich kann Beschwerden schildern und
Rückfragen beantworten."), `ratschlaege-formulieren` (spoken-interaction — "Ich kann mit
Konjunktiv II Ratschläge geben und abschwächen." — *not* `ratschlag-geben`, which
`gesundheit-arzttermin` already owns: outcome ids are global), `empfehlungen-verstehen` (reading — "Ich kann Empfehlungen
und Packungsangaben verstehen."), `gewohnheiten-beschreiben` (spoken-production — "Ich kann über
Gewohnheiten und Wohlbefinden sprechen.").
**Deepens:** `gesundheit-arzttermin` (its `reflexiv-akkusativ`/`reflexiv-dativ` base grows the
preposition frames). The A2 chunk tag `hoeflich-konjunktiv` never closes `konjunktiv2-ratschlag`
— the point is the productive paradigm behind the chunks.
**Exclude:** diagnoses, medical terminology beyond everyday complaints, the unreal Konjunktiv II
paradigm (B1.8).

### B1.4 · `arbeit-bewerbung` — Arbeit & Bewerbung

**Mission:** read a vacancy, present experience, write an application, handle interview turns.
**Grammar (3):** `n-deklination` → tag `n-deklination` (der Kollege/den Kollegen);
`adjektiv-nomen` → `adjektiv-nomen` (der Angestellte, die Bekannte); `nomen-verb-verbindungen` →
`nomen-verb-verbindung` (eine Frage stellen, zur Verfügung stehen).
**Outcomes:** `stellenanzeige-verstehen` (reading — "Ich kann eine Stellenanzeige verstehen und
die Anforderungen herauslesen."), `bewerbung-schreiben` (writing — "Ich kann ein kurzes
Bewerbungsschreiben verfassen."), `erfahrung-praesentieren` (spoken-production — "Ich kann meine
Erfahrung und Stärken im Gespräch darstellen."), `interview-fragen-beantworten`
(spoken-interaction — "Ich kann im Vorstellungsgespräch auf Fragen antworten und selbst eine
Frage stellen.") — **added 2026-07-26, before the unit shipped** ([why](#amendment-2026-07-26-a-fourth-b14-outcome-because-probe-families-arm-by-outcome)).
**Deepens:** `arbeit-beruf`, `aemter-dienstleistungen` (the formal register grows from their
hoeflich-konjunktiv base).
**Exclude:** contract/labour-law language, CV-format conventions as content, salary negotiation.

### B1.5 · `meinung-medien` — Meinung & Medien

**Mission:** understand a report, summarize its point, support an opinion.
**Grammar (3):** `verb-praeposition-erweitert` → tag `verb-praeposition-b1` (sich äußern zu,
abhängen von); `kausalsatz-da` → `da-weil`; `zweiteilige-konnektoren` →
`zweiteilige-konnektoren` (nicht nur … sondern auch, entweder … oder, zwar … aber).
**Outcomes:** `bericht-verstehen` (reading — "Ich kann einen kurzen Bericht verstehen und seine
Kernaussage wiedergeben."), `meinung-begruenden` (spoken-production — "Ich kann meine Meinung
äußern und mit Argumenten stützen."), `argumente-verbinden` (writing — "Ich kann Aussagen mit
zweiteiligen Konnektoren verknüpfen und abwägen.").
**Deepens:** `verben-mit-praepositionen`, `verbindungen-folgen`, `lernen-verstehen` (indirect
questions recycle — the mediation load is the new part).
**Exclude:** politics and news beyond everyday media use, opinion essays (that is B2 genre range).

### B1.6 · `konsum-umwelt` — Konsum & Umwelt

**Mission:** compare choices and understand how things are made, sold and regulated; avoid abstract
policy.
**Grammar (2):** `passiv-produktion` → tag `passiv-bildung`; `passiv-vergangenheit` →
`passiv-vergangenheit`.
**Outcomes:** `passiv-beschreiben` (writing — "Ich kann mit dem Passiv beschreiben, wie etwas
hergestellt oder geregelt wird."), `hinweise-verstehen` (reading — "Ich kann öffentliche Hinweise
und Regelungen verstehen."), `konsum-vergleichen` (spoken-production — "Ich kann
Konsumentscheidungen vergleichen und meine Wahl begründen.").
**Deepens:** `einkaufen-reklamation`, `man-und-besitz` (its `passiv-rezeptiv` recognition was A2;
production is this unit's whole point — the A2 tag never closes these gaps).
**Exclude:** Vorgangs- vs Zustandspassiv terminology, environmental policy debate, statistics, the
modal passive (B1.7).

### B1.7 · `regeln-verantwortung` — Regeln & Verantwortung

**Mission:** understand what must, may and cannot be done in everyday regulated situations, state
what follows from it, and negotiate a practical solution.
**Grammar (2):** `passiv-modal` → tag `passiv-modal` (das muss bis Freitag erledigt werden);
`konsekutivsatz-sodass` → `sodass-folge`.
**Outcomes:** `pflichten-verstehen` (reading — "Ich kann einer Regelung entnehmen, was getan werden
muss und was erlaubt ist."), `folgen-benennen` (writing — "Ich kann mit sodass benennen, welche
Folge etwas hat."), `loesung-aushandeln` (spoken-interaction — "Ich kann bei einem Problem eine
praktische Lösung aushandeln.").
**Deepens:** `modalverben` (the A2 active modal is the base — the modal passive is the depth),
`verbindungen-folgen` (deshalb/trotzdem are A2 adverbs; sodass the conjunction is the depth),
`aemter-dienstleistungen`.
**Exclude:** legal obligation language, the `so … dass` split-position stylistic variant,
Zustandspassiv.

### B1.8 · `reisen-probleme` — Reisen & Probleme

**Mission:** manage less predictable disruption and make a complaint; exclude legal detail.
**Grammar (2):** `konjunktiv2-irreal` → tags `konjunktiv2-form`, `irreale-bedingung`;
`praeposition-genitiv` → `praeposition-genitiv` (wegen, trotz, während).
**Outcomes:** `beschwerde-schreiben` (writing — "Ich kann eine formelle Beschwerde mit Begründung
schreiben."), `irreale-bedingung-nutzen` (spoken-production — "Ich kann sagen, was ich tun würde,
wenn etwas anders wäre."), `panne-berichten` (spoken-production — "Ich kann eine Reisepanne
zusammenhängend berichten.").
**Deepens:** `reisen-verkehr`, `gesundheit-wohlbefinden` (the Konjunktiv II advice forms feed the
full paradigm here).
**Exclude:** Konjunktiv II of full verbs beyond hätte/wäre/würde + core modals, compensation law.

### B1.9 · `lernen-zukunft` — Lernen & Zukunft

**Mission:** discuss learning and career goals, summarize, plan next steps.
**Grammar (3):** `finalsatz-damit` → tag `damit-um-zu` (the subject test decides between them);
`konditionalsatz-falls` → `falls-wenn`; `infinitivsatz-ohne-statt` → `ohne-statt-zu`.
**Outcomes:** `ziele-begruenden` (spoken-production — "Ich kann Lernziele nennen und begründen,
wozu ich etwas lerne."), `plan-formulieren` (writing — "Ich kann einen Plan mit Bedingungen
formulieren."), `beratung-verstehen` (listening — "Ich kann einer Beratung die wichtigsten Punkte
entnehmen.").
**Deepens:** `lernen-verstehen`, `infinitiv-mit-zu`, `nebensaetze-plaene` (um … zu and zu-infinitive
are A2 — damit/ohne … zu/statt … zu are the added depth).
**Exclude:** formal study-counselling vocabulary, Futur II, career-planning jargon.

### B1.10 · `gesellschaft-zusammenleben` — Gesellschaft & Zusammenleben

**Mission:** join a familiar community discussion and resolve a disagreement; action-oriented,
never civics-lecture.
**Grammar (3):** `konzessivsatz-obwohl` → tag `obwohl-trotzdem` (the conjunction vs the A2
adverb); `indefinitpronomen-erweitert` → `indefinitpronomen-erweitert` (irgendjemand, niemand,
alle/einige/manche); `relativ-was-wo` → `relativ-was-wo` (alles, was …; die Stadt, wo …).
**Outcomes:** `einwand-ausdruecken` (spoken-interaction — "Ich kann Einwände ausdrücken und auf
Gegenmeinungen reagieren."), `diskussion-folgen` (listening — "Ich kann einer Diskussion zu einem
vertrauten Thema folgen."), `kompromiss-vorschlagen` (spoken-interaction — "Ich kann bei einer
Meinungsverschiedenheit einen Kompromiss vorschlagen.").
**Deepens:** `verbindungen-folgen` (trotzdem the adverb is A2 — obwohl the conjunction is the
depth), `freunde-feste`.
**Exclude:** political institutions, migration-policy content, formal debate structure.

### B1.11 · `digitales-leben` — Digitales Leben

**Genre unit — owns no manifest grammar point.** Its practice recycles tags already registered by
earlier units; it closes none, and the grammar ratchet does not move in its commit.
**Mission:** follow written instructions, get help with something that went wrong, and talk about
media habits. Genre range: Anleitung, Hilfetext, Online-Formular.
**Grammar (0):** none new. Recycles `passiv-bildung` (B1.6) in instructions and `sodass-folge`
(B1.7) in problem reports — recycled tags never close a point.
**Outcomes:** `anleitung-verstehen` (reading — "Ich kann einer schriftlichen Anleitung Schritt für
Schritt folgen."), `technikproblem-schildern` (writing — "Ich kann ein technisches Problem
schildern und gezielt um Hilfe bitten."), `mediennutzung-berichten` (spoken-production — "Ich kann
über meine Mediennutzung berichten und sie einordnen.").
**Deepens:** `lernen-verstehen`, `aemter-dienstleistungen` (online forms grow the counter-desk
register).
**Exclude:** IT-specialist vocabulary, data-protection law, device-specific brand language.

### B1.12 · `kultur-freizeit` — Kultur & Freizeit

**Genre unit — owns no manifest grammar point** (same rule as B1.11).
**Mission:** read what is on, agree with someone on a plan, and say what an event was like. Genre
range: Programm, Rezension, Einladung.
**Grammar (0):** none new. Recycles `komparativ-attributiv` (B1.2) in recommendations and
`praeteritum-vollverben` (B1.1) in written reports.
**Outcomes:** `programm-verstehen` (reading — "Ich kann einem Veranstaltungsprogramm die für mich
wichtigen Informationen entnehmen."), `veranstaltung-empfehlen` (spoken-interaction — "Ich kann
eine Veranstaltung empfehlen und mich mit anderen auf einen Plan einigen."), `erlebnis-bewerten`
(writing — "Ich kann einen kurzen Erfahrungsbericht schreiben und begründet bewerten.").
**Deepens:** `freunde-feste`, `freizeit-koennen`.
**Exclude:** art criticism register, sports-reporting jargon, cultural-history content.

### B1.13 · `geld-vertraege` — Geld & Verträge

**Genre unit — owns no manifest grammar point** (same rule as B1.11).
**Mission:** check what you have been charged, ask the questions that clarify a contract, and
compare what things cost. Genre range: Rechnung, Vertrag, Kostenvoranschlag.
**Grammar (0):** none new. Recycles `genitiv-form` (B1.2), `passiv-modal` (B1.7) in terms and
conditions, and `n-deklination` (B1.4).
**Outcomes:** `rechnung-pruefen` (reading — "Ich kann eine Rechnung prüfen und Unstimmigkeiten
benennen."), `vertrag-nachfragen` (spoken-interaction — "Ich kann zu einem Vertrag gezielt
nachfragen und Bedingungen klären."), `kosten-vergleichen` (spoken-production — "Ich kann Kosten
und Tarife vergleichen und meine Wahl begründen.").
**Deepens:** `einkaufen-reklamation`, `aemter-dienstleistungen`.
**Exclude:** banking and insurance law, investment vocabulary, tax content.

### B1.14 · `informationen-vermitteln` — Informationen vermitteln

**Mission:** relay the main points of a notice, message or conversation — the cumulative
mediation unit that closes the level.
**Grammar (3):** `indirekte-rede` → tag `indirekte-rede` (er sagt, dass … / sie fragt, ob … —
Konjunktiv I receptive only); `wortstellung-angaben` → tags `angaben-reihenfolge`,
`pronomen-stellung`; `partizip-adjektiv` → `partizip-adjektiv` (das geplante Treffen — the
compression notices are made of).
**Outcomes:** `mitteilung-weitergeben` (spoken-production — "Ich kann den Inhalt einer Mitteilung
mit eigenen Worten weitergeben."), `indirekt-berichten` (writing — "Ich kann berichten, was
jemand gesagt oder gefragt hat."), `text-zusammenfassen` (writing — "Ich kann einen Text kurz
zusammenfassen.").
**Deepens:** `lernen-verstehen` (indirect questions), `nebensaetze-plaene` (dass-clauses),
`erfahrungen-erzaehlen` (narrative order under the Angaben rule).
**Exclude:** Konjunktiv I production, journalistic register, minutes/protocol formats.

### Vocabulary, probes, checkpoint — the level-wide policies

- **Vocabulary:** each unit ships a deck of **30–40 entries** no deck owns, recycling A1/A2 lexis
  aggressively. **The deck has two tiers and the split is decided at authoring time, once:** the
  core 12–24 entries the unit actively teaches ship `cards: both`; every entry added beyond that
  core is receptive tail and ships **`cards: recognition` from the start**. This is not a
  preference — an entry defaults to `both` and **is never retrofitted**, because the direction is
  baked into the card id and flipping a shipped entry deletes its production-card SRS history. At
  two cards per `both` entry, a 35-entry all-`both` deck is 70 cards, and fourteen of them is ~980
  cards against `DAILY_NEW_CARDS = 15` — roughly double B1's affordable review load. The tiering is
  what makes the larger deck payable.
  The remaining Wortliste tail still closes in an end-of-level completion pass of **unowned** decks,
  recognition-heavy — never listed in any topic's `vocab:`. Coverage command:
  `bun scripts/coverage.ts B1` (with `--check-deck` per deck before validate).
- **Probes: one 3-variant, single-competence family per competence the unit owns**, from day one,
  cloze-preferred for attribution. A unit with three grammar points declares three families
  (`b1/probe-<id>` plus `b1/probe-<id>-<competence>`); a genre unit declares one per outcome
  cluster worth delayed evidence. The `topic:` back-reference — not the filename — binds a family
  to its unit, so the suffix is free-form; `probeFamilies` (`src/lib/probes.ts`) already arms each
  family independently. **One family per unit was the original contract and it was a regression:**
  A1 and A2 both ship 1.80 families per topic (18 of 22 A2 topics carry more than one), while the
  ten-unit B1 contract would have measured 10 of 31 grammar points.
  **Why this must be decided before a unit ships, and not after:** a topic's *first* family arms
  from whole practice sets (`armingSetIds`); the moment a second family exists, `probeFamilies`
  flips **both** to item-level arming (`armingItemKeys`, `shared === true`). The existing family's
  arming basis therefore changes underneath it, and its `armedAt` moves if the learner's earliest
  attempt on that topic was on an item that does not carry its outcomes. P12-2 (2026-07-20) fixed
  the catastrophic form of this — arming used to degrade to nothing and discard the cohort — but it
  did not make adding a family free. So a second family on a shipped unit stays what it already
  was: allowed **only for a measured reason, with `armedAt` checked before and after** (a >~1-day
  shift re-labels probes already taken). B1.1–B1.3 keep the single family they shipped with unless
  that measurement says otherwise; the 24/31 figure above assumes they do.
- **Operating cadence** (extends P5-11 to B1): after every two shipped units — triage the grading
  queue to zero, rerun `bun run progress:audit`, re-read the weak-focus table, and only then
  author the next pair; the grammar ratchet and the tag registry move in every unit's own commit.
- **Checkpoint and placement:** `checkpoint-b1.yaml` and `placement-b1.yaml` at level close —
  data, not wiring; one of each per level.
- **Ukrainian:** `<Uk>` halves ship with each topic (per-file all-or-none); the Über page's
  computed coverage figure is the tracker.

Pronunciation shifts toward clause grouping, sentence accent, reductions and connected speech. No B1
unit may assume that a structure met once at A2 was retained.

## Authoring and release workflow

1. Freeze the identities above before authoring. Never rename a persisted id for tidiness.
2. Author one complete unit per bundle: atlas node and unit slot, article, three-item pretest,
   practice sets clearing the item-mix bar, **one probe family per competence the unit owns**, an
   intensive reading, the two-tier vocab deck, and the focus tags registered in both
   [`focus-tags.md`](focus-tags.md) and `focusIntroducedBy` (`src/lib/focus-tags.ts`). A genre unit
   (B1.11–B1.13) registers no new tag and leaves the grammar ratchet untouched.
3. Review each unit against the twelve-point A2 unit quality gate in the audit and the
   `learning-science` skill before it lands.
4. Run the full gate: `bun run validate && bun test && bun run check && bun run lint && bun run build`.
5. After every two units (the frozen B1 cadence — same interval as the level-wide policy above),
   read the newest snapshot in `progress/<profile>/`: mode
   distribution, focus errors, card lapses, delayed-probe retention and novel transfer. Adjust the
   units that follow; add to the units that shipped without renaming anything.
6. Close the level with the checkpoint, the Wortliste completion pass, and an honest Über page.

## Acceptance gates

- Every A2 unit clears the twelve-point A2 unit quality gate in [the audit](a1-learning-audit.md).
- Every declared outcome is measured by at least one non-pretest item or reading question.
- No A2 deck re-teaches a headword another deck owns, and no A2 topic adopts an A1 deck.
- Receptive-only language appears in readings and articles — never in an A2 deck, and in a B1
  deck only as `cards: recognition` (the A2 two-card decks are never retrofitted).
- The six shipped A2 topics are strengthened in place, never duplicated under a thematic name.
- The B1 contract is frozen (2026-07-24) but creates no learner-visible completeness claim ahead
  of shipped content — the Über B1 card and the README scope line flip only when the first B1
  unit actually ships, and then only to "in progress".
- This document, [roadmap.md](roadmap.md), [backlog.md](backlog.md) and `CLAUDE.md` agree.

## Amendment 2026-07-24: probe families, unit count and deck size

The contract above was frozen and then amended the same day, before B1.4 was authored. The trigger
was a scope question — *is 10 B1 units right against A2's 22?* — and the answer that came back from
measurement was **10 is too few, but 22 is the wrong target**. A2 reached 22 partly by accident: 17
planned units plus 5 remedial ones added in Phase 10 when the grammar manifest revealed A2 sitting
at 20/30 ([backlog](backlog.md)). The exhaustive-ownership clause exists to prevent that drift and
it worked; the defects were narrower than unit count.

**What was measured, and with what.** Every figure below is reproducible.

| Figure | Command |
| --- | --- |
| A1 22, A2 30, B1 31 grammar points | `data/grammar-inventory.yaml`, `standard_level` |
| B1 grammar coverage 10/31 (32%) | `bun scripts/grammar-coverage.ts B1` |
| Wortliste: A2 1449/1449 (100%), B1 1480/3416 (43%), 1936 missing | `bun scripts/coverage.ts A2` · `bun scripts/coverage.ts B1` |
| Outcomes A1 37 / A2 83 / B1 32; ~3.7 per unit at every level | count `outcomes` per node in `content/atlas.yaml` |
| Grammar points per unit: A2 1.36, B1-as-frozen 3.10 | the two rows above |
| Probe families per topic: A1 1.80, A2 1.82, B1 1.00 | group `content/exercises/<lvl>/probe-*.yaml` by their `topic:` field |
| Vocab entries in topic-owned decks: A1 232, A2 339, B1 60 | decks named in a topic's `vocab:` frontmatter, summed |
| Repo-wide 631 entries owned / 1048 unowned across 40 decks | as above, complement |

**Three findings drove the change.**

1. **B1 packed 2.3× A2's grammar per unit**, and `konsum-umwelt` stacked three passive forms plus
   `konsekutivsatz-sodass` behind one article, one practice set and one probe. Split into B1.6 and
   B1.7; the "the passive block coheres in one unit" rationale is reversed above.
2. **One probe family per unit was a regression, not a simplification.** A1 and A2 both ship 1.80
   families per topic; the frozen B1 contract would have placed 10 of 31 grammar points under
   delayed retention measurement. Per-competence families take that to 24/31 — B1.1–B1.3 are
   locked at the single family they shipped with, since adding one re-arms a shipped topic.
3. **Vocabulary was the weakest of the three arguments, and is recorded as such.** ~1,750 of the
   1,936 missing words looked set to fall to unowned completion decks (~90%) — until the A2
   comparison showed A2 already ran ~77% of its list that way and still reached 100%. B1 differs in
   degree, not kind. Deck size rose 12–24 → 30–40 anyway, on the owner's decision; **what it buys
   is ~14% of the gap** (11 unauthored units × 30–40 ≈ 330–440 entries, tail ~1,750 → ~1,500). It
   does not remove the end-of-level completion pass, and it is affordable only because of the
   two-tier `cards: recognition` rule stated in the vocabulary policy.

**What changed:** ten units → fourteen (B1.6 split; genre units B1.11–B1.13 added; the mediation
unit still closes the level, now as B1.14); one probe family per unit → one per competence; deck
size 12–24 → 30–40 with a mandatory two-tier card-direction split.

**What did not change, and must not:** the 31 manifest points and their one-owner-each rule (the
sum is restated as `3+3+4+3+3+2+2+2+3+3+0+0+0+3 = 31`); the 34 focus tags; the shipped identities
of B1.1–B1.3; the two-unit evidence cadence; the rule that atlas nodes land only in a unit's own
shipping PR. Section numbers B1.4–B1.14 are **document labels, not persisted identities** — no
unshipped unit has an entry in `content/atlas.yaml`, so reflowing them renames nothing. Topic ids
are the identities, and every one of them is unchanged.

## Amendment 2026-07-26: a fourth B1.4 outcome, because probe families arm by outcome

B1.4 was authored with the three outcomes the contract froze, and the review of its shipping PR
found that the three probe families it owes could not be measured independently. The mechanism is
in `probeFamilies`/`armedAt` (`src/lib/probes.ts`): a family arms from the practice items that
declare **its outcomes**, and an attempt also arms it directly when the attempt names one of them.
Two families declaring the same outcome therefore arm **identically**. B1.4's adjectival-noun and
noun–verb families both sat on `erfahrung-praesentieren`, so a verified adjectival-noun item would
have started the noun–verb retention clock, and that probe would have fired at 2/7/21 days against
a competence the learner had never practised — logging a retention failure that measures nothing.

This is new at B1.4 because **B1.1–B1.3 each ship exactly one family**; the 2026-07-24 amendment
that asked for one family per competence created the collision, and nothing measured it until a
unit actually owed three.

Two fixes were available and only one was safe before the 2026-08-02 cohort read. Making arming
focus-aware is the deeper fix, but it changes `armedAt` semantics for every family A1 and A2
already shipped — 18 of 22 A2 topics carry more than one — and a shifted `armedAt` re-labels
probes already taken. **Distinct outcomes** was therefore the fix taken, and it repaired a real
gap rather than papering over one: B1.4's mission has four moves and the contract named three
outcomes, leaving *handle interview turns* unowned. `interview-fragen-beantworten`
(spoken-interaction) now owns it and carries the noun–verb family, whose chunks — *eine Frage
stellen, eine Antwort geben, einen Eindruck machen* — are exactly what an interview turn is made
of.

**Correction, same day.** The paragraph above first closed by saying the outcome's written items
"record selected-response evidence, never spoken evidence, on the same footing as B1.3's two
spoken-interaction outcomes". That precedent is the opposite of what the repo contains, and the
review of the same PR caught it: B1.3's `beschwerden-schildern` and `ratschlaege-formulieren` each
own a `speak` task (`sprechen-beschwerden-apotheke`, `sprechen-ratschlag-freundin`). A new outcome
introduced to fix an arming collision had been given no task in its own mode, and the sentence
justifying that cited the units which do the opposite. B1.4 now ships `sprechen-interview-turns`
(`mode: spoken-interaction`, answer a question then ask one) plus `hoeren-interview-verstehen`, an
`audio-comprehension` item for the half of an interaction a speaking task cannot train. **The rule
this leaves: an outcome added to separate probe arming is still an outcome, and owes a task in the
mode it names** — the arming fix is not a licence to skip the checklist line at
`docs/authoring-checklists.md:18`.

**What distinct outcomes do not fix, stated precisely.** They separate families *from each other*.
They do not separate unrelated items *within* one outcome: `armedAt` arms from any verified attempt
carrying the family's outcome, so an item that declares `bewerbung-schreiben` while drilling
`hoeflich-konjunktiv` still starts the n-declension clock. The B1.4 review reported the three arming
sets as "each containing only items that teach its own competence" — that was over-read from the
instrument's output, which lists keys and not their focus tags; `uebersetzen-einladung` is the
counterexample. The residual is bounded (the clock can start early, never on a topic the learner
never opened) and it is **the systemic behaviour, not a B1.4 defect**: `probeFamilies` over shipped
A1/A2 content yields **227 such links across 26 multi-family topics**. Closing it means focus-aware
arming — the deferred fix above, whose cost is unchanged. Do not special-case B1.4 for it.

**The standing rule this leaves:** a unit owing N probe families needs N distinct outcomes among
them, and outcome count is capped at four per node. A unit owning more than four competences
cannot give each one an independently-armed family until arming is focus-aware — check this when
planning a unit's outcomes, not after its probes are written. B1.5–B1.14 each own at most three
grammar points, so the constraint binds nowhere else in the current contract.
