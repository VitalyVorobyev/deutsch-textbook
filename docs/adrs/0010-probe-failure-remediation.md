# ADR 0010: Probe-failure remediation — a session-end card, a documented weakness channel, and a named exhausted state

Status: accepted · 2026-08-12

## Context

A delayed probe (`src/lib/probes.ts`) asks the same competence again 2, 7 and 21 days
after it was first practiced, in a task the learner has not seen — the project's only
evidence about what survived rather than what was fresh. An investigation into what
happens when the learner gets one wrong found three things, none of them a scheduling
defect:

- **No visible consequence.** `ProbeStep.tsx` logs the attempt and shows the running
  score, but `SessionFlow.tsx`'s `finishProbes` discards `correct` outright, and the
  step-3 summary card shows only a count answered. A learner who fails a probe learns
  nothing about *which* competence slipped or what to do about it — the number that
  exists specifically to catch decayed learning has nowhere to land.
- **A silent weakness channel.** `weakFocuses` (`src/lib/weakness.ts:99-126`) excludes
  unverified evidence and pretest attempts, and nothing else — it applies no role
  filter, so a probe attempt already raises its focus tag's error rate exactly like an
  ordinary practice attempt. That is the right behavior: a failed delayed check is
  stronger evidence of a live confusion than a same-session miss, not weaker. But
  `probes.ts:24-26` and `docs/authoring/authoring-checklists.md` both asserted the
  opposite — probes "never leak into ordinary training" — and neither claim was ever
  true of probe *results*, only of probe *items* (`trainableRoles` in `training.ts`
  correctly excludes `role: probe` from being re-served). A claim with no test behind
  it is how this drifted, and the gap between the code and the doc is itself the
  defect a future refactor could break without any test noticing.
- **A correctness-blind ladder with a terminal state it cannot name.** `armedAt`,
  `dueProbe` and `nextVariant` are deliberately blind to whether past stages were
  right or wrong — a family serves its next scheduled stage regardless, so a mid-ladder
  failure already gets re-checked on schedule. The gap is the family that has used all
  three stages (`PROBE_INTERVALS_DAYS.length`) and failed one: there is no fourth rung,
  and nothing in the app currently says so. `probeResults` reports `remaining: 0` and
  moves on.

## Decision

- **R1 — a session-end remediation card.** `SessionFlow.tsx` step 3 gains a card
  listing every probe family that logged a wrong attempt *today*, derived from the
  attempt log at render time — never from `finishProbes`' transient result, so a
  reload lands on the same card. Per failed family: the owning topic (name and link)
  and one recommended set (R4). Tone is neutral and advisory: it names the competence
  and points at material, gates nothing, and does not render when nothing failed
  today.
- **R2 — the weakness channel is documented policy, not an oversight.** Probe
  **items** never re-enter ordinary training; probe **results** deliberately feed
  `weakFocuses` like any other attempt. Both `probes.ts` and
  `docs/authoring/authoring-checklists.md` are corrected to say so, and a test now
  pins a wrong probe attempt raising its focus tag's error count — the claim this ADR
  makes is no longer untested.
- **R3 — no ladder surgery; the exhausted-and-failed family becomes a named state.**
  `armedAt`/`dueProbe`/`nextVariant`/`PROBE_INTERVALS_DAYS` are unchanged — the ladder
  stays correctness-blind by design. The one addition is a name for the family with no
  rungs left and at least one failure among the stages it took: `ProbeResults.tsx`
  (progress page) shows it as an explicit line, and the session-end card shows the
  same line when today's failure was the family's last stage. Naming the state is not
  scheduling it a successor — that is content work (see Consequences).
- **R4 — the recommendation prefers assembly.** The card's recommended set for a
  failed family is chosen by a small pure resolver, `remediationSetFor(focus, topicId,
  sets)` (`src/lib/training.ts`): among the topic's own `practice`/`drill` sets whose
  items carry the family's focus tag, prefer `role: drill`, tie-break by the count of
  `translate` items carrying the tag, then by the set's position in the topic's
  authored `exercises:` order. Translate-first because the learner's assembly mode
  measures well below recognition formats in the attempt log — the recommendation
  should point at the response mode that is actually weak.

## Consequences

- No new evidence class and no new storage: R1's card and R3's named state are both
  computed at render/call time from `getAttempts()` and the existing content graph,
  the same derivation discipline as the rest of `probes.ts`.
- No scheduling change: `MAX_PROBES_PER_SESSION`, `MAX_PROBES_PER_CATCHUP` and the
  interval ladder are exactly as before. A learner sees the same probes on the same
  days; the only new thing is what happens after a wrong answer.
- `weakFocuses` behavior is unchanged — R2 documents and tests what the code already
  did, so no learner-visible change follows from it beyond the new test coverage.
- **Exhausted-and-failed families need authored successors, and this PR does not
  write them.** Naming the state (R3) makes the gap visible on two surfaces; closing
  it — a fresh probe family for that competence — is ordinary content work fed by
  `progress:audit`, the same as any other drill-from-progress pass.
- The recommendation (R4) can point at a set with no `title` (schema-optional); the
  card falls back to the set's id rather than hiding the link, so a match is never
  silently dropped for lacking cosmetic metadata.
