/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { suggestNextTopic, topicSetIds, type TopicNode } from './mastery';
import type { Attempt, TopicsState } from './store';

/**
 * Pretests never enter the pool — they are guesses by design, meant to be
 * taken once before the article. Any other set is eligible only when its
 * topic is opened (readAt), already practiced (≥1 logged attempt on any of
 * the topic's sets — profiles that predate readAt tracking must not lose
 * their pool), or the suggested next topic.
 */
export function eligibleTrainingSets<
  T extends { setId: string; topicId: string; isPretest?: boolean },
>(sets: T[], nodes: TopicNode[], attempts: Attempt[], topics: TopicsState): T[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const attempted = new Set(attempts.map((a) => a.setId));
  const practiced = (topicId: string): boolean => {
    const node = nodeById.get(topicId);
    return node ? topicSetIds(node).some((id) => attempted.has(id)) : false;
  };
  const next = suggestNextTopic(nodes, attempts)?.id;
  return sets.filter(
    (s) =>
      !s.isPretest &&
      (topics[s.topicId]?.readAt || s.topicId === next || practiced(s.topicId)),
  );
}
