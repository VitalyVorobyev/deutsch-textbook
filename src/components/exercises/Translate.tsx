import { useRef, useState } from 'react';
import type { z } from 'zod';
import type { translateItemSchema } from '../../lib/schemas';
import { normalizeAnswer, normalizeTranslation } from '../../lib/cloze';
import {
  closestTranslationCandidate,
  gradeTranslation,
  translationCandidates,
  verdictIsCorrect,
  type TranslationVerdict,
} from '../../lib/production';
import { diffExpectedWords } from '../../lib/worddiff';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type TranslateItem = z.infer<typeof translateItemSchema>;

/** Characters that are awkward to type on a non-German keyboard. */
const SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß'] as const;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  placeholder: { en: 'Type the German sentence…', ru: 'Введите немецкое предложение…' },
  correctionLabel: { en: 'Correction: ', ru: 'Исправленный вариант: ' },
  spellingNote: { en: 'Watch the spelling: ', ru: 'Обратите внимание на написание: ' },
} as const satisfies Record<string, { en: string; ru: string }>;

export function Translate({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
}: ItemProps<TranslateItem>) {
  const uiLang = useUiLang();
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

  const feedbackTarget = closestTranslationCandidate(value, {
    answer: item.answer,
    accept: item.accept,
  });
  const answerWords = feedbackTarget.split(/\s+/);
  const alternatives = translationCandidates({ answer: item.answer, accept: item.accept }).filter(
    (candidate) => normalizeTranslation(candidate) !== normalizeTranslation(feedbackTarget),
  );
  const differs =
    checked && !isCorrect
      ? diffExpectedWords(answerWords, normalizeAnswer(value).split(/\s+/))
      : null;

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {/* No prompt_de exists by design (German→German is nonsense): 'de' mode
          falls back to the EN prompt inside pick(). */}
      <p className="mb-4 text-lg font-medium">{pick(lang, { en: item.prompt_en, ru: item.prompt_ru, uk: item.prompt_uk })}</p>
      <input
        ref={inputRef}
        type="text"
        lang="de"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={checked}
        placeholder={pick(lang, UI.placeholder)}
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
      <div className="mt-2 flex gap-1.5" aria-label={t('exercise.specialChars', uiLang)}>
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
          correctAnswerLabel={pick(lang, UI.correctionLabel)}
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
                {pick(lang, UI.spellingNote)}
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
          speakText={feedbackTarget}
          alternatives={alternatives}
        />
      )}
    </div>
  );
}
