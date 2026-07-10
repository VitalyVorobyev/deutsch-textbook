import { useEffect, useState } from 'react';
import {
  getAttempts,
  getCardStates,
  getTopicsState,
  markTopicRead,
  setTopicManual,
  type TopicManual,
} from '../../lib/store';
import { topicCompletion, type Completion, type TopicRollup } from '../../lib/mastery';
import { useExplainLang } from '../hooks';
import { TierBadge } from './TierBadge';

interface Props {
  topicId: string;
  exerciseSets: string[];
  vocabIds: string[];
  readingIds: string[];
  pretestId?: string;
}

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

  async function refresh() {
    const [attempts, cards, topics] = await Promise.all([
      getAttempts(),
      getCardStates(),
      getTopicsState(),
    ]);
    setDone(topicCompletion(node, { attempts, cards, topics }));
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

  return (
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
  );
}
