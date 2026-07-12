import { useRef, useState } from 'react';
import type { z } from 'zod';
import type { translateItemSchema } from '../../lib/schemas';
import { normalizeAnswer } from '../../lib/cloze';
import { gradeTranslation, verdictIsCorrect, type TranslationVerdict } from '../../lib/production';
import { diffExpectedWords } from '../../lib/worddiff';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type TranslateItem = z.infer<typeof translateItemSchema>;

/** Characters that are awkward to type on a non-German keyboard. */
const SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß'] as const;

export function Translate({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
}: ItemProps<TranslateItem>) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const verdict: TranslationVerdict = gradeTranslation(value, {
    answer: item.answer,
    accept: item.accept,
    focus: item.focus,
    keyTokens: item.key_tokens,
  });
  const isCorrect = verdictIsCorrect(verdict);

  function check() {
    if (checked || locked || value.trim() === '') return;
    setChecked(true);
    onResult({
      correct: isCorrect,
      given: normalizeAnswer(value),
      // A correct answer — including one with a slipped letter — keeps the item's tag:
      // producing the structure correctly is exactly the positive evidence that tag is
      // for. Only a failure gives it up, and only when the tokens that diverged are not
      // the ones the tag grades (`undefined` means "use the item's own tag").
      focus: verdict.kind === 'wrong' ? (verdict.focus ?? null) : undefined,
    });
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
      ? diffExpectedWords(answerWords, normalizeAnswer(value).split(/\s+/))
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
      <ActionRow
        checked={checked}
        correct={isCorrect}
        onCheck={check}
        checkDisabled={value.trim() === ''}
        onNext={onNext}
        nextLabel={nextLabel}
      />
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
          note={
            verdict.kind === 'spelling' && (
              <p>
                {lang === 'ru' ? 'Обратите внимание на написание: ' : 'Watch the spelling: '}
                <span lang="de">
                  <s className="opacity-70">{verdict.correction.given}</s>
                  {' → '}
                  <strong>{verdict.correction.expected}</strong>
                </span>
              </p>
            )
          }
          explain={item.explain}
          lang={lang}
          speakText={item.answer}
        />
      )}
    </div>
  );
}
