import { useState, type ReactElement } from 'react';
import type { ExerciseItem, ExerciseSet as ExerciseSetData } from '../../lib/schemas';
import { logAttempt } from '../../lib/store';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';
import { Cloze } from './Cloze';
import { Listen } from './Listen';
import { Match } from './Match';
import { MultipleChoice } from './MultipleChoice';
import { Order } from './Order';
import { TableFill } from './TableFill';
import { Translate } from './Translate';
import type { ItemResult } from './shared';

interface Props {
  setId: string;
  set: ExerciseSetData;
}

interface Answered {
  itemId: string;
  correct: boolean;
}

/**
 * Renders a single exercise item of any type and reports the learner's answer.
 *
 * Exported for reuse outside ExerciseSet (e.g. a mixed-training page):
 * - `item` — any ExerciseItem from the content schema (discriminated by `type`).
 * - `lang` — explanation language, usually obtained via useExplainLang().
 * - `onResult` — called exactly once when the learner submits, with
 *   `{ correct, given }` (`given` = the answer serialized for the attempt log).
 *   Persistence is the caller's job — ItemView does not log attempts itself.
 * - `locked` — set true after submission to freeze the item's inputs.
 *
 * Items keep internal state; remount with a fresh React `key` to reset one
 * for another attempt.
 */
export function ItemView({
  item,
  lang,
  onResult,
  locked,
}: {
  item: ExerciseItem;
  lang: 'en' | 'ru';
  onResult: (r: ItemResult) => void;
  locked: boolean;
  // explicit return type so a forgotten case fails the type check
}): ReactElement {
  switch (item.type) {
    case 'mc':
      return <MultipleChoice item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'cloze':
      return <Cloze item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'match':
      return <Match item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'order':
      return <Order item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'table':
      return <TableFill item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'translate':
      return <Translate item={item} lang={lang} onResult={onResult} locked={locked} />;
    case 'listen':
      return <Listen item={item} lang={lang} onResult={onResult} locked={locked} />;
  }
}

export default function ExerciseSet({ setId, set }: Props) {
  const lang = useExplainLang();
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [currentDone, setCurrentDone] = useState(false);
  const [round, setRound] = useState(0);

  const items = set.items;
  const finished = index >= items.length;
  const item = items[index];

  function handleResult(result: ItemResult) {
    if (!item) return;
    setCurrentDone(true);
    setAnswered((a) => [...a, { itemId: item.id, correct: result.correct }]);
    void logAttempt({
      setId,
      itemId: item.id,
      itemType: item.type,
      correct: result.correct,
      given: result.given,
      focus: item.focus,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  function restart() {
    setIndex(0);
    setAnswered([]);
    setCurrentDone(false);
    setRound((r) => r + 1);
  }

  if (finished) {
    const correct = answered.filter((a) => a.correct).length;
    const pct = Math.round((correct / items.length) * 100);
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-center dark:border-stone-700 dark:bg-stone-800 sm:p-6">
        <p className="text-3xl font-bold">
          {correct} / {items.length}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {pct >= 80
            ? lang === 'ru'
              ? 'Отлично! Тема усваивается.'
              : 'Great — this topic is sinking in.'
            : lang === 'ru'
              ? 'Стоит повторить материал и попробовать ещё раз.'
              : 'Worth re-reading the article and trying again.'}
        </p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
        >
          {lang === 'ru' ? 'Ещё раз' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        {set.title && (
          <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            {pick(lang, set.title)}
          </p>
        )}
        <div className="ml-auto flex items-center gap-1" aria-label="progress">
          {items.map((it, i) => {
            const a = answered[i];
            return (
              <span
                key={`${round}-${it.id}`}
                className={`h-2 w-2 rounded-full ${
                  a ? (a.correct ? 'bg-green-500' : 'bg-red-400') : i === index ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'
                }`}
              />
            );
          })}
        </div>
      </div>

      {item && (
        <ItemView
          key={`${round}-${item.id}`}
          item={item}
          lang={lang}
          onResult={handleResult}
          locked={currentDone}
        />
      )}

      {currentDone && (
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-md bg-stone-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-700 sm:min-h-0 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
          >
            {index + 1 < items.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'}
          </button>
        </div>
      )}
    </div>
  );
}
