# Article prose — how an explanation is shaped

The article is the **model stage** of the lesson cycle: the place where a learner meets the rule
with maximal support, before any practice asks anything back. That job is done by *shape* as much
as by content. [`CLAUDE.md`](../../CLAUDE.md) keeps the imperatives; this is what each one guards.

## Why shape, not length

**Total length is not the defect, and cutting is not the fix.** B1 articles are longer than A2's
because each B1 unit owns more grammar; per grammar point they are no less dense. A revision that
trims the elaboration and the L1 contrast trades a shape defect for a teaching one. The defect is
packaging: one long block holding many idea units under a single signal, with its tables far from
the prose that explains them.

The evidence, labelled by strength (full catalogue: the `learning-science` skill, §17 in
`.claude/skills/learning-science/references/learning-principles.md`):

- **Segmenting and signalling** — *moderate*. Headings and structural cues improve organised recall
  and let a reader find a rule again (Mayer; Lorch & Lorch 1996; Meyer's structure strategy).
- **Coherence / seductive details** — *moderate–strong*. Interesting but tangential material
  measurably depresses learning and transfer (Harp & Mayer 1998; Rey 2012 meta-analysis,
  g ≈ −0.3). A fact no item drills and no outcome needs is such a detail.
- **Cohesion × prior knowledge** — *moderate*. Low-cohesion text helps high-knowledge readers and
  hurts low-knowledge ones (McNamara, Kintsch, Songer & Kintsch 1996). A learner meeting a structure
  for the first time is the low-knowledge reader, so explicit connectives, one referent per pronoun
  and repeated key terms beat elegant variation.
- **Readability formulas** — **not a target.** They are correlational indices, and writing *to*
  them strips the cohesion the reader needs (Davison & Kantor 1982). The word cap refuses a wall;
  nothing rewards shorter prose.

## The rules

1. **`## Erklärung` splits into `### German subsections`, one per named confusion.** The heading is
   German and sits **outside** `<Bilingual>`, so it is visible under `en`, `ru`, `uk` and `de`. A
   unit that owns three grammar points has at least three, plus the integrating section. A bolded
   lead sentence is not a heading: it cannot be navigated to and cannot carry a table with it.
2. **A subsection keeps its table with its prose.** The reader should never hold a paradigm in
   memory across another subsection.
3. **No paragraph over 120 words in any explanation half; target ≤ 90.** One paragraph, one claim
   plus its evidence. Validator-enforced (`packages/content/src/prose-shape.ts`). The ceiling is
   corpus-derived — 120 refused the wall without touching a single A1 or A2 paragraph.
4. **A fact in `## Erklärung` is drilled by an item or serves an outcome.** Otherwise it belongs in
   a compact `### Feinheiten` table: kept for its reference value, off the path to the rule.
5. **A list of more than three members is a table or a bullet list, never a semicolon chain** — and
   prose never restates what the table beside it already enumerates.
6. **No aside nested between a subject and its finite verb.** The qualification gets its own
   sentence.
7. **`## Kurz gesagt` is an advance organizer**: ≤ ~100 words per half, ≤ 5 sentences — the schema
   the article will fill in, not a summary of its details. A **target, not a gate**; the files that
   exceed it are a backlog line (P18-2).

## Links back

An article that says *Auf A2 stand der Komparativ nach ist* sends the learner looking for that
page, and without a link they either give up or lose their place. Such a back-reference is a
`<Siehe>` link, in the German body where B1 has one, so it is visible in every Lernsprache:

```mdx
<Siehe to="a2/einkaufen-reklamation#ungleich-gleich-und-am-höchsten">Das A2-Kapitel zum Einkaufen</Siehe>
```

`to` is `<level>/<topic-id>`, optionally `#` and the heading's id (its text lowercased, punctuation
dropped, spaces as hyphens — `headingSlug` in `packages/content/src/siehe.ts`), or
`referenz/<page>`. `bun run validate` fails a target topic, heading or Referenz page that does not
exist, so a renamed heading cannot strand a link. Following a link leaves one "Zurück zu …" pill on
the target page, and the pill returns to the link itself, opening any fold around it
(`src/lib/siehe.ts`). Link where the sentence points back; a topic's full set of relations is
already the derived *Siehe auch* footer.

## The instrument

- `bun scripts/prose-shape.ts <file.mdx|directory> [--worst]` — paragraph count, mean, p90, max and
  the long-sentence share, per file per half. Counting method at the top of the script.
- `bun run validate` — hard-fails any paragraph over the cap, in topics and discovery pieces alike.
- `tests/prose-shape.test.ts` — the splitter's unit tests (120 passes, 121 fails) and a corpus
  ratchet.

The instrument cannot see whether a heading names the confusion it teaches, or whether a stated
fact is ever drilled. Those stay with the author. Its sentence splitter must recognise Cyrillic
capitals, or the RU and UK halves read as one sentence each.

## The native-language review loop

Two skills diagnose and repair explanation prose as *native-language text* — the dimension no
validator reaches, because a calqued sentence is well-formed YAML, valid MDX and perfect
orthography at once:

- `.claude/skills/textbook-text-reviewer/` — diagnosis only: findings with severity, learner impact
  and a revision direction. Never rewrites.
- `.claude/skills/textbook-text-editor/` — repair against the reviewer's findings.
- `.claude/skills/textbook-text-reviewer/references/rubric.md` — the shared rubric both apply.

**The defect class is the calque.** A RU/UK half drafted while the EN half is in view inherits its
rhetoric sentence-for-sentence, and figures that work in English — antithesis, a unit number as a
teaching agent, "three moves do it" — garden-path or collapse in Russian and Ukrainian. The tell is
RU and UK failing in the *same* sentences: both were shaped by the EN template, which is exactly
what "independently authored from the German" exists to prevent.

**When to run it:**

1. **New unit authoring** — over the freshly drafted RU and UK halves, before the five-field
   semantics review. Neither replaces the other: this one never checks German facts against items,
   the semantics review never checks whether the Russian is Russian.
2. **A learner-reported language complaint** — the quoted sentences are confirmed members of the
   finding, not the whole of it.
3. **A topic-quality pass** on a unit still in the calque queue (backlog C6-1).
4. **Not as a corpus-wide gate.** The scores are uncalibrated judgements; a blanket pass
   manufactures review rounds.

**How to run it — what the skills cannot know about this repo:**

- Reviewer and editor are separate invocations, and the reviewer that verifies a revision is a fresh
  context, never the editor grading itself. Subagents run one at a time.
- **The factual specification is the German material** — the `<De>` half (in a German-first B1 article, the body), the example sentences,
  the tables. **Never hand the sibling half over as the reference**: halves are independent by
  design and may diverge, so "matches the EN" is not meaning preservation. Give the EN half as
  context labelled as suspect, or not at all.
- The editor keeps the repo constraints: ≤ 120-word paragraphs, divergence by design (an RU repair
  does not obligate the EN half), German terms glossed on first use, the language hygiene rules. One
  the validator cannot reach: the Russian conjunction **и** inside a `<Uk>` half — Ukrainian has и
  as a letter, so grep for it by hand.
- **When the German and a non-German half disagree about a fact of German, the German is right —
  and the EN half is often where the error entered.** A review scoped to RU/UK may therefore have to
  fix `<En>`, `<De>` or an exercise `explain`: a false claim is one defect wherever it was copied,
  and grepping it to its other instances is in scope. Authorise that exception explicitly and touch
  nothing else in those halves. An `explain`-only edit does not bump `revision`.
- Stop after two edit cycles and report what still fails.
- **The 0–4 scores never leave the review.** Status (PASS/REVISE/REJECT) plus findings are the
  deliverable; a score has no command behind it.
