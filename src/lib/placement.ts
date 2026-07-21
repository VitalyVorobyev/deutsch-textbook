/**
 * Pure rollups over placement-test attempts (`role: placement` sets).
 *
 * A placement test asks one question per topic — *does this learner already know it?* — and
 * a passing answer takes the topic off the recommended path for good. That makes placement
 * a **third evidence class**, beside measured mastery and the learner's own `learned`
 * self-rating: it is real evidence, it is green, and it deliberately never raises the
 * measured tier. `topicTier` is blind to it by construction (placement sets appear in no
 * topic's `exercises`, so `topicPracticeSetIds` cannot see them), and that is the design,
 * not an oversight — a twenty-item test is not the ten spaced correct answers across two
 * days that `Gemeistert` means.
 */
import type { Attempt, TopicsState } from './store';
import { attemptScore } from './scoring';
import { latestVerifiedByItem, type CheckpointItemRef } from './checkpoint';
import { GOOD_RATIO } from './bars';

/**
 * The ratio a topic's placement items must reach to place out.
 *
 * Deliberately the same number as `MASTERY_ACCURACY` and as the bar's green threshold —
 * imported rather than retyped, so it cannot drift. A third constant would let two green
 * surfaces disagree about what "good enough" means, with no way to tell which to believe.
 */
export const PLACEMENT_PASS_RATIO = GOOD_RATIO;

export interface PlacementTopicResult {
  topicId: string;
  /** placement items belonging to this topic */
  items: number;
  /** how many of them have a verified attempt */
  answered: number;
  /** parts-weighted score summed over the answered items */
  score: number;
  /** score / items — unanswered items count as zero, see `placed` */
  ratio: number;
  /** every item answered AND ratio ≥ PLACEMENT_PASS_RATIO */
  placed: boolean;
}

export interface PlacementSummary {
  setId: string;
  level: string;
  /** one row per topic the set covers, in the set's item order */
  topics: PlacementTopicResult[];
  /** scorable items answered so far */
  answered: number;
  /** scorable items in the set */
  total: number;
  /** timestamp of the most recent attempt on the set */
  lastTs: number;
}

/**
 * Has the learner started *learning*, as opposed to answering an entry test?
 *
 * The distinction exists because `logAttempt` fires per item, so a learner who answers one
 * placement question and closes the tab has a non-empty attempt log while having learned
 * nothing. `FirstSteps` — the only surface that links to the entry test — used a bare
 * `attempts.length === 0`, so that single answer hid the card and with it the only route
 * back into the test. The answers themselves were never lost (`ExerciseSet` saves them
 * through `resume.ts`); what was stranded was the way back to them.
 *
 * A placement that has been *applied* does end it: the learner has placed, so the offer is
 * spent — and applying writes no attempt, no card and no `readAt`, so nothing else here
 * would notice.
 */
export function hasStartedLearning(
  attempts: readonly { setId: string }[],
  cardIds: readonly string[],
  topics: TopicsState,
  placementSetIds: readonly string[],
): boolean {
  const placementSets = new Set(placementSetIds);
  if (attempts.some((a) => !placementSets.has(a.setId))) return true;
  if (cardIds.length > 0) return true;
  return Object.values(topics).some((t) => t.readAt || t.placement);
}

/**
 * Is the test finished, with nothing left to write?
 *
 * Deliberately **not** "something was applied". A learner who answers every item and passes
 * *nothing* has an empty pending list and no placement of their own — and that is the
 * ordinary outcome for the beginner the entry test is offered to on day one. Keying the
 * results panel's completion state on `alreadyApplied` left exactly that learner looking at
 * a permanently disabled Apply button with no link onward: the advertised flow could not be
 * finished by the person most likely to be in it.
 *
 * `answered === total` is what keeps a half-finished test out of the completion state.
 */
export function placementSettled(
  summary: Pick<PlacementSummary, 'answered' | 'total'>,
  pendingCount: number,
): boolean {
  return summary.answered === summary.total && pendingCount === 0;
}

/**
 * Which topic a placement item decides. The validator guarantees every item's outcomes
 * belong to exactly one topic, so the first resolvable owner is the answer; an item whose
 * outcomes resolve to nothing is skipped rather than filed under a made-up topic.
 */
function topicOfItem(
  item: CheckpointItemRef,
  outcomeTopics: Record<string, string>,
): string | undefined {
  for (const outcome of item.outcomes) {
    const topicId = outcomeTopics[outcome];
    if (topicId) return topicId;
  }
  return undefined;
}

/**
 * Roll up a placement attempt log into one verdict per topic.
 *
 * Two conditions, both required:
 *
 *  - **every item answered.** Without it, a learner who answers the two items they happen
 *    to know and abandons the rest places out of that topic on a 2/2 that was never a
 *    sample. `ratio` divides by `items`, not by `answered`, for the same reason.
 *  - **ratio ≥ 0.8.** At the two-item minimum the validator enforces, that means both
 *    right. Unforgiving on purpose: the costs are asymmetric. A false positive removes
 *    teaching the learner never sees again; a false negative costs a re-read they can
 *    skip in one click.
 *
 * Returns null while the set has never been attempted, exactly like the checkpoint rollup,
 * so a results panel can tell "not taken" from "taken and failed everything".
 */
export function placementResults(
  items: CheckpointItemRef[],
  attempts: Attempt[],
  setId: string,
  level: string,
  outcomeTopics: Record<string, string>,
): PlacementSummary | null {
  const own = attempts.filter((a) => a.setId === setId);
  if (own.length === 0) return null;

  const latest = latestVerifiedByItem(attempts, setId);

  // `write`/`speak` are rejected by the validator, but a set authored before that rule —
  // or an imported snapshot — must not be able to wedge a topic at "never answerable".
  const scorable = items.filter((item) => item.type !== 'write' && item.type !== 'speak');

  const rows = new Map<string, PlacementTopicResult>();
  let answered = 0;
  for (const item of scorable) {
    const topicId = topicOfItem(item, outcomeTopics);
    if (!topicId) continue;
    const row = rows.get(topicId) ?? {
      topicId,
      items: 0,
      answered: 0,
      score: 0,
      ratio: 0,
      placed: false,
    };
    row.items++;
    rows.set(topicId, row);

    const attempt = latest.get(item.id);
    if (!attempt) continue;
    answered++;
    row.answered++;
    row.score += attemptScore(attempt);
  }

  for (const row of rows.values()) {
    row.ratio = row.items > 0 ? row.score / row.items : 0;
    row.placed = row.answered === row.items && row.ratio >= PLACEMENT_PASS_RATIO;
  }

  return {
    setId,
    level,
    topics: [...rows.values()],
    answered,
    total: scorable.length,
    lastTs: Math.max(...own.map((a) => a.ts)),
  };
}
