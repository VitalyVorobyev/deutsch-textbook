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
closed clean the same day (see Recently completed). B1.8+B1.9 authoring proceeds per contract.

**Read of 2026-07-30** (snapshot same day; queue drained at 152 ruled / 0 awaiting — 8 rulings
this read, 3 accept, 5 confirm): all three accepts were paid — `weil-grund` gains the
article-less *Nachrichten sehen/schauen* renderings, `koennten` the postposed
*zusammen/gemeinsam*, `aber-sondern-chat` the *um acht Uhr* shape whose `nich` slip today's
grader forgives. The post-triage table moves only where the accepts left it:
`nebensatz-verbende` drops to 16/48 and flips to recovered. Every persistent no-recovery focus
(`akkusativ-artikel`, `dativ-praepositionen`, `trennbar-wortstellung`, `da-wo-woerter`,
`wo-wohin`) already has a serving drill — no drill owed from this read; the owed action remains
the learner taking training, where the weakness bar prioritises them. Two real confusions
recorded as drill notes in the rulings: *bleiben* takes *sein* (matches the persistent
`haben-sein` row) and the doubled modality *darf nicht erlaubt werden* (modal-passive territory
B1.7 already drills).

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

- **P21-1 · Standard written forms are taught but never practised as forms** — the course teaches
  the parts (`content/reference-data/briefe.yaml` holds the sections and three complete register
  models; `write` items ask for free production) and A2/B1 topics name the situations. What is
  missing is the middle: a task that asks the learner to *assemble* a Bewerbung, a Beschwerde or a
  formal e-mail from its parts and gets meaningful feedback. `write` cannot do it — it is
  minimal-ceremony by contract (attempt → model answer → done), and the app cannot verify free
  production, which is the right rule and also the reason a whole genre has no practice surface.
  Open question, not a decided design: a new item type that grades *structure* rather than wording
  (are the required sections present, in order, at one register?) would stay inside what a program
  can actually check, but it needs the seven placement-style rules thought through before any
  schema — a form task that grades wording would reject correct German at scale.
- **P21-2 · The written-forms material has no index** — `briefe`, the register conventions, and the
  A2/B1 topics that use them are reachable only by knowing they exist. An Entdecken piece
  (`content/discovery/`) is the natural home for a focused summary that points at the Referenz page
  and the owning topics — no mastery, no review debt, no completion bar, per the Entdecken contract.
  Blocked on nothing; sized small.
- **P21-3 · The Atlas has almost no cross-links, and every new Referenz page widens the gap** —
  `deepens:` edges exist between topics and are validated, and a discovery piece may name its
  topics, but there is no link *from* a topic *to* a Referenz page, none from Referenz back into the
  topics that teach a form, and no topic-to-topic "see also" surface a learner can follow. Today
  each Referenz page hand-writes at most one closing link. `/referenz/zeitformen` (this PR) shows
  both halves of the answer and the remaining gap: its per-form lesson chips are **derived** from
  `focusIntroducedBy` and so cannot drift — that is the pattern to generalise — while the reverse
  edge, a topic page pointing at the reference that frames what it teaches, still does not exist
  anywhere. Worth doing as one pass over the whole graph rather than page by page, because the
  value is in the network and a half-linked graph reads as an oversight.
- **P22-3 · An adapter switch can save a payload the store will then refuse to load** — the
  Studio's script form applies `model_copy()`, which bypasses `RevisionPayload.consistent()`.
  Switching `tts_adapter` while the lines still carry the previous adapter's preset voices
  therefore writes a revision that every subsequent `Store.get()` rejects, and the project
  becomes unreachable through the interface — the same failure mode as the legacy-question
  regression, arrived at from the other direction. The form must build and validate a complete
  `RevisionPayload` and require the voices to be re-picked when the adapter changes. **This is
  the first thing anyone switching Parler → Qwen will hit**, so it is the first entry to clear.
- **P22-4 · `bun tauri dev` serves no reviewed recording** — `src/integrations/audio-bundle.ts`
  copies audio on `astro:build:done`, which the dev server never reaches, while `dev:desktop`
  still sets the bundle flag. So `AudioComprehension` requests `/audio/<id>.mp3`, gets a 404, and
  — because the component treats a configured URL as available — does not fall back to TTS. Two
  candidate fixes, and they are not alternatives: an `astro:server:setup` middleware serving from
  `content/listening/` makes dev match the build, and an `<audio>` error handler falling back to
  TTS covers a missing or corrupt file in a shipped build too. Costs nothing today (no recording
  is committed) and costs the whole playback check the day one is.
- **P22-5 · A rebuilt export keeps the previous revision's files** — `write_bundle` reuses the
  export directory, so a contextual source dropped or replaced by a new revision survives under
  `sources/`, enters `exported_files` and the ZIP, and is published even though the manifest's
  `contextual_sources` no longer describes it. A published file no manifest accounts for is
  precisely what the provenance chain exists to make impossible. Build into a clean directory.
- **P22-6 · Freesound source URLs are matched by prefix** — `sources.py` accepts
  `https://freesound.org/s/1234` for `sound_id: 123`, so a metadata typo can credit and link a
  different upload while every validation step passes. Attribution is someone else's name on
  someone else's work; parse the URL and require the sound-id segment to equal `sound_id`.
- **P22-7 · Passive: only the accusative object is promoted** — `content/reference-data/zeitformen.yaml`
  says the active clause's object becomes the passive subject, unqualified. A dative object does
  not: *Man hilft dem Mann* → *Dem Mann wird geholfen*, not *\*Der Mann wird geholfen*. The owning
  B1 material limits the transformation correctly, so the reference page is the looser statement
  of the two — the state a reference page must never be in.
- **P22-8 · Konjunktiv II Vergangenheit is not always `hätte/wäre + Partizip II`** — with a
  governing modal it takes the Ersatzinfinitiv: *Das hättest du sagen sollen*, which the page
  itself prints two lines below the formula that excludes it. Either qualify the formula as
  holding without a dependent infinitive, or give the double-infinitive pattern its own row.
- **P22-1 · Reviewed unit listening corpus** — `data/listening-plan.yaml` owns one planned artifact
  for each live unit; `bun run listening:inventory` derives production state. Produce Wave 1 for
  the twelve explicit listening outcomes with Parler on the measured M4 fallback path, preserving
  failed QA and requiring Vitaly's approval of every exact WAV. Context sounds are optional,
  speech-independent and restricted to manually reviewed CC0/CC BY Freesound originals. Wave 2 is
  model/input coverage and does not silently create new listening outcomes. The separate P19-6
  Goethe pack remains open until its own 6/4/5 task structure and delayed probes ship.

- **P20-1 · The A1 exam-practice surface has one entry point and one owner topic** — `/pruefung/a1`
  is linked only from `/about`: no nav entry, no link from the A1 topic pages, nothing on the
  progress page. A learner who never opens Über will not find it. Separately, all three sets
  declare `topic: freizeit-koennen` while their items name outcomes from six topics — accurate for
  `role: exam-practice` (it is in `CROSS_TOPIC_ROLES`, so any outcome resolves) but the `topic:`
  field is then a formality that says something untrue. Both are shape questions for the surface
  rather than defects in it, so they were filed rather than fixed in #128: deciding where exam
  practice belongs in navigation is a product call, and giving the role a level instead of a topic
  is a schema change.
- **P20-2 · Four of the five backfilled A1 grammar points rest on one or two items** —
  `bun scripts/grammar-coverage.ts A1` reports 22/22, 0 late, and the bar it applies is
  *at least one* non-preview `practice`/`drill` item per tag. Counted against A1 sets, `du-sie` and
  `perfekt-satzklammer` have exactly one each; `imperativ-form`, `trennbar-wortstellung`,
  `trennbar-modal`, `duerfen-muessen`, `haben-sein` and `partizip2-a1` have two. That clears the
  instrument honestly and is thin against the A2 norm for a *taught* point. Not a gate failure and
  not something to fix by padding — the next A1 pass should thicken the ones a stop-at-A1 learner
  would lean on hardest, which is the `du/Sie` and Perfekt-bracket pair.
- **P20-3 · The live card-id migration's call site has no automated coverage** — the test
  environment has no IndexedDB (`bunfig.toml` preloads happy-dom, which does not provide it), so
  `tests/card-id-migration.test.ts` exercises `migrateStoredCardIds` with in-memory read/write and
  cannot execute `getStore`'s call into it. That seam is exactly where the #128 P1 lived — the map
  existed, was correct, and was wired to only one of its two entry points. Adding `fake-indexeddb`
  as a dev dependency would let the store's open path be tested directly, and is worth it the next
  time anything touches profile-scoped storage.
- **P17-6 · Item-scoped document stimuli — resolved 2026-07-31** — an item's optional
  `stimulus` now overrides the set stimulus, with reference validation and rendering tests. Existing
  set-scoped documents retain their old behavior; authors can isolate a simulated form, notice or ad
  without pinning it beside unrelated tasks.

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
- **P19-1 · A1 backfill of the five late grammar points — resolved 2026-07-31** — Perfekt,
  Imperativ, trennbare Verben, *darf/muss nicht* and *du/Sie* now have A1 explanations,
  scaffolded retrieval, open production and delayed transfer. The boundary report is
  `22 covered · 0 late · 0 missing`; the broader participle system remains at A2.
- **P19-2 · `a1/probe-erste-schritte` audit label — resolved 2026-07-31** — the
  family remains honestly untagged for scoring, while the audit displays its outcome identity
  instead of the unreadable `(untagged)` label. It remains excluded from a focus-retention verdict.
- **P19-3 · Irrealer Wunsch (*Wenn … doch/nur …!*) has no retrieval item** — the inventory point
  `konjunktiv2-irreal` is named "Bedingungen und Wünsche", but B1.8 drills only the two-clause
  condition; the wish form sat taught in `## Erklärung` with no item and was demoted to
  `### Feinheiten` in the #126 review round (Codex finding). A later KII-touching unit or drill
  should own one production item for it (a `translate` pinning the one-word form beside
  *doch*/*nur*) so the point's second half is practised, not just named.
- **P19-4 · Outcome-keyed probe arming cannot tell carrier and comprehension items — resolved 2026-07-31** —
  every family now commits exact
  `setId::itemId` arming sources; validation rejects unresolved, non-practice and unverified
  sources, and runtime arming no longer falls back to broad outcomes.
- **P19-5 · Future-cast prompt halves accept only present renderings** — #127's review caught
  `probe-lernen-zukunft` variant-a rejecting *wird … schicken* although its RU/UK halves say
  «пришлёт»/«надішле»; fixed there, but the class is corpus-wide (`a2/drill-mir-mich` "I will
  call you tomorrow" → present-only accepts is the shipped precedent, and B1.9's
  `uebersetzen-falls-antwort`/`uebersetzen-vorfeld-falls` share the shape). Decide once at the
  instrument level: an item-authoring rule — align the tense across prompt halves, or accept the
  werden main clause wherever a half invites it — plus one sweep, instead of per-rendering
  grading-queue rulings.
- **P19-6 · Reviewed A1 listening pack and delayed listening probes** — author 15 original
  Goethe-style listening tasks in the official 6/4/5 structure plus two three-variant delayed
  families (telephone/number information and public directions/announcements). Commit final audio,
  exact transcripts, accessibility text, provenance and editorial review. Production may use a
  human recording, a suitably licensed service, or paid OpenAI API speech only after explicit
  budget approval. Every take needs human review for A1 intelligibility and natural pacing, plus
  mobile/desktop playback verification. Until this ships, public copy must describe exam practice
  as reading/writing/speaking only and must not imply complete Hören preparation.
  The repository-local Listening Studio now supplies the reviewed authoring, QA and provenance
  pipeline, but this content task remains open until the real A1 recordings and Vitaly's review
  are committed.
- **P18-3 · B1.1–B1.3 measure one competence each with delayed evidence** — the contract
  (`docs/curriculum-a2-b1.md`, amended 2026-07-24) requires *one 3-variant probe family per
  competence*, and calls one-family-per-unit a regression. B1.4 and B1.5 comply (3 families each);
  B1.1, B1.2 and B1.3 own 3 + 3 + 4 grammar points and ship **one family each** — 10 competences,
  3 of them probed. This is the real cost of B1's larger units, and the fix is six new families.
  A seventh joined in #123: `probe-konsum-umwelt-passiv-vergangenheit` was narrowed to the
  written wurde/wurden register so its three stages measure one form, which leaves the spoken
  *ist … worden* with practice coverage but no delayed check — a later B1 topic owes it a
  family, the way `probe-biografie-erfahrungen-hilfsverb` carries A2's second past on a second
  topic. **A second family re-arms the topic**: measure `armedAt` before and after, or probes
  already taken are silently relabelled.
- **P18-4 · The RU/UK produktion-set titles name goods, not speech** — all seven B1
  `*-produktion` sets title themselves «Продукция»/«Продукція», which reads as manufactured
  output, not language production (the intended sense). Counted by the title grep over
  `content/exercises/b1/*-produktion.yaml`: seven files, title fields only, no ids touched. If
  retitled («Речевая практика» / «Мовна практика», or the mission line the EN titles already
  carry), do all seven in one pass so the convention stays uniform — B1.6 and B1.7 shipped with
  the precedent spelling for exactly that reason, and every later unit will too until this is
  ruled on.
- **P18-5 · A write-task guidance line claims the main-clause passive frame for every clause** —
  `schreiben-produktgeschichte` (`konsum-umwelt-produktion.yaml`) requires: "Every passive
  sentence keeps the frame: werden in position 2, the Partizip II at the very end" — false in
  a Nebensatz, where the finite werden follows the participle (*…, weil es wieder benutzt
  wird*), an order the learner owns from A2's `nebensatz-verbende`. The line is ungated
  guidance on an unverified write task, so nothing mis-grades, but it is teaching text:
  qualify all four halves with "in a main clause" and point the Nebensatz case at the A2
  rule. Flagged by Codex in #123 round 5; filed at wrap-up instead of edited.
- **P18-8 · `review:gate` cannot see a review whose body omits the Reviewed-commit line** —
  `scripts/pr-review-gate.ts` proves review-of-HEAD only by parsing "Reviewed commit: `sha`"
  out of review/comment bodies; #124's wrap-up review (2026-07-29 11:41Z) omitted that line
  while its API `commit_id` field carried the exact HEAD sha, so the gate reported "not
  completed against HEAD" for a review that demonstrably ran against it. Fix: also read the
  review's `commit_id` from the GraphQL/REST payload; the body regex stays as the fallback
  for summary comments. Until then, on this failure verify `commit_id == HEAD` by hand before
  overriding — command: `gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '[.[] |
  select(.user.login == "chatgpt-codex-connector[bot]")] | last | .commit_id'`.
- **P18-7 · Two B1.7 probe renderings still graded wrong** — filed at #124's wrap-up round
  (2026-07-29), same open-space class the round-1 fixes patched: (1) `probe-regeln-verantwortung-sodass-folge`
  variant-c rejects *Die Straßenbahn fällt heute aus, …* although `ausfallen` is taught for
  exactly a cancelled service — the cause-clause verb space (fährt nicht / verkehrt nicht /
  fällt aus / kommt nicht) is open, so the closing fix is naming the verb in the instruction,
  not another accept; (2) `probe-regeln-verantwortung-duerfen-muessen` variant-b rejects
  *Während der Prüfung dürfen keine Handys benutzt werden* — the nicht/keine negation axis is
  genuinely closed (two members × two orders), so there the fix is the four accepts. Both are
  probe false negatives on three-lifetime-stage artifacts; apply with the next content PR,
  with a `revision` bump if the unit has shipped by then.
- **P18-6 · `passiv-bildung`'s position half has no delayed evidence** — `probe-konsum-umwelt`
  is cloze ×3, and a cloze grades a form, never a position (`docs/authoring-checklists.md`
  states exactly this). The family's declared competence is the form cells (wird/werden +
  Partizip II against ist/hat), which cloze grades with clean attribution — but the frame's
  position-2/clause-final half is graded only in practice (`uebersetzen-gemuese` pins both
  walls) and never after a delay, so a learner who reproduces the wrong bracket can pass all
  three stages. The checklist's remedy is a second response format — a translate family — and
  its hazard applies: **adding a family re-arms the topic**, so measure `armedAt` before and
  after (see [[P18-3]] for the family queue). Flagged by Codex in #123 round 5; filed at
  wrap-up instead of edited.

- **P5-11b · Mode coverage is unchecked, and B1.2/B1.3 show it** — the checklist
  (`docs/authoring-checklists.md:18`) asks every topic for a hidden-transcript
  `audio-comprehension`, a `write`, a `speak` and a faded discrimination set. B1.4 shipped its
  review round missing two of the four, and nothing failed: `bun run validate` enforces the item-mix
  bar but never asks whether an outcome has a task in the mode it names. Checking B1 turned up the
  same gap upstream, and the practice since has answered the question the wrong way round: **five of
  the seven B1 units now own an `audio-comprehension` item** (all but `leben-veraendern` and
  `gesundheit-wohlbefinden`, whose set documents its reason), while `erfahrungen-erzaehlen` is still
  the only one declaring an explicitly listening outcome. So the artifact is being shipped
  unconditionally in practice and skipped by two units, which is the one combination no reading of
  the doc sentence supports. Decide which the rule is, write it down, and either backfill B1.2/B1.3
  or state why a unit with no listening outcome may skip it. A validator check ("every outcome's declared mode is exercised by at least
  one item of a matching type") is the mechanical half — see [`docs/coverage-instruments.md`] for
  the earned-not-asserted bar this belongs under. **A1 portion resolved 2026-07-31:** items now
  declare `target_mode` independently of response mode, validation requires every A1 outcome's
  claimed mode to be genuinely practised, and missing spoken modes received record-and-replay
  tasks. The broader B1 policy question remains open here.
- **P5-11c · The connector-determinacy check does not reach cloze gaps** — the rule in
  `scripts/validate.ts` reads `item.answer` and `item.accept`, which is the `translate` shape, so a
  **cloze** gap that accepts one interchangeable connector and rejects its sibling is unguarded.
  B1.5's three `da-weil` probe variants are cloze, and their ambiguity had to be found and fixed by
  hand. Read the comment above `INTERCHANGEABLE_CONNECTORS` before acting: `da` is **deliberately
  absent**, because clause-initial *Da* is more often "then/there" than causal and the naive rule
  would misfire on the adverb. Adding the pair was tried during the B1.5 pass and reverted for that
  reason — it produced zero new warnings, which measures today's corpus and not the rule. A cloze
  equivalent therefore needs sense disambiguation, not merely a longer list.
- **P5-11d · A reading question arms a production probe — resolved 2026-07-31** — probe families
  now commit exact verified `setId::itemId` arming keys. Runtime no longer consults broad outcomes,
  so reading and pretest attempts cannot start a production-retention clock.
- **P12-4 · Separate focus evidence from answer constraints — resolved 2026-07-31** —
  `focus_evidence` predicates now produce explicit `retained`, `failed` or `unknown` attempt data;
  `key_tokens` continues to constrain answer grading, and still attributes on items that declare
  no predicates. An attempt carries a verdict only where the item declares a contract, so
  historical attempts remain unchanged and the audit falls back to their earlier contract
  wherever the explicit verdict is absent.
- **P12-5 · Inserted-token attribution — resolved 2026-07-31** — failed predicates can name an
  inserted form directly. `uebersetzen-modal-ohne-zu` now distinguishes spurious *zu* or
  *mitzukommen* (failed) from a lexical substitution such as *kommen* (unknown), instead of
  charging both to `zu-infinitiv`.
- **P12-6 · Dictation focus attribution — resolved for A1 2026-07-31** — focused A1 dictations
  carry explicit predicates and validation requires them, so on those items a wrong answer the
  predicates do not name is `unknown`, never guessed as failure of its grammar tag.
  **A2/B1 dictations are not covered and keep `dictationSlip`**: extending the silence to items
  with no predicates was tried and measured against the learner's log, where it dropped 145 of
  291 free-typed tags and took `weakFocuses` from 7 to 1 — an inverted signal, not an honest gap
  (`um-am-zeit` read 1% error at n = 30 against a real 21%). The remaining work is authoring
  predicates for the ~50 focused A2/B1 `listen` items, after which they get the A1 treatment
  item by item. Reproduce with a `weakFocuses` replay over the newest `progress/vitaly` snapshot;
  the rule itself is pinned by `tests/focus-attribution.test.tsx`.
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

- **P22-2 (2026-08-02):** decided and implemented before the first recording was committed, as the
  entry required. The WAV master stays in the studio; a 64 kbps mono MP3 is published into
  `content/listening/`. The manifest carries both `master_audio_sha256` (what the editor approved
  and what QA ran on) and `published_audio_sha256` (what a learner downloads), and the validator
  checks the published derivative.
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
