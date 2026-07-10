import { useRef, useState } from 'react';
import type { z } from 'zod';
import type { listenItemSchema } from '../../lib/schemas';
import { dictationMatches, normalizeAnswer } from '../../lib/cloze';
import { diffExpectedWords } from '../../lib/worddiff';
import { SLOW_RATE, speakGerman, ttsAvailable } from '../../lib/speech';
import { CheckButton, Feedback, Instruction, Translation, type ItemProps } from './shared';

type ListenItem = z.infer<typeof listenItemSchema>;

/** Characters that are awkward to type on a non-German keyboard. */
const SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß'] as const;

/**
 * Dictation: the sentence is spoken via browser TTS (replayable, with a slow
 * variant), the learner types what they hear. Punctuation is ignored in
 * matching; capitalization counts. Without TTS the sentence is shown and the
 * item degrades to a copy/spelling task.
 */
export function Listen({ item, lang, onResult, locked }: ItemProps<ListenItem>) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canTts = ttsAvailable();

  const isCorrect = dictationMatches(value, [item.text, ...item.accept]);

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

  const answerWords = item.text.split(/\s+/);
  const differs =
    checked && !isCorrect
      ? diffExpectedWords(answerWords, normalizeAnswer(value).split(/\s+/))
      : null;

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      {canTts ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => speakGerman(item.text)}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 sm:min-h-0 sm:py-1.5 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
          >
            ▶ Anhören
          </button>
          <button
            type="button"
            onClick={() => speakGerman(item.text, { rate: SLOW_RATE })}
            className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 sm:min-h-0 sm:py-1.5 dark:border-stone-600"
          >
            🐢 Langsam
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-xs text-stone-400">
            {lang === 'ru'
              ? 'Аудио на этом устройстве недоступно — перепишите предложение.'
              : 'Audio is not available on this device — copy the sentence instead.'}
          </p>
          <p lang="de" className="mt-1 text-lg font-medium">
            {item.text}
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        lang="de"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={checked}
        placeholder={lang === 'ru' ? 'Напишите, что вы слышите…' : 'Type what you hear…'}
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
        <>
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
            speakText={item.text}
          />
          {isCorrect && (
            <p lang="de" className="mt-2 text-lg font-medium">
              {item.text}
            </p>
          )}
          <Translation text={item.translation} lang={lang} />
        </>
      )}
    </div>
  );
}
