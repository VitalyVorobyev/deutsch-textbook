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

The long-sentence share did **not** move, and that is the honest reading of what this pass did and
did not do: it re-packaged the prose without rewriting its sentences. Sentence-level surgery
happened only where a sentence duplicated the table beside it.

**The structural cause was one missing convention.** Nine A2 topics split `## Erklärung` into
`### German subsections`; all five B1 topics that existed at the time used none — every B1 article
carries them now. `a2/nebensaetze-plaene` renders as
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

## The native-language review loop

Two skills diagnose and repair explanation prose as *native-language text* — the quality
dimension no validator can reach, because a calqued sentence is well-formed YAML, valid MDX and
perfect orthography all at once:

- `.claude/skills/textbook-text-reviewer/` — diagnosis only: findings with severity, learner
  impact and a revision direction. Never rewrites.
- `.claude/skills/textbook-text-editor/` — repair against the reviewer's findings.
- `.claude/skills/textbook-quality-rubric.md` — the shared rubric both apply.

**The defect class it exists for is the calque.** A RU/UK half drafted while the EN half is in
view inherits its rhetoric sentence-for-sentence, and figures that work in English — antithesis
("precise where a complaint is loud"), a unit number as teaching agent ("B1.7 taught"), "three
moves do it" — garden-path or collapse in Russian and Ukrainian. First live case:
`b1/digitales-leben`, learner-reported 2026-08-05. The tell was that RU and UK failed in the
*same three sentences*: both halves had been shaped by the EN template, which is exactly what
"independently authored from the German" exists to prevent.

**When to run it:**

1. **New unit authoring** — reviewer pass over the freshly drafted RU and UK halves, before the
   five-field semantics review. The two reviews answer different questions and neither replaces
   the other: this one never checks German facts against items, the semantics review never checks
   whether the Russian is Russian.
2. **A learner-reported language complaint** — this loop is the procedure, and the quoted
   sentences are confirmed member cases, not the full finding list.
3. **Not as a corpus-wide gate.** The scores are uncalibrated LLM judgements (the editor skill's
   own calibration warning); a blanket pass over shipped topics manufactures review rounds. Run it
   where a complaint, a spot-check or new authoring points.

**How to run it — the parts the skills cannot know about this repo:**

- Reviewer and editor are separate invocations, and the reviewer that verifies a revision is a
  fresh context — never the editor grading itself (the skill's own workflow; also this repo's
  review-round doctrine). Subagents run one at a time, sequentially.
- **The factual specification is the German material** — the `<De>` half, the example sentences,
  the tables. **Never hand the sibling half over as the reference**: halves are independent by
  design and may deliberately diverge, so "matches the EN" is not meaning preservation — here it
  is the defect under review. Give the EN half as context labelled as suspect, or not at all.
- The editor's revision keeps the repo constraints: ≤ 120-word paragraphs, divergence-by-design
  (an RU repair does not obligate the EN half), German terms glossed on first use, the language
  hygiene rules (`bun run validate` enforces the character-set half of them). One hygiene rule the
  validator cannot reach: the Russian conjunction **и** inside a `<Uk>` half. Ukrainian has и as a
  letter, so the character-set check passes; grep for it by hand. (Clean across all 46 topics on
  2026-08-06.)
- **When the German and the non-German halves disagree about a fact of German, the German is
  right — and the EN half is often where the error entered.** `b1/kultur-freizeit` said the ending
  is the one *the noun would take*, against a German that said *die das Nomen ohnehin verlangt*
  (requires): EN, RU and UK all carried it, the `<De>` half did not, and the same file contradicted
  itself 200 lines later. So a review scoped to RU/UK may legitimately have to fix `<En>`, `<De>`
  or an exercise `explain` — a false claim is one defect wherever it was copied, and grepping it to
  its other instances is in scope (`CLAUDE.md`, "Fix the finding, not the neighbourhood"). Authorise
  that exception explicitly, and touch nothing else in those halves. An `explain`-only edit does not
  bump `revision`.
- Stop after two edit cycles and report what still fails (skill rule; same doctrine as "review
  rounds end when a round finds nothing material").
- **The 0–4 scores never leave the review.** Status (PASS/REVISE/REJECT) plus findings are the
  deliverable; a score is an uncalibrated judgement with no command behind it, and quoting one in
  a PR or doc violates the claims discipline in `CLAUDE.md`.
