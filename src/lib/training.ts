/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { topicPracticeSetIds, type TopicContext, type TopicNode } from './mastery';

/**
 * Pretests never enter the pool — they are guesses by design, meant to be
 * taken once before the article. Any other set is eligible only when its
 * topic is opened (readAt) or already practiced (≥1 logged non-pretest attempt
 * — profiles that predate readAt tracking must not lose their pool).
 */
export function eligibleTrainingSets<
  T extends { setId: string; topicId: string; role?: string },
>(sets: T[], spine: string[], nodes: TopicNode[], ctx: TopicContext): T[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const attempted = new Set(ctx.attempts.map((a) => a.setId));
  const practiced = (topicId: string): boolean => {
    const node = nodeById.get(topicId);
    return node ? topicPracticeSetIds(node).some((id) => attempted.has(id)) : false;
  };
  void spine;
  const trainableRoles = new Set(['practice', 'drill']);
  return sets.filter(
    (s) =>
      trainableRoles.has(s.role ?? 'practice') &&
      (ctx.topics[s.topicId]?.readAt || practiced(s.topicId)),
  );
}

/** A resumed queue may continue only while every queued set is still eligible. */
export function resumedQueueIsEligible(
  queued: readonly { setId: string }[],
  eligible: readonly { setId: string }[],
): boolean {
  const allowed = new Set(eligible.map((set) => set.setId));
  return queued.every((entry) => allowed.has(entry.setId));
}
