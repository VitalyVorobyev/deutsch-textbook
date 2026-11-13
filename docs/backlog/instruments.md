# Backlog · Instruments and gates

Graders, validators, measurements and the progress audit. The format and the ID rule are in the [backlog README](README.md).

- **INS-1 · Grading rulings carry no item revision, so a probe cannot be repaired past one.** An
  `accept` ruling must pass today's grader (`packages/content/src/grading-decisions.ts`), so
  once a ruling accepts a rendering, the item can never stop accepting it. Found on
  `a2/probe-natur-wetter:variant-a`: *Am Dienstag regnet es den ganzen Tag* is almost the practice
  cloze `cloze-es-umgestellt` word for word, so the probe can be answered from memory of it — but
  the 2026-08-26 ruling accepting exactly that rendering blocks changing the carrier. First step:
  give a ruling an optional `revision` and check `accept` only against that revision.
- **INS-2 · Owner decision: does the `da-weil` probe grade a preference?** `focus-tags.md` says *weil* is
  grammatical wherever *da* is, so an item may grade only a forced choice, and practice
  (`cloze-da-weil-bekannt-neu`, `-produktion::cloze-da-weil-transfer`) accepts *Weil*; but
  `probe-meinung-medien-da-weil` variants b and c, under the same instruction, accept only *Da*.
  Either key the practice gaps `{{Da}}` and amend the tag rule to "or the direction the instruction
  constrains", or let the probe accept *Weil* (then only variant-a measures). Also: who drafted
  this unit's UK/DE halves and ran its C6-1 review is not in its provenance record.
- **INS-3 · The grader's closed-class guard lacks *dies-*, *jed-*, *welch-* and *euer*.** `CLOSED_CLASS`
  (`packages/grading/src/production.ts`) lists articles, possessives and pronouns, so `den` for
  `dem` is a choice; but *dieser* for *dieses* is one edit and forgiven as a slip, although
  `demonstrativartikel` and `interrogativartikel` grade exactly that ending. Found on
  `b1/drill-irreale-bedingung:uebersetzen-zimmer-balkon`. First step: add the four paradigms and
  run the determiner-twin sweep for renderings the change newly rejects.
- **INS-4 · The grading queue reads predicate-bearing items through `key_tokens` alone.** `gradingReview`
  (`scripts/progress-audit.ts`) queues a rejected rendering and re-attributes a confirmed one with
  `gradeTranslation`, while the runtime logs the item's `focus_evidence` verdict. Routing it through
  the predicates queues 2 more renderings today, both on `a2/drill-zu-infinitiv:uebersetzen-formular-auszufuellen`
  (a misspelt pin the predicates call `unknown`); no probe row moves. Decide whether such a miss
  belongs in the review queue before wiring it.
- **INS-5 · A probe's arming contract pins a tag on an item that should not carry it.**
  `b1/arbeit-bewerbung-produktion::hoeren-interview-verstehen` is a speaker-attribution listening
  item tagged `nomen-verb-verbindung` (its own explain says so), but it is in that probe family's
  `arming:` list, and the validator requires arming items to carry the family's focus. Removing it
  moves the family's clock: measure `armedAt` on a current snapshot before changing either.
- **INS-6 · A reordered main clause is blamed on the relative pronoun.** The misplaced-token check
  attributes a correct rendering whose main clause is reordered (*Jetzt helfen mir die Kollegen,
  denen …*) to the pinned token's focus, because the token count is unchanged. Every
  relative-clause translate item can hit it; `b1/leben-veraendern-produktion::uebersetzen-transfer-kollegen`
  now accepts the fronted order by hand. First step: measure how many confirmed rejections in
  the attempt log are reorderings of an unpinned clause.
- **P25-7 · Slip-forgiveness stops at `key_tokens`.** Four confirmed rows where every graded token
  was right and one typo elsewhere sank the rendering (`data/grading-decisions.yaml`, decided
  2026-08-11). Measure every historical confirm whose only divergence is outside `key_tokens` before
  changing the scorer — invented fixtures got this trade-off wrong twice.
- **P25-15 · A probe family logs a sub-confusion on its umbrella tag.** The validator holds variant
  `focus` equal to the arming set's, so `a2/probe-zeit-praepositionen` variant-a (seit/vor) and
  variant-b (am/um) both log as `zeitangaben-system`.
- **P23-2 · A revision bump that only widens `accept` stops the retention table re-grading.**
  `classifyProbe` (`scripts/progress-audit.ts`) replays an attempt only when `itemRevision` matches,
  else falls back to the stored tag. One measurement found no row affected; verify before acting.
- **P5-11b · Mode coverage is checked at A1 only** — items declare `target_mode` and validation
  requires each A1 outcome's mode to be practised. First step: decide whether an outcome must name
  the mode it is measured in, then extend the check to A2 and B1.
- **P12-6 · Dictation focus attribution at A2/B1** keeps `dictationSlip`; silencing unmatched misses
  without predicates inverted the weakness signal. First step: `focus_evidence` predicates for the
  ~50 focused A2/B1 `listen` items.
- **P12-7 · An accept list is closed by its declared product**, never by enumeration: the
  dimensions the item's own answer, accept and explain present as equivalent, each verified through
  `gradeTranslation`. Beyond that, name the token in the `instruction` when it carries the focus, or
  accept the sibling.
- **P5-11c · The connector-determinacy check does not reach cloze gaps.** Read the comment above
  `INTERCHANGEABLE_CONNECTORS` first (`da` is absent on purpose); a cloze version needs sense
  disambiguation.
- **P22-9 · Markdown emphasis in a YAML text field renders as asterisks.** `*` is also the
  ungrammaticality marker (64 correct uses); emphasis *closes*, the marker never does. Verify a rule
  against both sets.
- **P22-11 · No detector for two vocab entries answering one production prompt**
  (`Angebot`/`Sonderangebot` was found by the learner). Respect parentheticals, require mutual
  overlap, triage against the lapse table; `Stock`/`Stockwerk`/`Etage` needs an editorial ruling.
- **P22-19 · An audio-only topic escapes the item-mix bar** (`scripts/validate.ts`: the
  `practiceItems` guard runs on the audio-filtered list). Unreachable today. Decide *whether the topic
  has practice* from the unfiltered list.
- **P22-12 · The positional-option rule cannot see a bare ordinal**
  (`src/lib/option-references.ts`); needs sense disambiguation.
- **P24-8 · `bun run gen:ipa` writes a duplicate `ipa:` key when a comment precedes the field**, and
  YAML keeps the last one, silently replacing a reviewed transcription. Until fixed, run it with
  `--only <deck>`. Make the writer idempotent, and make duplicate keys fail `bun run validate`.
- **P24-9 · Article comprehensibility is measured but uncalibrated.**
  `bun scripts/comprehensibility.ts --rank` has never been checked against the owner's
  felt-difficulty list. Then learner evidence: a per-topic pretest → first-practice accuracy delta in
  `progress:audit`.
- **P25-13 · The real store round-trip test is skipped on CI** (`test.skipIf(CI)`): a fake-indexeddb
  scheduling race on Linux runners, never on macOS. On each bun upgrade, drop the `skipIf` in a draft
  PR and see whether it is gone.
- **P20-3 · The live card-id migration call site has no automated coverage.** Add `fake-indexeddb`
  coverage the next time profile-scoped storage changes.
- **P12-8 · The two answer highlights come from two LCS runs** in `Translate`, so a transposition
  can mark different words on each side. Display only; return both arrays from one traversal in
  `packages/grading/src/worddiff.ts`.
- **INS-7 · A passed placement arms no probe family**, so a topic the learner tested out of never
  gets a delayed check. Not urgent: `progress/vitaly/2026-11-11.json` holds no placement attempt, so
  arming from a pass would arm 0 families today. Arming at the moment of a pass puts every family a
  full pass covers due on one day — 39 at A1, 64 at A2, 56 at B1 (counted by simulating a learner who
  answers every item of one placement set right, one session a day) against 35 a week at
  `MAX_PROBES_PER_SESSION` — so it needs a stagger, one family a day; that takes 63 days to arm a
  full A2 pass, and a staggered clock understates reported intervals by its delay. First step:
  open this once a learner who placed out exists.
- **INS-8 · A cloze probe charges a misspelling to the tag.** `b1/probe-arbeit-bewerbung-adjektiv-nomen:variant-a`
  logged *Interresantes* as an `adjektiv-nomen` failure, with the capital and the *-es* both right.
  `translate` forgives a one-edit slip outside `key_tokens`, and `listen` withholds attribution
  (`dictationSlip`), but a cloze gap whose whole answer is the graded word has neither. The rule
  "one edit, last two letters intact means `unknown`" is measured and rejected: of the 51 wrong
  cloze probe attempts in `progress/vitaly/2026-11-11.json`, all charged `failed`, it reclassifies
  8, and about 1 of those is a stem slip (*müssen* without its umlaut); the rest are graded or real
  forms — a different determiner for *Seine*, *schlaft* for *schläft*, another first vowel in
  *an dem*, another article in *in der Küche*, another vowel in *gibt*. The example above is two edits away and stays charged.
  Counted by rebuilding each logged gap against the item at its revision. First step: a cloze gap
  declares what it grades — a predicate per gap, or `focus_evidence` on the item — and only text
  outside it may be forgiven.
- **INS-9 · `progress:audit --item` prints no prompt or answer for an island item.** Cloze, table and
  order items show `Prompt: —` and `Answer: —`, so the item detail cannot be read without opening
  the YAML (`bun run progress:audit --profile vitaly --item b1/probe-leben-veraendern-relativ-praeposition:variant-a`).
  First step: print the cloze `text` with its keyed gaps.
- **INS-10 · Confirm on a real snapshot that the never-practised probe families arm.** On
  `progress/vitaly/2026-11-11.json` 20 of 159 families had no answered arming item: for 14 the
  tagged items lay in sets added after the learner's first pass of the topic and never opened, for
  5 in opened sets whose tagged items were never dealt, and 1
  (`b1/probe-gesellschaft-zusammenleben-hoeren`) is untagged and arms only from its two authored
  keys. Mixed training never reached them: band 1 held 80 or more items for 6 priority slots. It
  now deals every unarmed family's arming keys first among never-attempted items; simulated over
  30 daily sessions on that snapshot (30 seeds, each item answered at the learner's accuracy for
  its type), all 20 arm within 30 sessions on every seed and a mean of 12 within 10. Still open:
  `a1/probe-akkusativ-praepositionen` holds 2 probe attempts although it is unarmed, so its arming
  once resolved and no longer does. First step: rerun the count on the first snapshot 30 sessions
  out, and read that family's arming history.
