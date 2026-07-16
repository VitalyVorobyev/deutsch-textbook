import { useMemo, useState } from 'react';
import type { z } from 'zod';
import type { matchItemSchema } from '../../lib/schemas';
import { shuffle } from '../../lib/shuffle';
import { pick, pickLang } from '../../lib/prefs';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type MatchItem = z.infer<typeof matchItemSchema>;
type RightSide = MatchItem['pairs'][number]['right'];

/** A record right's `en` is its stable identity (matching, keys, shuffle);
    a plain-string right is its own identity. Display resolves separately. */
const rightKey = (r: RightSide): string => (typeof r === 'string' ? r : r.en);

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  errors: { en: 'Errors', ru: 'Ошибки' },
} as const satisfies Record<string, { en: string; ru: string }>;

export function Match({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<MatchItem>) {
  const rights = useMemo(() => shuffle(item.pairs.map((p) => p.right)), [item]);
  const rightText = (r: RightSide): string => (typeof r === 'string' ? r : pick(lang, r));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const done = matched.size === item.pairs.length;

  function clickRight(right: RightSide) {
    if (!selectedLeft || locked || done) return;
    const pair = item.pairs.find((p) => p.left === selectedLeft);
    if (pair && rightKey(pair.right) === rightKey(right)) {
      const next = new Set(matched).add(selectedLeft);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === item.pairs.length) {
        onResult({
          correct: errors === 0,
          given: `${errors} Fehler`,
          // errors are unbounded (every wrong click counts) — credit clamps at zero
          correctParts: Math.max(0, item.pairs.length - errors),
          totalParts: item.pairs.length,
        });
      }
    } else {
      setErrors((e) => e + 1);
      setWrongFlash(rightKey(right));
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
            const key = rightKey(right);
            const isMatched = item.pairs.some((p) => rightKey(p.right) === key && matched.has(p.left));
            return (
              <button
                key={key}
                type="button"
                lang={typeof right === 'string' ? 'de' : pickLang(lang, right)}
                disabled={isMatched || done}
                onClick={() => clickRight(right)}
                className={`min-h-11 break-words rounded-md border px-2.5 py-2 text-left text-sm leading-snug sm:min-h-0 sm:px-3 ${
                  isMatched
                    ? 'border-green-400 bg-green-50 opacity-60 dark:bg-green-950'
                    : wrongFlash === key
                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                      : 'border-stone-300 hover:border-amber-400 dark:border-stone-600'
                }`}
              >
                {rightText(right)}
              </button>
            );
          })}
        </div>
      </div>
      {/* height reserved even at zero errors, so the counter appearing cannot shove the action row down */}
      <p className="mt-2 min-h-4 text-xs text-red-600 dark:text-red-400">
        {errors > 0 && !done && `${pick(lang, UI.errors)}: ${errors}`}
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
