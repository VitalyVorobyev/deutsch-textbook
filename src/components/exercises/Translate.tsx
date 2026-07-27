import { useEffect, useRef, useState } from 'react';
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
import { GERMAN_INPUT_KEYS as SPECIAL_CHARS } from '../../lib/typing';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { ActionRow, Feedback, Instruction, type ItemProps } from './shared';

type TranslateItem = z.infer<typeof translateItemSchema>;

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  placeholder: { en: 'Type the German sentence…', ru: 'Введите немецкое предложение…' },
  correctionLabel: { en: 'Correction: ', ru: 'Исправленный вариант: ' },
  spellingNote: { en: 'Watch the spelling: ', ru: 'Обратите внимание на написание: ' },
  yourAnswer: { en: 'You wrote: ', ru: 'Вы написали: ' },
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Grow the field to its content.
   *
   * A `translate` answer is a whole sentence, and a probe prompt can be three of them —
   * on a single-line input the tail scrolls out of sight, and once the field is disabled
   * after checking the learner cannot scroll it back to see what they wrote. The
   * correction below was therefore unreadable exactly where it mattered most.
   *
   * Measured against `content/`: of 859 authored renderings **226 run past 60 characters**
   * and the longest is **136** (`probe-biografie-erfahrungen::variant-a`, a three-sentence
   * narration) — so this is a few lines at a normal width, not a scroll region, and the
   * worst case is a delayed probe, where the learner has least context to reconstruct what
   * they typed. `field-sizing: content` would do this in CSS, but the desktop shell is
   * WebKit, which does not support it yet.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      // `scrollHeight` is the content box; the field is `border-box` with a 2px border on
      // each side, so assigning it directly leaves the last line 4px short and clipped —
      // which a browser check caught after the naive version looked right in the diff.
      // `offsetHeight - clientHeight` is exactly that border, measured rather than assumed.
      el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    };
    fit();

    // Typing is not the only thing that changes the line count. Narrowing the desktop
    // window, or rotating a phone, rewraps the same text onto more lines without touching
    // `value` — and with a pinned pixel height plus `overflow-hidden`, those new lines are
    // clipped, which is the very defect this field exists to fix. Width is the trigger:
    // our own height writes also fire the observer, and re-fitting on those would loop.
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

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
  const givenWords = normalizeAnswer(value).split(/\s+/);
  const differs = checked && !isCorrect ? diffExpectedWords(answerWords, givenWords) : null;
  /**
   * The same LCS the other way round, so the marks land on the learner's own words.
   *
   * Showing only the corrected sentence asks the learner to hold their answer in their
   * head and spot the difference — which is the one thing they cannot do, because the
   * field above has just been disabled. `diffExpectedWords` is symmetric in shape, so
   * swapping the arguments needs no new code.
   */
  const givenDiffers =
    checked && !isCorrect ? diffExpectedWords(givenWords, answerWords) : null;

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {/* No prompt_de exists by design (German→German is nonsense): 'de' mode
          falls back to the EN prompt inside pick(). */}
      <p className="mb-4 text-lg font-medium">{pick(lang, { en: item.prompt_en, ru: item.prompt_ru, uk: item.prompt_uk })}</p>
      <textarea
        ref={inputRef}
        rows={1}
        lang="de"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // Enter still submits, because that is what every other typed item does. Shift+Enter
        // is left as a newline rather than swallowed: a learner who wants to lay a long
        // sentence out while drafting should be able to, and the grader splits on any
        // whitespace, so it changes nothing about the verdict.
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            check();
          }
        }}
        disabled={checked}
        placeholder={pick(lang, UI.placeholder)}
        className={`w-full resize-none overflow-hidden rounded-md border-2 bg-transparent px-3 py-2 text-lg outline-none ${
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
      {/* flex-wrap: eight keys since Ä/Ö/Ü and é joined GERMAN_INPUT_KEYS, which
          overflows a narrow viewport if the row cannot break. */}
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('exercise.specialChars', uiLang)}>
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
            <>
              {givenDiffers && (
                <p>
                  {pick(lang, UI.yourAnswer)}
                  <span lang="de" className="opacity-90">
                    {givenWords.map((w, i) => (
                      <span key={i}>
                        {i > 0 && ' '}
                        {givenDiffers[i] ? (
                          <mark className="rounded bg-amber-200 px-0.5 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                            {w}
                          </mark>
                        ) : (
                          w
                        )}
                      </span>
                    ))}
                  </span>
                </p>
              )}
              {verdict.kind === 'spelling' && (
                <p className={givenDiffers ? 'mt-2' : undefined}>
                  {pick(lang, UI.spellingNote)}
                  <span lang="de">
                    <s className="opacity-70">{verdict.correction.given}</s>
                    {' → '}
                    <strong>{verdict.correction.expected}</strong>
                  </span>
                </p>
              )}
            </>
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
