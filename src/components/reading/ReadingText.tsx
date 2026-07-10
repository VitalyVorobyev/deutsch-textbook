import { Fragment, useMemo, useState } from 'react';
import type { Reading } from '../../lib/schemas';
import { parseGlosses } from '../../lib/gloss';
import { logAttempt } from '../../lib/store';
import { useExplainLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';

interface Props {
  /** reading path-id, e.g. "a2/termine-vereinbaren" */
  readingId: string;
  reading: Reading;
}

/**
 * A graded reading text with click-to-reveal glosses, followed by its
 * comprehension questions one at a time (same "Weiter →" flow as ExerciseSet).
 * Attempts are logged under `reading:<path-id>` so they are distinguishable
 * from exercise-set attempts in progress snapshots.
 */
export default function ReadingText({ readingId, reading }: Props) {
  const lang = useExplainLang();
  const paragraphs = useMemo(() => reading.text.map((p) => parseGlosses(p).segments), [reading]);
  const [openGlosses, setOpenGlosses] = useState<ReadonlySet<string>>(new Set());

  const questions = reading.questions;
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [currentDone, setCurrentDone] = useState(false);

  const finished = index >= questions.length;
  const question = questions[index];

  function toggleGloss(key: string) {
    setOpenGlosses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleResult(result: ItemResult) {
    if (!question) return;
    setCurrentDone(true);
    setAnswered((a) => [...a, result.correct]);
    void logAttempt({
      setId: `reading:${readingId}`,
      itemId: question.id,
      itemType: question.type,
      correct: result.correct,
      given: result.given,
      focus: question.focus,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  const correctCount = answered.filter(Boolean).length;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <h3 lang="de" className="mb-4 text-xl font-semibold">
        {reading.title_de}
      </h3>

      <div lang="de" className="flex flex-col gap-4 leading-relaxed">
        {paragraphs.map((segments, pi) => (
          <p key={pi}>
            {segments.map((seg, si) => {
              if (seg.kind === 'text') return <Fragment key={si}>{seg.text}</Fragment>;
              const key = `${pi}:${si}`;
              const shown = openGlosses.has(key);
              return (
                <Fragment key={si}>
                  <button
                    type="button"
                    onClick={() => toggleGloss(key)}
                    aria-expanded={shown}
                    className="cursor-pointer underline decoration-amber-500 decoration-dotted underline-offset-4 hover:text-amber-700 dark:decoration-amber-400 dark:hover:text-amber-400"
                  >
                    {seg.gloss.de}
                  </button>
                  {shown && (
                    <span
                      lang={lang}
                      className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                    >
                      {lang === 'ru' ? seg.gloss.ru : seg.gloss.en}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </p>
        ))}
      </div>

      <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-700">
        <div className="mb-4 flex items-center justify-between">
          <p lang="de" className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            Fragen zum Text
          </p>
          <div className="flex items-center gap-1" aria-label="progress">
            {questions.map((q, i) => (
              <span
                key={q.id}
                className={`h-2 w-2 rounded-full ${
                  i < answered.length
                    ? answered[i]
                      ? 'bg-green-500'
                      : 'bg-red-400'
                    : i === index
                      ? 'bg-amber-500'
                      : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
            ))}
          </div>
        </div>

        {finished ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            <span className="font-bold">
              {correctCount} / {questions.length}
            </span>{' '}
            {lang === 'ru' ? 'правильных ответов по тексту.' : 'comprehension questions correct.'}
          </p>
        ) : (
          question && (
            <>
              <ItemView
                key={question.id}
                item={question}
                lang={lang}
                onResult={handleResult}
                locked={currentDone}
              />
              {currentDone && (
                <div className="mt-4 text-right">
                  <button
                    type="button"
                    onClick={next}
                    className="min-h-11 rounded-md bg-stone-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-700 sm:min-h-0 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
                  >
                    {index + 1 < questions.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
