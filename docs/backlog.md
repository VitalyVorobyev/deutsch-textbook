# Active Backlog

Companion to [roadmap.md](roadmap.md). Statuses are `todo` → `doing` → `done`. **A finished item
moves to an archive, keeping at most one line here** — done entries never accumulate detail in this
file. Completed P0–P3 items: [the learning-foundations archive](archive/2026-07-learning-foundations.md);
completed Phase 4–10 items: [the phases 4–10 archive](archive/2026-07-phases-4-9.md).

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v6 snapshot import and pass the full repository gate. What A2 teaches, in what order,
with which identities, is decided in [the A2–B1 curriculum blueprint](curriculum-a2-b1.md) — read it
before authoring anything.

Phases 0–8 are done: the learning system, the Atlas, complete A1 and A2 curriculum spines (including
the Ukrainian explanation half), the hardened learning loop, the pre-1.0 evidence foundation, the
honest-signal instrument pass, the Schreib-Assistent, and the learner-language machinery. Only
Phase 9 (Entdecken & Referenz) runs in parallel now, and it never gates B1. B1 remains provisional
until representative A2 use, its checkpoint and delayed evidence have been reviewed — the B1 gate
lives in [roadmap.md](roadmap.md).

## Completed work — one line here, detail in the archive

- **Phase 10 · close the A2 grammar standard** — `done` 2026-07-18. Structural coverage moved from 20/30 to 30/30; see [the phases 4–10 archive](archive/2026-07-phases-4-9.md).
- **P11 · A2 linguistic corpus pass** — `done` 2026-07-18. All 30 manifest points are signed off with zero open high/medium findings; see [the QA ledger](a2-linguistic-qa.md).
- **P13 · Level placement tests** — `done` 2026-07-20. `role: placement`, one set per level, discovered like checkpoints; per-topic verdicts that take a topic off the path without ever raising its measured tier. 70 items shipped (A1 24, A2 46). Contract in CLAUDE.md; two open limitations below (P13-1 spoken modes, P13-2 offering the next level's test).

## The open gate

### P3-6 · Read the A1 retention cohort — `blocked on 2026-08-02` (a calendar gate, not a task)

The engineering half shipped with P3-1: the probe report on Fortschritt, reporting delayed results
apart from practice accuracy and at the interval that *actually* elapsed rather than the scheduled
one. The other half runs on wall-clock. Probes armed on 2026-07-12; the 21-day cohort completes
**2026-08-02**.

**The exit bar, stated so that it can fail:**

> **The A1 delayed probes retain their target competence in ≥ 80% of readable competences, with the
> free-production channel at ≥ 70%.**
>
> **Retained** = the item's graded target survived: correct under today's contract, or wrong with
> the divergence outside the tokens the item's `focus` grades. **Failed** = the target itself
> diverged. Competences group by focus tag, pooled across families, read per level. A competence is
> **readable** only at ≥ 3 attempts (one per scheduled interval); below that it is pending, excluded
> from the percentage, never counted as a pass. An untagged family cannot fail its target by
> construction and is excluded as an instrument gap.

`bun run progress:audit` prints this as *Retention by competence*. The bar's numerator used to be
`correct` — whole-sentence flawlessness — which measures sentence-building rather than retention of
the competence the interval tests. That reading puts the cohort at **18%**; target retention puts it
at **59%**. Neither clears 80%: the restatement makes the gate *readable*, not passed. See
[the roadmap](roadmap.md#the-retention-gate) for why it must not be tuned until it passes.

The bar used to say *per A1 outcome*, and it could not have been met as written. A probe family's
three variants were testing three **different** competences, and `dueProbe` serves one variant per
interval — so each competence was measured exactly once, at exactly one delay, and no retention
curve could exist. The number would have looked like retention without being it. Caught before the
cohort produced a single answer (zero probe attempts were logged), and fixed: a family's variants are
now parallel checks of **one** competence, and `bun run validate` refuses any other kind. One
competence per topic is probed — a topic's remaining outcomes get their evidence from practice, which
is where outcome mastery comes from anyway.

This used to gate the *start* of A2 authoring. It is now a **revision trigger** instead — the
roadmap explains why, and names the risk that change accepts. If A1 misses the bar, A2 authoring
stops, the units written by then are revised against the finding, and the lesson pattern is fixed
before another unit is written.

- Accept: delayed and novel-transfer evidence are reported separately from engagement; the findings
  update [the audit](a1-learning-audit.md) and, if the bar is missed, the A2 units already written.

## Open — found in the 2026-07-21 pre-B1 review

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

- Not repaired, and recorded so the number is not misread: at least one of the 53 x-de lapses is
  instrument rather than learner. There is no retraction mechanism for card attempts —
  `data/grading-decisions.yaml` rules `translate` renderings only — the same gap the P12-6 `table`
  note names.

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
- Worth weighing after 2026-08-02, not now: whether `Cafe` should be a *soft* miss like `ae/oe/ue`
  rather than plain correct. It touches `foldUmlauts`, which is flashcard-only and therefore does not
  move the retention figure — but it does change grading for every card, so it is not a change to
  make in the same breath as a bug fix.

## Open — found in the 2026-07-20 instrument review

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

**A2 is mostly NOT blocked — measured 2026-07-20, correcting a blanket deferral written here
earlier.** "Wait for the cohort read" was assumed rather than checked. What actually blocks a second
family is the P12-2 hazard: adding one flips the topic to item-level arming, which can move the
existing family's `armedAt` and silently re-date probes already taken.

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

- Open: three A2 topics plus `essen-trinken` after the cohort read; the outcome under-tagging above.

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

### P12-3 · Smaller findings — **four closed 2026-07-20**, one open

- ~~**The B1 grammar inventory is a 1-point stub.**~~ **Done 2026-07-20.** Authored to 31 points against the Goethe B1 Prüfungsziele, cross-checked against Schritte plus B1 and Menschen B1. `bun scripts/grammar-coverage.ts B1` now reports **0/31**, which is the honest figure and the point of the exercise: the A2 story is that a level with no manifest cannot notice it is at 67%. Tags are proposed and unregistered, so every point reports `missing` until the unit teaching it ships. Ratcheted by `tests/grammar-coverage.test.ts` (`covered === 0`), the mirror of the A2 test. Über still publishes no B1 grammar figure and should not: B1 has no content, and the page's claim is "not started".
- ~~**Pretest attempts were weakness evidence.**~~ **Done 2026-07-20**, and this turned out to be the sharp end of the mc finding rather than a separate one. `focusStats` keys only by `focus`, so it saw all 91 focus-tagged pretest attempts — and since every pretest item is `mc`, the format the learner scores ~93% on, they diluted the denominators of a signal built to find production confusion. Measured: **27 tags change error rate**, and the weak set swaps a member — `nebensatz-vorfeld` was masked below the bar and `konjunktionaladverb-inversion` pushed above it. Both directions steer training and drill authoring wrongly. `isPretestAttempt` now excludes them in `focusStats` and in the audit's `focusSignals`, and the `-pretest` suffix is validator-enforced both ways because an attempt records no role.
- ~~**Format saturation: `order` has stopped discriminating.**~~ **Done 2026-07-20.** Capped at **2 per set**, validator-enforced, per *set* because the topic-level caps cannot see one set that is mostly `order` — a sibling set's translate items dilute the ratio. Four sets were over; five items converted to `translate` in place, ids kept (so `pathDone` is untouched) with `revision: 2`. The worst was `a2/trennbare-verben` at 4 of 18 while `trennbar-wortstellung` sat among the worst persistent weak focuses: a quarter of the practice for a rule the learner was failing handed them every token.
- ~~**All 96 pretest items are `mc`.**~~ **Done 2026-07-20.** The first item of every pretest was converted from `mc` to `cloze`, so each pretest is now one production item + two recognition items. The measured motive: **94% of 100 pretest attempts were correct and 22 of 26 attempted pretests scored a perfect 3/3** — an instrument billed as *diagnostic generation* was returning "you already know this" for a learner who scores ~93% on `mc`. Most prompts were already `___` gaps, so the conversion filled the blank and carried the reviewed `translation`/`explain` over verbatim; where the four options were what constrained the answer (a soft pronoun, a full-sentence choice), the cloze got German context to stay determinate (`Danke, Anna!` → `dir`; `Frau Berg` → `Ihnen`; `Ich habe eine Schwester.` → `meine`) or an inline `(lemma)` hint, following the determinate-gap rule. The 32 `revision` bumps are free here, not deferred: `isPretestAttempt` and the role allowlists keep pretests out of weakness, coverage, probe arming and training, so nothing re-grades their history. The same inertness is why each converted item keeps its topic's original `focus` tag even where a cloze grades an adjacent form rather than the tagged position (`konjunktionaladverb-inversion`, `trennbar-wortstellung`): the tag is documentary on a pretest, and matching the item's two `mc` siblings is worth more than a technically-truer tag that nothing reads. **Guarded:** `bun run validate` now rejects an all-`mc` pretest, and `contracts.test.ts` pins the same property, so the conversion cannot silently regress.
- **Not a defect, recorded so it is not mistaken for one:** flashcard direction asymmetry is x-de 53 lapses / 156 cards vs de-x 5 / 173. Production recall is ~10× harder; FSRS handles it per card.

### P12-5 · Two source files were invisible to grep — `done` 2026-07-20

`scripts/progress-audit.ts` and `src/lib/grading-decisions.ts` each contained a **literal NUL byte**, used as a composite-map-key separator in a template literal. The idea is sound — no rendering can contain a NUL, so no pair of parts can collide — but emitting it as a raw byte rather than as an escape sequence makes `file` report the source as `data`, and grep, ripgrep and editor search then **skip the whole file silently**, returning "no matches" rather than an error.

It survives every existing gate: a NUL is valid TypeScript, so `bun test`, `astro check`, ESLint and the production build all pass. It cost half a dozen dead-end greps before `file` explained why searching `progress-audit.ts` for `focus` returned nothing. Both replaced with the escape — byte-identical keys at runtime, verified by diffing the full audit output — and `tests/source-hygiene.test.ts` now fails on any tracked source file containing one. That test caught itself on first run, which is the best evidence it works.

### P13-1 · Placement cannot evidence the spoken modes — `todo` (S), and it is a limitation, not a bug

The placement test scores three response channels — selection, writing and listening — because those
are the three that can be scored at all. `write` and `speak` are validator-rejected in a placement
set: open production is never verified, and since "every item answered" is half the pass condition,
one unscorable item would make its topic permanently *unplaceable*.

The consequence is stated plainly rather than papered over: **32 of A2's 83 outcomes and 13 of A1's
37 are spoken-production or spoken-interaction, and a topic carrying them is placed on written
evidence.** No A1 or A2 topic is spoken-*only* (checked, not assumed), so every topic does get
evidence in a mode it can be graded in — but a learner who writes German far better than they speak
it will place out of topics whose can-do statements are about speaking.

Deliberately not fixed by a mode-coverage rule over the *outcome's* CEFR mode: an ordinary typed item
referencing a `spoken-interaction` outcome would satisfy such a rule while measuring nothing spoken,
which buys the appearance of coverage and none of it. A real fix needs scorable speech, which the app
does not have and which the open-production contract says it must not pretend to have.

### P12-6 · Items that grade which word the author had in mind — **done 2026-07-21**, one deferred

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

- Deferred: `a2/probe-nebensaetze-plaene:variant-a` has the same defect and is frozen — constraining
  it needs a `revision` bump, which drops its attempt out of the re-graded retention reading before
  2026-08-02. Safe to wait: its one logged attempt used *weil* unprompted, so the ambiguity has not
  yet cost a data point. The validator **warns** rather than passing silently, so the exemption
  cannot be forgotten; remove it and the `DEFERRED` entry in `contracts.test.ts` together.
- Not repaired: the one logged `konjunktionaladverb-inversion` failure is preserved as a known
  revision mismatch and still reads as a real error in the weak-focus table. `data/grading-decisions.yaml`
  rules `translate` renderings only, so there is no mechanism to retract a `table` attempt. Weight that
  tag accordingly until it has post-fix evidence.

### P13-2 · The entry test went unreachable the moment it was started — **half done 2026-07-21**

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

**Still open — the next level's test is not offered.** `src/pages/index.astro` links
`getPlacements()[0]` only, deliberately, so a learner cannot skip to A2 while A1 is untouched (the
rule `dueCheckpoint` already encodes). Closing it is the `dueCheckpoint` analogue — **offer level
N+1's test once level N is placed or passed**, surfaced from `PlacementResults` after *Ergebnis
übernehmen*. This half really is a new entry surface with its own eligibility question: it has to
decide what "level N is done" means for a learner who placed out of half of it, and it must not
become a second path the learner feels obliged to walk.

- Lesson worth keeping: the deferral was written from the *symptom* that was noticed (A2 unreachable)
  rather than from the mechanism, and the mechanism covered a second, cheaper, more urgent case. A
  deferral is a claim; this one bundled a bug into a design question and inherited the design
  question's timeline.

### P12-4 · `key_tokens` conflates three different reasons to pin a token — `todo` (M)

A token is pinned for one of three reasons, and the scorer cannot tell them apart:

| Pinned for | Example | Wanted behaviour |
| --- | --- | --- |
| **form** — the tag grades which word this is | `dem` in a `dativ-artikel` item | never forgiven, attributes to `focus` |
| **position** — the tag grades where it sits | `schwimmen` in a `modal-satzklammer` item | forgive a typo; attribute only a *displacement* |
| **presence** — it must be right, but its error belongs to another tag | `geflogen` in a `haben-sein` item | never forgiven, attributes to **nothing** |

All three get form treatment today. There is also a fourth, separate blind spot in the same
function: **`misplacedGraded` requires equal token counts** (`production.ts`), so an *insertion or
deletion* can never be attributed even when it is precisely the confusion the tag grades.

The five wrong attributions live in the log, all four kinds represented:

| Item's tag | Learner wrote | Should be | Today |
| --- | --- | --- | --- |
| `modal-satzklammer` ×2 | `schimmen` for `schwimmen` | forgiven (typo, position pin) | wrong + tagged |
| `haben-sein` | `geflügen` for `geflogen` | `partizip2-form` (presence pin) | wrong + tagged |
| `modal-satzklammer` | `Sie sollten … **zu** nehmen` | tagged — a modal takes a bare infinitive | wrong, **untagged** |
| `passen-dativ` | `Passt **es zu** dir …` for `Passt dir …` | tagged — this *is* the confusion | wrong, **untagged** |

The last two are the length guard, and they are the more serious kind: the scorer is blind to the
drill's own signature error.

**Do not "fix" this by dropping the pins.** All 54 attributions that change if `key_tokens` goes
empty were reviewed one at a time: **52 of the 54 belong to a different tag than the item's** — a
fumbled article inside a perfect `trennbar-modal` bracket, a nominative-for-accusative pronoun
inside a perfect `konjunktionaladverb-inversion`. So the pins cost 5 and buy back 52. The cheap
workaround is ~10× worse than the defect.

Shape: `key_tokens` stays the form list; add optional sibling lists (working names
`position_tokens`, `present_tokens`) rather than a per-token object, so every existing item keeps
parsing unchanged and no revision bump is needed to adopt it. `gradeTranslation` gets three sets
instead of one — rule 1 forgives a one-edit miss on a position token, `misplacedGraded` reads the
position set, and a divergence on a presence token returns `{ kind: 'wrong' }` with no `focus`.
The length guard needs its own answer: align the diff and ask whether a graded token moved
*relative to its neighbours*, rather than requiring the sentences to be the same length.

**Sequencing hazard — both halves must wait for 2026-08-02.** Retrofitting live items bumps
`revision`, which makes `revisionKnownMismatch` stop re-grading those attempts and deletes data
points from the retention reading. **The scorer change is not safe to land early either** — the
retention figure is computed by re-grading, so changing the grader moves the number the gate
reads. Measured: **7 of the 16 probe attempts currently counted as retained are length-mismatched**
(`probe-perfekt-haben-sein`, `probe-alltag-zeit`, `probe-reisen-verkehr`,
`probe-einkaufen-reklamation`, `probe-termine-vereinbaren`, `probe-arbeit-beruf`,
`probe-erste-schritte`) and could flip to failed under the length-guard fix alone. Land the whole
of P12-4 after the cohort is read, and re-read the gate under both graders so the movement is
attributable.

## Done phases — one line per item, details in [the phases 4–10 archive](archive/2026-07-phases-4-9.md)

- **Phase 4 · complete A2** — `done`. P4-1 froze the A2 curriculum contract; P4-2 built the A2
  instrument (outcome-measurement rule, probe families, A2 Wortliste manifest, checkpoint
  discovery); P4-3 brought the six pre-loop A2 topics up to contract; P4-4 authored the ten A2
  units and fixed the transposition-blind scorer (34 items); P4-6 gave the writing outcomes
  verified evidence (all 61 A2 outcomes measured); P4-5 closed A2 (checkpoint, 100% Wortliste,
  computed Über claims, 0.3.0).
- **Phase 5 · pre-1.0 foundation** — `done` except the entries kept below. P5-2 extensive readers
  (Lena 5–7); P5-8 snapshot v5 + revision-safe evidence; P5-9 A2 context pilots; P5-10 canonical
  case reference.
- **Phase 6 · learning quality** — `done` 2026-07-14/15. P6-1 grading-decisions instrument;
  P6-2 triaged all 32 queued renderings; P6-3 probe catch-up pacing (Probe-Rückstand card);
  P6-4 dative-cluster drill; P6-5 verb-forms drill (split by tag ownership); P6-6 desktop mic
  permission; P6-7 minimal-ceremony open production; P6-8 Goethe-B1 Wortliste manifest
  (3,416 headwords, inherited-only `~`).
- **Phase 7 · Schreib-Assistent** — `done` 2026-07-15, per [assist-design.md](assist-design.md);
  advisory only, never evidence. P7-1 assist library; P7-2 Write.tsx advisory panel; P7-3 Tauri
  transport.
- **Phase 8 · Sprachen, machinery** — `done` 2026-07-15/16, per [i18n-design.md](i18n-design.md);
  the objective is the learner's language, not the chrome. P8-1 strings module + per-profile
  language preferences; P8-2/P8-3 the ternary sweep (~136 ternaries → hoisted `pick()` records);
  P8-4 content-language machinery for `uk` **and** the B1-onward German-medium `de` half;
  P8-5 card meaning side + computed Über UK-coverage figure + chrome residue. **Post-scriptum
  2026-07-16**: one Lernsprache selector, chrome pinned German, EN surface never shows RU/UK
  (`pickSecond` under `en` → EN alone) — the owner ruling and rationale live in
  [i18n-design.md](i18n-design.md).
- **C3 · Ukrainian A1+A2 explanation half** — `done` 2026-07-18. Authored across every ru-bearing
  A1/A2 file (Über **266/266**), idiomatic and per-file-parity, `en`/`ru` prose byte-identical
  (waves 1–7, PRs #60/#61/#66/#67/#68/#69). B1 `uk` waves follow B1 content.

## Parallel — Phase 9: Entdecken & Referenz

P9-1 (discovery schema: provenance-checked `images[]`, online-only `links[]`) — `done` 2026-07-15,
archived.

P9-4 (canonical multilingual Wortnetze schema, four pilot networks, reference page and compact
card-back context) — `done` 2026-07-18, archived. It remains a parallel reference track and does
not gate B1.

### P9-2 · Entdecken pieces — `todo` (recurring, ~1–2 per PR)

Optional editorial pieces from the fifteen-theme backlog, each passing the editorial test in
[future-content-directions.md](future-content-directions.md) — a language reason to exist, level
control, and no review obligation from opening it:

1. die Berliner Mauer im Stadtbild
2. das Ampelmännchen
3. Pfand und Mülltrennung — shipped
4. die Sonntagsruhe
5. Schrebergärten
6. Deutsch in Österreich und der Schweiz
7. der Verein
8. Brot als UNESCO-Kulturerbe
9. das Deutschlandticket — shipped
10. das Amt als Genre
11. Bauhaus im Alltag — the movement through an everyday object
12. der Döner — migration through a familiar food — shipped
13. die Loreley — the Rhine through a place and a legend
14. Moin, Servus, Grüß Gott — regional German through an encounter — shipped
15. Tatort am Sonntag — a television ritual

Two standing decisions are recorded here rather than as items. **Committed audio stays deferred**
(P5-1 untouched): when the audio schema's `kind: asset` path needs exercising, the cheap path is
one CC-licensed audio asset inside one Entdecken piece, not a TTS replacement program. **Audit
extensions are added only with named consumers** — the grading-decisions integration names P6-1's
queue; the probe-debt row names the P5-11 audits and the P5-7 decision.

- Depends on: P9-1.
- Accept per piece: the editorial test; the validator; no mastery or review-debt semantics.

### P9-3 · Referenz lookup pages — `next` (M)

The largest non-blocked, learner-facing work that does not gate B1. Three pages, each derived or
canonical — never a second hand-maintained textbook. Ship one at a time (each is independently
shippable); match the existing `src/pages/referenz/*.astro` pattern.

- `/referenz/verbformen` — build-time-derived from the vocab YAML (`praesens_3sg`, `partizip2`,
  `aux`, `valence`); a verb table that cannot drift from the decks that teach the verbs.
- `/referenz/zahlen-datum-zeit` — numbers, dates and clock time, from a new
  `content/reference-data/` YAML shared with any lesson that needs it.
- `/referenz/briefe` — letter and message conventions (greeting, closing, register).

Lower priority, recorded so it is not re-invented as a page: a two-way-preposition visual belongs
inside the existing kasus reference, not on a new route.

- Accept: reference pages carry no completion state or evidence semantics; derived tables are
  computed at build time.

## Phase 5 — the entries still open

### P5-11 · Two-unit A2 evidence cycles — `doing` (recurring)

Run the just-in-time audit and post-pair snapshot review in
[a2-learning-led-program.md](a2-learning-led-program.md). The audit reports revision coverage,
response modes, overdue probes, productive-card lapses, persistent focus errors, structured
production changes, session workload, pair windows and pilot feedback.

The windows now include the learner-led `verben-mit-praepositionen` module after
`gesundheit-arzttermin`; the operating program is authoritative. Keep the cycle-one snapshot review
open until `einkaufen-reklamation` is completed. A2 closure remains open until the expanded
checkpoint and this module's 2/7/21-day evidence have been reviewed. Continues as recurring
practice; the Phase 6 instruments (the triage flow, the probe-debt row) feed it.

### P5-7 · Delayed evidence for listening — `todo` (M)

One competence is probed per topic, and in every one of the original sixteen topics the competence that
answers "did this lesson stick" turned out to be a production one. So **no listening outcome has a
retention curve** — listening is practised (`listen` dictation, `audio-comprehension`) but never
re-checked after an interval. That is a real hole, and it is stated here rather than papered over.

The fix is a second probe family per topic where a listening outcome deserves it (`probe-<topic>-hoeren`,
three parallel `listen` or `audio-comprehension` variants). It is not free: a due probe opens the
session and the cap is three, and seventeen families can now arm. Do it after the first cohort
reports (P3-6, 2026-08-02), when the real probe load is known rather than guessed. Precondition to
verify first: `probeFamilies()` supports two families per topic — a small code change if it turns
out to be keyed per topic.

- Accept: a listening outcome shows a 2/7/21-day curve; the probe load per session stays bounded.

### P5-1 · Expand committed neural-TTS audio — `deferred` (L)

Prefer generated assets with speech synthesis as a permanent fallback. Reconsider after usage shows
that audio quality, rather than content coverage, is the limiting factor. It does not: `listen` sits
at 76% and `audio-comprehension` at 8/8 on browser TTS.

### P5-3 · Evaluate pronunciation assistance — `deferred` (L)

Constrained local or optional AI pronunciation assistance. All resulting evidence stays unverified
unless a trustworthy assessment method exists.

### P5-4 · Add lightweight mission grouping — `deferred` (M)

A presentation and resume layer over stable content IDs — not a branching game engine.

**Deferred out of Phase 3 on 2026-07-12**, and it stays deferred: by its own description it adds no
new retrieval opportunity, and its premise is engagement, which is not the problem the data shows.
The audit's requirement that an A2 unit provide "a coherent real-world mission" is met as an
**authoring convention** instead — a unit's artifacts share one scenario and end in a fresh-context
production task. That costs no code. Reconsider the feature only if the convention proves
insufficient.

### P5-5 · Evaluate branching missions — `deferred` (M)

Only after a linear mission pilot shows that branching would improve rather than distract from the
learning workflow.

### P5-6 · Recognition-only vocabulary cards — `deferred` (S)

`buildDeck()` turns every vocab entry into two cards, so there is no way to teach a word for
recognition alone. Language the learner must understand but will never produce — station
announcements, listing abbreviations, form headings — therefore lives in readings and article tables
and never in a deck. If A2 usage shows the review load is genuinely inflated by words that only need
recognition, a `cards: recognition | both` field on a vocab entry is the fix.

- Accept, when taken up: a recognition-only entry produces one card rather than two; existing card
  ids are unchanged; the Wortschatz table says which words are recognition-only.
