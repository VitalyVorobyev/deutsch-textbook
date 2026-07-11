import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { matchItemSchema } from '../../lib/schemas';
import { shuffle } from '../../lib/shuffle';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type MatchItem = z.infer<typeof matchItemSchema>;

export function Match({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<MatchItem>) {
  const rights = useMemo(() => shuffle(item.pairs.map((p) => p.right)), [item]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const done = matched.size === item.pairs.length;

  function clickRight(right: string) {
    if (!selectedLeft || locked || done) return;
    const pair = item.pairs.find((p) => p.left === selectedLeft);
    if (pair?.right === right) {
      const next = new Set(matched).add(selectedLeft);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === item.pairs.length) {
        onResult({ correct: errors === 0, given: `${errors} Fehler` });
      }
    } else {
      setErrors((e) => e + 1);
      setWrongFlash(right);
      setTimeout(() => setWrongFlash(null), 400);
    }
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <div className="grid grid-cols-2 items-start gap-2">
        <div className="flex flex-col gap-2">
          {item.pairs.map((p) => {
            const isMatched = matched.has(p.left);
            return (
              <button
                key={p.left}
                type="button"
                lang="de"
                disabled={isMatched || done}
                onClick={() => setSelectedLeft(p.left)}
                className={`min-h-11 break-words rounded-md border px-2.5 py-2 text-left text-sm leading-snug sm:min-h-0 sm:px-3 ${
                  isMatched
                    ? 'border-green-400 bg-green-50 opacity-60 dark:bg-green-950'
                    : selectedLeft === p.left
                      ? 'border-amber-500 bg-amber-50 dark:bg-stone-800'
                      : 'border-stone-300 hover:border-amber-400 dark:border-stone-600'
                }`}
              >
                {p.left}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {rights.map((right) => {
            const isMatched = item.pairs.some((p) => p.right === right && matched.has(p.left));
            return (
              <button
                key={right}
                type="button"
                disabled={isMatched || done}
                onClick={() => clickRight(right)}
                className={`min-h-11 break-words rounded-md border px-2.5 py-2 text-left text-sm leading-snug sm:min-h-0 sm:px-3 ${
                  isMatched
                    ? 'border-green-400 bg-green-50 opacity-60 dark:bg-green-950'
                    : wrongFlash === right
                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                      : 'border-stone-300 hover:border-amber-400 dark:border-stone-600'
                }`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      {/* height reserved even at zero errors, so the counter appearing cannot shove the action row down */}
      <p className="mt-2 min-h-4 text-xs text-red-600 dark:text-red-400">
        {errors > 0 && !done && (lang === 'ru' ? `Ошибки: ${errors}` : `Errors: ${errors}`)}
      </p>
      <ActionRow
        checked={done}
        correct={errors === 0}
        onNext={onNext}
        nextLabel={nextLabel}
      />
      {done && <Feedback correct={errors === 0} explain={item.explain} lang={lang} />}
    </div>
  );
}
