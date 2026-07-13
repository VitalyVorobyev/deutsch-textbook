import { useEffect, useState } from 'react';
import { recommendedNext, topicCompletion, type TopicNode } from '../../lib/mastery';
import { dueCheckpoint, type CheckpointRef } from '../../lib/checkpoint';
import { getAttempts, getCardStates, getTopicsState } from '../../lib/store';
import { useExplainLang } from '../hooks';

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
            {lang === 'ru' ? 'Следующая тема' : 'Suggested next topic'}
          </p>
          <a href={suggestion.path} className="mt-1 block">
            <span lang="de" className="text-xl font-bold text-amber-700 hover:underline dark:text-amber-400">
              {suggestion.title_de}
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {lang === 'ru' ? suggestion.title_ru : suggestion.title_en} · {suggestion.level}
            </span>
          </a>
        </>
      )}
      {checkpoint && (
        <div className={suggestion ? 'mt-4 border-t border-stone-200 pt-3 dark:border-stone-700' : ''}>
          <p className="text-xs uppercase tracking-wide text-stone-400">
            {lang === 'ru' ? 'Все уроки пройдены' : 'All lessons complete'}
          </p>
          <a href={checkpoint.path} className="mt-1 block">
            <span className="text-xl font-bold text-amber-700 hover:underline dark:text-amber-400">
              {checkpoint.title} →
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {lang === 'ru'
                ? 'Проверьте, что вы уже умеете на этом уровне.'
                : 'Measure what you can already do at this level.'}
            </span>
          </a>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-400">
        {lang === 'ru'
          ? `Освоено тем: ${mastered} из ${nodes.length}`
          : `Topics mastered: ${mastered} of ${nodes.length}`}
      </p>
    </div>
  );
}
