# Themenlisten — the external anchor for what the course is *about*

`data/strukturenlisten/` measures the grammar this course teaches. `data/handlungslisten/` measures
what it lets the learner *do*. Neither can see the third question a language course answers:
**what is it about**. A course can teach every structure the published standard lists, cover every
communicative function it enumerates, and never once mention Versicherungen.

The claimant here is a **topic** — `content/topics/<level>/<id>.topic.yaml`. That is why this
dimension landed last: until [ADR 0012](../../docs/adrs/0012-topic-manifests.md) a topic had nowhere
to declare anything, its identity split across a directory, an MDX frontmatter and an atlas node.

| file | level | audience | mode | entries | free |
| --- | --- | --- | --- | --- | --- |
| `goethe-dtz.yaml` | A2 + B1 | Erwachsene | unstated | 70 | yes |

`mode: unstated` is not an omission. § 8.4 says its structures must be mastered *"aktiv und
passiv"*; § 8.1 says nothing of the kind — it constrains task *selection*. A theme is not something
one produces. Everything else about the format — `cumulative`, `printed`, `pdf_pages`, the
labels-only boundary, `bun scripts/anchor-check.ts` — is shared and documented once in
[`../strukturenlisten/README.md`](../strukturenlisten/README.md).

## How a topic cites one

```yaml
# content/topics/a1/wohnen.topic.yaml
claims:
  - goethe-dtz-themen:wohnen-wohnung-art
  - goethe-dtz-themen:wohnen-raeume
  - goethe-dtz-themen:wohnen-einrichtung
```

```
bun scripts/themen.ts [A1|A2|B1] [--unclaimed-only] [--beyond]
```

## What the first run found

**59 of 70 claimed (84%).** Eleven themes the DTZ names for an adult building a life in Germany
that no topic is about:

> Geburtsort · Geschlecht · **Klima/Wetter** · Pflanzen · Tiere · **Rauchen/Drogen/Alkohol** ·
> **Unfall** · **Kinderbetreuung** · Studium · **Polizei** · **Versicherungen**

The bolded ones are the ones worth arguing about. *Unfall*, *Polizei* and *Versicherungen* are
high-stakes and reachable at A2; *Kinderbetreuung* is the daily reality of a large part of the
audience; *Klima/Wetter* is standard A1 material in every coursebook.

**A hole here is a topic-level hole, not a vocabulary one, and the difference is the finding.**
*Wetter*, *Sonne*, *Regen*, *Schnee*, *Grad*, *warm* and *kalt* all exist as flashcards — in
Wortliste **completion decks that no topic owns**. The learner meets them as isolated cards and
never in a lesson. Coverage of the Goethe Wortliste cannot express that, because a card is a card.

## Three of the fourteen first-run holes were the author's, not the corpus's

The first pass reported fourteen. Checking each against the actual decks and items — rather than
against the assignment that produced them — retired three:

- **Lebensmittel** — *Brot, Butter, Käse, Milch, Ei, Fleisch, Gemüse* are all in `essen-trinken`;
  it had claimed `essen-nahrungsmittel` and not the near-identical `einkaufen-lebensmittel`.
- **Alter** — `menschen-familie`'s practice items ask *Wie alt …* and answer *… Jahre alt*.
- **Post** — `informationen-vermitteln` teaches *Absender*, *Briefkasten*, *Mitteilung*,
  *hinterlassen*.

Which is the standing warning about this dimension: **the assignments are editorial**, and an
under-claim manufactures a hole exactly as an over-claim manufactures coverage. Every claim in the
corpus today was made from a topic's own deck and readings, and every hole above was tested against
the corpus before it was written down.

## `beyond` is expected here

Thirteen topics cite no theme and that is not a defect. Most are grammar: *Der Akkusativ* is about
the accusative, not about a slice of life. Two are not, and are worth naming because the source's
own scope explains them — `gesellschaft-zusammenleben` and `alltag-zeit`. § 8.1 deliberately
contains no civics theme (*"Wissen über Politik, Geschichte, Ökonomie wird ebenfalls nicht
überprüft"* — that belongs to the Orientierungskurs), and it has no theme for clock time and
weekdays at all. Read `beyond` as *the course is about more than the exam is*, `unclaimed` as *the
exam is about more than the course is*. Only the second is a gap.

## One footnote in the source is itself a finding

`Essen / Trinken` carries a superscript 1 on p. 88: *"Die Bedarfsrecherchen haben ergeben, dass das
Thema im Zusammenhang mit dem Spracherwerb weniger wichtig ist."* The standard's own needs research
says food matters **less** for this audience than a coursebook progression implies. It is
transcribed on the section and acted on nowhere — but it is the kind of thing a self-authored
syllabus never tells you about itself.
