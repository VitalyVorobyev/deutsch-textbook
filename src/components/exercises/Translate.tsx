import { useRef, useState } from 'react';
import type { z } from 'zod';
import type { translateItemSchema } from '../../lib/schemas';
import { normalizeAnswer, translationMatches } from '../../lib/cloze';
import { CheckButton, Feedback, Instruction, type ItemProps } from './shared';

type TranslateItem = z.infer<typeof translateItemSchema>;

/** Characters that are awkward to type on a non-German keyboard. */
const SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß'] as const;

/** Strip attached punctuation so "Hund." and "Hund" count as the same word in the diff. */
const wordKey = (w: string) => w.replace(/[.,!?;:]+$/, '');

/**
 * Word-level diff via longest common subsequence: returns one flag per word of
 * `expected` — true if that word has no counterpart in `given` (i.e. differs).
 */
function diffExpected(expected: string[], given: string[]): boolean[] {
  const a = expected.map(wordKey);
  const b = given.map(wordKey);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const differs = expected.map(() => true);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      differs[i] = false;
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return differs;
}

export function Translate({ item, lang, onResult, locked }: ItemProps<TranslateItem>) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCorrect = translationMatches(value, [item.answer, ...item.accept]);

  function check() {
    if (checked || locked || value.trim() === '') return;
    setChecked(true);
    onResult({ correct: isCorrect, given: normalizeAnswer(value) });
  }

  /** Insert a character at the caret position of the answer input. */
  function insertChar(ch: string) {
    if (checked) return;
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
  }

  const answerWords = item.answer.split(/\s+/);
  const differs =
    checked && !isCorrect
      ? diffExpected(answerWords, normalizeAnswer(value).split(/\s+/))
      : null;

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="mb-4 text-lg font-medium">{lang === 'ru' ? item.prompt_ru : item.prompt_en}</p>
      <input
        ref={inputRef}
        type="text"
        lang="de"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={checked}
        placeholder={lang === 'ru' ? 'Введите немецкое предложение…' : 'Type the German sentence…'}
        className={`w-full rounded-md border-2 bg-transparent px-3 py-2 text-lg outline-none ${
          checked
            ? isCorrect
              ? 'border-green-500 text-green-700 dark:text-green-400'
              : 'border-red-500 text-red-700 dark:text-red-400'
            : 'border-stone-300 focus:border-amber-500 dark:border-stone-600'
        }`}
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="mt-2 flex gap-1.5" aria-label="Sonderzeichen">
        {SPECIAL_CHARS.map((ch) => (
          <button
            key={ch}
            type="button"
            lang="de"
            disabled={checked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertChar(ch)}
            className="min-h-10 rounded-md border border-stone-300 px-3 py-1 text-base hover:border-amber-500 disabled:opacity-40 dark:border-stone-600 dark:hover:border-amber-400 sm:min-h-0 sm:px-2.5 sm:py-0.5 sm:text-sm"
          >
            {ch}
          </button>
        ))}
      </div>
      {!checked && <CheckButton onClick={check} disabled={value.trim() === ''} />}
      {checked && (
        <Feedback
          correct={isCorrect}
          correctAnswer={
            differs &&
            answerWords.map((w, i) => (
              <span key={i}>
                {i > 0 && ' '}
                {differs[i] ? (
                  <mark className="rounded bg-red-200 px-0.5 text-red-900 dark:bg-red-800 dark:text-red-100">
                    {w}
                  </mark>
                ) : (
                  w
                )}
              </span>
            ))
          }
          explain={item.explain}
          lang={lang}
        />
      )}
    </div>
  );
}
