import { useMemo, useState } from 'react';
import type { DueProbe } from '../../lib/probes';
import { PROBE_INTERVALS_DAYS } from '../../lib/probes';
import type { ExerciseItem } from '../../lib/schemas';
import { focusForAttempt, responseModeForItem } from '../../lib/evidence';
import { attemptScore } from '../../lib/scoring';
import { logAttempt } from '../../lib/store';
import { useExplainLang } from '../hooks';
import { ItemView } from '../exercises/ExerciseSet';
import type { ItemResult } from '../exercises/shared';
import type { TrainingSet } from '../training/MixedTraining';

/**
 * The delayed half of the loop: probes that came due today.
 *
 * This runs FIRST in the session, before flashcards and training, and that ordering is
 * the whole point. A probe asks whether a competence survived an interval; answering it
 * after twenty minutes of practice on the same material would measure the practice, not
 * the interval. It has to be the cold-start question.
 *
 * There is no "check your answer first" affordance and no retry — a probe is a
 * measurement, and one the learner can retake on the spot is not one. Feedback still
 * shows afterwards, because withholding the correct answer would waste the single best
 * moment to learn it.
 */
interface Props {
  due: DueProbe[];
  sets: TrainingSet[];
  onFinished: (result: { answered: number; correct: number }) => void;
}

/** Bounded share of the session — a probe backlog must never crowd out the lesson. */
export const MAX_PROBES_PER_SESSION = 3;

interface Queued {
  setId: string;
  item: ExerciseItem;
  stage: number;
  overdueDays: number;
}

export default function ProbeStep({ due, sets, onFinished }: Props) {
  const lang = useExplainLang();

  const queue = useMemo<Queued[]>(() => {
    const bySetId = new Map(sets.map((s) => [s.setId, s]));
    return due
      .slice(0, MAX_PROBES_PER_SESSION)
      .flatMap((d) => {
        const item = bySetId.get(d.family.setId)?.items.find((i) => i.id === d.itemId);
        return item
          ? [{ setId: d.family.setId, item, stage: d.stage, overdueDays: d.overdueDays }]
          : [];
      });
  }, [due, sets]);

  const [index, setIndex] = useState(0);
  const [currentDone, setCurrentDone] = useState(false);
  const [answered, setAnswered] = useState<{ correct: boolean; score: number }[]>([]);

  const current = queue[index];
  const finished = index >= queue.length;

  function handleResult(result: ItemResult) {
    if (!current) return;
    setCurrentDone(true);
    setAnswered((a) => [...a, { correct: result.correct, score: attemptScore(result) }]);
    void logAttempt({
      setId: current.setId,
      itemId: current.item.id,
      itemType: current.item.type,
      itemRevision: current.item.revision,
      correct: result.correct,
      ...(result.totalParts !== undefined
        ? { correctParts: result.correctParts, totalParts: result.totalParts }
        : {}),
      given: result.given,
      focus: focusForAttempt(current.item, result),
      evidence: result.evidence,
      responseMode: result.responseMode ?? responseModeForItem(current.item),
      outcomes: current.item.outcomes,
      practice: result.practice,
      ts: Date.now(),
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setCurrentDone(false);
  }

  if (queue.length === 0) {
    return (
      <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
        <span lang="de">Keine Rückfragen fällig — weiter …</span>
      </p>
    );
  }

  if (finished) {
    const correct = answered.filter((a) => a.correct).length;
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
        <p lang="de" className="font-semibold">
          Rückblick abgeschlossen
        </p>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          {correct} / {answered.length}{' '}
          {lang === 'ru'
            ? '— это то, что осталось спустя время, а не сразу после занятия.'
            : '— that is what survived the interval, not what you knew right after the lesson.'}
        </p>
        <button
          type="button"
          onClick={() => onFinished({ answered: answered.length, correct })}
          className="mt-4 rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Weiter →
        </button>
      </div>
    );
  }

  const scheduled = PROBE_INTERVALS_DAYS[current!.stage] ?? 0;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-stone-400">
          {lang === 'ru' ? 'Проверка через время' : 'Delayed check'} · {index + 1} / {queue.length}
        </p>
        <p className="text-xs text-stone-400">
          {lang === 'ru' ? `спустя ${scheduled} дн.` : `${scheduled}-day interval`}
          {current!.overdueDays > 0 &&
            (lang === 'ru'
              ? ` (+${current!.overdueDays})`
              : ` (+${current!.overdueDays} late)`)}
        </p>
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {lang === 'ru'
          ? 'Вы это уже проходили. Отвечайте по памяти — подсказок не будет.'
          : 'You have learned this before. Answer from memory — there are no hints.'}
      </p>

      <div className="mt-5">
        <ItemView
          // Probe item ids are unique only inside their own family, and consecutive
          // queue entries come from different families — so the set id belongs in the key.
          instanceKey={`${current!.setId}::${current!.item.id}`}
          item={current!.item}
          lang={lang}
          onResult={handleResult}
          locked={currentDone}
          onNext={next}
          nextLabel={index === queue.length - 1 ? 'Fertig →' : 'Weiter →'}
        />
      </div>
    </div>
  );
}
