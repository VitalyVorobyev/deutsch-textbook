# ADR 0006: Public-domain classics as the second extensive-reading strand

Status: accepted · 2026-08-04

## Context

Extensive reading is the thinnest input channel in the course. The whole strand today is **seven
connected *Lena in Bremen* episodes** — `content/reading/a1/lena-1-der-erste-tag.yaml` plus
`content/reading/a2/lena-2…lena-7`, measured 2026-08-04 with
`grep -rln "kind: extensive" content/reading/`, against 60 reading files in total
(`ls content/reading/*/*.yaml | wc -l`). Every other reading is `kind: intensive`, which is a
different artifact for a different job: ~90–130 words, densely glossed, mined by comprehension
questions. Volume input is not what an intensive text delivers, and relabelling one does not make
it deliver volume.

`deutsche_klassiker_a2_b1_markdown/` is a corpus of **ten didactic retellings of public-domain
German classics** — six Grimm tales, Kopisch's *Die Heinzelmännchen*, Goethe's *Der Zauberlehrling*
and two Hauff stories (`deutsche_klassiker_a2_b1_markdown/SOURCES.md`), each with its Wikisource
link to the historical full text. It carries an explicit A2→B1 progression with a named grammatical
focus per text, and its own README states the legal position (§ 64 UrhG; the retellings are new
didactic prose, not transcriptions) and the recommended in-course credit line: *"Nach einem
gemeinfreien Werk von [Autor]. Didaktische Bearbeitung für Niveau [A2/B1]. Historischer
Originaltext: [Link]."*

Two facts about fit, measured 2026-08-04:

- **Length.** Per-text adapted-Lesetext word counts, counted with
  `awk '/^## Adaptierter Lesetext/{f=1;next}/^## /{f=0}f' <file> | wc -w`: 285, 315, 522, 326, 425,
  380, 343, 379, 456, 519. The validator's extensive band is **250–400 words**
  (`scripts/validate.ts:1309`), with at most 2 gist questions (`:1313`) and a gloss-density cap
  (`:1321`). Six of ten sit inside the band as they stand; four (Bremer Stadtmusikanten, Hans im
  Glück, Kalif Storch, Das kalte Herz) run long and need trimming or splitting into episodes.
- **Provenance.** `readingSchema` (`src/lib/schemas.ts:725`–`:748`) has **no** `attribution` or
  `license` field. `documentSchema` does (`src/lib/schemas.ts:765`–`:766`), and refuses to validate
  a `real`/`adapted` document without both (`:769`). So today a reading adapted from someone else's
  work can ship with its provenance in a comment, or with none at all, and every gate stays green.

## Decision

### The corpus becomes the second extensive-reading strand

Each text is adapted into `content/reading/<level>/<id>.yaml` with `kind: extensive`, at the level
the corpus assigns it (A2 for 1–2, A2+ for 3–4 and 7, B1 for 5–6 and 8–10), and is held to the
same validator bounds as the Lena episodes — no exemptions for being a classic. A text that will
not fit 250–400 words is trimmed or split into episodes; the band is not widened for it.

### The reading schema gains `attribution` and `license`

Mirroring `content/documents/`: per-text provenance becomes **validator-enforced, not
conventional**. The credit line the corpus README recommends — *"Nach einem gemeinfreien Werk von
… · Historischer Originaltext: <Wikisource link>"* — is data on the reading, rendered with it, not
a note in a YAML comment that no gate can see. A reading with no external source keeps both fields
absent; a reading adapted from a source cannot ship without them.

This is the same argument that made the document fields load-bearing: attribution that lives in
prose drifts out of the artifact it describes, and "we always write it in the header" is not a
guarantee, it is a habit.

### Readings stay no-mastery, no-review-debt

Unchanged and restated because a ten-text strand is exactly the size at which someone proposes a
completion bar. An extensive reading creates no cards, no mastery, no "done" state and no review
debt. It is read for meaning at volume, and being asked to account for every sentence is what turns
reading back into a test.

### Receptive vocabulary in these texts creates no cards

The Wortliste completion decks own the cards. What the readings grow is the **taught surface** —
the corpus of German the learner has actually met — and that is a distinct, load-bearing asset: it
is what earns a `~` exclusion in the Wortliste (a word taught as grammar with no flashcard, which
the validator hard-fails unless the word occurs in the taught surface), and it is what makes the
wave-3/4 `cards: recognition` decks honest rather than a list of words the learner has never seen.
See [`../authoring/coverage-instruments.md`](../authoring/coverage-instruments.md).

### One Entdecken index piece gathers the strand

A single reviewed `content/discovery/` piece introduces the classics, names the sources, and links
the texts. It passes the Entdecken admission test like any other piece
([`../authoring/future-content-directions.md`](../authoring/future-content-directions.md)), creates
no completion state, and obligates the learner to nothing.

### The corpus source directory ships verbatim now; its home is decided later

`deutsche_klassiker_a2_b1_markdown/` is committed **unedited, at the repo root**, in the same
change as this ADR. It is inert for the build — nothing imports it, no collection reads it. Editing
it in the same pass that decides to use it would destroy the ability to diff an adaptation against
what it was adapted from. Where it finally lives (a `sources/` directory, `docs/archive/`, or out
of the repo entirely) is backlog **P24-4**, together with the schema extension and the pilot.

## Consequences

- **Extensive reading roughly doubles at A2 and gains its first B1 volume.** Seven Lena episodes
  plus up to ten classics; the honest statement stays "a growing strand", not "an extensive-reading
  library".
- **The two strands do different jobs and both are worth having.** Lena is contemporary, serial and
  written for this course's vocabulary; the classics are canonical, self-contained and carry
  cultural reference a learner meets outside the app. Neither replaces the other.
- **Every future reading adapted from an external source is now provable.** The cost is a schema
  change plus a pass over existing readings to confirm none of them silently needs the fields.
- **CEFR discipline is the binding constraint, not the source text.** A retelling of a Grimm tale
  is still A2 material or it does not ship at A2: `Präteritum` of high-frequency verbs is fine at
  A2, but the corpus's own grammar column (e.g. Konjunktiv II in *Das kalte Herz*) decides which
  level a text can honestly sit at, and a text that needs structures the level has not taught is
  either re-levelled or re-adapted.
- **Cost accepted: adaptation is real authoring work, not import.** Ten texts need glossing to the
  extensive density, level checks, gist questions (0–2, never a comprehension battery), and the
  four long ones need editorial trimming. This is a wave, sized like a lexis wave, and P24-4 pilots
  exactly one text end to end before the other nine are budgeted.
- **What this ADR does not decide:** it does not admit character art, audio narration or exercises
  built on these texts. Narration is [ADR 0008](0008-character-ensemble-and-audio-studio.md) and
  PR #133's business; illustration remains governed by the Entdecken contract, which rejects
  decorative art.
