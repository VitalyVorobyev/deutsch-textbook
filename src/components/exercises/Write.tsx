import { useEffect, useState } from 'react';
import type { z } from 'zod';
import type { writeItemSchema } from '../../lib/schemas';
import { pick } from '../../lib/prefs';
import { Instruction, Translation, type ItemProps } from './shared';

type WriteItem = z.infer<typeof writeItemSchema>;

export function Write({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
  storageKey,
}: ItemProps<WriteItem> & { storageKey: string }) {
  const draftKey = `da:write:${storageKey}`;
  const [value, setValue] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(draftKey) ?? '';
  });
  const [submitted, setSubmitted] = useState(locked);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (submitted) return;
    localStorage.setItem(draftKey, value);
  }, [draftKey, submitted, value]);

  function submit() {
    if (submitted || words < item.min_words) return;
    setSubmitted(true);
    localStorage.removeItem(draftKey);
    onResult({ correct: true, given: value.trim(), evidence: 'practice' });
  }

  return (
    <div>
      <Instruction text={item.instruction} lang={lang} />
      <p className="text-lg font-medium">{pick(lang, item.prompt)}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{pick(lang, item.goal)}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
        {item.requirements.map((r, i) => <li key={i}>{pick(lang, r)}</li>)}
      </ul>
      <textarea
        lang="de"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={submitted || locked}
        rows={5}
        className="mt-4 w-full resize-y rounded-md border-2 border-stone-300 bg-transparent px-3 py-2 text-base outline-none focus:border-amber-500 disabled:opacity-80 dark:border-stone-600"
        placeholder={lang === 'ru' ? 'Напишите ответ по-немецки…' : 'Write your answer in German…'}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
        <span>{words} / {item.min_words} Wörter</span>
        <span>{lang === 'ru' ? 'Черновик сохраняется на этом устройстве' : 'Draft saved on this device'}</span>
      </div>
      <div className="mt-4">
        {!submitted ? (
          <button type="button" onClick={submit} disabled={words < item.min_words}
            className="min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 sm:min-h-0">
            {lang === 'ru' ? 'Сравнить с примером' : 'Compare with model'}
          </button>
        ) : (
          <button type="button" onClick={onNext}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white dark:bg-stone-200 dark:text-stone-900 sm:min-h-0">
            {nextLabel}
          </button>
        )}
      </div>
      {submitted && (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {lang === 'ru' ? 'Пример — сравните содержание и форму' : 'Model — compare content and form'}
          </p>
          <p lang="de" className="mt-2">{item.model_answer}</p>
          <Translation text={item.model_translation} lang={lang} />
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            {lang === 'ru'
              ? 'Это практика письма, а не автоматически проверенная оценка.'
              : 'This records writing practice, not an automatically verified score.'}
          </p>
        </div>
      )}
    </div>
  );
}
