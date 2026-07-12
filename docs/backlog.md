# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P2 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v4 snapshot import and pass the full repository gate.

Phases 0–2 are done: the learning system, the Atlas, and a complete A1 (v0.2.0).

## Now — Phase 3: A1 learning-loop hardening

**Sequencing note.** P3-0 comes first and blocks P3-1. P3-1 is the only item with a *calendar* cost
— a 21-day probe cannot report before 21 days — so the instinct is to ship it immediately. But
probes read the same scorer as everything else, and until P3-0 landed that scorer was writing wrong
`correct` flags and wrong `focus` tags (see finding 0 in the [audit](a1-learning-audit.md)). A
retention cohort measured with a broken instrument is a cohort that has to be re-run. Fix the
instrument, then start the clock.

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

### P3-1b · Reserve a broad-retrieval share in mixed sessions — `todo` (S)

The remaining half of the original P3-1: a bounded, stable share of each mixed session drawn from
older material rather than the current topic, so recency cannot monopolize practice.

- Depends on: P3-1.
- Accept: the share is bounded and stable; weakness targeting cannot crowd it out; tests cover it.

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

### P3-4 · Rebalance the item mix — `todo` (M)

A1 is 77 `mc` of 232 items, and in *attempts* `mc` is 45% of everything the learner did — at 93%
accuracy. `mc` + `match` + `order` together are ~58% of all attempts and score 93–100%, while
`translate`, the format that actually discriminates (54%), is 25 items in all of A1. `order` is
45/45 and yields no information at all.

The audit noted that "tightly constrained manipulation still dominates" without drawing the
consequence. The consequence is that **the authoring template must change before A2 exists**, or A2
inherits a recognition-heavy diet at ten times the volume. Set a target item-mix ratio in the
`CLAUDE.md` authoring checklist, rebalance the weakest A1 sets, and decide whether `order` earns its
place as an item type.

- Accept: the A1 catalog's production share rises materially; the checklist states the target so new
  units cannot regress it; no persisted item ids are renamed.

### P3-5 · Pilot sustained input — `todo` (M)

Author one recurring-character late-A1 reader of 250–400 words with very high known-word coverage
and sparse glosses, experienced for meaning rather than quizzed line by line. `readingSchema` caps
`questions` at four and every current reading is ~100 words, so this needs a relaxed or separate
schema plus a `content.config.ts` entry and validator rules.

Reviewed multi-voice audio is **split out and deferred** (see P5-1): there is no evidence TTS
acoustics are the limiter — `listen` is at 76% and `audio-comprehension` is 8/8 on TTS — and P5-1
already gates audio work on "audio quality, rather than content coverage, is the limiting factor."
That condition is not met.

- Accept: unknown-word sampling meets the late-A1 ceiling; the reader is not a quiz; it builds in
  web and Tauri outputs.

### P3-6 · Validate the hardened A1 loop — `todo` (S engineering + a 21-day gate)

Not an engineering task of size (M): the delayed half runs on wall-clock. Split it.

- **Now, with P3-1:** the probe report and mode-coverage surface — the tooling that will read the
  cohort.
- **~21 days after P3-1 ships:** compare immediate performance with parallel probes at 2–3, 7 and
  21 days. Report delayed retention, novel-context transfer, focus-error reduction (now that the
  focus tags are trustworthy — P3-0), mode distribution and workload.

Phase 3's exit criteria must also become **falsifiable**. "Due parallel probes run after a real
interval" is a system check, not a learning check, and no numeric bar exists anywhere in the docs, so
nothing can currently fail. State one — e.g. **≥80% on delayed parallel probes per A1 outcome, with
free-production items ≥70%** — so the A2 gate can actually block.

- Accept: every A1 mode has real practice evidence; delayed and novel-transfer evidence are
  reported separately from engagement; findings update the audit before A2 authoring begins.

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
