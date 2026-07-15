import { useEffect, useState } from 'react';
import { recommendedNext, topicCompletion, type TopicNode } from '../../lib/mastery';
import { dueCheckpoint, type CheckpointRef } from '../../lib/checkpoint';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  nextTopic: { en: 'Suggested next topic', ru: 'Следующая тема' },
  allLessons: { en: 'All lessons complete', ru: 'Все уроки пройдены' },
  measure: {
    en: 'Measure what you can already do at this level.',
    ru: 'Проверьте, что вы уже умеете на этом уровне.',
  },
  masteredOf: { en: 'Topics mastered: {done} of {total}', ru: 'Освоено тем: {done} из {total}' },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Props {
  /** topic ids in recommended-path order (getCurriculum().spine) */
  spine: string[];
  nodes: TopicNode[];
  /** every level checkpoint in the content; the due one (if any) is surfaced */
  checkpoints?: CheckpointRef[];
}

const NO_CHECKPOINTS: CheckpointRef[] = [];

export default function NextTopic({ spine, nodes, checkpoints = NO_CHECKPOINTS }: Props) {
  const lang = useExplainLang();
  const [suggestion, setSuggestion] = useState<TopicNode | null>(null);
  const [mastered, setMastered] = useState(0);
  const [checkpoint, setCheckpoint] = useState<CheckpointRef | null>(null);

  useEffect(() => {
    void Promise.all([getAttempts(), getCardStates(), getTopicsState()]).then(
      ([attempts, cards, topics]) => {
        const ctx = { attempts, cards, topics };
        setSuggestion(recommendedNext(spine, nodes, ctx) ?? null);
        setMastered(nodes.filter((n) => topicCompletion(n, ctx).tier === 'mastered').length);
        setCheckpoint(dueCheckpoint(checkpoints, nodes, ctx) ?? null);
      },
    );
  }, [spine, nodes, checkpoints]);

  if (!suggestion && !checkpoint) return null;

  return (
    <div>
      {suggestion && (
        <>
          <p className="text-xs uppercase tracking-wide text-stone-400">
            {pick(lang, UI.nextTopic)}
          </p>
          <a href={suggestion.path} className="mt-1 block">
            <span lang="de" className="text-xl font-bold text-amber-700 hover:underline dark:text-amber-400">
              {suggestion.title_de}
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, { en: suggestion.title_en, ru: suggestion.title_ru, uk: suggestion.title_uk })} · {suggestion.level}
            </span>
          </a>
        </>
      )}
      {checkpoint && (
        <div className={suggestion ? 'mt-4 border-t border-stone-200 pt-3 dark:border-stone-700' : ''}>
          <p className="text-xs uppercase tracking-wide text-stone-400">
            {pick(lang, UI.allLessons)}
          </p>
          <a href={checkpoint.path} className="mt-1 block">
            <span className="text-xl font-bold text-amber-700 hover:underline dark:text-amber-400">
              {checkpoint.title} →
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.measure)}
            </span>
          </a>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-400">
        {pick(lang, UI.masteredOf).replace('{done}', String(mastered)).replace('{total}', String(nodes.length))}
      </p>
    </div>
  );
}
