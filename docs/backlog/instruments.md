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
- **P23-3 · Six of the seven tags the runtime prioritises have no drill, all B1.** Cross
  `weakFocuses` (`src/lib/weakness.ts`) with every `role: drill` item's `focus`. `weakFocuses` (last
  ~30 attempts, ≥35% errors) and the audit's `persistent` table disagree, and neither is wrong. Take
  one drill per evidence read, never six at once.
- **P25-9 · Band 1 re-deals a failed item ahead of its own drill.** `buildSession`
  (`src/lib/training.ts`) serves last-wrong items first, so `uebersetzen-waehrend-regen` was failed
  in nine sessions running while all eight items of `drill-temporal-nebensatz` sat unserved; the
  delayed probe on the same competence runs 2/2. The fix is selection — cap re-deals, or let a due
  drill item of the same weak focus preempt band 1 — measured on the deal distribution before and
  after.
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
- **INS-7 · A placed-out topic never arms its probes.** 19 competences read "unarmed — needs the
  lesson opened" (`bun run progress:audit --profile vitaly`, *Can the gate be read?*), A1
  `nicht-position` among them, and that is exactly the error the learner still makes. A passed
  placement never raises the tier, by design, but it also leaves retention unmeasurable. First
  step: a proposal on whether a passed placement arms the topic's probe families.
