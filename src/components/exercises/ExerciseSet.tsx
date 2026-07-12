import { useState, type ReactElement } from 'react';
import type { ExerciseItem, ExerciseSet as ExerciseSetData } from '../../lib/schemas';
import { logAttempt } from '../../lib/store';
import { attemptScore, formatScore } from '../../lib/scoring';
import { clearResume, loadResume, saveResume } from '../../lib/resume';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';
import { Cloze } from './Cloze';
import { Listen } from './Listen';
import { Match } from './Match';
import { MultipleChoice } from './MultipleChoice';
import { Order } from './Order';
import { TableFill } from './TableFill';
import { Translate } from './Translate';
import { Write } from './Write';
import { Speak } from './Speak';
import { AudioComprehension } from './AudioComprehension';
import type { ItemResult } from './shared';
import { responseModeForItem } from '../../lib/evidence';

interface Props {
  setId: string;
  set: ExerciseSetData;
}

interface Answered {
  itemId: string;
  correct: boolean;
  /** attemptScore of the answer — parts-weighted for multi-part items */
  score: number;
  evidence?: 'verified' | 'practice';
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
 * - `onNext` / `nextLabel` — the advance action. The item renders it itself, in the
 *   same slot as its Prüfen button, so checking an answer never moves the button.
 *
 * Items keep internal state; remount with a fresh React `key` to reset one
 * for another attempt.
 */
export function ItemView({
  item,
  lang,
  onResult,
  locked,
  onNext,
  nextLabel,
  storageKey,
}: {
  item: ExerciseItem;
  lang: 'en' | 'ru';
  onResult: (r: ItemResult) => void;
  locked: boolean;
  onNext: () => void;
  nextLabel: string;
  storageKey?: string;
  // explicit return type so a forgotten case fails the type check
}): ReactElement {
  const props = { lang, onResult, locked, onNext, nextLabel };
  switch (item.type) {
    case 'mc':
      return <MultipleChoice item={item} {...props} />;
    case 'cloze':
      return <Cloze item={item} {...props} />;
    case 'match':
      return <Match item={item} {...props} />;
    case 'order':
      return <Order item={item} {...props} />;
    case 'table':
      return <TableFill item={item} {...props} />;
    case 'translate':
      return <Translate item={item} {...props} />;
    case 'listen':
      return <Listen item={item} {...props} />;
    case 'write':
      return <Write item={item} storageKey={storageKey ?? item.id} {...props} />;
    case 'speak':
      return <Speak item={item} {...props} />;
    case 'audio-comprehension':
      return <AudioComprehension item={item} {...props} />;
  }
}

export default function ExerciseSet({ setId, set }: Props) {
  const lang = useExplainLang();
  const items = set.items;
  const resumeSurface = `exset:${setId}`;
  // Resume today's run at the first unanswered item (a reload — mobile tab
  // discard, navigation — would otherwise restart the set from scratch).
  const [answered, setAnswered] = useState<Answered[]>(() => {
    const saved = loadResume<{ answered: Answered[] }>(resumeSurface);
    if (!saved || !Array.isArray(saved.answered) || saved.answered.length > items.length) return [];
    // stale if the set's items changed since the state was saved (or pre-score shape)
    if (!saved.answered.every((a, i) => a.itemId === items[i]?.id && typeof a.score === 'number'))
      return [];
    return saved.answered;
  });
  const [index, setIndex] = useState(answered.length);
  const [currentDone, setCurrentDone] = useState(false);
  const [round, setRound] = useState(0);

  const finished = index >= items.length;
  const item = items[index];

  function handleResult(result: ItemResult) {
    if (!item) return;
    setCurrentDone(true);
    const next = [
      ...answered,
      {
        itemId: item.id,
        correct: result.correct,
        score: attemptScore(result),
        evidence: result.evidence,
      },
    ];
    setAnswered(next);
    saveResume(resumeSurface, { answered: next });
    void logAttempt({
      setId,
      itemId: item.id,
      itemType: item.type,
      correct: result.correct,
      ...(result.totalParts !== undefined
        ? { correctParts: result.correctParts, totalParts: result.totalParts }
        : {}),
      given: result.given,
      focus: item.focus,
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(item),
      outcomes: item.outcomes,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  function restart() {
    clearResume(resumeSurface);
    setIndex(0);
    setAnswered([]);
    setCurrentDone(false);
    setRound((r) => r + 1);
  }

  if (finished) {
    const verified = answered.filter((a) => a.evidence !== 'practice');
    const score = verified.reduce((s, a) => s + a.score, 0);
    const pct = verified.length ? Math.round((score / verified.length) * 100) : 0;
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-center dark:border-stone-700 dark:bg-stone-800 sm:p-6">
        <p className="text-3xl font-bold">
          {formatScore(score, lang)} / {verified.length}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {verified.length === 0
            ? lang === 'ru'
              ? 'Практика сохранена; автоматической оценки нет.'
              : 'Practice saved; there is no automatic score.'
            : pct >= 80
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
          onNext={next}
          nextLabel={
            index + 1 < items.length ? 'Weiter →' : lang === 'ru' ? 'Результат' : 'Results'
          }
          storageKey={`${setId}::${item.id}`}
        />
      )}
    </div>
  );
}
