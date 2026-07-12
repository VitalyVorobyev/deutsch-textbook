# Active Backlog

Companion to [roadmap.md](roadmap.md). Completed P0–P2 items keep their stable IDs in
[the July 2026 archive](archive/2026-07-learning-foundations.md). Statuses are `todo` → `doing` →
`done`; a finished item moves to the archive rather than accumulating here.

Every content item must pass the learning-science review and `bun run validate`. Code changes must
preserve v1–v4 snapshot import and pass the full repository gate.

Phases 0–2 are done: the learning system, the Atlas, and a complete A1 (v0.2.0).

## Now — Phase 3: A1 learning-loop hardening

### P3-1 · Add scheduled parallel probes — `todo` (L)

Implement local, snapshot-safe 2–3, 7 and 21-day outcome probes. A probe family has reviewed
parallel variants; the scheduler never presents the identical item as its own transfer check.
Reserve a bounded broad-retrieval share in mixed sessions.

- Accept: probe due state survives export/import; pretests/checkpoints/probes stay out of ordinary
  training; each attempt records the variant; tests cover due dates, replacement and session share.

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

### P3-4 · Add lightweight mission grouping — `todo` (M)

Group existing exercise and reading artifacts under a shared real-world situation with ordered
steps and a final transfer task. Avoid a branching game engine; the mission is a presentation and
resume layer over stable content IDs.

- Accept: one A1 pilot combines input, retrieval, revised writing and speaking; it resumes; item
  attempts retain their original set IDs; ordinary topic pages remain usable independently.

### P3-5 · Pilot sustained input and reviewed audio — `todo` (M)

Author one recurring-character late-A1 reader of 250–400 words with very high known-word coverage
and sparse glosses. Add at least one reviewed committed multi-voice comprehension asset; keep TTS as
a visible fallback, not the primary artifact.

- Accept: the reader is experienced for meaning rather than quizzed line by line; unknown-word
  sampling meets the late-A1 ceiling; audio transcript stays hidden until attempt; assets build in
  web and Tauri outputs.

### P3-6 · Validate the hardened A1 loop — `todo` (M)

Run an end-to-end pilot and inspect a fresh snapshot. Compare immediate performance with parallel
probes after real intervals; report mode distribution, transfer, focus-error reduction and workload.

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

### P5-4 · Evaluate branching missions — `deferred` (M)

Only add branching after the Phase 3 linear mission pilot shows that branching would improve rather
than distract from the learning workflow.
