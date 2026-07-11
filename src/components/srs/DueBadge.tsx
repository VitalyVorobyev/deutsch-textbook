import { useEffect, useState } from 'react';
import { splitQueue, type CardDef } from '../../lib/srs';
import { eligibleFreshCards } from '../../lib/decks';
import type { TopicNode } from '../../lib/mastery';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { useExplainLang } from '../hooks';

interface Props {
  cards: CardDef[];
  /** compact renders just "n due" text; full renders the Today-page call to action */
  variant?: 'compact' | 'full';
  /** when set, the "new" count only counts eligible decks — must match the
      gate of the queue this badge advertises (the compact variant never
      shows fresh, so per-deck badges don't need it) */
  gate?: { spine: string[]; nodes: TopicNode[]; deckLevels: Record<string, string> };
}

export default function DueBadge({ cards, variant = 'compact', gate }: Props) {
  const lang = useExplainLang();
  const [counts, setCounts] = useState<{ due: number; fresh: number } | null>(null);

  useEffect(() => {
    void Promise.all([
      getCardStates(),
      gate ? getAttempts() : [],
      gate ? getTopicsState() : {},
    ]).then(([s, attempts, topics]) => {
      const { due, fresh } = splitQueue(cards, s);
      const pool = gate
        ? eligibleFreshCards(fresh, gate.spine, gate.nodes, gate.deckLevels, {
            attempts,
            cards: s,
            topics,
          })
        : fresh;
      setCounts({ due: due.length, fresh: pool.length });
    });
  }, [cards, gate]);

  if (!counts) return null;

  if (variant === 'compact') {
    if (counts.due === 0) return null;
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        {counts.due} {lang === 'ru' ? 'к повторению' : 'due'}
      </span>
    );
  }

  return (
    <div>
      <p className="text-4xl font-bold">{counts.due}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {lang === 'ru' ? 'карточек к повторению' : 'cards due for review'}
        {counts.fresh > 0 && (
          <span> · {counts.fresh} {lang === 'ru' ? 'новых' : 'new'}</span>
        )}
      </p>
    </div>
  );
}
