# Article prose — how an explanation is shaped

The article is the **model stage** of the lesson cycle: the place where a learner meets the rule
with maximal support, before any practice asks anything back. That job is done by *shape* as much
as by content, and shape is the thing that drifted.

Lifted out of [`CLAUDE.md`](../../CLAUDE.md), which keeps the imperatives (`### subsections`, the
table beside its prose, the 120-word ceiling, the drilled-or-`Feinheiten` rule) and points here for
the measurement behind them and what each one guards.

## What was measured

Command behind every figure below: `bun scripts/prose-shape.ts content/topics/<level>`
(`--worst` for one line per file). Counting method is stated at the top of the script.

| Level | En words per paragraph (mean of file means) | Longest paragraph, worst file | Sentences over 30 words |
| --- | ---: | ---: | ---: |
| A1 | 21.8 | 107 | 4% |
| A2 | 36.4 | 107 | 6% |
| B1, as authored (2026-07-27) | 66.7 | **397** | 19% |
| B1, after this pass (2026-07-28) | 51.7 | 120 | 19% |

Per B1 file, longest paragraph, before → after: `erfahrungen-erzaehlen` 97 → 97 ·
`leben-veraendern` 129 → 120 · `gesundheit-wohlbefinden` 199 → 115 · `meinung-medien` 260 → 113 ·
`arbeit-bewerbung` **397 → 107**. Every B1 article gained five or six `### subsections`.

The long-sentence share did **not** move, and that is the honest reading of what this pass did and
did not do: it re-packaged the prose without rewriting its sentences. Sentence-level surgery
happened only where a sentence duplicated the table beside it.

**The structural cause was one missing convention.** Nine A2 topics split `## Erklärung` into
`### German subsections`; all five B1 topics that existed at the time used none. (Every B1 article
carries them now — the five this pass segmented, and B1.6/B1.7 authored with the convention.) `a2/nebensaetze-plaene` renders as
*heading → table → ~50-word block → heading → table → ~60-word block*. `b1/arbeit-bewerbung`
rendered as *one 397-word block, then its two tables 130 lines later*. The bolded lead sentence was
doing a heading's job without being one — so it could not be navigated to, could not stay visible
across the four language modes (a heading is German and lives outside the halves), and could not
put a table next to the prose explaining it.

**Total length was never the defect, and cutting is not the fix.** B1 `<En>` halves average 1516
words against A2's 1050 (1.44×) while carrying 2.1× the grammar — 2.9 manifest points per
grammar-bearing B1 unit against 1.36 per A2 topic (`bun scripts/grammar-coverage.ts A2|B1`, unit
counts from the frozen contract in [`curriculum-a2-b1.md`](../curriculum/a2-b1.md)). Per grammar point
the B1 articles were already **denser** than A2's. Volume follows the contract; packaging does not.
A revision that trimmed the elaboration and the L1 contrast would trade a shape defect for a
teaching one.

## The four levers, labelled honestly

Full catalog and evidence labels: the `learning-science` skill, §17 in
`.agents/skills/learning-science/references/learning-principles.md`.

- **Segmenting and signaling** — *moderate*. Headings and structural cues improve organized recall
  and let a reader find a rule again (Mayer; Lorch & Lorch 1996; Meyer's structure strategy). The
  397-word block held roughly nine idea units under a single signal.
- **Coherence / seductive details** — *moderate–strong*. Interesting-but-tangential material
  measurably depresses learning and transfer (Harp & Mayer 1998; Rey 2012 meta-analysis, g ≈ −0.3).
  In `arbeit-bewerbung` the n-declension tail (`der Löwe`, `der Planet`, the `des Namens` genitive,
  the `Herr` plural) was drilled by **zero** items and served none of the unit's four outcomes.
- **Cohesion × prior knowledge** — *moderate*, and the interaction is what decides it here.
  Inference-demanding, low-cohesion text helps *high*-knowledge readers and hurts *low*-knowledge
  ones (McNamara, Kintsch, Songer & Kintsch 1996). A learner meeting n-Deklination for the first
  time is the low-knowledge reader by construction, so explicit connectives, one referent per
  pronoun and repeated key terms beat elegant variation.
- **Readability formulas** — **not a target.** Flesch–Kincaid and its relatives are validated as
  correlational indices; writing *to* them strips the cohesion the reader needs (Davison & Kantor
  1982). The word cap here is a tripwire that refuses a wall. Nothing rewards shorter prose.

## The rules

1. **`## Erklärung` splits into `### German subsections`, one per named confusion.** The heading is
   German and sits **outside** `<Bilingual>`, so it is visible under `en`, `ru`, `uk` and `de`. A
   unit that owns three grammar points has at least three, plus the integrating section.
2. **A subsection keeps its table with its prose.** Never a table stranded behind another
   subsection's prose — the reader should not hold a paradigm in memory across 130 lines.
3. **No paragraph over 120 words in any explanation half; target ≤ 90.** One paragraph, one claim
   plus its evidence. Validator-enforced (`src/lib/prose-shape.ts`); the ceiling is corpus-derived,
   not chosen — when it was set no A1 or A2 paragraph exceeded 107 and no discovery piece exceeded
   113, so 120 refuses the wall without touching a shipped paragraph.
4. **A fact in `## Erklärung` is drilled by an item or serves an outcome.** Otherwise it belongs in
   a compact `### Feinheiten` table — kept, because the reference value is real, but off the path
   the learner must walk to reach the rule.
5. **A list of more than three members is a table or a bullet list, never a semicolon chain inside
   a sentence** — and prose never restates what the table beside it already enumerates.
6. **No aside nested between a subject and its finite verb.** The qualification gets its own
   sentence. This is where B1's long sentences came from, not from vocabulary.
7. **`## Kurz gesagt` is an advance organizer**: ≤ ~100 words per half, ≤ 5 sentences — the schema
   the article will fill in, not a summary of its details.

Rule 7 replaced an older CLAUDE.md line demanding "2–3 sentences", which **every article since A1
broke** (EN halves ran 98–167 words). A rule the whole corpus disagrees with is an instrument
defect, not 38 content defects; the ceiling in rule 3 now does the enforcing.

Rule 7 is a **target, not a gate**, and it is not met everywhere. Median `Kurz gesagt` across the
37 topics is 91 words, but `a2/freunde-feste` (143) and `a2/arbeit-beruf` (144) exceed the target
and were **not** revised in the pass that wrote this rule — they are a backlog line, not a silent
claim of compliance. The two B1 files this pass touched were brought to it (117 → 107, 158 → 113).

## The instrument

- `bun scripts/prose-shape.ts <file.mdx|directory> [--worst]` — the reporter. Paragraph count,
  mean, p90, max and the long-sentence share, per file per half.
- `bun run validate` — hard-fails any paragraph over the cap, in topics and discovery pieces alike
  (no topics-warn/discovery-fail split: a paragraph too big to read is the same defect wherever it
  was authored).
- `tests/prose-shape.test.ts` — the splitter's unit tests plus a corpus ratchet, so the rule holds
  for anyone who runs only `bun test`.

Two things the instrument deliberately cannot see, which stay with the author: whether a
subsection's heading names the confusion it teaches, and whether a stated fact is ever drilled.
A word count cannot reach either.

**Watched fail before it was trusted:** the cap fired on 45 paragraphs across the four B1 files
that exceeded it, and the unit tests pin the boundary at 120 passing / 121 failing. The
long-sentence statistic was wrong on first writing — its split lookahead was `[A-ZÄÖÜ]`, which
never matches a Cyrillic capital, so the RU and UK halves reported one sentence each and a
long-sentence share of 56–69% where EN read 10%. A statistic that works for one of four halves is
worse than none.
