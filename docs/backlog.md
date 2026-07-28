# Active backlog

Status: active. The [roadmap](roadmap.md) owns direction; this file contains only executable or
calendar-blocked work. Completed detail through 2026-07-26 is
[archived](archive/2026-07-backlog-full.md).

## Visual work completed in this PR

### P17-2–3 · Sentence, time and route families — done 2026-07-26

The accepted, responsive Wohnen pilot now has three deterministic successor families:

1. a sentence rail for V2, separable verbs, modal/Perfekt brackets, verb-final
   clauses, indirect questions and `zu`-infinitives;
2. a clock/preposition visual and a `seit`/`vor` timeline;
3. a city-route map for `geradeaus` and the second street, plus a travel contrast for
   `mit dem Zug`, `in den Zug` and `im Zug`.

Generated pixels carry no load-bearing language. Exact labels belong to HTML/SVG; viewing creates
no evidence. All families passed semantic, accessibility and 320–1100 px overflow review.
Body/participant roles and task-bound apartment, form and receipt additions shipped in P17-4.

## Doing

### P5-11 · Evidence-led operating cadence

After every two B1 units: drain the grading queue, rerun `bun run progress:audit --profile vitaly`,
then decide whether content or drills need revision. Never author from a pre-triage focus table.

**Read of 2026-07-26** (snapshot same day, queue clean at 125 ruled / 0 awaiting): production
assembly is the bottleneck — `translate` 43% vs `cloze` 85%, and translate-format probes carry
nearly all retention failures; `order` is saturated at 98%, so no new order items. Every
persistent weak focus already has a drill except `zu-infinitiv` (8/23 wrong across 6 items, one
probe error, no recovery) — one drill owed from this read (queued below as A2 maintenance). Lapse concentration flagged for
entry review: `einkaufen-geschaefte` (6 lapses / 2 cards), `schule-arbeit` (9/8),
`wohnen-umzug` (10/14).

**Read of 2026-07-28** (snapshot same day; queue drained at 144 ruled / 0 awaiting — 19 rulings
this read, 3 accept, 16 confirm): the post-triage focus table is unchanged at the top, because
the confirms re-entered with their graded targets retained and charge no focus. The 2026-07-26
decisions stand, with one correction: the `zu-infinitiv` drill is NOT owed — `a2/drill-zu-infinitiv`
shipped in #116 the same day the 2026-07-26 read queued it, and the stale "owed" line survived
into this read's first draft. The row (8/22 wrong, no recovery) reads "drill not yet served":
the set has zero attempts in the log, so the owed action is the learner taking it, not authoring.
No other undrilled focus crosses the bar. New from the rulings: `akkusativ-pronomen` (er/ihn) recurred in
free production, matching its persistent row — the existing drill keeps serving it; two
Mittelfeld Angaben-order errors surfaced in B1 items, expected-not-yet-taught (B1.14
`wortstellung-angaben` territory, no action now); genus slips on feminine nouns (`Bescheinigung`,
`Stelle`, `Sendung`) recorded as drill notes in the rulings. The P5-11a lapse-entry review
closed clean the same day (see Recently completed). B1.6+B1.7 authoring proceeds per contract.

### P9-2 · Entdecken pieces

Recurring, at most one or two reviewed pieces per PR. Each must pass the editorial and provenance
contract in [future-content-directions.md](future-content-directions.md).

## Calendar gates

### P3-6 · Read the A1 retention cohort — blocked until 2026-08-02

Run `bun run progress:audit --profile vitaly --project 2026-08-02`, then the current audit. Read
only competences with at least three attempts. Pass bar: at least 80% of readable A1 competences
retain their target, with free-production retention at least 70%. A miss stops B1 authoring and
opens revision work; it does not retroactively alter logged evidence.

**Trajectory warning (2026-07-26 projection):** 4 A1 competences readable now, none at ≥80%
retention (33/50/75/75%); 5 more become readable only if ~5 due probe attempts are actually
taken before the date (12 probes due, session cap 5); 4 are unreachable by the date. On current
numbers the gate misses — plan for the revision program to open on 2026-08-02.

### A2 checkpoint review — approximately 2026-08-14

Review the checkpoint’s completed 2/7/21-day evidence as a B1 revision trigger.

## Open

- **P17-6 · The document stimulus is set-scoped, so it stays pinned to tasks it does not describe** —
  `stimulus` sits on the exercise set, so the panel renders beside every item — and it follows the
  items out of the topic page too: `src/pages/ueben/training.astro:33` hands the set's document to
  mixed training, and `session.astro` and `proben.astro` do the same.
  In `b1/arbeit-bewerbung-produktion` that means the Nordlicht-Markt ad (contact: Frau Berger)
  stays on screen while `schreiben-bewerbung` asks for a letter to Herr Weber at a different shop,
  and the interview items use Herr Weber too. The tasks are self-contained — each quotes the
  vacancy it means — so nothing is mis-graded, but the panel supplies contradictory context.
  Three ways out, and the choice is a design decision, not an edit: give the extraction item its
  own document-scoped set, make `stimulus` item-scoped (schema + `ExerciseSet.tsx`), or align every
  task in the set to one vacancy. Raised by Codex on #119; deferred there because all three are
  larger than the finding.

- **P18-1 · `explain` prose drifted the same way the articles did** — mean EN `explain`
  runs A1 28 w → A2 53 w → **~110 w in B1.4/B1.5** (max 167), against an A2 practice-set norm of
  ~50. Explanatory feedback is read *after* an error, where attention is scarcest, so the same
  segment-and-signal argument applies (`docs/article-prose.md` §17). Measured but deliberately not
  fixed in the prose-shape pass, which was scoped to articles. Decide a target, put it in
  `docs/item-authoring.md`, and revise the two B1 units' non-produktion sets — `-produktion` model
  answers are legitimately longer and need their own line.
- **P18-2 · `Kurz gesagt` exceeds its own target in two A2 files** — `a2/freunde-feste` (143 w)
  and `a2/arbeit-beruf` (144 w) against the ~100-word advance-organizer target now stated in
  `CLAUDE.md`. Median across 37 topics is 91, so these two are outliers, not the norm. Not a gate
  (the 120-word paragraph cap is), so this is editing work, not a build failure.
- **P18-3 · B1.1–B1.3 measure one competence each with delayed evidence** — the contract
  (`docs/curriculum-a2-b1.md`, amended 2026-07-24) requires *one 3-variant probe family per
  competence*, and calls one-family-per-unit a regression. B1.4 and B1.5 comply (3 families each);
  B1.1, B1.2 and B1.3 own 3 + 3 + 4 grammar points and ship **one family each** — 10 competences,
  3 of them probed. This is the real cost of B1's larger units, and the fix is six new families.
  **A second family re-arms the topic**: measure `armedAt` before and after, or probes already
  taken are silently relabelled.
- **P5-11b · Mode coverage is unchecked, and B1.2/B1.3 show it** — the checklist
  (`docs/authoring-checklists.md:18`) asks every topic for a hidden-transcript
  `audio-comprehension`, a `write`, a `speak` and a faded discrimination set. B1.4 shipped its
  review round missing two of the four, and nothing failed: `bun run validate` enforces the item-mix
  bar but never asks whether an outcome has a task in the mode it names. Checking B1 turned up the
  same gap upstream — of the four B1 units, only `erfahrungen-erzaehlen` owns an
  `audio-comprehension` item, and it is the only one with a `listening` outcome, so the doc sentence
  is ambiguous about whether the artifact is unconditional or claimed-mode-driven. Decide which the
  rule is, write it down, and either backfill B1.2/B1.3 or state why a unit with no listening
  outcome may skip it. A validator check ("every outcome's declared mode is exercised by at least
  one item of a matching type") is the mechanical half — see [`docs/coverage-instruments.md`] for
  the earned-not-asserted bar this belongs under.
- **P5-11c · The connector-determinacy check does not reach cloze gaps** — the rule in
  `scripts/validate.ts` reads `item.answer` and `item.accept`, which is the `translate` shape, so a
  **cloze** gap that accepts one interchangeable connector and rejects its sibling is unguarded.
  B1.5's three `da-weil` probe variants are cloze, and their ambiguity had to be found and fixed by
  hand. Read the comment above `INTERCHANGEABLE_CONNECTORS` before acting: `da` is **deliberately
  absent**, because clause-initial *Da* is more often "then/there" than causal and the naive rule
  would misfire on the adverb. Adding the pair was tried during the B1.5 pass and reverted for that
  reason — it produced zero new warnings, which measures today's corpus and not the rule. A cloze
  equivalent therefore needs sense disambiguation, not merely a longer list.
- **P5-11d · A reading question arms a production probe** — `ReadingText.tsx` logs
  `outcomes: question.outcomes`, and `armedAt` matches families by outcome, so answering a
  *comprehension* question can start the retention clock of a *production* probe that shares the
  outcome. Measured across the corpus rather than assumed: **73 such links — A1 20, A2 46, B1 7**
  (`content/reading/**` questions against every `role: probe` family's outcomes), so 66 of them
  predate B1 and this is a level-wide property of the arming rule, not a unit defect. Neither
  obvious local fix is right: stripping the outcome from the reading breaks the rule that every
  outcome be measured by a practice item **or a reading question**, and the alternative — arming on
  a competence signal narrower than the outcome — is a change to `src/lib/probes.ts` that moves
  every level's probe schedule at once. Whoever takes it should measure the schedule shift before
  and after, the way `essen-trinken` was measured before freezing.
- **P12-4 · Separate `key_tokens` purposes** — distinguish focus attribution, target-retention
  scoring and answer constraints without changing the pre-2026-08-02 cohort underneath it.
- **P12-5 · `key_tokens` cannot attribute an *inserted* token** — attribution fires when a graded
  token **diverges**, so it catches substitutions (`abholen` for `abzuholen`) and reorderings, and
  is blind to a word the learner adds that should not be there. Measured on
  `uebersetzen-modal-ohne-zu`: `Willst du zu mitkommen, oder musst du zu arbeiten?` — the exact
  error a modal item exists to catch — returns `{kind: 'wrong'}` with **no focus**, while
  `mitzukommen` in the same slot returns `wrong` **with** `zu-infinitiv`, because that one changes a
  pinned token instead of adding a neighbour. This is general: any item whose target error is an
  insertion (a spurious `zu`, `um`, article or reflexive) under-reports. Not fixable by widening the
  pins — `zu` cannot be pinned because it does not occur in the answer — and not fixable by dropping
  them, which the corpus already priced at 52 false attributions to buy 5 true ones. It needs an
  attribution rule that reads the *edit* rather than the surviving tokens, so treat it as
  P12-4's sibling. **The same list has a second blind spot, the mirror of the first:** a pin
  names a token but cannot say *which property of it* the tag grades. `uebersetzen-modal-ohne-zu`
  pins `mitkommen` to catch `mitzukommen` — a modal taking a bare infinitive is the lesson — and
  the pin therefore also fires on `kommen`, a lexical substitution that gets the grammar right.
  Both verified against the shipped spec: each returns `wrong` with `zu-infinitiv`. Unpinning
  trades the false attribution for a certain one, since `mitzukommen` is the error the drill
  exists to catch and would go unattributed; the instruction names the verb, which lowers the
  frequency but not the conflation. A rule that graded *the form of a named token* rather than
  *the presence of a token* would close both faces at once. Coverage today is by mode, not by mechanism: the same drill's cloze gaps
  (`muss ich {{einkaufen}}`, `Bleib … {{sitzen}}`, `Lass mich … {{kommen}}`) do attribute the
  identical confusion, because a cloze logs `item.focus` whole (`focusForAttempt`,
  `src/lib/evidence.ts:17`).
- **P12-6 · A dictation blames its grammar tag for a mishearing** — `Listen.tsx` logs the item's
  `focus` on any wrong answer except the narrow `dictationSlip` exception (one token off, one edit,
  not a closed-class swap). So on `hoeren-diktat-da` — *Da ich wenig Zeit habe, lese ich nur die
  Schlagzeilen.* — typing `keine` for `wenig` is recorded against `nebensatz-vorfeld`, a word-order
  tag, though the two verb positions were reproduced perfectly; verified, `dictationSlip` returns
  false there because the two words are more than one edit apart. Level-wide, not a unit defect:
  **53 of the corpus's 62 `listen` items carry a grammar focus**, so this is how dictation
  attribution works everywhere, and `dictationSlip` is the existing mitigation rather than a
  missing one. Do not untag single items — that trades a false attribution for a silent one and
  makes the corpus inconsistent. The fix is an attribution rule that names the tokens the tag
  grades, i.e. what `key_tokens` does for `translate` and `listen` has no equivalent of; sibling
  of P12-4.
- **P12-7 · An accept list cannot be completed by enumeration** — `gradeTranslation` compares
  against a finite authored list, so every correct paraphrase absent from it is a false negative.
  The #116/#117 review ran **ten and nine rounds** largely on this one class: `bald` placement,
  fronted clock time, `telefonieren` for `anrufen`, `die Moderatorin`, a shared subject across
  coordinated predicates — each valid, each revealing the next. **The class does not terminate**,
  because German has more correct renderings than any list holds. Standing policy, so nobody
  re-runs that loop: close an item's *declared* product in one pass — the dimensions its own
  `answer`/`accept`/`explain` present as equivalent — and verify every cell through
  `gradeTranslation`; then stop. Renderings outside that product are the business of
  `data/grading-decisions.yaml`, which rules on what a learner actually typed with the attempt
  in front of you, and of the `keyTokensIntact` reason that routes them there
  (`scripts/progress-audit.ts`). Two mitigations already exist and should be preferred to a longer
  list: **name the token in the `instruction`** when the pin carries the focus (`mitkommen`,
  `abholen`), and **accept the sibling** when it does not (`telefonieren`).
- **C6-2 · Verify the citation stress of `tatsächlich`** — `content/vocab/meinung-medien.yaml`
  transcribes `ˈtaːtzɛçlɪç` (initial). Three independent supports: the derivation from *Tatsache*,
  the parallel `hauptsächlich` ← *Hauptsache*, and `docs/lautschrift.md:14` ("primary on the
  prefix/first stem"); espeak-ng agrees (`tˈatzɛçlˌɪç`), though CLAUDE.md warns it gets compound
  stress wrong. A 2026-07-27 review argued for `taːtˈzɛçlɪç`, which is the ordinary **emphatic**
  realisation. Settle it against Duden's primary entry rather than by argument; it is a
  one-character edit either way, and the same question applies to any other `-lich` adjective
  built on a compound.
- **P12-8 · The two answer highlights come from two LCS runs** — `Translate` marks the corrected
  sentence and the learner's own by calling `diffExpectedWords` twice with the arguments swapped.
  Each traversal picks its own alignment and its tie-break is direction-dependent, so a
  **transposition** can mark different words on the two sides: expected *weil ich heute arbeite*
  against given *weil ich arbeite heute* marks `heute` in the correction and `arbeite` in the
  echo, leaving the other swapped word unmarked on each. Both cues still land in the right
  region, and nothing about scoring or focus attribution is touched — this is a display
  refinement, not a measurement defect, which is why it was filed rather than fixed alongside the
  clipping bug. The fix is to return both flag arrays from **one** traversal in
  `src/lib/worddiff.ts`; `Listen` shares that helper, so it belongs there and not in the
  component.
- **P13-1 · Spoken-mode placement evidence** — document or prototype only when the app can collect
  mode-valid evidence; written selection must never masquerade as speech.
- **P13-2 · Next-level placement offer** — surface a newly available level test without hard-locking
  the learner.
- **C6-1 · Ukrainian calque audit** — review halves written before the German-first authoring
  ruling; language quality, not alphabet parity, is the target.
- **P5-7 · Listening retention pilot** — after the A1 gate, pilot only
  `termine-vereinbaren` and `reisen-verkehr`, then observe a complete 2/7/21-day cycle.

## Deferred

- committed neural-TTS expansion;
- pronunciation assistance;
- runtime mission grouping;
- branching missions.

These require a measured learning or usability need. They do not block the curriculum.

## Recently completed

- **P5-11a (2026-07-28):** both halves resolved by inspection — the zu-infinitiv drill had
  already shipped in #116 (stale "owed" line corrected), and all four 2+-lapse cards in the
  named decks check out: Angebot and Aufgabe fixed by #116's collision pass, Kaution and
  Erdgeschoss collision-free with disambiguated glosses (Erdgeschoss already carries the
  off-by-one Stock note) — simply hard, left alone per the program rule.
- **P9-2 (2026-07-26):** two reviewed Entdecken pieces—reading a simulated Behördenbrief and
  understanding the shared-space structure of Schrebergärten.
- **P17-3 (2026-07-26):** responsive route and train-movement semantic figures.
- **P17-4 (2026-07-26):** body pain, body-care and giver–recipient role figures; task-bound
  apartment listing, registration form and receipt/product-comparison practice.
- **P17-1 (2026-07-26):** responsive Wohnen semantic figures, multilingual text equivalents and
  provenance guard.
- **B1.1–B1.3 (2026-07-24/25):** first three units under the frozen B1 contract.
- **A2 close (2026-07-24):** checkpoint taken; B1 authoring began with dated revision triggers.
