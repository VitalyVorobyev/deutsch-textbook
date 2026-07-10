import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { topicCompletion, type TopicContext, type TopicRollup } from '../../lib/mastery';
import { TierBadge } from './TierBadge';

interface Props {
  topics: TopicRollup[];
}

/**
 * Single overlay island for the /topics grid: one data read, computes every
 * topic's tier, and portals a completion badge into each server-rendered card's
 * `[data-topic-badge="<id>"]` placeholder. Untouched topics get no badge.
 */
export default function TopicsProgress({ topics }: Props) {
  const [ctx, setCtx] = useState<TopicContext | null>(null);
  const [slots, setSlots] = useState<Array<[string, HTMLElement]>>([]);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, tp]) => setCtx({ attempts, cards, topics: tp }),
    );
    const found: Array<[string, HTMLElement]> = [];
    document.querySelectorAll<HTMLElement>('[data-topic-badge]').forEach((el) => {
      const id = el.getAttribute('data-topic-badge');
      if (id) found.push([id, el]);
    });
    setSlots(found);
  }, []);

  if (!ctx) return null;
  const byId = new Map(topics.map((t) => [t.id, t]));

  return (
    <>
      {slots.map(([id, el]) => {
        const node = byId.get(id);
        if (!node) return null;
        const done = topicCompletion(node, ctx);
        if (done.tier === 'untouched') return null;
        return createPortal(<TierBadge tier={done.tier} manual={!!done.manual} />, el, id);
      })}
    </>
  );
}
