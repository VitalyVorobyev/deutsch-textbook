import { useEffect, useState } from 'react';
import { splitQueue, type CardDef } from '../../lib/srs';
import { getCardStates } from '../../lib/store';
import { useExplainLang } from '../hooks';

interface Props {
  cards: CardDef[];
  /** compact renders just "n due" text; full renders the Today-page call to action */
  variant?: 'compact' | 'full';
}

export default function DueBadge({ cards, variant = 'compact' }: Props) {
  const lang = useExplainLang();
  const [counts, setCounts] = useState<{ due: number; fresh: number } | null>(null);

  useEffect(() => {
    void getCardStates().then((s) => {
      const { due, fresh } = splitQueue(cards, s);
      setCounts({ due: due.length, fresh: fresh.length });
    });
  }, [cards]);

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
