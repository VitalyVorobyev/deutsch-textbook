import { useEffect, useState } from 'react';
import { suggestNextTopic, topicMastery, type TopicNode } from '../../lib/mastery';
import { getAttempts } from '../../lib/store';
import { useExplainLang } from '../hooks';

interface Props {
  nodes: TopicNode[];
}

export default function NextTopic({ nodes }: Props) {
  const lang = useExplainLang();
  const [suggestion, setSuggestion] = useState<TopicNode | null>(null);
  const [mastered, setMastered] = useState(0);

  useEffect(() => {
    void getAttempts().then((attempts) => {
      setSuggestion(suggestNextTopic(nodes, attempts) ?? null);
      setMastered(nodes.filter((n) => topicMastery(n, attempts) === 'mastered').length);
    });
  }, [nodes]);

  if (!suggestion) return null;

  return (
    <div>
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
      <p className="mt-3 text-xs text-stone-400">
        {lang === 'ru'
          ? `Освоено тем: ${mastered} из ${nodes.length}`
          : `Topics mastered: ${mastered} of ${nodes.length}`}
      </p>
    </div>
  );
}
