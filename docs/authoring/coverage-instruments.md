# Coverage instruments — how a published figure is earned

Four scripts decide every completeness number this project publishes, and each answers a
different question: `scripts/coverage.ts` — *is the word here* (against the Goethe Wortliste);
`scripts/grammar-coverage.ts` — *is the structure here* (against `data/grammar-inventory.yaml`);
`scripts/structures.ts` — *is the list of structures the right list* (against published
Strukturenlisten); `scripts/grammar-depth.ts` — *how much practice stands behind each confusion*.
None substitutes for another: a level can read 100% on three of them and be thin on the fourth.

A fifth, `scripts/comprehensibility.ts`, publishes nothing and gates nothing; it shares the corpus,
the tokenizer and the discipline, so it is filed here too.

`CLAUDE.md` keeps the one-line rules; this doc is how the instruments work.

## Wortliste coverage — `bun scripts/coverage.ts <A1|A2|B1>`

Against `data/goethe-<level>-wortliste.txt` (headwords only). `--missing-only` hides covered words.
A level with no manifest has no figure and claims none.

- **A new word belongs to exactly one deck** (the validator hard-fails cross-file duplicates), and
  the manifest gains a line in the same change.
- **The manifests are separate lists, not nested ones** — the A2 list does not repeat *Nase* or
  *anziehen* — so a word counts as covered by whichever deck teaches it, at any level.
- **A `~` (taught as grammar, no flashcard) must be earned.** `bun run validate` hard-fails unless
  the word occurs in the **taught surface**: a topic article with its `<En>`/`<Ru>` halves stripped,
  a reading, or a `practice`/`drill` item (`taughtSurface`, `packages/content/src/coverage.ts`).
  Pretests, checkpoints and probes do not count: they test rather than teach. The stripping is the
  point — a word that appears only in English prose *about* German was never taught. A `~` you
  cannot pay for with content is a word that needs a flashcard.
- **`--check-deck <file.yaml>`** rejects any headword not on the level's current missing list,
  which is by construction a word no other deck owns. Run it per deck before `bun run validate` on
  any completion pass.

## Grammar coverage — `bun scripts/grammar-coverage.ts <A1|A2|B1> [--missing-only]`

Structural coverage against `data/grammar-inventory.yaml`. A point counts as taught only when a
`practice` or `drill` item carries the focus tag naming its confusion — not a checkpoint, pretest
or probe, and not a `preview: true` item, which declares an intentional forward reference.
`reference_only: true` with `taught_in:` covers real knowledge that names no confusion (the clock,
ordinals); the named topic must exist and its level is the point's level, so the hatch buys no
free pass. `level: {reception, production}` says where the standard expects comprehension and
where this course authors production; coverage measures against `production`, so a point taught
later than its production level reports `late` instead of passing.

A1 reports **28/28 covered, 0 late, 0 missing**; A2 **46/46**.
**B1 has a real 32-point manifest, at 32/32 (100%) with the contracted units B1.1–B1.14 shipped.**
That internal 100% means every row
we wrote is taught, not that the catalogue is complete. The focus allowlist is complete
(35 of the 35 tags the B1 points name are registered), and the external anchor below is reported
separately.

**Changing the denominator means changing the exact number in `tests/grammar-coverage.test.ts` in
the same commit** — it is a tripwire in both directions.

## The denominator's denominator — `bun scripts/structures.ts`

Grammar coverage measures the content against a list this project wrote for itself, so a structure
nobody thought of is absent from both and the figure reads 100% anyway. This instrument checks the
list against published standards.

```
bun scripts/structures.ts A1 A2 [--unclaimed-only] [--beyond]
```

`data/strukturenlisten/<source-id>.yaml` holds one file per **source document** — structure labels
only, in the document's own section order, no example sentences
([ADR 0004](../adrs/0004-completeness-is-evidence-contracts.md)). An inventory row cites entries as
`claims: [<source-id>:<entry-key>]`, and every published entry is **claimed**, **unclaimed** (a
hole in the denominator) or **beyond** (a row citing no source — legitimate, since this course
follows a coursebook progression, but visible rather than assumed). A dangling `claims:` ref fails
validation.

**A level with no source reports `anchored: false`, never 100% of nothing.** B2–C2 are in that
state. The DTZ is cumulative and names an A2–B1 production repertoire, so its A2 entries stay in
scope at B1. `data/strukturenlisten/README.md` names the missing higher-level documents.

Today: **A1 93/93 · A2 300/300 · B1 164/164** claimed. B1 is `100% des DTZ-Inventars`, never "all
conceivable B1 grammar". Per [ADR 0004](../adrs/0004-completeness-is-evidence-contracts.md), external
alignment, internal coverage, teaching depth and learner mastery are never merged into one
percentage.

**A row is claimed only in the change that ships its exit evidence:**

- an exact external claim, or an explicit `beyond` status;
- an owning topic and a named `###` section;
- at least one scaffolded production item;
- a fade or transfer item in a distinct context;
- three delayed probe variants with fresh facts and correct arming;
- diagnostics at zero for the point and its owning topic.

That is evidence of delivery, not of learning.

## Practice depth — `bun scripts/grammar-depth.ts`

Coverage is binary by design — one item marks a point taught — which is the wrong bar for *how much*
practice a confusion gets.

```
bun scripts/grammar-depth.ts [A1|A2|B1] [--thin] [--by-point] [--no-probe]
```

Four numbers per focus tag: **teaching** items · **production** items (does the learner build
German or pick it) · distinct practice **files** (a tag in one file is met once and never
interleaved) · **probe** items (is it re-asked after an interval). Counting follows
`drilledFocusTags`: practice and drill only, `preview: true` excluded.

**No threshold, deliberately.** Nobody has validated a correct number of items per confusion, so
the report prints each level's median and every row is read against it.
`tests/grammar-depth.test.ts` ratchets today's measured medians and tail counts, which may only
improve; a failure means practice was removed or a tag was added without practice to pay for it.

Today, median teaching items per confusion **A1 13 · A2 9 · B1 6**, production **9 · 6 · 5**; tags
at ≤3 items 4 · 1 · 2, tags in a single file 4 · 2 · 1; no inventory structure lacks a delayed
probe. **Breadth work can pay depth debt**: choose a new topic's focus tags from `--thin` rather
than from its vocabulary.

## Input load — `bun scripts/comprehensibility.ts`

Measures **nothing published**: how much of a topic's German the learner has not met yet, against
what the spine says they have met by then.

```
bun scripts/comprehensibility.ts b1/geld-vertraege   # one topic, in detail
bun scripts/comprehensibility.ts --rank B1           # one level, ranked
bun scripts/comprehensibility.ts --rank              # all three levels
```

**Read-only, no threshold.** No validator hook, no test asserting a number, nothing on `/about`.
The report prints each level's **median**, and every row is read against it. Outliers are the
product.

**What it counts.** A topic's position is its index in `content/atlas.yaml`'s `units:` order,
levels concatenated A1 → A2 → B1. At position P the learner is assumed to know (1) the German of
every topic before P — articles with all four halves stripped, readings with each gloss reduced to
its German, and `practice`/`drill` item German; (2) every form in every deck attached at or before
P, own decks included; (3) every Wortliste headword of each level up to the topic's. A token in none
of the three that survives a light inflection fold is **ahead of the learner**. The module doc of
`packages/content/src/comprehensibility.ts` has the full definition, including why `<De>` is
stripped here while `taughtSurface()` strips only `<En>`/`<Ru>`. The detailed report lists the
distinct ahead tokens per section — the words to gloss, move into the deck, or cut.

Level medians (`bun scripts/comprehensibility.ts --rank`):

| level | ahead/100 (article+reading) | mean words/sentence | Nebensatz/sentence | max terminology/100 |
| --- | ---: | ---: | ---: | ---: |
| A1 | 6.9 | 7.4 | 0.01 | 3.26 |
| A2 | 5.6 | 8.4 | 0.11 | 5.24 |
| B1 | 3.8 | 11.2 | 0.28 | 4.76 |

Sentence length and subordination rise across the levels and load does not, which is the shape a
spine should have; A1 reads highest because the first topics have almost no prior surface.

**What the numbers cannot support.** The method is generous — it under-reports load rather than
inventing it — and four false-positive classes are known, none worth chasing until the ranking is
calibrated against a felt-difficulty list (backlog P24-9):

- **Proper names** (`Anna`, `Hamburg`, `GmbH`) are ahead by every rule here and no burden at all.
- **Strong-verb ablaut.** The fold reaches umlaut (`fährt` → `fahren`) but not vowel change (`gibt`,
  `trifft`). The closed class is handled by `FUNCTION_WORDS`.
- **A glossed reading word still counts**, so the reading column partly measures how much was
  glossed.
- **Per-language glosses inside a German table** (`sein (to be / быть / бути)`): Cyrillic falls out
  in normalization, English does not.

Article surfaces run from 47 to 668 tokens, so one ahead token moves a short A1 article's share by
two points; compare the pooled `all` column, not `artic`, when the article is short.
