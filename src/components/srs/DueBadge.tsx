import { useEffect, useState } from 'react';
import type { CardDef } from '../../lib/srs';
import { planReview, type ReviewGate, type ReviewPlanResult } from '../../lib/decks';
import { getAttempts, getCardStates, getLearningGoal, getTopicsState } from '../../lib/store';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  due: { en: 'due', ru: 'к повторению' },
  cardsDue: { en: 'cards due for review', ru: 'карточек к повторению' },
  notStarted: {
    en: 'Flashcards appear as soon as you open your first topic.',
    ru: 'Карточки появятся, как только вы откроете первую тему.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Props {
  cards: CardDef[];
  /** compact renders just "n due" text; full renders the Today-page call to action */
  variant?: 'compact' | 'full';
  /** when set, the "new" count only counts eligible decks — must match the
      gate of the queue this badge advertises (the compact variant never
      shows fresh, so per-deck badges don't need it) */
  gate?: ReviewGate;
  /** fresh-card cap of the queue this badge advertises — the same value the
      review page passes to FlashcardSession, so the numbers agree */
  newLimit?: number;
}

export default function DueBadge({ cards, variant = 'compact', gate, newLimit = 15 }: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [plan, setPlan] = useState<ReviewPlanResult | null>(null);
  const [started, setStarted] = useState(true);

  useEffect(() => {
    void Promise.all([
      getCardStates(),
      gate ? getAttempts() : [],
      gate ? getTopicsState() : {},
      gate ? getLearningGoal() : undefined,
    ]).then(([s, attempts, topics, goal]) => {
      setStarted(Object.keys(s).length > 0);
      setPlan(planReview(cards, gate, { attempts, cards: s, topics, goal }, { newLimit }));
    });
  }, [cards, gate, newLimit]);

  if (!plan) return null;

  if (variant === 'compact') {
    if (plan.dueCount === 0) return null;
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        {plan.dueCount} {pick(lang, UI.due)}
      </span>
    );
  }

  if (plan.total === 0) {
    // A zero the learner has earned ("nothing is due today") and a zero that
    // only means "you haven't started" look identical but say opposite things.
    // Fresh cards are gated on opening a topic (see eligibleFreshCards), so the
    // second is exactly what a new profile sees — and it reads as broken.
    return (
      <div>
        <p className="text-4xl font-bold">0</p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {started ? pick(lang, UI.cardsDue) : pick(lang, UI.notStarted)}
        </p>
      </div>
    );
  }

  const parts: string[] = [];
  if (plan.dueCount > 0) parts.push(t('flashcards.due', uiLang).replace('{n}', String(plan.dueCount)));
  if (plan.freshCount > 0) parts.push(t('flashcards.new', uiLang).replace('{n}', String(plan.freshCount)));

  return (
    <div>
      <p className="text-4xl font-bold">{plan.total}</p>
      <p lang={uiLang} className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {parts.join(' · ')}
      </p>
    </div>
  );
}
