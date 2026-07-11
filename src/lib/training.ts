/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { recommendedNext, topicSetIds, type TopicContext, type TopicNode } from './mastery';

/**
 * Pretests never enter the pool — they are guesses by design, meant to be
 * taken once before the article. Any other set is eligible only when its
 * topic is opened (readAt), already practiced (≥1 logged attempt on any of
 * the topic's sets — profiles that predate readAt tracking must not lose
 * their pool), or the recommended next topic on the spine.
 */
export function eligibleTrainingSets<
  T extends { setId: string; topicId: string; isPretest?: boolean },
>(sets: T[], spine: string[], nodes: TopicNode[], ctx: TopicContext): T[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const attempted = new Set(ctx.attempts.map((a) => a.setId));
  const practiced = (topicId: string): boolean => {
    const node = nodeById.get(topicId);
    return node ? topicSetIds(node).some((id) => attempted.has(id)) : false;
  };
  const next = recommendedNext(spine, nodes, ctx)?.id;
  return sets.filter(
    (s) =>
      !s.isPretest &&
      (ctx.topics[s.topicId]?.readAt || s.topicId === next || practiced(s.topicId)),
  );
}
