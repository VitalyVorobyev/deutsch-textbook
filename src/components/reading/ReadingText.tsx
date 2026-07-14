import { Fragment, useMemo, useState } from 'react';
import type { Reading } from '../../lib/schemas';
import { parseGlosses } from '../../lib/gloss';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';
import { logAttempt } from '../../lib/store';
import { useExplainLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';
import SpeakerButton from '../SpeakerButton';

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
      itemRevision: question.revision,
      correct: result.correct,
      given: result.given,
      focus: focusForAttempt(question, result),
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(question),
      outcomes: question.outcomes,
      practice: result.practice,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  const correctCount = answered.filter(Boolean).length;

  const extensive = reading.kind === 'extensive';

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <h3 lang="de" className="mb-1 text-xl font-semibold">
        {reading.title_de}
      </h3>

      {/*
        An extensive reader is told what it is, because otherwise a learner treats every
        German text on this site the same way — parsing each sentence, tapping every gloss,
        bracing for the questions. That is the intensive reading habit, and it is exactly
        what stops a longer text from ever being read at volume. Saying "read it once,
        keep going, you are meant not to know everything" is the intervention.
      */}
      {extensive && (
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Длинный текст для чтения ради удовольствия. Прочитайте его один раз, не останавливаясь. Незнакомые слова — это нормально: не открывайте подсказки, пока смысл понятен.'
            : 'A longer text, meant to be read for pleasure. Read it straight through once. Not knowing every word is fine — leave the glosses closed while the meaning still carries.'}
        </p>
      )}
      {!extensive && <div className="mb-4" />}

      <div lang="de" className="flex flex-col gap-4 leading-relaxed">
        {paragraphs.map((segments, pi) => (
          <p key={pi}>
            <SpeakerButton
              text={segments.map((s) => (s.kind === 'text' ? s.text : s.gloss.de)).join('')}
              className="float-right ml-2 text-stone-400"
            />
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

      {questions.length === 0 ? null : (
      <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-700">
        <div className="mb-4 flex items-center justify-between">
          <p lang="de" className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            {/* one gist question, not an interrogation of every sentence */}
            {extensive ? 'Worum geht es?' : 'Fragen zum Text'}
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
            <ItemView
              instanceKey={question.id}
              item={question}
              lang={lang}
              onResult={handleResult}
              locked={currentDone}
              onNext={next}
              nextLabel={
                index + 1 < questions.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'
              }
            />
          )
        )}
      </div>
      )}
    </div>
  );
}
