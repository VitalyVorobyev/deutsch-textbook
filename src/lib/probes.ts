/**
 * Delayed outcome probes — the evidence that learning survived.
 *
 * Everything else in the project measures performance *during* practice, which is
 * the weakest possible evidence of learning: it is inflated by the surrounding
 * context, the item just seen, and the fact that the material is fresh. A probe asks
 * the same competence again after a real interval (2, 7 and 21 days), in a task the
 * learner has not seen, and that is the number worth trusting.
 *
 * Two rules the design turns on:
 *
 * 1. **A probe is never the item it checks.** Re-presenting a practice item measures
 *    recognition of that item. Each probe family therefore owns several *parallel
 *    variants* — different tasks, same competence — and a due probe always draws one
 *    the learner has not answered before.
 *
 * 2. **Probe state is derived, never stored.** Everything the scheduler needs is
 *    already in the attempt log: when the outcome was first practiced (armed), which
 *    probes have been taken (their attempts), and which variants were used (their item
 *    ids). Deriving it means probe scheduling survives export/import for free — no new
 *    snapshot key to merge, and none for `replaceSnapshot` to silently destroy. The
 *    attempt log is the one thing in this system that already merges correctly.
 *
 * Probes stay out of ordinary training (`trainableRoles` in training.ts is an
 * allowlist of practice+drill) and out of mastery: they are their own surface.
 */
import type { Attempt } from './store';
import { isVerifiedEvidence } from './scoring';

/** Days after the outcome was first practiced at which each probe falls due. */
export const PROBE_INTERVALS_DAYS = [2, 7, 21] as const;

/** Bounded share of an ordinary session — a probe backlog must never crowd out the lesson. */
export const MAX_PROBES_PER_SESSION = 3;

/**
 * Bounded size of a probes-only catch-up visit (the "Probe-Rückstand" run). Larger than
 * the session cap because the visit contains nothing else, but still bounded: nine probes
 * in a row is an exam, and fatigue confounds the very measurement a probe exists to make.
 * The session cap itself is deliberately never raised — this run is how debt drains.
 */
export const MAX_PROBES_PER_CATCHUP = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A probe set: one family of parallel variants over a shared set of outcomes. */
export interface ProbeFamily {
  /** the probe set's path-id, e.g. "a1/probe-akkusativ" — also the attempt setId */
  setId: string;
  /** the topic the family anchors to (its spine position) */
  topicId: string;
  /** the outcomes these variants probe */
  outcomes: string[];
  /**
   * The sets whose practice arms this family. Arming cannot rely on the attempt's
   * `outcomes` alone: that field is recent, and in a real snapshot most attempts predate
   * it (551 of 671 in the learner's log carry no outcomes at all). A family whose topic
   * was practised for weeks would sit unarmed forever and never probe anything. So the
   * topic's own practice sets arm it too — an attempt on `a1/akkusativ` is evidence the
   * akkusativ outcomes were practised, whether or not the row says so.
   *
   * Pretests are excluded on purpose: a pretest is a guess taken *before* the lesson, so
   * arming a retention clock from one would start counting before there was anything to
   * retain.
   */
  armingSetIds: string[];
  /** the parallel variants, in authoring order */
  items: { id: string; outcomes: string[] }[];
}

/** The shape both the session and the progress page already hold for every set. */
interface SetLike {
  setId: string;
  topicId: string;
  role?: string;
  items: readonly { id: string; outcomes: string[] }[];
}

/** Roles whose attempts count as having practised the topic. */
const ARMING_ROLES = new Set(['practice', 'drill']);

/**
 * Read the probe families out of the ordinary set list — no separate content channel.
 * A family's outcomes are the union of its variants', so practising *any* outcome the
 * family probes arms it.
 */
export function probeFamilies(sets: readonly SetLike[]): ProbeFamily[] {
  return sets
    .filter((s) => s.role === 'probe')
    .map((s) => ({
      setId: s.setId,
      topicId: s.topicId,
      outcomes: [...new Set(s.items.flatMap((i) => i.outcomes))],
      armingSetIds: sets
        .filter((o) => o.topicId === s.topicId && ARMING_ROLES.has(o.role ?? 'practice'))
        .map((o) => o.setId),
      items: s.items.map((i) => ({ id: i.id, outcomes: i.outcomes })),
    }));
}

export interface DueProbe {
  family: ProbeFamily;
  /** 0-based: which of PROBE_INTERVALS_DAYS this probe is for */
  stage: number;
  /** the variant to present — never one the learner has already answered */
  itemId: string;
  /** when it came due */
  dueAt: number;
  /** how many whole days it is overdue (0 = due today) */
  overdueDays: number;
}

/**
 * When a family becomes armed: the first time the learner produced *verified* evidence
 * on what it probes, outside a probe. Practice is what starts the retention clock — an
 * outcome never studied has nothing to retain, and a probe fired at it would measure
 * guessing rather than memory.
 *
 * An attempt counts either because it names one of the family's outcomes, or because it
 * came from one of the topic's practice sets (see `armingSetIds` — most historical
 * attempts carry no outcomes, and dropping them would leave long-practised topics
 * permanently unarmed).
 */
export function armedAt(family: ProbeFamily, attempts: readonly Attempt[]): number | undefined {
  const outcomes = new Set(family.outcomes);
  const arming = new Set(family.armingSetIds);
  let earliest: number | undefined;
  for (const a of attempts) {
    if (a.setId === family.setId) continue; // a probe cannot arm itself
    if (!isVerifiedEvidence(a)) continue; // unverified production is not evidence
    const relevant = arming.has(a.setId) || (a.outcomes?.some((o) => outcomes.has(o)) ?? false);
    if (!relevant) continue;
    if (earliest === undefined || a.ts < earliest) earliest = a.ts;
  }
  return earliest;
}

/** The family's probe attempts, oldest first. */
export function probeAttempts(family: ProbeFamily, attempts: readonly Attempt[]): Attempt[] {
  return attempts.filter((a) => a.setId === family.setId).sort((a, b) => a.ts - b.ts);
}

/**
 * The variant to present at this stage: the first authored item the learner has not
 * answered. Falls back to the least-recently-answered one when the family runs out of
 * fresh variants — repeating the oldest is still a better transfer check than
 * repeating the one seen last week, and it keeps a family usable past its variant
 * count rather than going silent.
 */
export function nextVariant(
  family: ProbeFamily,
  attempts: readonly Attempt[],
): string | undefined {
  if (family.items.length === 0) return undefined;
  const taken = probeAttempts(family, attempts);
  const seen = new Map<string, number>();
  for (const a of taken) seen.set(a.itemId, a.ts); // later attempt wins → most recent ts

  const fresh = family.items.find((i) => !seen.has(i.id));
  if (fresh) return fresh.id;

  return [...family.items].sort(
    (a, b) => (seen.get(a.id) ?? 0) - (seen.get(b.id) ?? 0),
  )[0]!.id;
}

/**
 * The probe this family owes right now, if any.
 *
 * A family is due when it has been armed, has stages left, and the interval for its
 * next stage has elapsed. Stage is simply how many probes have been taken — so a
 * learner who skips a session does not lose a probe, it just runs late, and the
 * attempt log records when it actually happened.
 */
export function dueProbe(
  family: ProbeFamily,
  attempts: readonly Attempt[],
  now: number = Date.now(),
): DueProbe | undefined {
  const armed = armedAt(family, attempts);
  if (armed === undefined) return undefined;

  const stage = probeAttempts(family, attempts).length;
  if (stage >= PROBE_INTERVALS_DAYS.length) return undefined; // family complete

  const dueAt = armed + PROBE_INTERVALS_DAYS[stage]! * DAY_MS;
  if (now < dueAt) return undefined;

  const itemId = nextVariant(family, attempts);
  if (!itemId) return undefined;

  return {
    family,
    stage,
    itemId,
    dueAt,
    overdueDays: Math.floor((now - dueAt) / DAY_MS),
  };
}

/**
 * Every probe currently owed, most overdue first — the same ordering principle as the
 * review queue, because a probe that has waited longest is the one whose answer has
 * decayed most and is therefore worth the most information.
 */
export function dueProbes(
  families: readonly ProbeFamily[],
  attempts: readonly Attempt[],
  now: number = Date.now(),
): DueProbe[] {
  return families
    .map((f) => dueProbe(f, attempts, now))
    .filter((p): p is DueProbe => p !== undefined)
    .sort((a, b) => a.dueAt - b.dueAt);
}

/**
 * What one visit actually serves: the first `cap` entries of the due queue. `dueProbes`
 * is already most-overdue-first, so a bounded visit always drains the oldest debt first.
 * The cap bounds the serving, never the debt — a probe left unserved stays due (`dueProbe`
 * counts probes *taken*, not offered), and the Heute backlog card keeps reporting it.
 */
export function servedProbes(due: readonly DueProbe[], cap: number): DueProbe[] {
  return due.slice(0, Math.max(0, cap));
}

/** Same day convention as sessions and the heatmap (localDateString in store.ts): local midnight. */
function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * How many probes were answered today — derived from the attempt log like every other
 * piece of probe state, so the daily budget below survives export/import with nothing
 * new to store or merge.
 */
export function probesTakenToday(
  families: readonly ProbeFamily[],
  attempts: readonly Attempt[],
  now: number = Date.now(),
): number {
  const probeSetIds = new Set(families.map((f) => f.setId));
  return attempts.filter((a) => probeSetIds.has(a.setId) && sameLocalDay(a.ts, now)).length;
}

/**
 * How many probes today may still serve. MAX_PROBES_PER_CATCHUP is a ceiling per *day*,
 * not per visit: without it, finishing a catch-up run landed back on Heute, where a
 * still-over-cap backlog re-showed the card — and a nine-probe debt could be chained
 * back-to-back in one sitting, which is exactly the exam-with-fatigue the caps exist to
 * prevent. An ordinary session serves at most MAX_PROBES_PER_SESSION (< the ceiling), so
 * an exhausted budget means a catch-up already ran today; the rest of the debt stays due
 * (`dueProbe` counts probes taken, not offered) and drains tomorrow.
 */
export function remainingProbeBudget(
  families: readonly ProbeFamily[],
  attempts: readonly Attempt[],
  now: number = Date.now(),
): number {
  return Math.max(0, MAX_PROBES_PER_CATCHUP - probesTakenToday(families, attempts, now));
}

export interface ProbeResult {
  family: ProbeFamily;
  /** one entry per probe taken, oldest first */
  taken: { stage: number; itemId: string; correct: boolean; ts: number; days: number }[];
  /** probes still owed before the family is complete */
  remaining: number;
  /** zero-based next scheduled interval, absent once all three were taken */
  nextStage?: number;
  /** timestamp at which the next stage becomes due */
  nextDueAt?: number;
  stages: {
    stage: number;
    scheduledDays: number;
    status: 'passed' | 'failed' | 'due' | 'scheduled' | 'later';
    dueAt?: number;
    takenAt?: number;
    actualDays?: number;
  }[];
}

/**
 * What the probes actually showed, for the progress page. `days` is the real elapsed
 * interval — not the scheduled one — because a probe answered nine days late is
 * evidence about nine days, and reporting it as "the 7-day probe" would overstate the
 * schedule's precision.
 */
export function probeResults(
  families: readonly ProbeFamily[],
  attempts: readonly Attempt[],
  now: number = Date.now(),
): ProbeResult[] {
  return families.map((family) => {
    const armed = armedAt(family, attempts);
    const taken = probeAttempts(family, attempts).map((a, i) => ({
      stage: i,
      itemId: a.itemId,
      correct: a.correct,
      ts: a.ts,
      days: armed === undefined ? 0 : Math.round((a.ts - armed) / DAY_MS),
    }));
    const nextStage = taken.length < PROBE_INTERVALS_DAYS.length ? taken.length : undefined;
    const nextDueAt = armed === undefined || nextStage === undefined
      ? undefined
      : armed + PROBE_INTERVALS_DAYS[nextStage]! * DAY_MS;
    const stages = PROBE_INTERVALS_DAYS.map((scheduledDays, stage) => {
      const completed = taken[stage];
      if (completed) return {
        stage,
        scheduledDays,
        status: completed.correct ? 'passed' as const : 'failed' as const,
        takenAt: completed.ts,
        actualDays: completed.days,
      };
      const dueAt = armed === undefined ? undefined : armed + scheduledDays * DAY_MS;
      return {
        stage,
        scheduledDays,
        status: stage === nextStage
          ? dueAt !== undefined && dueAt <= now ? 'due' as const : 'scheduled' as const
          : 'later' as const,
        dueAt,
      };
    });
    return {
      family,
      taken,
      remaining: Math.max(0, PROBE_INTERVALS_DAYS.length - taken.length),
      nextStage,
      nextDueAt,
      stages,
    };
  });
}
