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
  const [state, setState] = useState<{
    ctx: TopicContext;
    slots: Array<[string, HTMLElement]>;
  } | null>(null);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, tp]) => {
        // nothing renders until the data is here, so the badge slots can be
        // collected in the same pass — one state set, one render
        const slots: Array<[string, HTMLElement]> = [];
        document.querySelectorAll<HTMLElement>('[data-topic-badge]').forEach((el) => {
          const id = el.getAttribute('data-topic-badge');
          if (id) slots.push([id, el]);
        });
        setState({ ctx: { attempts, cards, topics: tp }, slots });
      },
    );
  }, []);

  if (!state) return null;
  const { ctx, slots } = state;
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
