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
import { pick } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { SelfAssessedMark, TierBadge } from './TierBadge';

interface Props {
  topicId: string;
  exerciseSets: string[];
  vocabIds: string[];
  readingIds: string[];
  pretestId?: string;
}

const REQ_KEYS: Record<MasteryReq, StringKey> = {
  attempts: 'mastery.reqAttempts',
  accuracy: 'mastery.reqAccuracy',
  days: 'mastery.reqDays',
  cards: 'mastery.reqCards',
};

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  // The ru values were German before the sweep (an authoring slip the inline
  // ternaries hid) — fixed here rather than preserved byte-exact.
  reopen: { en: 'Reopen', ru: 'Открыть заново' },
  markLearned: { en: 'Mark as learned', ru: 'Отметить как изученное' },
  clearManual: {
    en: 'Clear manual state — use activity-based tier',
    ru: 'Сбросить ручной статус — по активности',
  },
  auto: { en: 'auto', ru: 'авто' },
} as const satisfies Record<string, { en: string; ru: string }>;

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
  const uiLang = useUiLang();
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

  if (!done) {
    return <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />;
  }

  const isMastered = done.tier === 'mastered';
  const selfLearned = done.manual === 'learned';
  // The gate is only worth explaining once the learner is actually practising it.
  // (Shown even when self-assessed as learned — the badge stays measured, so the
  // explanation must follow the badge.)
  const missing = gaps.filter((g) => !g.met);
  const showGaps = done.auto === 'practiced' && missing.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={done.tier} manual={done.manual === 'reopened'} />
        {selfLearned && <SelfAssessedMark />}
        {isMastered ? (
          <button
            type="button"
            onClick={() => void setManual('reopened')}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300"
          >
            {pick(lang, UI.reopen)}
          </button>
        ) : (
          !selfLearned && (
            <button
              type="button"
              onClick={() => void setManual('learned')}
              className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-emerald-500 dark:border-stone-600 dark:text-stone-300"
            >
              {pick(lang, UI.markLearned)}
            </button>
          )
        )}
        {done.manual && (
          <button
            type="button"
            onClick={() => void setManual(null)}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            title={pick(lang, UI.clearManual)}
          >
            ↺ {pick(lang, UI.auto)}
          </button>
        )}
      </div>

      {showGaps && (
        <div className="max-w-prose rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-800/60">
          <p lang={uiLang} className="font-medium text-stone-600 dark:text-stone-300">
            {t('mastery.missingHeader', uiLang)}
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
                <span lang={uiLang}>{t(REQ_KEYS[g.req], uiLang)}</span>{' '}
                <span className="tabular-nums opacity-70">{reqValue(g)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-stone-500 dark:text-stone-400">
            {pick(lang, REQ_HINT[missing[0]!.req])}
          </p>
        </div>
      )}
    </div>
  );
}
