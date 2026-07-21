# P12–P14 — the instrument reviews, July 2026

This archive preserves the rationale, the measurements and the stable backlog IDs for the items
closed by the **2026-07-20 instrument review** and the **2026-07-21 pre-B1 review**, plus the
placement-test entry-surface fix. It is historical, not an execution queue. Current direction is in
[../roadmap.md](../roadmap.md); active tasks — including the halves of these items that are still
open — are in [../backlog.md](../backlog.md).

The common thread is worth stating once: every item here is a case where the *instrument* was
wrong, not the content. A probe format that could not attribute its own result, an arming rule that
re-dated a cohort, a pretest that fed weakness evidence, a gloss field that printed the answer, an
input bar that graded keyboard access. Each was found by measuring rather than by reading, and each
fix was watched failing before it was trusted.

## The 2026-07-20 instrument review

### P12-1 · The probe channel is a `translate` monoculture — **A1 + 16 A2 topics done 2026-07-20**, 4 topics blocked

All 102 items across all 34 families are `type: translate`. So the delayed instrument measures one
skill of five, and measures it through the format with the widest failure surface: a probe item asks
for eight or so independent correctness decisions, of which the graded competence is one. That is
why 16 of 39 attempts land in *retained the target but missed elsewhere*, and why 18 are logged with
no attribution at all.

Format cannot vary *inside* a family — `bun run validate` requires one item type across variants,
and correctly so: one variant per interval means a changing format is confounded with the delay.
Diversification therefore means **a second family per topic with a different uniform type**. `cloze`
is the right one: it is always attributed (the gap *is* the target token), so the "retained but
missed elsewhere" bucket disappears. Use `table` for paradigm competences. Not `mc` (the learner
scores 93% — a flat curve carries no information) and not `order` (saturates).

**Shipped for A1: 8 new `cloze` families, 24 items.** The acceptance criterion written here
originally — *every A1 competence probed by two families of different type* — was revised against
the data, for two reasons found while authoring:

**A `cloze` gap grades a form, never a position.** The slot is given, so the learner cannot put the
word anywhere else. `verbzweit` and `modal-satzklammer` therefore *cannot* have a cloze twin, and
the placement competences are stuck with `translate` until some other format is found. Their topics
got a second *form* competence instead.

**Zero delayed evidence is a bigger hole than one-format evidence.** Twelve A1 competences were
taught and never probed at all, several of them heavily (`verb-endungen` ×20 items, `kein-nicht`
×12, `akkusativ-praepositionen` ×8), while `akkusativ-artikel` already carried three families. So
five of the eight new families probe a competence with **no** delayed evidence today
(`verb-endungen`, `akkusativ-praepositionen`, `modal-konjugation`, `kopula-sein`, `kein-nicht`) and
three are second-format twins of singleton competences (`um-am-zeit`, `possessivartikel`,
`dativ-praepositionen`).

Two A1 topics are deliberately excluded, each for a measured reason:

- **`erste-schritte`** cannot carry a focus tag at all. It opens the spine, so every registered tag
  is introduced later and the validator rejects it as curriculum-order leakage. Its existing family
  is the untagged one the retention gate excludes by name — and a second untagged family would add
  attempts that still cannot fail their target. The instrument gap is real and is *not* closable by
  authoring more probes.
- **`essen-trinken`** is frozen until after the cohort read. Its existing family probes
  `essen-bestellen`, an outcome only 2 practice items declare, so switching the topic to item-level
  arming moves its `armedAt` by **2.34 days** and re-labels probes already taken (4d → 1d, 8d → 6d).
  That is exactly the corruption P12-2 exists to prevent. Revisit after 2026-08-02, when the
  re-dating is a correction rather than a mid-flight cohort loss.

**Verified after shipping:** of the 34 pre-existing families, exactly one moved — `probe-alltag-zeit`
by 39 seconds, leaving both its reported intervals (3d, 8d) unchanged. All 8 new families arm from
history. Marginal probe debt is a flat **+8** at every horizon and never compounds, because
`dueProbe` serves at most one probe per family — so the ceiling is set by family count, not by
interval count, and the existing backlog already dominates it.

**The audit now reports retention split by response format.** A cloze probe hands over the sentence
frame and a translate probe does not, so pooling them silently would let the percentage rise when
the easier format arrives and read as improved retention. The pooled figure stays the headline; the
split is the check on it.

**A2 is mostly NOT blocked — measured 2026-07-20, correcting a blanket deferral written earlier.**
"Wait for the cohort read" was assumed rather than checked. What actually blocks a second family is
the P12-2 hazard: adding one flips the topic to item-level arming, which can move the existing
family's `armedAt` and silently re-date probes already taken.

**Re-measured before authoring (the figures below supersede an earlier "16 of 19" note).** The count
was wrong twice over: there are **20** single-family A2 topics, not 19, and **17** are safe, not 16.
The instrument was also wrong — an `armedAt` shift of under a day was being read as safe, but
`probeResults` reports `Math.round((ts - armed) / DAY)`, so what actually matters is whether a probe
*already taken* changes its rounded day label. Measured that way, `dativ` shifts 0.29 d and does not
cross a boundary (safe), while the three genuinely blocked topics are worse than recorded:

| Family | Probes at risk | Effect of a second family |
| --- | ---: | --- |
| `probe-perfekt-haben-sein` | 2 | 4d and 9d → **unlabelled** (family becomes unarmed) |
| `probe-alltag-tagesablauf` | 2 | 3d and 7d → **unlabelled** (family becomes unarmed) |
| `probe-modalverben` | 2 | 4d → 3d, 8d → 7d |

**Why two go unarmed, which is a finding in its own right.** `probe-perfekt-haben-sein` probes the
outcome `perfekt-hilfsverb`, and the only practice set declaring that outcome — `a2/perfekt-produktion`
— has **0 attempts**. Its retention clock is currently started by 56 attempts on
`a2/perfekt-haben-sein` and `a2/drill-haben-sein`, whose items all declare
`perfekt-vergangenheit-erzaehlen` instead. `alltag-tagesablauf` has the same shape
(`alltag-zeitpraepositionen` probed, `alltag-produktion` unattempted). So those two families have
been measuring retention of a competence armed by practice of a *sibling* outcome — set-level
arming's documented failure mode, live. The items that carry `focus: haben-sein` are simply
under-tagged and should declare `perfekt-hilfsverb` as well. **Not fixed here**: changing an item's
`outcomes` requires a `revision` bump, which stops those 56 attempts being re-graded and deletes
data points from the retention reading before the gate. Fix after 2026-08-02, together with the
three blocked families.

**Shipped 2026-07-20: 16 of the 17 safe topics, 48 cloze items.** `lernen-verstehen` is the
seventeenth and is excluded for a measured reason rather than deferred: it drills only three tags
besides its probed one, two of which (`nebensatz-verbende`, `verbzweit`) are POSITION rules that no
cloze can grade, and the third (`du-sie`) has a single practice item. Its own probed competence,
`indirekte-frage`, is itself a position rule, so it cannot have a cloze twin either. Neither a second
competence nor a second format is available; authoring more probes cannot close it.

Twelve families probe a competence the topic drills but nothing checked after a delay; four are
second-format twins or cross-topic reinforcements (`dativ-praepositionen` now on three topics,
`du-sie` on two, `haben-sein` on two, `relativpronomen-kasus` as a cloze twin) — deliberate, because
one family caps at three attempts ever and the retention gate's readability floor is n ≥ 3.

**Verified after shipping**, by building the families from the shipped content twice, with and
without the new files, and diffing the day label `probeResults` gives every probe already taken:
**zero changed** across all 23 families with attempts.

What is still open — the three blocked A2 topics, `essen-trinken`, and the outcome under-tagging —
is carried in [../backlog.md](../backlog.md).

### P12-2 · Multi-family arming discards the older family's cohort — **done 2026-07-20**

`probeFamilies` (`src/lib/probes.ts`) gives a topic owning more than one family `armingSetIds: []`,
so it arms by outcome alone. The comment justifies this with *"a multi-family topic is new by
construction, so every attempt on it names the outcomes"* — true of the two that exist today, false
in general: **552 of 1221 attempts in the learner's log carry no `outcomes`**.

Simulated against the real log by adding a second family to `akkusativ`, an old A1 topic with
history. The damage is not that the new family fails to arm — it is that **the existing family is
silently re-dated**: `armedAt` moves from 2026-07-10 to 2026-07-13, because with the set-level
fallback gone only outcome-bearing attempts can arm, and the earliest of those is three days later.
Both families then report the same arming date, off whichever competence happened to be practised
first. `probeResults` derives its elapsed interval from `armedAt`, so every probe already taken is
retroactively re-labelled:

| variant | taken | real interval | reported after the shift |
| --- | --- | --- | --- |
| `variant-a` | 2026-07-15 | 4 days | **1 day** |
| `variant-b` | 2026-07-19 | 9 days | 6 days |

A four-day retention result filed as a one-day result is the retention curve reading as *better*
than it is, from a change that logs nothing and touches no content.

**The planned fix would not have worked, and the reason is worth keeping.** It was to set
`armingSetIds` to the topic's `practice`/`drill` sets holding at least one item declaring one of
*this family's* outcomes. Measured against the actual content, **every practice set of both
multi-family topics contains items for both families' outcomes** — `a2/man-und-besitz` mixes 3
Genitiv and 6 *man* items; `a2/verbindungen-folgen` mixes 5 and 4. That is deliberate interleaving
and good pedagogy, but it means "which sets teach this family" resolves to the same list for both
families. The set-level fix would have reproduced the bug it was written to remove.

**Shipped instead: item-level arming.** A new optional `armingItemKeys` (`setId::itemId`) holds the
practice items whose own declared outcomes match the family. The attempt log carries `itemId`, so
the question is answerable without the `outcomes` field most historical attempts lack. Single-family
topics keep the coarser `armingSetIds` untouched — they have no ambiguity to resolve, and whole-set
arming stays the more inclusive fallback for a legacy attempt whose item has since been renamed.

- Verified: all **34** families' `armedAt` timestamps unchanged across the fix (0 changed), so no
  cohort was discarded; the four multi-family families now arm from disjoint item sets (10/5 and
  8/7 keys). The regression test fails against the pre-fix code with `armedAt` returning `undefined`
  where the cohort should arm.

### P12-3 · Smaller findings — **four closed 2026-07-20**

- ~~**The B1 grammar inventory is a 1-point stub.**~~ **Done 2026-07-20.** Authored to 31 points against the Goethe B1 Prüfungsziele, cross-checked against Schritte plus B1 and Menschen B1. `bun scripts/grammar-coverage.ts B1` now reports **0/31**, which is the honest figure and the point of the exercise: the A2 story is that a level with no manifest cannot notice it is at 67%. Tags are proposed and unregistered, so every point reports `missing` until the unit teaching it ships. Ratcheted by `tests/grammar-coverage.test.ts` (`covered === 0`), the mirror of the A2 test. Über still publishes no B1 grammar figure and should not: B1 has no content, and the page's claim is "not started".
- ~~**Pretest attempts were weakness evidence.**~~ **Done 2026-07-20**, and this turned out to be the sharp end of the mc finding rather than a separate one. `focusStats` keys only by `focus`, so it saw all 91 focus-tagged pretest attempts — and since every pretest item is `mc`, the format the learner scores ~93% on, they diluted the denominators of a signal built to find production confusion. Measured: **27 tags change error rate**, and the weak set swaps a member — `nebensatz-vorfeld` was masked below the bar and `konjunktionaladverb-inversion` pushed above it. Both directions steer training and drill authoring wrongly. `isPretestAttempt` now excludes them in `focusStats` and in the audit's `focusSignals`, and the `-pretest` suffix is validator-enforced both ways because an attempt records no role.
- ~~**Format saturation: `order` has stopped discriminating.**~~ **Done 2026-07-20.** Capped at **2 per set**, validator-enforced, per *set* because the topic-level caps cannot see one set that is mostly `order` — a sibling set's translate items dilute the ratio. Four sets were over; five items converted to `translate` in place, ids kept (so `pathDone` is untouched) with `revision: 2`. The worst was `a2/trennbare-verben` at 4 of 18 while `trennbar-wortstellung` sat among the worst persistent weak focuses: a quarter of the practice for a rule the learner was failing handed them every token.
- ~~**All 96 pretest items are `mc`.**~~ **Done 2026-07-20.** The first item of every pretest was converted from `mc` to `cloze`, so each pretest is now one production item + two recognition items. The measured motive: **94% of 100 pretest attempts were correct and 22 of 26 attempted pretests scored a perfect 3/3** — an instrument billed as *diagnostic generation* was returning "you already know this" for a learner who scores ~93% on `mc`. Most prompts were already `___` gaps, so the conversion filled the blank and carried the reviewed `translation`/`explain` over verbatim; where the four options were what constrained the answer (a soft pronoun, a full-sentence choice), the cloze got German context to stay determinate (`Danke, Anna!` → `dir`; `Frau Berg` → `Ihnen`; `Ich habe eine Schwester.` → `meine`) or an inline `(lemma)` hint, following the determinate-gap rule. The 32 `revision` bumps are free here, not deferred: `isPretestAttempt` and the role allowlists keep pretests out of weakness, coverage, probe arming and training, so nothing re-grades their history. The same inertness is why each converted item keeps its topic's original `focus` tag even where a cloze grades an adjacent form rather than the tagged position (`konjunktionaladverb-inversion`, `trennbar-wortstellung`): the tag is documentary on a pretest, and matching the item's two `mc` siblings is worth more than a technically-truer tag that nothing reads. **Guarded:** `bun run validate` now rejects an all-`mc` pretest, and `contracts.test.ts` pins the same property, so the conversion cannot silently regress.

The fifth finding — flashcard direction asymmetry, a property of production recall rather than a
defect — stays in [../backlog.md](../backlog.md) so it is not re-filed as a bug.

### P12-5 · Two source files were invisible to grep — `done` 2026-07-20

`scripts/progress-audit.ts` and `src/lib/grading-decisions.ts` each contained a **literal NUL byte**, used as a composite-map-key separator in a template literal. The idea is sound — no rendering can contain a NUL, so no pair of parts can collide — but emitting it as a raw byte rather than as an escape sequence makes `file` report the source as `data`, and grep, ripgrep and editor search then **skip the whole file silently**, returning "no matches" rather than an error.

It survives every existing gate: a NUL is valid TypeScript, so `bun test`, `astro check`, ESLint and the production build all pass. It cost half a dozen dead-end greps before `file` explained why searching `progress-audit.ts` for `focus` returned nothing. Both replaced with the escape — byte-identical keys at runtime, verified by diffing the full audit output — and `tests/source-hygiene.test.ts` now fails on any tracked source file containing one. That test caught itself on first run, which is the best evidence it works.

### P12-6 · Items that grade which word the author had in mind — **done 2026-07-21**

Found by the learner in a single session, twice, both times by writing correct German and being
told it was wrong. Two different item types, one defect: the item had exactly one right answer
where the language has two, and never said which it wanted.

**`translate` — the connector coin flip.** «потому что» is exactly as ambiguous as *because*:
*denn* (V2) and *weil* (verb-final) both render it. Six items accepted one and rejected the other
with nothing in the prompt or instruction to choose by. **The class hides behind curriculum
order** — `a2/arbeit-beruf` teaches *denn* and its article says *weil* "comes later", so on the
topic's own page the task genuinely is determinate. Mixed training then serves the item stripped
of that context, months after *weil* was taught. So the rule is now stated as: **an item is
determinate only if it is determinate when served alone.**

Resolved per item by asking whether the connector carries the tag, which split them 4–1:

| Item | focus | ruling |
| --- | --- | --- |
| `a2/arbeit-beruf:uebersetzen-denn-termin` | `verbzweit` | constrain — the tag *is* "verb stays in position 2 after denn" |
| `a2/checkpoint-a2:uebersetzen-weil-arbeiten` | `nebensatz-verbende` | constrain — the tag is defined as verb-final *in a weil-clause* |
| `a2/freunde-feste:uebersetzen-absage-weil` | `nebensatz-verbende` | constrain |
| `a2/aemter-dienstleistungen-produktion:uebersetzen-weil-anliegen` | `nebensatz-verbende` | constrain |
| `a2/aemter-dienstleistungen-produktion:uebersetzen-transfer-post` | `hoeflich-konjunktiv` | **accept** — the tag grades *würde gern* and does not care what follows |

The last row is the one that matters for the rule: constraining an item that did not need it is the
same defect pointed the other way, narrowing real production for nothing. A first pass constrained
all five and was corrected.

**`table` — the stub repeated.** `a2/verbindungen-folgen:table-drei-wortarten` shows
`Ich komme nicht, weil …` in a `given` cell and graded the next cell as `weil ich heute arbeite` —
so the sentence reads back as *weil weil ich heute arbeite*, while the instruction says "write the
second half only". All three rows. The learner's answers (`ich heute arbeite` / `ich arbeite heute` /
`komme ich nicht`) had **every word order the item drills correct** — verb-final after *weil*, V2
after *denn*, inversion after *deshalb* — and were logged `wrong` and attributed to
`konjunktionaladverb-inversion`, a tag P12-3 had just finished cleaning contamination off.

**Both are validator-enforced now**, and both rules were watched failing before being trusted.
The translate rule is keyed on a curated group list (`INTERCHANGEABLE_CONNECTORS`); `da` and the
concessive pair are deliberately excluded because the prompt distinguishes them. The table rule is
keyed on the **ellipsis**, which is what separates a continuation prompt from a paradigm table where
`die`/`die` is genuinely right — checked, it leaves all four paradigm tables alone. `contracts.test.ts`
pins both properties independently of the validator.

This closes a gap the validator's own comment names: *"whether an `instruction` really pins the
target … is a judgement about meaning — on the author."* True in general, but **whether the
instruction names the pinned connector is mechanical**, and that is the half now checked.

The frozen probe variant and the unretractable `table` attempt are carried in
[../backlog.md](../backlog.md).

## Level placement tests

### P13-2 · The entry test went unreachable the moment it was started — **first half done 2026-07-21**

Two defects were filed here as one, and the split matters because only one of them was a design
question. **Codex found the other on PR #89**, and the review was right that it is the more serious:
the first filing framed it as "the *A2* test has no link" and deferred the whole thing.

**Done — an interrupted test could not be resumed.** `FirstSteps` gated on
`attempts.length === 0`, and `logAttempt` fires **per item**, so answering a single placement
question hid the card that holds the only link to the test. Nothing was lost — `ExerciseSet`
saves answers through `resume.ts` and restores them on mount — so what was stranded was a
*route back to real state*, which is the worst shape this kind of bug takes: the learner sees
their work vanish and has no reason to believe it survived. The rule now lives in
`hasStartedLearning` (`src/lib/placement.ts`), pure and tested rather than inline in an effect,
which is how it stayed silent: **a placement attempt is not evidence of having started learning**,
and an *applied* placement ends the offer even though applying writes no attempt, card or `readAt`.
The card says *fortsetzen* rather than *starten* once answers exist. The regression test fails
against the pre-fix predicate.

- Lesson worth keeping: the deferral was written from the *symptom* that was noticed (A2 unreachable)
  rather than from the mechanism, and the mechanism covered a second, cheaper, more urgent case. A
  deferral is a claim; this one bundled a bug into a design question and inherited the design
  question's timeline.

The second half — offering level N+1's test — is a live item in [../backlog.md](../backlog.md).

## The 2026-07-21 pre-B1 review

### P14-1 · Vocabulary cards that print their own answer — **done 2026-07-21**

Found by the learner, in the app, by writing plausible German and being told it was wrong. The x-de
card for `gern` showed *“gladly; (verb + **gern**) to like doing something · охотно; (глагол +
**gern**) любить что-то делать”* and graded the typed answer `gern`. They typed `lieber` — reasoning
that a prompt already showing `gern` could not be asking for it — and `lieber`'s gloss carried the
identical defect.

**The instrument produced it, which is why the fix is not just eight edits.** `note` renders in the
Wortschatz table and **nowhere on a card**, so an author who wanted a construction hint where the
learner would actually meet it had only one place to put it: the gloss — which is the *question*
side of the production card. `CardDef.note` now carries it to the card back, beside `deDetail` and
the example, and `FlashcardSession` renders it after answering only.

**Measured across all 67 vocab files, both before and after.** 68 raw hits for “headword appears in
its own gloss”, and the naive rule is unusable: **~104 glosses legitimately contain their headword**
because the word *is* the translation (`Kiosk` → “kiosk”, `Post` → “post office”). What separates
the defects is *where* the word sits — every real leak put it in a metalinguistic aside
(a parenthetical, or an em-dash restatement) while a cognate has it in the running text. That rule
flags **22 gloss fields before the fix and 0 after**, catching no cognate in either direction, and is
enforced in `scripts/validate.ts` plus pinned independently in `contracts.test.ts`. Watched failing
before being trusted.

Three more entries were found by the same pass, all “the card marks correct German wrong”:

| Entry | Defect | Fix |
| --- | --- | --- |
| `lang` | glossed *“for a long time (variant of **lange**)”* — names the variant **and** rejects it | gloss cleaned, `accept: [lange]` |
| `vorn` | note says *“the variant vorne is just as common”*, `accept` was empty | `accept: [vorne]` |
| `Frühjahr` | prompt *“spring · весна”* is **character-identical to `Frühling`'s** in another deck, with mutually exclusive answers | gloss disambiguated to “the more official word”; the unmarked prompt stays with the unmarked word |

`gern` gained `accept: [gerne]` for the same reason — its own note calls `gerne` “an equally correct
variant”, and the grader was rejecting it.

**Verified:** all **3238** card ids unchanged across the change (`<deck>::<de>::<dir>` — glosses and
`accept` are not in the key), so no SRS history moved.

The unretractable card lapses are carried in [../backlog.md](../backlog.md).

### P14-2 · Answers the learner had no way to type — **done 2026-07-21**

Reported by the learner in the same session: *“I don't have proper e for the Café card.”* The insert
bar under the answer field offered `ä ö ü ß` and nothing else, so on a non-German layout the `é` was
unreachable and the card graded **keyboard access rather than German**. Nothing noticed, because the
entry is well-formed and correctly spelled and passes every other check.

Fixed as data plus instrument. `é` joins the bar — measured first: `Café` is the only accented
headword in the A1, A2 *and* B1 Wortlisten, and **no graded answer anywhere in the exercise corpus
contains an accent**, so one key covers the course through B1. `accept: ["das Cafe"]` takes the
accent-less spelling, because the é is a French diacritic on a loanword rather than German
orthography like ä/ö/ü/ß; the article stays required in both spellings, and the back still shows
`das Café` after every answer.

**The rule written to prevent the next `Café` found eleven live ones the moment it ran**, and that
half is more serious than the report. `checkAnswerIsTypeable` (`scripts/validate.ts`) asserts every
character of the *normalized* typed answer is reachable from the bar — normalized, so the two
`arbeit-beruf` phrase headwords ending in `…` are not falsely demanded. It failed immediately on
**Ä/Ö/Ü**, which the bar never carried: German capitalizes its nouns, the grader is case-sensitive,
and `die Ärztin`, `Österreich`, `die Übung`, `die Öffnungszeiten` and seven more were therefore a
**permanent soft miss** for any learner without a German keyboard — `foldUmlauts` turns `Aerztin`
into an `umlaut` verdict, which suggests *Again*. Nobody reported it because a card that is merely
hard to *type* looks exactly like a card you keep getting wrong.

The three separate copies of `['ä','ö','ü','ß']` in `FlashcardSession`, `Translate` and `Listen` are
now one exported `GERMAN_INPUT_KEYS` (`src/lib/typing.ts`), so the bar cannot drift per surface.

- Verified: all 3238 card ids unchanged; `bun run validate` clean; the exercise corpus needs no
  character the bar lacks (checked, not assumed).

The open question about `Cafe` as a soft miss is carried in [../backlog.md](../backlog.md).

### P14-3 · Ask whether the gate can be read, not only what it says — **done 2026-07-21**

The retention table answers *what is the percentage*. It cannot answer *will there be a
percentage*, because it is keyed off attempts that already happened: a competence whose family has
never been probed does not appear in it at all. Yet the P3-6 verdict counts only competences at
`PROBE_READABLE_MIN` attempts, so whether 2026-08-02 produces a readable answer is decided by arming
dates and the interval schedule — which is knowable **now**.

`bun run progress:audit --project YYYY-MM-DD` adds *Can the gate be read?*. It assumes nothing about
study frequency: two ceilings per competence, `ceilingEver` (families × intervals) and
`ceilingByTarget` (only the intervals whose due date has arrived by the target).

Measured for the gate date, from the 2026-07-20 snapshot:

> **A1: 1 readable now, 8 still reachable by 2026-08-02, 4 not** — reaching them needs **12 more
> probe attempts actually taken**. A2: 1 readable, 8 reachable, 25 not.

So the read is *possible* — 12 attempts in 12 days is about four sessions at
`MAX_PROBES_PER_SESSION`, against 19 due and 16 overdue. Nine of thirteen A1 competences can
contribute; four cannot, whatever anyone does. That is worth knowing on 07-21 rather than on 08-02.

Three distinctions the report makes that the retention table cannot:

- **unreachable by date** (the schedule rules it out — only time or a later target helps) versus
  **needs N more** (effort helps). Both read as "pending" in the retention table.
- **unarmed families** are projected from the snapshot date, not written off: their topic has simply
  never been practised, and opening the lesson today starts the clock today. Counting them as zero
  would report "unreachable" for a competence one lesson away.
- **untagged is never reachable**, however much time remains — the same exclusion the verdict makes,
  applied here so a projection cannot promise readability the verdict will refuse.

A single-family competence caps at exactly the readability floor, so it has no margin for a probe
that is never taken. Widening that is authoring work (a second family), not study — which is the
P12-1 second-family programme, and this report is how to tell which competences still need it.

### P14-4 · Two learning-science findings, recorded rather than acted on — measured 2026-07-20

Both are measurements from the 2026-07-20 snapshot. Neither was fixed, and the reasons differ. The
live halves — the deferred format-saturation conversion and the Entdecken-feedback caveat — stay in
[../backlog.md](../backlog.md); the investigation that closed is here.

**Open production's revision loop produces no revisions — investigated, no defect found.** The audit
reports **7 structured revisions, 0 changed between drafts**. The suspicion was an invisible
affordance, and it was not idle: the Entdecken *Useful* toggles persisted their clicks while
rendering nothing and were reported as "not clickable" until #85. `Write.tsx` is not that. On the
compare screen the learner's `WritingArea` stays enabled, and `UI.compareHint` sits directly beneath
it saying *"edit it right here if you like"*. The mechanism is present, labelled and working; the
honest reading is that the learner read the model and judged the draft finished. Left alone
deliberately — minimal ceremony is the contract, seven data points on an optional step are not
grounds to add a stage, and "fixing" a working mechanism is how a good flow becomes a gated one.

**Two more formats have stopped discriminating.** `audio-comprehension` is **25/25 = 100%** and
`match` **97%** over 55 attempts — the saturation signature that got `order` capped at 2 per set in
P12-3. Not acted on in this window: converting items is a `revision` bump, which drops their
attempts out of the re-graded retention reading before 2026-08-02. Revisit with P12-4.

**And one number in the audit that is not evidence.** The *Optional-content feedback* table reports
`discovery:a2/berlin-ubahn-karte` as *comfortable / useful: no / wants more: no*, which reads as a
verdict on the whole Entdecken strand. Its timestamp is **2026-07-19T09:22Z — 4h38m before #85**
fixed the invisible toggles, and "off" is exactly what a double-press on an unresponsive toggle
produces. Treat Entdecken feedback as starting from #85; do not plan authoring volume against it.
