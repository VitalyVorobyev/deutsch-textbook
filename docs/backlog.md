# Active backlog

Status: active. The [roadmap](roadmap.md) owns direction; this file contains only executable or
calendar-blocked work. **A finished item leaves this file** — one line under *Recently completed*,
detail in an archive: [through 2026-07-26](archive/2026-07-backlog-full.md),
[2026-07-28 → 2026-08-02](archive/2026-08-backlog-shipped.md).

## Doing

### P5-11 · Evidence-led operating cadence

After every two B1 units: drain the grading queue, rerun `bun run progress:audit --profile vitaly`,
then decide whether content or drills need revision. Never author from a pre-triage focus table.

**Read of 2026-08-02** (queue drained at 165 ruled / 0 awaiting — 13 rulings, 2 accept, 11 confirm):
the A1 gate came due and missed both bars; the read and the roadmap-rule amendment it triggered are
in [roadmap.md](roadmap.md#retention-gate). Standing picture is unchanged from the three previous
reads: production assembly is the bottleneck (`translate` 41% against `cloze` 84%), `order` is
saturated at 98% so no new order items, and every persistent weak focus already has a serving drill
— **the owed action is the learner taking training, not authoring**. Six tags still show no recovery
after their last error: `akkusativ-artikel` (24/74), `haben-sein` (24/85), `nebensatz-verbende`
(17/53), `trennbar-wortstellung` (15/60), `da-wo-woerter` (11/49), `wo-wohin` (8/36). New drill
notes from this read: *einladen zu* (not *an*), `nicht` before a time adverb changing what is
negated, and expletive *es* disappearing once a real subject occupies the slot.

### P9-2 · Entdecken pieces

Recurring, at most one or two reviewed pieces per PR. Each must pass the editorial and provenance
contract in [future-content-directions.md](future-content-directions.md).

## Calendar gates

### A2 checkpoint review — approximately 2026-08-14

Review the checkpoint's completed 2/7/21-day evidence as a B1 revision trigger.

## Open

### Curriculum and content

- **P18-3 · B1.1–B1.3 measure one competence each with delayed evidence** — the contract requires
  one 3-variant family per competence; B1.1–B1.3 own 3 + 3 + 4 grammar points and shipped one
  family each. The 2026-08-02 amendment to [curriculum-a2-b1.md](curriculum-a2-b1.md) removed the
  reason this was expensive (P19-4 gave every family its own explicit `arming:` list, so a new
  family cannot move an existing one's `armedAt`). `adjektiv-nullartikel` is the remainder after
  this PR's six families.
- **P18-6 · `passiv-bildung`'s position half has no delayed evidence** — `probe-konsum-umwelt` is
  cloze ×3, and a cloze grades a form, never a position. The frame's position-2/clause-final half is
  graded only in practice, so a learner who reproduces the wrong bracket can pass all three stages.
  The remedy is a second response format — a translate family.
- **P19-3 · Irrealer Wunsch (*Wenn … doch/nur …!*) has no retrieval item** — B1.8 drills only the
  two-clause condition; the wish form sits in `### Feinheiten` with no item. A later KII-touching
  unit should own one production item (a `translate` pinning the one-word form beside *doch*/*nur*).
- **P19-6 · Reviewed A1 listening pack and delayed listening probes** — 15 original Goethe-style
  tasks in the official 6/4/5 structure plus two three-variant delayed families (telephone/number
  information, public directions/announcements), with committed audio, transcripts, accessibility
  text and provenance. The Listening Studio supplies the pipeline; this content task is what remains.
  Until it ships, public copy must describe exam practice as reading/writing/speaking only.
- **P20-2 · Four of the five backfilled A1 grammar points rest on one or two items** — `du-sie` and
  `perfekt-satzklammer` have exactly one each; five more have two. That clears the instrument
  honestly and is thin against the A2 norm. Not to be fixed by padding: the next A1 pass should
  thicken what a stop-at-A1 learner leans on hardest, which is the `du/Sie` and Perfekt-bracket pair.
- **P18-1 · `explain` prose drifted the way the articles did** — mean EN `explain` runs A1 28 w →
  A2 53 w → ~110 w in B1.4/B1.5 (max 167), against an A2 practice norm of ~50. Explanatory feedback
  is read *after* an error, where attention is scarcest. Decide a target, put it in
  [item-authoring.md](item-authoring.md), and revise the two B1 units' non-produktion sets;
  `-produktion` model answers are legitimately longer and need their own line.
- **P18-2 · `Kurz gesagt` exceeds its own target in two A2 files** — `a2/freunde-feste` (143 w) and
  `a2/arbeit-beruf` (144 w) against the ~100-word target. Median across 37 topics is 91, so these
  are outliers. Editing work, not a build failure.
- **P18-4 · The RU/UK produktion-set titles name goods, not speech** — all seven B1 `*-produktion`
  sets title themselves «Продукция»/«Продукція», which reads as manufactured output. If retitled,
  do all seven in one pass so the convention stays uniform.
- **C6-1 · Ukrainian calque audit** — review halves written before the German-first authoring
  ruling; language quality, not alphabet parity, is the target.
- **C6-2 · Verify the citation stress of `tatsächlich`** — `content/vocab/meinung-medien.yaml` has
  `ˈtaːtzɛçlɪç` (initial), supported by the derivation from *Tatsache*, the parallel `hauptsächlich`,
  and [lautschrift.md](lautschrift.md); a 2026-07-27 review argued for `taːtˈzɛçlɪç`, which is the
  emphatic realisation. Settle against Duden's primary entry, and apply to any other `-lich`
  adjective built on a compound.

### Instruments and gates

- **P5-11b · Mode coverage is unchecked** — `bun run validate` enforces the item-mix bar but never
  asks whether an outcome has a task in the mode it names. **A1 resolved 2026-07-31** (items declare
  `target_mode`; validation requires every A1 outcome's claimed mode to be practised). The B1 policy
  question is open, and publishing the corpus changed its shape rather than closing it: **every topic
  at every level now owns an `audio-comprehension` item** (A1 10/10, A2 22/22, B1 9/9), so the old
  asymmetry — five of seven B1 units carrying one — is gone. What remains is the rule itself: only
  `erfahrungen-erzaehlen` declares a listening outcome, so listening is now practised everywhere and
  claimed almost nowhere. Decide whether an outcome must name the mode it is measured in, write it
  down, then extend the A1 validator check to B1.
- **P12-6 · Dictation focus attribution** — **A1 resolved 2026-07-31**. A2/B1 dictations keep
  `dictationSlip`: extending the A1 silence to items without predicates dropped 145 of 291 free-typed
  tags and took `weakFocuses` from 7 to 1 — an inverted signal, not an honest gap (`um-am-zeit` read
  1% error at n = 30 against a real 21%). The work is authoring predicates for the ~50 focused A2/B1
  `listen` items, after which they get the A1 treatment item by item.
- **P12-7 · An accept list cannot be completed by enumeration** — standing policy, so nobody re-runs
  the ten-round loop #116/#117 became: close an item's *declared* product in one pass (the dimensions
  its own `answer`/`accept`/`explain` present as equivalent) and verify every cell through
  `gradeTranslation`; then stop. Renderings outside that product belong to
  `data/grading-decisions.yaml`. Prefer the two mitigations to a longer list: **name the token in the
  `instruction`** when the pin carries the focus, and **accept the sibling** when it does not.
- **P5-11c · The connector-determinacy check does not reach cloze gaps** — the rule reads
  `item.answer`/`item.accept`, which is the `translate` shape, so a cloze gap accepting one
  interchangeable connector and rejecting its sibling is unguarded. Read the comment above
  `INTERCHANGEABLE_CONNECTORS` first: `da` is deliberately absent because clause-initial *Da* is more
  often "then/there" than causal. A cloze equivalent needs sense disambiguation, not a longer list.
- **P22-9 · Markdown emphasis in a YAML text field reaches the learner as asterisks** — no exercise
  component runs a markdown pass. A blanket rule is wrong: `*` is also the ungrammaticality marker,
  used correctly in 64 places. The distinguishing test is that emphasis *closes* — a `*` preceded by
  a non-space and followed by space, punctuation or end-of-string — while the linguistic marker never
  does. Verify a candidate rule against both sets before landing it. Cost of not having it, 2026-08-02:
  a rewrite pass over the published `-hoeren` sets emphasised German with `*…*` before anyone checked
  whether `explain` renders markdown. It does not — `shared.tsx` puts it in a plain `<p>`. Caught by
  reading the component, not by a gate.
- **P22-14 · Per-line silence compounds with the inter-line pause, and nothing measures it** —
  each synthesised line carries its own leading and trailing silence (corpus medians 0.43 s and
  0.46 s), and `assemble` then adds `pause_after_ms` (450 ms) between lines. So a normal turn
  boundary is ~1.4 s of dead air, and an unlucky pair runs past 2 s: `ls-wohnen-01` line-6 alone
  carries 2.83 s of lead+trail. Two lines in `ls-gesundheit-wohlbefinden-01` were re-rolled by
  seed after Vitaly heard them, but that is treating instances. The fix is to trim each take's
  lead and trail at assembly and let `pause_after_ms` be the whole gap — which would tighten all
  41 artifacts and **invalidate every approval**, so it is a between-waves change, not a now
  change. Note the measurement trap while here: words per second of wall clock ranks "Und heute?"
  as the corpus's slowest line because short utterances are dominated by fixed pause overhead.
  Words per second of *voiced* audio (median 2.96) is the metric that finds real defects.
- **P22-10 · Nothing in the repo compares a recording's length to the length the plan asked for** —
  `duration_seconds` is authored per artifact in `data/listening-plan.yaml`; the studio's approval
  page states the comparison and `tools/listening-studio/authoring/audio_report.py` measures it, but
  neither `bun run validate` nor `bun run listening:inventory` can see it. Current read
  (`uv run python authoring/audio_report.py`): **twelve of forty-one outside their window** — ten of
  Wave 1's twelve, unchanged, plus `ls-trennbare-verben-01` (33.4 s against 35–45) and
  `ls-man-und-besitz-01` (46.9 s against 35–45), which the voice-drift re-seeding pushed out of a
  window they used to sit inside. Steadier delivery is faster; the windows were written before the
  corpus existed. **Do not amend a window to match what shipped** — decide per artifact whether the
  script is short, and fix the script.
- **P22-11 · Nothing detects two vocab entries that answer the same production prompt** — two
  entries whose glosses reduce to the same content words are two correct answers to one question.
  `Angebot`/`Sonderangebot` was found by the learner, not by a gate. A throwaway scan flags 129
  candidate pairs, but that is **not** a defect count: it strips parentheticals, which is exactly
  where the corpus puts its disambiguators (`öffnen`/`aufmachen` name each other and are correctly
  separated), and it scores a subset as a full collision (`drei` vs `dreimal`). Verified genuine:
  `Stock`/`Stockwerk`/`Etage` are all "floor, storey · этаж" — true synonyms, so that one needs an
  editorial ruling, not a mechanical fix. Build the detector to respect parentheticals and require
  mutual overlap, then triage against the lapse table (`aufmachen`, `Aufgabe`, `Anweisung`,
  `Empfehlung` sit high on both).
- **P22-15 · The Studio cannot author a `uk` half, so the repo's copy is the only one** —
  `RevisionPayload` carries `Bilingual.uk` and it is `None` on all 41 artifacts, because no editor
  surface writes it. Publishing therefore emitted 82 files with `en`/`ru` only, and
  `tests/i18n-content.test.ts` — the ratchet that holds every ru-bearing content file at parity —
  failed. The 246 uk fields were authored by hand **into the published YAML**, which means the
  Studio and the repo now disagree about those artifacts. Nothing silently loses them (`publish`
  refuses to overwrite), but the next wave repeats the whole exercise. Fix by giving the Studio the
  field: the third column in the question editor, and `uk` in `draft_prompt`'s shape. Until then,
  any new listening artifact needs the same manual pass — budget it into the wave, not after it.
- **P22-16 · Delivery settings do not vary by level** — `pace` and `pause_after_ms` are flat across
  A1, A2 and B1 (450 ms between every line in all 41 artifacts), and nothing in
  `scripts/validate.ts` or `data/listening-plan.yaml` checks them against the artifact's level. An
  A1 listener needs more room between turns than a B1 listener and the corpus gives them the same.
  The fix is a per-level delivery profile in `data/listening-plan.yaml` with validator enforcement —
  but changing either field changes `line_cache_key`, so it re-synthesises every artifact at that
  level and **invalidates its approval**. Between-waves work, same class as P22-14, and worth doing
  in the same pass as that one so the approval cost is paid once.
- **P22-12 · The positional-option rule cannot see a bare ordinal** — `src/lib/option-references.ts`
  anchors on an option noun, because scanning every ordinal in the shuffled-option corpus returns 203
  occurrences of which most are correct grammar prose. A field whose *only* positional reference is a
  bare ordinal ("Третьего не происходит вовсе") is therefore invisible. Fields with a flagged sibling
  phrase are covered, since the rule reports the whole field. Needs sense disambiguation to go further.
- **P22-5 · A rebuilt export keeps the previous revision's files** — `write_bundle` reuses the export
  directory, so a contextual source dropped by a new revision survives under `sources/`, enters
  `exported_files` and the ZIP, and is published although the manifest's `contextual_sources` no
  longer describes it. Build into a clean directory.
- **P22-6 · Freesound source URLs are matched by prefix** — `sources.py` accepts
  `https://freesound.org/s/1234` for `sound_id: 123`, so a metadata typo can credit a different
  upload while every validation step passes. Parse the URL; require the sound-id segment to equal
  `sound_id`.
- **P12-8 · The two answer highlights come from two LCS runs** — `Translate` calls
  `diffExpectedWords` twice with the arguments swapped, and each traversal picks its own
  direction-dependent alignment, so a transposition can mark different words on the two sides. Both
  cues still land in the right region and nothing about scoring or attribution is touched — a display
  refinement. Return both flag arrays from one traversal in `src/lib/worddiff.ts`.
- **P18-8 · `review:gate` cannot see a review whose body omits the Reviewed-commit line** —
  `scripts/pr-review-gate.ts` proves review-of-HEAD only by parsing "Reviewed commit: `sha`" out of
  bodies; #124's wrap-up review omitted the line while its API `commit_id` carried the exact HEAD sha.
  Also read `commit_id`; keep the body regex as fallback. Until then verify by hand:
  `gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | last | .commit_id'`
- **P20-3 · The live card-id migration's call site has no automated coverage** — the test environment
  has no IndexedDB, so `tests/card-id-migration.test.ts` cannot execute `getStore`'s call into
  `migrateStoredCardIds`. That seam is where #128's P1 lived. Adding `fake-indexeddb` is worth it the
  next time anything touches profile-scoped storage.

### Product surfaces

- **P21-1 · Standard written forms are taught but never practised as forms** — the course teaches the
  parts (`content/reference-data/briefe.yaml`) and names the situations, but nothing asks the learner
  to *assemble* a Bewerbung, Beschwerde or formal e-mail and gives meaningful feedback. `write` cannot
  do it: minimal-ceremony by contract, and the app cannot verify free production. Open question, not a
  decided design — an item type grading *structure* (are the required sections present, in order, at
  one register?) would stay inside what a program can check, but it needs the seven placement-style
  rules thought through before any schema. A form task that grades wording would reject correct
  German at scale.
- **P21-2 · The written-forms material has no index** — `briefe`, the register conventions and the
  topics that use them are reachable only by knowing they exist. An Entdecken piece is the natural
  home. Sized small.
- **P21-3 · The Atlas has almost no cross-links** — no link from a topic to a Referenz page, none from
  Referenz back into the topics that teach a form, no topic-to-topic "see also".
  `/referenz/zeitformen` shows the pattern to generalise (its per-form lesson chips are **derived**
  from `focusIntroducedBy` and cannot drift) and the remaining gap (the reverse edge does not exist
  anywhere). Worth one pass over the whole graph — a half-linked graph reads as an oversight.
- **P20-1 · The A1 exam-practice surface has one entry point and one owner topic** — `/pruefung/a1`
  is linked only from `/about`. Separately, all three sets declare `topic: freizeit-koennen` while
  their items name outcomes from six topics: accurate for `role: exam-practice`, but the `topic:`
  field then says something untrue. Both are shape questions — where exam practice belongs in
  navigation is a product call, and giving the role a level instead of a topic is a schema change.
- **P13-1 · Spoken-mode placement evidence** — document or prototype only when the app can collect
  mode-valid evidence; written selection must never masquerade as speech.
- **P13-2 · Next-level placement offer** — surface a newly available level test without hard-locking.
- **P5-7 · Listening retention pilot** — after the A1 gate, pilot only `termine-vereinbaren` and
  `reisen-verkehr`, then observe a complete 2/7/21-day cycle.

## Deferred

- committed neural-TTS expansion;
- pronunciation assistance;
- runtime mission grouping;
- branching missions.

These require a measured learning or usability need. They do not block the curriculum.

## Recently completed

Detail in [the 2026-08 archive](archive/2026-08-backlog-shipped.md).

- **P22-1 (2026-08-02):** the reviewed unit listening corpus, **published**. 41 artifacts across all
  live units, every one human-approved and hash-bound to the bytes that shipped: 14.2 MB of MP3 and
  41 `-hoeren` practice sets in `content/`, 13.7 MB of Freesound provenance in `data/`, carried by
  both shipping builds. 17 superseded TTS items retired against a per-item ledger
  ([audio-retirement-ledger.md](audio-retirement-ledger.md)). The A1 Goethe pack (P19-6) remains
  open as its own task.
- **P22-2 · P22-3 · P22-4 (2026-08-02):** master/derivative split decided before the first commit;
  adapter switch can no longer save an unloadable payload; `bun tauri dev` serves recordings.
- **P3-6 (2026-08-02):** A1 retention cohort read on its gate date — missed both bars, rule amended
  to advisory. See [roadmap.md](roadmap.md#retention-gate).
- **P12-4 · P12-5 · P19-4 · P5-11d (2026-07-31):** focus evidence separated from answer constraints,
  inserted-token attribution, and probe arming keyed to exact verified items.
- **P19-1 · P19-2 · P17-6 (2026-07-31):** A1 backfill of the five late grammar points; honest audit
  label for the untagged A1 probe family; item-scoped document stimuli.
- **P17-1–4 · P9-2 (2026-07-26):** semantic visual families and two Entdecken pieces.
- **B1.1–B1.3 (2026-07-24/25)** and **A2 close (2026-07-24)**.
