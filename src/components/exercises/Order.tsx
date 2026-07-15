import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { orderItemSchema } from '../../lib/schemas';
import { normalizeSentence } from '../../lib/cloze';
import { shuffle } from '../../lib/shuffle';
import { pick } from '../../lib/prefs';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type OrderItem = z.infer<typeof orderItemSchema>;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  emptyState: { en: 'Build the sentence…', ru: 'Соберите предложение…' },
} as const satisfies Record<string, { en: string; ru: string }>;

interface Chip {
  word: string;
  key: number;
}

export function Order({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<OrderItem>) {
  const initialPool = useMemo<Chip[]>(
    () => shuffle(item.words.map((word, key) => ({ word, key }))),
    [item],
  );
  const [pool, setPool] = useState<Chip[]>(initialPool);
  const [answer, setAnswer] = useState<Chip[]>([]);
  const [checked, setChecked] = useState(false);

  const target = normalizeSentence(item.words);
  const accepted = [target, ...item.accept.map((s) => normalizeSentence(s.split(/\s+/)))];
  const givenSentence = normalizeSentence(answer.map((c) => c.word));
  const isCorrect = accepted.includes(givenSentence);

  function check() {
    if (checked || locked) return;
    setChecked(true);
    onResult({ correct: isCorrect, given: givenSentence });
  }

  const chipCls =
    'min-h-11 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-base shadow-sm hover:border-amber-500 sm:min-h-0 dark:border-stone-600 dark:bg-stone-800';

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <div
        lang="de"
        className={`mb-3 flex min-h-14 flex-wrap items-center gap-2 rounded-md border-2 border-dashed px-3 py-2 ${
          checked
            ? isCorrect
              ? 'border-green-400'
              : 'border-red-400'
            : 'border-stone-300 dark:border-stone-600'
        }`}
      >
        {answer.length === 0 && (
          <span className="text-sm text-stone-400">
            {pick(lang, UI.emptyState)}
          </span>
        )}
        {answer.map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={checked}
            onClick={() => {
              setAnswer((a) => a.filter((c) => c.key !== chip.key));
              setPool((p) => [...p, chip]);
            }}
            className={chipCls}
          >
            {chip.word}
          </button>
        ))}
      </div>
      <div lang="de" className="flex flex-wrap gap-2">
        {pool.map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={checked}
            onClick={() => {
              setPool((p) => p.filter((c) => c.key !== chip.key));
              setAnswer((a) => [...a, chip]);
            }}
            className={chipCls}
          >
            {chip.word}
          </button>
        ))}
      </div>
      <Translation text={item.translation} lang={lang} />
      <ActionRow
        checked={checked}
        correct={isCorrect}
        onCheck={check}
        checkDisabled={pool.length > 0}
        onNext={onNext}
        nextLabel={nextLabel}
      />
      {checked && (
        <Feedback correct={isCorrect} correctAnswer={target} explain={item.explain} lang={lang} />
      )}
    </div>
  );
}
