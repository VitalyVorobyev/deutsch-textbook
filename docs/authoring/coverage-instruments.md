# Coverage instruments — how a published figure is earned

Four scripts decide every completeness number this project publishes: `scripts/coverage.ts`
(lexical, against the Goethe Wortliste), `scripts/grammar-coverage.ts` (structural, against
`data/grammar-inventory.yaml`), `scripts/structures.ts` (**the inventory itself**, against the
published Goethe Strukturenlisten) and `scripts/grammar-depth.ts` (how much practice stands behind
each confusion). They exist because the alternative — asserting completeness — had already gone
wrong three times, in three different directions: A1 claimed a word it never taught; A2 was called
content-complete at 67% of its own standard; and all three levels reported 100% grammar coverage
against a list that had never been checked against anything outside this repo.

**The four answer four different questions, and none substitutes for another.** *Is the word here*
· *is the structure here* · *is the list of structures the right list* · *how much of the structure
is here*. The third was added on 2026-08-14 and immediately found six structures the Goethe exams
test and no inventory row contained; the fourth found median practice per confusion falling A1 12 ·
A2 8 · B1 4 while all three published the same 100%.

A fifth, `scripts/comprehensibility.ts`, publishes nothing and gates nothing: it ranks topics by
how much of their German the learner has not met yet. It is filed here because it shares the
corpus, the tokenizer and the earned-claims discipline of the other four, and it is the last
section below.

Lifted out of [`CLAUDE.md`](../../CLAUDE.md), which keeps the rules ("a `~` must be earned", "closing
a gap lowers the tripwire in the same commit") and points here for how the instruments work and
what they caught.

## The two coverage commands

- `bun scripts/coverage.ts <A1|A2|B1>` — Goethe Wortliste coverage report against `data/goethe-<level>-wortliste.txt` (headwords only; a leading `~` marks words taught as grammar, no flashcard). `--missing-only` hides covered words. A level with no manifest has no coverage figure and must not claim one. **A1 and A2 are both at 100% — keep them there**: a new word belongs in exactly one deck (the validator hard-fails cross-file duplicate headwords), and the manifest gains a line in the same change. **The two manifests are separate lists, not nested ones** — the Goethe A2 Wortliste is not a superset of the A1 one (it does not repeat *Nase*, *Finger*, *anziehen*), so a word is measured as covered by whichever deck teaches it, at any level.
  **A `~` must be earned.** It counts toward the published figure, so it is checked, not trusted: `bun run validate` hard-fails unless the word actually occurs in the **taught surface** — a topic article body *with its `<En>`/`<Ru>` blocks stripped*, a reading, or a `practice`/`drill` item (`taughtSurface` in `packages/content/src/coverage.ts`). Pretests, checkpoints and probes do not count, on the same logic as the outcome rule below: they test rather than teach. The stripping is the point — A1 claimed `euer` for months while the possessive table stopped at the `sie` row and the word appeared only in English prose *about* German. If you cannot pay for a `~` with content, the word needs a flashcard instead.
  `--check-deck <file.yaml>` is the authoring guard for a Wortliste completion pass: it rejects any headword that is not on the level's current missing list — which is, by construction, a word no other deck owns. **Run it per deck before `bun run validate`**, or a few hundred new entries across a dozen files will collide on the cross-file duplicate check by accident.
- `bun scripts/grammar-coverage.ts <A1|A2|B1> [--missing-only]` — **structural** coverage against `data/grammar-inventory.yaml`, the counterpart to the Wortliste's lexical figure. It exists because "A2 is content-complete" was asserted for months at what turned out to be **67%** of the A2 standard, with six structures (Infinitiv mit *zu*, Relativsätze, *als*/*wenn*, Konjunktionaladverbien, Futur I, Reflexiv im Dativ) unwritten — several of them scheduled to be taught inside *B1* units, where they would never have been visible as A2 debt. A point counts as taught only when a `practice` or `drill` item carries the focus tag that names its confusion — the same "earned, not asserted" bar as the Wortliste `~`; checkpoints, pretests and probes do not count, because a structure only ever tested was never taught. **A `preview: true` item does not count either**: the flag declares an intentional forward reference to a focus introduced later, so reading it as evidence contradicts what it says. `reference_only: true` + `taught_in:` is the escape hatch for real knowledge that names no confusion (the clock, ordinals) — use it sparingly, and note that the named topic must exist and its own level is what the point is measured at, so the hatch cannot buy a free pass either. `level: {reception, production}` (which replaced `standard_level` on 2026-08-14) says where the *standard* expects comprehension and where *this course* authors production; coverage measures against `production`, so a point taught later than its own production level reports as `late` rather than passing silently. A1 reports **28/28 covered, 0 late, 0 missing** after the coordination, demonstrative and two Wortbildung slices shipped with full learner evidence. A2 reports **38/38 covered, 0 late, 0 missing** after reciprocal *uns/sich*, case-bearing *welch-* and duration *über + Akkusativ* received owner sections, scaffolded production, transfer and three-variant delayed probes. **Closing a gap means lowering the number in `tests/grammar-coverage.test.ts` in the same commit** — it is a tripwire, like the A2 spine length, and it works in both directions. **B1 has a real 32-point manifest, at 32/32 (100%) with units B1.1–B1.14 shipped** — it was authored at 0%, before any B1 content existed, precisely so the size of the job was visible: the proposed focus tags were deliberately unregistered, which is the normal way an unwritten structure shows up, and each became real in the commit that shipped the unit teaching it (35 of the 35 tags the B1 points name are registered, counting the union of their `focus:` lists against `focusIntroducedBy`; the last four — `indirekte-rede`, `angaben-reihenfolge`, `pronomen-stellung` and `partizip-adjektiv` — were registered by B1.14, the cumulative mediation unit that closes the level's grammar). B1's ratchet has therefore stopped being a countdown and become a ratchet of the A2 kind: the assertion in `tests/grammar-coverage.test.ts` now guards against a point being *added* to the inventory without the content to pay for it. Six structures once assumed to be B1 are taught at A2 and stay in the A2 section; the B1 points name only the *added depth* (the dative relative pronoun, the produced passive, *obwohl* as a conjunction) and each carries at least one tag no A1/A2 content already drills — otherwise an A2 tag would silently close a B1 gap, which is the same mistake that once hid six A2 structures inside planned B1 units.
  **Read B1's internal 100% with the qualifier the next section adds**: it means every row we wrote is taught. It does not mean the catalog is complete. The DTZ now supplies a production anchor for the cumulative A2–B1 repertoire, and B1 is reported against that source separately.

## The denominator's denominator — `bun scripts/structures.ts`

Added 2026-08-14, and the reason it had to be is worth stating plainly: `grammar-coverage.ts`
measured the content against a list this project wrote for itself, so a structure nobody thought of
was absent from both and the figure read 100% anyway. The Wortliste had an external anchor from the
start; grammar had none, and the inventory header had been *claiming* the Goethe Prüfungsziele as
its source for months while no one had opened one. They are free PDFs.

```
bun scripts/structures.ts A1 A2 [--unclaimed-only] [--beyond]
```

`data/strukturenlisten/<source-id>.yaml` holds one file per **source document** — structure labels
only, in the document's own section order, no example sentences (the boundary the Wortliste
manifests already keep; [ADR 0011](../adrs/0011-external-grammar-anchors.md)). An inventory row cites
entries as `claims: [<source-id>:<entry-key>]`, and every published entry then lands in one of three
classes: **claimed** · **unclaimed** (a hole in the denominator) · **beyond** (a row citing no
source — legitimate, since this course aims at B1 and follows a coursebook progression, but visible
rather than assumed). A dangling `claims:` ref is a validator failure.

**A level with no source reports `anchored: false`, never 100% of nothing.** B2–C2 are in that
state; A1–B1 are anchored. The DTZ is cumulative and names an A2–B1 production repertoire, so its
A2 entries remain in scope at B1. It is not a claim to describe every possible B1 grammar syllabus.
`data/strukturenlisten/README.md` names the missing higher-level documents and their availability.

Today: **A1 93/93 · A2 279/300 · B1 143/164** claimed. The 21-entry DTZ tail is named in
[`a1-b1-completeness-audit.md`](../curriculum/a1-b1-completeness-audit.md); `mod-wie` is the first
entry removed after exact existing teaching evidence was verified. Per [ADR 0015](../adrs/0015-provable-course-completeness.md),
external alignment, internal coverage, teaching depth and learner mastery are never merged into one
percentage.

## Practice depth — `bun scripts/grammar-depth.ts`

Coverage is binary by design: one `practice`/`drill` item marks a point taught. That is the right
bar for "is this structure in the course" and the wrong bar for the question it kept being read as
answering.

```
bun scripts/grammar-depth.ts [A1|A2|B1] [--thin] [--by-point] [--no-probe]
```

Four numbers per focus tag, each answering a different question the lesson cycle asks: **teaching**
items at all · **production** items (does the learner build German or pick it) · distinct practice
**files** (a tag in one file is met once and never interleaved) · **probe** items (is it ever
re-asked after an interval). Counting rules are `drilledFocusTags`': practice and drill only,
`preview: true` excluded.

**No threshold, deliberately** — the `comprehensibility.ts` discipline. Nobody has validated a
correct number of items per confusion, and inventing one would put a fabricated bar into a repo
built on earned figures; the report prints each level's median and every row is read against that.
`tests/grammar-depth.test.ts` is a **ratchet on measured reality**: today's medians and tail counts,
free to move only the right way. A failure means practice was removed, or a tag was added without
the practice to pay for it.

Today: median teaching items per confusion **A1 13 · A2 8 · B1 4**, production **9 · 6 · 3**, and
10 of 35 B1 tags in exactly one practice file against 4 of 31 at A1. No productive A1 or A2
inventory point lacks a delayed probe family; the remaining no-probe rows printed by the A2 report
are auxiliary focus tags, not uncovered inventory structures.

## Input load — `bun scripts/comprehensibility.ts`

The third instrument, and the one that measures **nothing published**. Perceived difficulty varies
a lot between topics (owner, 2026-08-04) and nothing saw it: `prose-shape` measures the explanation
halves, and CEFR discipline ("an A2 article must be readable by an A2 learner") binds only at
authoring time, by judgement, one file at a time. This measures the other side — the **German** the
learner has to get through — against what the spine says they have met by then. Backlog P24-9(a).

```
bun scripts/comprehensibility.ts b1/geld-vertraege   # one topic, in detail
bun scripts/comprehensibility.ts --rank B1           # one level, ranked
bun scripts/comprehensibility.ts --rank              # all three levels
```

**It is read-only and has no threshold.** No validator hook, no test asserting a number, nothing on
`/about`. There is deliberately no "acceptable" load: the report prints each level's **median** under
its table, computed from the corpus, and every row is read against that. Outliers are the product.

### What it counts

A topic's spine position is its index in `content/atlas.yaml`'s `units:` order, levels concatenated
A1 → A2 → B1. For the topic at position P the learner is assumed to know (1) the German of every
topic at position < P — articles with **all four** halves stripped, readings with each
`[[de::en::ru]]` gloss reduced to its German half, and `practice`/`drill` item German; (2) every
form in every deck attached at position **≤ P**, own decks included, since a word the topic's own
deck teaches is support rather than load; and (3) every headword of the Wortliste of each level
≤ the topic's. A token of the topic's own German that is in none of the three, and survives a light
inflection fold, is **ahead of the learner**. The full definition, and why `<De>` is stripped here
while `taughtSurface()` strips only `<En>`/`<Ru>`, is the module doc of `packages/content/src/comprehensibility.ts`.

The detailed report lists the distinct ahead tokens per section, most frequent first. That list is
the actionable half — it names the words to gloss, to move into the deck, or to cut.

### What the corpus says today

From `bun scripts/comprehensibility.ts --rank`, level medians:

| level | ahead/100 (article+reading) | mean words/sentence | Nebensatz/sentence | max terminology/100 |
| --- | ---: | ---: | ---: | ---: |
| A1 | 6.7 | 7.3 | 0.03 | 2.87 |
| A2 | 3.9 | 8.4 | 0.10 | 5.30 |
| B1 | 3.9 | 11.4 | 0.21 | 5.47 |

Sentence length and subordination rise monotonically across the three levels and load does not,
which is the shape a spine should have: later topics are syntactically harder and lexically no more
unfamiliar, because the known set grows with them. The A1 median is the highest of the three for
the same reason — the first topics have almost no prior surface to be measured against.

### What the numbers cannot support

The method is a heuristic and deliberately a generous one, so it **under**-reports load rather than
inventing it. Four classes of false positive are known and none of them is worth chasing until the
ranking has been calibrated against a felt-difficulty list:

- **Proper names.** `Anna`, `Hamburg`, `Lindenweg`, `GmbH` are ahead of the learner by every rule
  here and are no burden at all. They dominate some early A1 readings — five of the twelve distinct
  ahead tokens in `akkusativ`'s reading are the names in it.
- **Ablaut in a lexical strong verb.** The manifests list `geben` and `treffen`; a text shows `gibt`
  and `trifft`, and the fold reaches umlaut (`fährt` → `fahren`) but not vowel change. The closed
  class — the articles, the pronouns, and the finite forms of the auxiliaries and modals — is
  handled by `FUNCTION_WORDS`, which exists because without it the first topic on the spine read
  `ist` and `im` as words ahead of the learner.
- **A glossed reading word still counts.** The gloss is the author's mitigation, so the reading
  column partly measures how much was glossed. `geld-vertraege`'s reading reports 8.7 ahead per 100,
  and four of its eight distinct ahead tokens carry a `[[…]]` gloss.
- **Per-language glosses inside a German table.** `| Person | sein (to be / быть / бути) |` puts
  English into the German surface. Cyrillic falls out in normalization; English does not.

A small article makes all of this louder: article surfaces run from 47 to 668 tokens
(`bun scripts/comprehensibility.ts --rank` prints the shares, the token counts are in the detailed
report), so one ahead token in an A1 article moves its share by two points. Compare the pooled
`all` column, not `artic` alone, when the article is short.
