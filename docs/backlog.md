# Active backlog

Status: active. The [roadmap](roadmap.md) owns direction; this file contains only executable or
calendar-blocked work. **A finished item leaves this file** — one line under *Recently completed*,
detail in an archive: [through 2026-07-26](archive/2026-07-backlog-full.md),
[2026-07-28 → 2026-08-02](archive/2026-08-backlog-shipped.md).

An entry is *what*, *why in one line*, *where the evidence is* (file:line or command) and *the first
step*. Measurement essays, dated reads and PR history live in
[the 2026-08 doc-slimming archive](archive/2026-08-doc-slimming.md).

## Doing

### P5-11 · Evidence-led operating cadence

After every two B1 units: drain the grading queue, rerun `bun run progress:audit --profile vitaly`,
then decide whether content or drills need revision. **Never author a drill from a pre-triage
weak-focus table** — a pre-triage table names confusions the scorer invented.

Standing conclusion across five reads: **every persistent tag has a serving drill, so the owed
action is the learner taking training, not authoring.** The one exception the 2026-08-03 read found
— `temporal-nebensatz` persistent with nothing drilling it — is closed by
`content/exercises/b1/drill-temporal-nebensatz.yaml`. Production assembly is the durable weakness:
`translate` runs well under `cloze` and `mc` on every read. That read, and the drill notes banked
from it but not yet authored: [archive](archive/2026-08-doc-slimming.md).

### P9-2 · Entdecken pieces

Recurring, at most one or two reviewed pieces per PR. Each must pass the editorial and provenance
contract in [future-content-directions.md](authoring/future-content-directions.md).

## Calendar gates

### A2 checkpoint review — approximately 2026-08-14

Review the checkpoint's completed 2/7/21-day evidence as a B1 revision trigger.

## Open

### Curriculum and content

- **P18-3 · B1.1–B1.3 measure one competence each with delayed evidence** — the contract requires
  one 3-variant probe family per competence; those three units own 3 + 3 + 4 grammar points and
  shipped one family each. No longer expensive: P19-4 gave every family its own explicit `arming:`
  list, so a new family cannot move an existing one's `armedAt`. First step: `adjektiv-nullartikel`,
  the one competence still without a family.
- **P18-6 · `passiv-bildung`'s position half has no delayed evidence** — `probe-konsum-umwelt` is
  cloze ×3, and a cloze grades a form, never a position, so a learner who reproduces the wrong
  bracket passes all three stages. First step: a `translate` family for the position-2/clause-final
  frame.
- **P19-3 · Irrealer Wunsch (*Wenn … doch/nur …!*) has no retrieval item** — B1.8 drills only the
  two-clause condition; the wish form sits in `### Feinheiten` with no item. First step: a later
  KII-touching unit owns one `translate` pinning the one-word form beside *doch*/*nur*.
- **P19-6 · Reviewed A1 listening pack and delayed listening probes** — 15 original Goethe-style
  tasks in the official 6/4/5 structure plus two three-variant delayed families (telephone/number
  information, public directions/announcements), with committed audio, transcripts, accessibility
  text and provenance. The Listening Studio supplies the pipeline; this is the content half. Until
  it ships, public copy must describe exam practice as reading/writing/speaking only.
- **P20-2 · Four of the five backfilled A1 grammar points rest on one or two items** — `du-sie` and
  `perfekt-satzklammer` have exactly one each, five more have two: honest against the instrument,
  thin against the A2 norm. Not to be fixed by padding. First step: thicken what a stop-at-A1
  learner leans on hardest, the `du/Sie` and Perfekt-bracket pair.
- **P18-1 · `explain` prose drifted the way the articles did** — mean EN `explain` runs A1 28 w →
  A2 53 w → ~110 w in B1.4/B1.5 (max 167), counted as whitespace-separated words over `explain.en`
  across each level's `role: practice` sets. Explanatory feedback is read *after* an error, where
  attention is scarcest. First step: decide a target, put it in
  [item-authoring.md](authoring/item-authoring.md), then revise the two B1 units' non-`produktion`
  sets; `-produktion` model answers are legitimately longer and need their own line.
- **P18-2 · `Kurz gesagt` exceeds its own target in two A2 files** — `a2/freunde-feste` and
  `a2/arbeit-beruf` run ~145 words against the ~100-word target, well outside the corpus median
  (`bun scripts/prose-shape.ts content/topics --worst`). Editing work, not a build failure.
- **P18-4 · The RU/UK produktion-set titles name goods, not speech** — all seven B1 `*-produktion`
  sets title themselves «Продукция»/«Продукція», which reads as manufactured output. If retitled,
  do all seven in one pass so the convention stays uniform.
- **C6-1 · RU/UK calque triage with the prose-reviewer skill** — was "Ukrainian calque audit";
  widened 2026-08-05 when a learner report caught calqued *Russian* in `b1/digitales-leben` (RU and
  UK failed in the same sentences — both shaped by the EN template). Instrument now exists: the
  `textbook-text-reviewer` skill loop (`docs/authoring/article-prose.md`). Scope by evidence, not
  blanket: a 3-unit spot-check of B1 RU `Kurz gesagt` blocks (`meinung-medien`, `leben-veraendern`,
  `informationen-vermitteln`) found none, so triage at *section* granularity, worst-suspects first
  (units authored earliest in the B1 pipeline), and stop when a unit reviews clean. Language
  quality, not alphabet parity, is the target.
- **C6-2 · Verify the citation stress of `tatsächlich`** — `content/vocab/meinung-medien.yaml` has
  initial `ˈtaːtzɛçlɪç` (derivation from *Tatsache*, parallel `hauptsächlich`); a review argued for
  `taːtˈzɛçlɪç`, which is the emphatic realisation. Settle against Duden's primary entry and apply
  to any other `-lich` adjective built on a compound.

### Instruments and gates

- **P25-6 · 73 B1 Wortliste rows are structurally cardless — decide which can earn `~`** — after
  lexis wave 4b (2026-08-06) B1 coverage is 3343/3416: 3279 cards, 64 grammar `~`, 73 open. The 73
  (the `NOCARD` set in the wave-4 partition) are bound morphemes (`hell-`, `-weise`, `irgend-`),
  abbreviations (`bzw.`, `EG`, `vgl.`), correlative frames (`je … desto`, `sowohl … als auch`,
  `um … zu`), and full forms whose short forms ship (`Personenkraftwagen`, `Akkumulator`). Several
  of the frames are grammar-taught, so they may earn `~` markers — but a `~` must be earned (the
  validator requires the word in the taught surface) and each needs a manifest line. Go row by row;
  the rest stay open with this entry as the reason, and no coverage figure may round them away. — when an existing
  `ipa` sits below a comment block it fails to see it and writes a second key
  (`charakter-eigenschaften-a2`, `eigenschaften-dinge-a2`, `erfahrungen-erzaehlen`,
  `infinitiv-mit-zu`, `ort-richtung-verweis-b1`; hit and reverted during wave 2b, 2026-08-05).
  Until fixed, run it only with `--only <deck>`; the fix is in the writer's did-I-already-fill-this
  check, and duplicate-key YAML should also fail `bun run validate`.
- **P23-3 · Six of the seven tags the runtime prioritises have no drill, and all six are B1** —
  cross `weakFocuses` (`src/lib/weakness.ts`) against every `role: drill` item's `focus`; fifteen of
  the sixteen drill sets are A1 or A2. **Read both instruments before deciding**: `weakFocuses`
  takes the last ~30 attempts per focus at a ≥35% bar and drives what mixed training serves *now*,
  while the audit's `persistent` table asks whether a confusion is durable across ≥2 items. They
  disagree and neither is wrong ([archive](archive/2026-08-doc-slimming.md)). **Do not author six
  drills at once** — a serving drill the learner never opens changes nothing (P5-11); take the next
  one from the next read.
- **P23-2 · A revision bump that only widens `accept` makes the retention table stop re-grading** —
  `classifyProbe` (`scripts/progress-audit.ts:769`) re-grades a probe attempt against the item's
  current spec only when the attempt's `itemRevision` still matches (`:386`); otherwise it falls
  back to the stored historical tag, which CLAUDE.md elsewhere says must never be trusted. A widened
  `accept` list does not change the question, so replaying against it is the only way a false
  negative is ever corrected. **Verify against the corpus before acting** — this is a mechanism
  read, and the one measurement taken found no row affected
  ([archive](archive/2026-08-doc-slimming.md)).
- **P5-11b · Mode coverage is unchecked** — `bun run validate` enforces the item-mix bar but never
  asks whether an outcome has a task in the mode it names. **A1 is resolved**: items declare
  `target_mode`, and validation requires every A1 outcome's claimed mode to be practised. Every
  topic at every level now owns an `audio-comprehension` item, so listening is practised everywhere
  and claimed almost nowhere — only `erfahrungen-erzaehlen` declares a listening outcome. First
  step: decide whether an outcome must name the mode it is measured in, write it down, then extend
  the A1 validator check to B1.
- **P24-8 · `bun run gen:ipa` writes a duplicate `ipa:` key when a comment line precedes the
  field** — observed 2026-08-04 on five decks (`erfahrungen-erzaehlen`, `infinitiv-mit-zu`,
  `charakter-eigenschaften-a2`, `eigenschaften-dinge-a2`, `ort-richtung-verweis-b1`) and reverted by
  hand; YAML keeps the last key, so a reviewed transcription is silently replaced by a generated
  one. First step: make the writer idempotent, and add the comment-preceded case to its test.
- **P24-9 · Article comprehensibility is felt, not measured** — perceived difficulty varies
  substantially between topics (owner, 2026-08-04) and no instrument sees it: `prose-shape` checks
  paragraph *shape*, and CEFR discipline binds only at authoring time. **(a) is shipped**:
  `bun scripts/comprehensibility.ts <level>/<topic-id>` reports ahead-of-the-learner tokens per
  section with the words listed, sentence length and Nebensatz density, and terminology density per
  explanation half; `--rank` ranks a level or all three against medians read off the corpus
  (`src/lib/comprehensibility.ts`, [doc](authoring/coverage-instruments.md)). It is read-only and
  gates nothing. Two things remain. **Calibrate before trusting it**: rank all 46 topics against
  the owner's felt-difficulty list, because a ranking nobody has checked against the feeling it was
  built to explain is still an assertion. The four known false-positive classes (proper names,
  strong-verb ablaut, glossed reading words, per-language glosses inside German tables) are listed
  in the doc and are only worth chasing if calibration says they move the order. Then **(b) learner
  evidence** — a per-topic pretest→first-blocked-practice accuracy delta in `progress:audit`, since
  an article that taught reads as a positive delta. Outliers are the product, never caps.
- **P12-6 · Dictation focus attribution** — A1 is resolved; A2/B1 dictations keep `dictationSlip`,
  because extending the A1 silence to items without predicates dropped 145 of 291 free-typed tags
  and took `weakFocuses` from 7 to 1 — an inverted signal, not an honest gap
  ([archive](archive/2026-08-doc-slimming.md)). First step: author `focus_evidence` predicates for
  the ~50 focused A2/B1 `listen` items, then give them the A1 treatment item by item.
- **P12-7 · An accept list cannot be completed by enumeration** — standing policy: close an item's
  *declared* product in one pass (the dimensions its own `answer`/`accept`/`explain` present as
  equivalent), verify every cell through `gradeTranslation`, then stop. Renderings outside that
  product belong to `data/grading-decisions.yaml`. Prefer the two mitigations to a longer list:
  **name the token in the `instruction`** when the pin carries the focus, and **accept the sibling**
  when it does not.
- **P5-11c · The connector-determinacy check does not reach cloze gaps** — the rule reads
  `item.answer`/`item.accept`, which is the `translate` shape, so a cloze gap accepting one
  interchangeable connector and rejecting its sibling is unguarded. Read the comment above
  `INTERCHANGEABLE_CONNECTORS` first: `da` is deliberately absent because clause-initial *Da* is
  more often "then/there" than causal. A cloze equivalent needs sense disambiguation, not a longer
  list.
- **P22-9 · Markdown emphasis in a YAML text field reaches the learner as asterisks** — no exercise
  component runs a markdown pass; `explain` lands in a plain `<p>` (`shared.tsx`). A blanket rule is
  wrong: `*` is also the ungrammaticality marker, used correctly in 64 places. The distinguishing
  test is that emphasis *closes* — a `*` preceded by a non-space and followed by space, punctuation
  or end-of-string — while the linguistic marker never does. Verify a candidate rule against both
  sets before landing it.
- **P22-14 · Per-line silence compounds with the inter-line pause, and nothing measures it** — each
  synthesised line carries its own lead and trail (corpus medians 0.43 s and 0.46 s) and `assemble`
  then adds `pause_after_ms` (450 ms), so a normal turn boundary is ~1.4 s of dead air and an
  unlucky pair runs past 2 s. Fix by trimming each take's lead and trail at assembly and letting
  `pause_after_ms` be the whole gap — which re-synthesises all 41 artifacts and **invalidates every
  approval**, so it is between-waves work, best paid for in the same pass as P22-16. Measure in
  words per second of *voiced* audio (median 2.96), never of wall clock.
- **P22-10 · Nothing in the repo compares a recording's length to the length the plan asked for** —
  `duration_seconds` is authored per artifact in `data/listening-plan.yaml` and
  `tools/listening-studio/authoring/audio_report.py` measures the gap, but neither `bun run validate`
  nor `bun run listening:inventory` can see it; that read (2026-08-04) put **twelve of forty-one
  outside their window**. **Do not amend a window to match what shipped** — decide per artifact
  whether the script is short, and fix the script. Start with the two worst by proportion,
  `ls-lernen-zukunft-01` (44.4 s against 65–85) and `ls-arbeit-beruf-01` (23.7 s against 40–50).
- **P22-11 · Nothing detects two vocab entries that answer the same production prompt** — two
  entries whose glosses reduce to the same content words are two correct answers to one question;
  `Angebot`/`Sonderangebot` was found by the learner, not by a gate. A throwaway scan's 129
  candidate pairs are **not** a defect count ([archive](archive/2026-08-doc-slimming.md)). First
  step: build the detector to respect parentheticals and require mutual overlap, then triage against
  the lapse table. `Stock`/`Stockwerk`/`Etage` is verified genuine and needs an editorial ruling.
- **P22-19 · An audio-only topic escapes the item-mix bar entirely** — `scripts/validate.ts:751`
  builds `practiceItems` with `audio-comprehension` filtered out and then guards the whole block
  with `if (practiceItems.length > 0)`, so a topic whose `role: practice` sets held only recorded
  items would skip the two ratios *and* the two-translate minimum. Not reachable today — every topic
  pairs its `-hoeren` set with written practice — but it is a hole in the gate, and the next
  audio-first topic walks through it. Fix: decide *whether the topic has practice* from the
  unfiltered list, and use the filtered list only as the ratios' denominator.
- **P22-20 · The documented Qwen download is unpinned and the loader is not** —
  `scripts/download-qwen3-tts.py:55` calls `snapshot_download` with no `revision`, while
  `QwenTTS.revision` fixes `85e237c1…` and `locked_snapshot` accepts only that metadata. Today
  upstream `main` happens to match; once it advances, `install-qwen.sh` pulls a multi-gigabyte
  checkpoint, exits 0, and the Studio then reports the model as not found — a failure that appears
  nowhere near the command that caused it. Fix: pass the pinned revision to the downloader.
- **P22-18 · `soundfile` is pinned twice, at two versions** — `pyproject.toml` and `uv.lock` say
  `0.13.1`; `requirements-qwen-runtime.txt` says `0.14.0`. The documented order (`uv sync`, then
  `install-qwen.sh`) therefore leaves an environment that disagrees with its own package metadata,
  and a later `uv sync` downgrades it back. Two lines; pick one version and use it in both. While
  there: the 41 committed manifests record `dependency_lock_sha256` as it stood when the audio was
  approved, which is what a provenance record should say — do **not** refresh those hashes.
- **P22-17 · `draft-wave` cannot draft a Qwen-seeded project** — `cli.py`'s `ENGINE` is now
  `qwen_tts`, so `seed-wave` writes payloads carrying Qwen voices, but `generate_drafts` still
  forces `"tts_adapter": "parler_tts"` into the final payload (`adapters.py:298`) without
  reassigning them; Parler validates only its own voice set, so every draft is rejected and the wave
  stays undrafted. The seeded payload's adapter is authoritative — the line should read
  `payload.tts_adapter`. Verifying it end to end needs the MLX generation stack; it blocks the next
  wave's first command, so do it before seeding Wave 3.
- **P22-15 · The Studio cannot author a `uk` half, so the repo's copy is the only one** —
  `RevisionPayload` carries `Bilingual.uk` and it is `None` on all 41 artifacts, because no editor
  surface writes it. The 246 uk fields were authored by hand into the published YAML, so the Studio
  and the repo now disagree about those artifacts; nothing silently loses them (`publish` refuses to
  overwrite), but the next wave repeats the exercise. Fix: a third column in the question editor and
  `uk` in `draft_prompt`'s shape. Until then, budget the manual pass into the wave, not after it.
- **P22-16 · Delivery settings do not vary by level** — `pace` and `pause_after_ms` are flat across
  A1, A2 and B1 (450 ms between every line in all 41 artifacts), and nothing in `scripts/validate.ts`
  or `data/listening-plan.yaml` checks them against the artifact's level. An A1 listener needs more
  room between turns than a B1 listener. Fix with a per-level delivery profile in
  `data/listening-plan.yaml` plus validator enforcement — but either field changes `line_cache_key`,
  so it re-synthesises that level and **invalidates its approval**. Between-waves work; pair it with
  P22-14 so the approval cost is paid once.
- **P22-12 · The positional-option rule cannot see a bare ordinal** — `src/lib/option-references.ts`
  anchors on an option noun, because scanning every ordinal in the shuffled-option corpus returns
  203 occurrences of which most are correct grammar prose. A field whose *only* positional reference
  is a bare ordinal is therefore invisible; fields with a flagged sibling phrase are covered, since
  the rule reports the whole field. Needs sense disambiguation to go further.
- **P22-5 · A rebuilt export keeps the previous revision's files** — `write_bundle` reuses the
  export directory, so a contextual source dropped by a new revision survives under `sources/`,
  enters `exported_files` and the ZIP, and is published although the manifest's `contextual_sources`
  no longer describes it. Build into a clean directory.
- **P22-6 · Freesound source URLs are matched by prefix** — `sources.py` accepts
  `https://freesound.org/s/1234` for `sound_id: 123`, so a metadata typo can credit a different
  upload while every validation step passes. Parse the URL; require the sound-id segment to equal
  `sound_id`.
- **P12-8 · The two answer highlights come from two LCS runs** — `Translate` calls
  `diffExpectedWords` twice with the arguments swapped, and each traversal picks its own
  direction-dependent alignment, so a transposition can mark different words on the two sides.
  Display only — scoring and attribution are untouched. Return both flag arrays from one traversal
  in `src/lib/worddiff.ts`.
- **P18-8 · `review:gate` cannot see a review whose body omits the Reviewed-commit line** —
  `scripts/pr-review-gate.ts` proves review-of-HEAD only by parsing "Reviewed commit: `sha`" out of
  review bodies, and a review can carry the exact HEAD sha in its API `commit_id` while omitting the
  line. Also read `commit_id`; keep the body regex as fallback. Until then verify by hand:
  `gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '[.[] | select(.user.login == "chatgpt-codex-connector[bot]")] | last | .commit_id'`
- **P20-3 · The live card-id migration's call site has no automated coverage** — the test
  environment has no IndexedDB, so `tests/card-id-migration.test.ts` cannot execute `getStore`'s
  call into `migrateStoredCardIds`, and that seam is where a shipped P1 defect lived. Add
  `fake-indexeddb` the next time anything touches profile-scoped storage.

### Product surfaces

- **P25-1 · `/ueben/wortschatz` is a ~19,000 px flat deck list on a phone** — 22.3 viewport-heights
  at 390 px, one card per deck for the whole corpus, and every Wortliste wave makes it longer.
  Group by level with collapsed sections and/or a filter row. Evidence and method:
  [ux-audit-2026-08.md](quality/ux-audit-2026-08.md). First step: pick grouping vs filter (the
  Fortschritt vocab section's per-level summary is the in-house precedent).
- **P25-2 · Topic-page paradigm tables have no overflow container** — five per topic page, no
  viewport excepted; three-column paradigms fit 390 px by squeezing, and a wider paradigm clips
  with no gate seeing it. Fix once at the prose-table rendering layer in the topic template, never
  per-table. Evidence: [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).
- **P25-3 · Sub-44 px touch targets on the daily loop's surfaces** — measured at 390 px: theme
  toggle 30 px, profile button 30, Eingabe mode chips 28, "Mark as learned" 26, taught-in chips 22,
  crumb links 17. Apply the existing `min-h-11 sm:min-h-0` pattern to the listed sites; one pass,
  no redesign. Evidence: [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).

- **P24-5 · The one-pass derived cross-link graph, and a structured Referenz IA** — **subsumes
  P21-3**, and carries **P25-4** (reference pages run 9–13 screens with no in-page navigation — an
  anchor index rides on the IA pass, [ux-audit-2026-08.md](quality/ux-audit-2026-08.md)): no link
  from a topic to a Referenz page, none from Referenz back into the topics that
  teach a form, no topic-to-topic "see also".
  [ADR 0007](adrs/0007-derived-cross-links-never-hand-maintained.md) settles the how — every edge is
  **derived** from `focusIntroducedBy` (`src/lib/focus-tags.ts`), `deepens` edges and reference-data
  keys, never a hand-maintained list. **The reverse edge and the index IA shipped 2026-08-06**:
  five reference files carry a validator-checked page-level `focus` list, `TaughtIn.astro` renders
  the derived chips on their pages, and `/referenz` is grouped by function. What remains here:
  topic→Referenz edges, topic→topic "see also" (from `deepens` + shared tags), the P25-4 in-page
  anchor nav, and finer-grained per-section edges where a page's data supports them
  (sentence-connector relations already have ids). Where an editorial relation has no data behind
  it, add the datum, not a link.
- **P23-1 · Six pages inline most of the corpus and run 4.6–10.7 MB of HTML** —
  `find dist -name '*.html' -exec wc -c {} + | sort -rn` over a current build: 162 pages at a
  137 KB median, but `/ueben/wortschatz`, `/session`, `/progress`, `/`, `/ueben/wiederholen` and
  `/ueben/training` carry **42 MB of the 68 MB** between them, and those six are the pages the daily
  loop starts from. Fix by not inlining the whole deck/item set into the island's props and fetching
  it per view; sizing that is its own task. Do **not** treat the service worker's byte budget as the
  fix.
- **P21-1 · Standard written forms are taught but never practised as forms** — the course teaches
  the parts (`content/reference-data/briefe.yaml`) and names the situations, but nothing asks the
  learner to *assemble* a Bewerbung, Beschwerde or formal e-mail with meaningful feedback. `write`
  cannot do it: minimal-ceremony by contract. Open question, not a decided design — an item type
  grading *structure* (required sections, in order, at one register) stays inside what a program can
  check, but a form task that graded *wording* would reject correct German at scale, so the seven
  placement-style rules need thinking through before any schema.
- **P21-2 · The written-forms material has no index** — `briefe`, the register conventions and the
  topics that use them are reachable only by knowing they exist. An Entdecken piece is the natural
  home. Sized small.
- **P20-1 · The A1 exam-practice surface has one entry point and one owner topic** — `/pruefung/a1`
  is linked only from `/about`, and all three sets declare `topic: freizeit-koennen` while their
  items name outcomes from six topics: accurate for `role: exam-practice`, but the `topic:` field
  then says something untrue. Both are shape questions — where exam practice belongs in navigation
  is a product call, and giving the role a level instead of a topic is a schema change.
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

- **P24-4 · Klassiker wave** (2026-08-06) — all ten classics live as extensive readings on their
  owning topics; four trimmed into the band; corpus source moved to `sources/klassiker/` (the
  home decision ADR 0006 deferred); `klassiker-lesen` Entdecken piece indexes the strand.

Detail in [the 2026-08 archive](archive/2026-08-backlog-shipped.md); closures before 2026-07-28 in
[the 2026-07-26 archive](archive/2026-07-backlog-full.md).

- **P24-7 (2026-08-06):** below 640 px the seven-link nav is a `<details>` disclosure — the trigger
  shows the active tab, the panel holds all seven links at equal weight (44 px targets, outside-tap
  and Escape dismiss, works without JS), ≥640 px unchanged; plus the Tippen-card spacing tightened
  (~35 px reclaimed) so prompt-through-insert-bar fits with the iOS keyboard up (real-device
  confirmation rides on the owner's next walk, same caveat as P24-10). The audit half of the entry
  shipped 2026-08-05 as [ux-audit-2026-08.md](quality/ux-audit-2026-08.md).
- **P24-6 · P24-10 (2026-08-05):** the mobile quick wins — `autoCorrect="off"` on all five exercise
  inputs (plus `lang`/`autoCapitalize` on FormFill), `Write`'s textarea suppresses autocorrect while
  **spellcheck stays on deliberately** (advisory-only assist boundary; flagged in the code); and the
  flashcard rating row is sticky above `env(safe-area-inset-bottom)` on phones — sticky over
  scroll-into-view because it also holds when the card back is taller than one viewport. Verified at
  390×844 with a long-note card.
- **P24-1 (2026-08-05):** the first-run gate offers optional sign-in below the first-class local
  path — providers from the session, absent when the deployment has none and in the desktop app;
  OAuth display name prefills the editable name field and nothing more; pending stated with the
  AccountPanel wording. The entry's one server-side question answered: **no Worker change** —
  `safeReturnTo` already accepts any same-origin path, so the gate signs in with the current page
  as `returnTo` and lands back in the gate.
- **P24-2 (2026-08-05):** sync state visible in the profile menu — pending/blocked from the session
  the menu already fetches on open, bound/never/synced-N-ago from the persisted sync state, no
  network request added. No persisted error variant on purpose: outcomes are ephemeral, and a stale
  "synced N ago" is the honest outage signal ADR 0004 wants. The force button was demoted in P24-3.
- **P24-3 (2026-08-05):** the merged Fortschritt/Konto surface — Konto merged into the Daten tab
  (no fourth tab, per [ADR 0005](adrs/0005-one-surface-for-fortschritt-and-konto.md) as settled),
  `/konto` now a query-preserving redirect, one snapshot-load path whose cloud push follows account
  state, and Übersicht reordered summary-first: activity card (stats + heatmap) on top, topic/POS
  vocab detail and the session table behind disclosures, the developer intro paragraph cut to one
  learner-facing line.

- **P22-1 (2026-08-02):** the reviewed unit listening corpus, **published** — 41 artifacts across
  all live units, every one human-approved and hash-bound to the bytes that shipped, with 17
  superseded TTS items retired against a per-item ledger
  ([audio-retirement-ledger.md](quality/audio-retirement-ledger.md)). The A1 Goethe pack (P19-6)
  remains open as its own task.
- **P22-2 · P22-3 · P22-4 (2026-08-02):** master/derivative split decided before the first commit;
  adapter switch can no longer save an unloadable payload; `bun tauri dev` serves recordings.
- **P3-6 (2026-08-02):** A1 retention cohort read on its gate date — missed both bars, rule amended
  to advisory. See [roadmap.md](roadmap.md#retention-gate).
- **P12-4 · P12-5 · P19-4 · P5-11d (2026-07-31):** focus evidence separated from answer constraints,
  inserted-token attribution, and probe arming keyed to exact verified items.
- **P19-1 · P19-2 · P17-6 (2026-07-31):** A1 backfill of the five late grammar points; honest audit
  label for the untagged A1 probe family; item-scoped document stimuli.
