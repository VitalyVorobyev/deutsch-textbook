import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { mcItemSchema } from '../../lib/schemas';
import { shuffle } from '../../lib/shuffle';
import { Feedback, Instruction, Translation, type ItemProps } from './shared';

type McItem = z.infer<typeof mcItemSchema>;

export function MultipleChoice({ item, lang, onResult, locked }: ItemProps<McItem>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item]);

  function choose(idx: number) {
    if (locked || chosen !== null) return;
    setChosen(idx);
    onResult({ correct: idx === item.correct, given: item.options[idx]! });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p lang="de" className="mb-4 text-lg font-medium">{item.prompt}</p>
      <div className="flex flex-col gap-2">
        {order.map((idx) => {
          const answered = chosen !== null;
          const isCorrect = idx === item.correct;
          const isChosen = idx === chosen;
          let cls = 'border-stone-300 hover:border-amber-500 dark:border-stone-600 dark:hover:border-amber-400';
          if (answered && isCorrect) cls = 'border-green-500 bg-green-50 dark:bg-green-950';
          else if (answered && isChosen) cls = 'border-red-500 bg-red-50 dark:bg-red-950';
          else if (answered) cls = 'border-stone-200 opacity-60 dark:border-stone-700';
          return (
            <button
              key={idx}
              type="button"
              lang="de"
              onClick={() => choose(idx)}
              disabled={chosen !== null}
              className={`rounded-md border px-4 py-2 text-left text-base ${cls}`}
            >
              {item.options[idx]}
            </button>
          );
        })}
      </div>
      <Translation text={item.translation} lang={lang} />
      {chosen !== null && (
        <Feedback
          correct={chosen === item.correct}
          correctAnswer={item.options[item.correct]}
          explain={item.explain}
          lang={lang}
        />
      )}
    </div>
  );
}
