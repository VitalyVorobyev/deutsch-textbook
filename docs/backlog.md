# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P2 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v4 snapshot import and pass the full repository gate.

Phases 0–2 are done: the learning system, the Atlas, and a complete A1 (v0.2.0).

## Now — Phase 3: A1 learning-loop hardening

**Every engineering item in Phase 3 is done.** What remains is not work but *elapsed time*: the
probes shipped on 2026-07-12, and the 21-day cohort cannot report before **2026-08-02**. That gate
(P3-6) is what Phase 4 waits on — not a task anyone can pull forward.

**Sequencing note, kept because it was the hard call.** P3-0 blocked P3-1. P3-1 was the only item
with a *calendar* cost, so the instinct was to ship it immediately. But probes read the same scorer
as everything else, and until P3-0 landed that scorer was writing wrong `correct` flags and wrong
`focus` tags (see finding 0 in the [audit](a1-learning-audit.md)). A retention cohort measured with
a broken instrument is a cohort that has to be re-run. Fixing the instrument first cost two days of
clock and bought data worth trusting.

### P3-0 · Fix free-production scoring and error attribution — `done` (M)

Score `translate` answers honestly: a one-token near-miss outside the graded tokens is a spelling
slip (shown, scored correct, no focus error), and a real error is attributed to the item's `focus`
tag only when a token that tag grades is what diverged. Closed-class words are never forgiven as
typos — `den`/`dem` are one edit apart *and* are what the taxonomy grades. Items declare
`key_tokens`. Also: profile-scope `write` drafts, log `evidence`/`responseMode` on reading
attempts, and stop the dev progress-writer from overwriting a snapshot with a smaller one.

- Accept: replaying `progress/vitaly/2026-07-12.json` moves the weak-focus list (it does —
  `trennbar-modal` was a phantom and leaves it; `verben-mit-dativ` 33%→20%, `haben-sein` 27%→17%)
  while leaving genuine weaknesses (`kein-nicht`, `dativ-artikel`) intact; the full gate passes.

### P3-1 · Add scheduled parallel probes — `done` (L)

Local 2/7/21-day outcome probes with parallel variants (`src/lib/probes.ts`, ten A1 probe families
in `content/exercises/a1/probe-*.yaml`). A due probe opens the session as step 0 — **before** review
and training, because a probe answered after twenty minutes of practice on the same material
measures the practice, not the interval.

**No new snapshot key was needed.** Probe state is *derived* from the attempt log rather than
stored: when the family was armed (earliest verified attempt on its topic/outcomes), how many probes
have been taken (their attempts), and which variants were used (their item ids). That makes probe
scheduling survive export/import by construction — nothing for `mergeSnapshot` to merge, nothing for
`replaceSnapshot` to silently destroy. The attempt log is the one structure in the system that
already merges correctly, so the scheduler was built on it.

Two things the implementation had to get right, both found by running it against the real snapshot:

- **Arming cannot depend on `attempt.outcomes`.** That field is recent, and 551 of the learner's 671
  attempts predate it. Outcome-only arming left `akkusativ` and `artikel-genus` — 35 and 26 attempts
  each — permanently unarmed. Families are therefore armed by their topic's practice/drill sets too
  (pretests excluded: a pretest is a guess taken *before* the lesson).
- **The session resume point cannot be `step` alone.** Step 1 is both "past the probes" and the
  default, so a session opened before a probe fell due saved step 1 and every later visit that day
  read it as "already done" — one reload would silently cancel the probe. `probesDone` is explicit.

- Accept: ✅ probe state survives export/import (it *is* the attempt log); ✅ probes stay out of
  ordinary training (`trainableRoles` is an allowlist); ✅ each attempt records its variant as the
  item id; ✅ 18 tests cover arming, due dates, variant replacement and the session cap
  (`MAX_PROBES_PER_SESSION = 3`); ✅ Fortschritt reports delayed results apart from practice
  accuracy, at the interval that *actually* elapsed rather than the scheduled one.

### P3-1b · Reserve a broad-retrieval share in mixed sessions — `done` (S)

`BROAD_RETRIEVAL_SHARE = 0.25` in `src/lib/training.ts`. A quarter of every mixed session is
reserved for items the learner answered *correctly*, longest ago.

The three priority bands — answered wrong, weak focus, never seen — could previously fill a session
on their own, and they always can: there is nearly always something wrong or unseen to serve. So a
learner with any backlog would never meet an older topic again — and an old topic answered correctly
weeks ago is exactly the material whose retention has decayed most. Recency and weakness are the
loudest signals, not the most informative ones, so they no longer get the whole session. The
reservation is elastic in both directions: short on old material, the priority bands take the slack;
short on priority items, broad retrieval fills the session.

Queue building moved out of `MixedTraining.tsx` into `training.ts` (`buildSession`) so it is pure
and testable.

- Accept: ✅ the share is bounded and stable; ✅ weakness targeting cannot crowd it out; ✅ 7 tests
  cover the reservation, its elasticity in both directions, and interleaving.

### P3-2 · Add mode-valid evidence — `done` (M)

Give each exercise item an actual response mode derived by default from its type and overridable
where necessary. Persist it on attempts and show outcome target mode separately from practiced
mode. Historical snapshots remain valid.

- Accept: a written MC item targeting a spoken outcome is reported as written selection, not spoken
  interaction; practice/verified evidence remains independent; v1–v4 import passes.

### P3-3 · Upgrade open production — `done` (M)

Change writing to draft → requirement checklist → revision, preserving both versions as unverified
practice. Add a `speak` item with local record/replay, model audio/transcript, checklist and a second
attempt. No cloud recognition and no automatic mastery.

- Accept: drafts survive reload; learners cannot finish before reflection/revision; recordings stay
  local and can be deleted; unsupported browsers get an honest speak-and-self-check fallback;
  writing/speaking attempts never enter verified accuracy.

### P3-4 · Rebalance the item mix — `done` (M)

The trainable catalog was 44% `mc`/`match`/`order` and only 13% `translate` — the one format that
reliably separates learners who can build German from learners who can recognize it. The pilot
learner scored 93% on `mc`, 94% on `match` and 45/45 on `order`, against 54% on `translate`: the
constrained formats had stopped carrying information.

(The audit's first draft put this at "58% of attempts", which was too strong. Pretests and reading
questions are `mc`-only *by design*, and counting them indicted the practice catalog for something
it was not doing. The catalog figures above exclude them.)

Now enforced per topic by `bun run validate`, over the union of its `role: practice` sets: **≥ 2
`translate` items**, **`mc` ≤ ⅓**, **`mc`+`match`+`order` ≤ 45%**. Checked per topic rather than per
set, so a Hören set may still be all `listen`. Nine of sixteen topics failed the bar; 30 production
items were authored to clear it. `translate` is now 17% of the catalog and selection 40%.

`order` keeps its place but not its share: it hands the learner every token and asks only for the
sequence, which makes it scaffolding for a first encounter with a word-order rule, not a test of one.

**Placement mattered more than authoring.** `pathDone` treats a topic as finished once its
`primaryPractice` items have all been attempted, and most of the learner's topics are `practiced`
rather than `mastered` — so appending an item to a primary set would have silently un-finished the
topic and reopened the Lernpfad. New items went to non-primary sets, to mastered topics, or into new
practice sets appended *after* the existing ones (`primaryPractice` is the *first* practice set).
Verified: `pathDone` is unchanged for all sixteen topics.

- Accept: ✅ production share rises materially (translate 48 → 68 items); ✅ the bar is enforced, not
  merely documented, so new units cannot regress it; ✅ no persisted item ids renamed; ✅ no topic
  un-finished.

### P3-5 · Pilot sustained input — `done` (M)

`content/reading/a1/lena-1-der-erste-tag.yaml` — 262 words, a recurring character (Lena, newly
arrived in Bremen), three glosses, one gist question. Readings now declare `kind:
intensive | extensive`, and the two are held apart by the validator, because the difference is what
the text is *for*, not how long it is: an extensive reader is 250–400 words, at most 2 questions,
and roughly one gloss per 40 words. A "long reader" that is quizzed line by line and glossed every
other phrase is just a long intensive text, and the volume input it exists to provide never happens.

The UI says so too. Left unlabelled, a learner treats every German text on the site the same way —
parsing each sentence, tapping every gloss, bracing for the questions. That habit is exactly what
stops a longer text from being read at volume, so the reader opens by telling the learner to read it
straight through and leave the glosses closed while the meaning still carries.

Reviewed multi-voice audio was **split out and deferred** (see P5-1): there is no evidence TTS
acoustics are the limiter — `listen` is at 76% and `audio-comprehension` is 8/8 on TTS — and P5-1
already gates audio work on "audio quality, rather than content coverage, is the limiting factor."
That condition is not met.

- Accept: ✅ every structure at or below late A1; ✅ the reader is not a quiz; ✅ bounds are enforced
  rather than asked for; ✅ builds in web and Tauri outputs.

### P3-6 · Validate the hardened A1 loop — `blocked on 2026-08-02` (a calendar gate, not a task)

The engineering half is **done** and shipped with P3-1: the probe report on Fortschritt, reporting
delayed results apart from practice accuracy and at the interval that actually elapsed.

The other half runs on wall-clock and cannot be pulled forward. Probes armed on 2026-07-12; the
21-day cohort completes **2026-08-02**. Then, and only then: compare immediate performance against
the parallel probes at 2, 7 and 21 days, and report delayed retention, novel-context transfer,
focus-error reduction (trustworthy now that P3-0 fixed the tags), mode distribution and workload.

**The exit bar, so that it can fail.** Phase 3's criteria used to be unfalsifiable — "due parallel
probes run after a real interval" is a system check, not a learning check, and no number appeared
anywhere in the docs. The bar is now:

> **≥ 80% correct on delayed parallel probes per A1 outcome, with free-production items ≥ 70%.**

If A1 does not clear it, the answer is not to author A2 faster — it is that the A1 loop does not yet
produce retention, and the lesson pattern about to be scaled ten times over is the thing to fix.

- Accept: every A1 mode has real practice evidence; delayed and novel-transfer evidence are reported
  separately from engagement; the findings update the audit **before** A2 authoring begins.

## Next — Phase 4: A2 completion and retention

### P4-1 · Author the complete A2 spine — `todo` (S)

Define the final unit order and stable outcomes for Wohnen & Umzug, Reisen & Verkehr, Einkaufen &
Reklamation, Gesundheit & Termine, Arbeit & Beruf, Lernen & Verstehen, Biografie & Vergangenheit,
Freunde & Feste, Ämter & Alltag, and Nebensätze & Pläne. Add each live unit only with its content;
declare the established `deepens` relationships from the roadmap.

- Depends on: P2-7 pattern and current curriculum contracts.
- Accept: ordering respects prerequisites; every topic belongs to one unit; outcome IDs are unique;
  validation passes.

### P4-2 · Apply `deepens` semantics in training — `todo` (S)

When a learner practices a deepening topic, include its base topics' relevant focus tags in
weakness aggregation and training priority without duplicating base lessons.

- Depends on: P4-1.
- Accept: an error in a deepening topic can resurface an applicable base drill; unrelated base
  content does not enter the queue; focused relationship labels remain accurate.

### P4-3 · Add unit checkpoints and delayed probes — `todo` (L)

Add cumulative checkpoint sets, scheduled outcome probes with parallel variants, and a reserved
broad-retrieval share in mixed sessions. Probe scheduling must be local-first and snapshot-safe.

- Depends on: P3-1 and P4-1.
- Accept: checkpoint/probe roles never enter ordinary training; a due probe uses a parallel
  variant rather than the identical item; the session log exposes cumulative practice.

### P4-4 · Author ten A2 units — `todo` (L)

Use the same complete-unit bar as P2-5 with A2-calibrated language, genres and outcome modes.
Author in spine order and land one complete unit per change.

- Depends on: Phase 3, P4-1 and the completed Phase 2 task machinery.
- Accept per unit: complete lesson cycle and content bundle; learning-science review and full
  validation pass.

### P4-5 · Strengthen the six existing A2 topics — `todo` (M each)

Extend Dativ, Perfekt, Modalverben, trennbare Verben, Alltag/Tagesablauf and Termine into authentic
case choices, narratives, communicative functions, varied time frames and real scheduling tasks.
Keep two-way prepositions in the later Wohnen & Umzug deepening unit.

- Depends on: Phase 2 lesson-cycle convention.
- Accept: each topic gains faded production and transfer without duplicate content or renamed
  persisted identities.

### P4-6 · Build the cumulative A2 checkpoint — `todo` (M)

Create the end-of-course checkpoint using the proven A1 pattern and stable A2 outcome IDs.

- Depends on: P4-3 through P4-5.
- Accept: reachable at the end of the Lernpfad; provides honest outcome coverage; remains excluded
  from ordinary mixed training and compatible with snapshots.

## Later — Phase 5 (deferred)

### P5-1 · Expand committed neural-TTS audio — `deferred` (L)

Prefer generated assets with speech synthesis as a permanent fallback. Reconsider after A1 usage
shows that audio quality, rather than content coverage, is the limiting factor.

### P5-2 · Expand the extensive-reader series — `deferred` (M per reader)

Expand beyond the Phase 3 pilot with 500–800-word A2 episodes after the vocabulary and grammar base
is complete enough to keep them comprehensible.

### P5-3 · Evaluate pronunciation assistance — `deferred` (L)

Evaluate constrained local or optional AI pronunciation assistance. Keep all resulting evidence
unverified unless a trustworthy assessment method exists.

### P5-4 · Add lightweight mission grouping — `deferred` (M)

Was P3-4. Group existing exercise and reading artifacts under a shared real-world situation with
ordered steps and a final transfer task — a presentation and resume layer over stable content IDs,
not a branching game engine.

**Deferred out of Phase 3 on 2026-07-12.** By its own description it adds no new retrieval
opportunity, and its premise is engagement — which is not the problem the data shows. The learner
completed three consecutive daily sessions (reviewed 14/15/15, trained 8/8/8, every session
finished). What the data does show is a production gap and, until P3-0, a broken measurement of it.
Missions are the most code in Phase 3 for the least measured learning gain. Reconsider once the
probe cohort reports and the item mix is fixed.

- Accept, when taken up: one A1 pilot combines input, retrieval, revised writing and speaking; it
  resumes; item attempts retain their original set IDs; ordinary topic pages remain usable
  independently.

### P5-5 · Evaluate branching missions — `deferred` (M)

Only add branching after a linear mission pilot (P5-4) shows that branching would improve rather
than distract from the learning workflow.
