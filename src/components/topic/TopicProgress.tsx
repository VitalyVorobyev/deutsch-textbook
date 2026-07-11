import { useEffect, useState } from 'react';
import {
  getAttempts,
  getCardStates,
  getTopicsState,
  markTopicRead,
  setTopicManual,
  type TopicManual,
} from '../../lib/store';
import {
  masteryGaps,
  topicCompletion,
  type Completion,
  type MasteryGap,
  type MasteryReq,
  type TopicRollup,
} from '../../lib/mastery';
import { useExplainLang } from '../hooks';
import { TierBadge } from './TierBadge';

interface Props {
  topicId: string;
  exerciseSets: string[];
  vocabIds: string[];
  readingIds: string[];
  pretestId?: string;
}

const REQ_LABEL: Record<MasteryReq, string> = {
  attempts: 'Aufgaben gelöst',
  accuracy: 'richtig',
  days: 'an 2 Tagen geübt',
  cards: 'Vokabeln wiederholt',
};

function reqValue(g: MasteryGap): string {
  if (g.req === 'accuracy') return `${g.have}%`;
  if (g.req === 'cards') return `${g.have}`;
  return `${g.have}/${g.need}`;
}

/** Why this requirement is not met yet — the teaching moment behind the gate. */
const REQ_HINT: Record<MasteryReq, { en: string; ru: string }> = {
  attempts: {
    en: 'Answer at least 5 items from this topic — the pretest does not count.',
    ru: 'Решите хотя бы 5 заданий по теме — претест не считается.',
  },
  accuracy: {
    en: 'Fewer than 80% of your last 10 answers here were correct. Re-read the article and run the exercises again.',
    ru: 'В последних 10 ответах по теме меньше 80% верных. Перечитайте статью и пройдите упражнения ещё раз.',
  },
  days: {
    en: 'Come back on another day and answer one more item. The gap between sessions is what turns fluency into memory — accuracy inside a single sitting fades fast.',
    ru: 'Вернитесь в другой день и решите ещё одно задание. Именно перерыв между занятиями превращает беглость в память — точность внутри одного захода быстро исчезает.',
  },
  cards: {
    en: "Review at least one flashcard from this topic's deck.",
    ru: 'Повторите хотя бы одну карточку из словаря темы.',
  },
};

/**
 * Topic-header island: marks the article read on mount (idempotent), shows the
 * completion badge, and offers the manual "learned / re-open" override.
 */
export default function TopicProgress(props: Props) {
  const lang = useExplainLang();
  const node: TopicRollup = {
    id: props.topicId,
    exerciseSets: props.exerciseSets,
    vocabIds: props.vocabIds,
    readingIds: props.readingIds,
    pretestId: props.pretestId,
  };
  const [done, setDone] = useState<Completion | null>(null);
  const [gaps, setGaps] = useState<MasteryGap[]>([]);

  async function refresh() {
    const [attempts, cards, topics] = await Promise.all([
      getAttempts(),
      getCardStates(),
      getTopicsState(),
    ]);
    const ctx = { attempts, cards, topics };
    setDone(topicCompletion(node, ctx));
    setGaps(masteryGaps(node, ctx));
  }

  useEffect(() => {
    void (async () => {
      await markTopicRead(props.topicId);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.topicId]);

  async function setManual(manual: TopicManual | null) {
    await setTopicManual(props.topicId, manual);
    await refresh();
  }

  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  if (!done) {
    return <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />;
  }

  const isMastered = done.tier === 'mastered';
  // The gate is only worth explaining once the learner is actually practising it
  // and has not overridden the tier by hand.
  const missing = gaps.filter((g) => !g.met);
  const showGaps = done.auto === 'practiced' && !done.manual && missing.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={done.tier} manual={!!done.manual} />
        {isMastered ? (
          <button
            type="button"
            onClick={() => void setManual('reopened')}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300"
          >
            {t('Reopen', 'Wieder öffnen')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void setManual('learned')}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-emerald-500 dark:border-stone-600 dark:text-stone-300"
          >
            {t('Mark as learned', 'Als gelernt markieren')}
          </button>
        )}
        {done.manual && (
          <button
            type="button"
            onClick={() => void setManual(null)}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            title={t('Clear manual state — use activity-based tier', 'Сбросить ручной статус — по активности')}
          >
            ↺ {t('auto', 'авто')}
          </button>
        )}
      </div>

      {showGaps && (
        <div className="max-w-prose rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-800/60">
          <p lang="de" className="font-medium text-stone-600 dark:text-stone-300">
            Für „Gemeistert“ fehlt noch:
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {gaps.map((g) => (
              <li
                key={g.req}
                className={
                  g.met
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'font-medium text-stone-600 dark:text-stone-300'
                }
              >
                <span aria-hidden="true">{g.met ? '✓' : '✗'}</span>{' '}
                <span lang="de">{REQ_LABEL[g.req]}</span>{' '}
                <span className="tabular-nums opacity-70">{reqValue(g)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-stone-500 dark:text-stone-400">
            {t(REQ_HINT[missing[0]!.req].en, REQ_HINT[missing[0]!.req].ru)}
          </p>
        </div>
      )}
    </div>
  );
}
