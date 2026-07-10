import { useEffect, useMemo, useState } from 'react';
import { splitQueue, type CardDef } from '../../lib/srs';
import { getCardStates, localDateString, logSession, sessionDoneToday } from '../../lib/store';
import { shuffle } from '../../lib/shuffle';
import type { TopicNode } from '../../lib/mastery';
import { useExplainLang } from '../hooks';
import FlashcardSession from '../srs/FlashcardSession';
import MixedTraining, { type TrainingSet } from '../training/MixedTraining';
import NextTopic from '../today/NextTopic';

interface Props {
  cards: CardDef[];
  sets: TrainingSet[];
  nodes: TopicNode[];
}

/** hard cap on flashcards in step 1 — keeps the whole session ~15 min */
const MAX_CARDS = 15;
/** new cards are mixed in only when fewer due cards than this */
const MIN_DUE = 5;
/** exercise items in step 2 */
const TRAINING_COUNT = 8;

type Step = 1 | 2 | 3;

const STEPS: Array<{ n: Step; de: string }> = [
  { n: 1, de: 'Wiederholen' },
  { n: 2, de: 'Training' },
  { n: 3, de: 'Weiter lernen' },
];

interface ReviewPlan {
  /** cards handed to FlashcardSession (capped due first, then the new-card pool) */
  cards: CardDef[];
  /** how many never-seen cards FlashcardSession may mix in */
  newLimit: number;
  /** total cards this step will actually show */
  total: number;
}

export default function SessionFlow({ cards, sets, nodes }: Props) {
  const lang = useExplainLang();
  const [step, setStep] = useState<Step>(1);
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [reviewDone, setReviewDone] = useState(false);
  // summary counters: null = step was skipped
  const [reviewedCount, setReviewedCount] = useState<number | null>(null);
  const [trainedCount, setTrainedCount] = useState<number | null>(null);
  // null = still loading the session log
  const [doneToday, setDoneToday] = useState<boolean | null>(null);
  const [repeatAnyway, setRepeatAnyway] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void sessionDoneToday().then((done) => {
      if (!cancelled) setDoneToday(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Plan step 1: due cards first (capped), new cards only when little is due.
  useEffect(() => {
    let cancelled = false;
    void getCardStates().then((states) => {
      if (cancelled) return;
      const { due, fresh } = splitQueue(cards, states);
      const dueCapped = shuffle(due).slice(0, MAX_CARDS);
      const newLimit = due.length > 0 && due.length < MIN_DUE ? MAX_CARDS - dueCapped.length : 0;
      setPlan({
        cards: newLimit > 0 ? [...dueCapped, ...fresh] : dueCapped,
        newLimit,
        total: dueCapped.length + Math.min(newLimit, fresh.length),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [cards]);

  // Nothing due at all → brief note, then auto-advance to training.
  useEffect(() => {
    if (step !== 1 || plan === null || plan.total > 0) return;
    setReviewedCount(0);
    const t = setTimeout(() => setStep(2), 1600);
    return () => clearTimeout(t);
  }, [step, plan]);

  const trainingTotal = useMemo(
    () => Math.min(TRAINING_COUNT, sets.reduce((n, s) => n + s.items.length, 0)),
    [sets],
  );

  function finishReview() {
    setReviewedCount(plan?.total ?? 0);
    setReviewDone(true);
  }

  function finishTraining() {
    setTrainedCount(trainingTotal);
    setStep(3);
    void logSession({
      date: localDateString(),
      reviewed: reviewedCount,
      trained: trainingTotal,
      ts: Date.now(),
    });
  }

  const skipTarget: Step | null = step === 1 && !reviewDone ? 2 : step === 2 ? 3 : null;
  const skippedLabel = lang === 'ru' ? 'пропущено' : 'skipped';

  if (doneToday === null) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">…</p>;
  }

  // Already completed today → quiet gate with an explicit escape hatch.
  if (doneToday && !repeatAnyway) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
        <p className="text-2xl text-green-600 dark:text-green-400">✓</p>
        <p lang="de" className="mt-2 font-semibold">
          Heute schon erledigt
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Сессия на сегодня уже завершена. Хотите пройти ещё одну?'
            : "Today's session is already done. Want to run another one anyway?"}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setRepeatAnyway(true)}
            className="rounded-md border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700 hover:border-amber-500 dark:border-stone-600 dark:text-stone-200 dark:hover:border-amber-500"
          >
            Nochmal üben
          </button>
          <a href="/" className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            Zur Startseite
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* slim step header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-stone-300 dark:text-stone-600">→</span>}
              <span className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    step === s.n
                      ? 'bg-amber-600 text-white'
                      : step > s.n
                        ? 'bg-stone-300 text-stone-600 dark:bg-stone-600 dark:text-stone-300'
                        : 'border border-stone-300 text-stone-400 dark:border-stone-600 dark:text-stone-500'
                  }`}
                >
                  {s.n}
                </span>
                <span
                  lang="de"
                  className={
                    step === s.n
                      ? 'font-semibold text-stone-900 dark:text-stone-100'
                      : 'text-stone-400 dark:text-stone-500'
                  }
                >
                  {s.de}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {skipTarget !== null && (
          <button
            type="button"
            onClick={() => setStep(skipTarget)}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            Überspringen →
          </button>
        )}
      </div>

      <div className="mt-6">
        {step === 1 &&
          (plan === null ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">…</p>
          ) : plan.total === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              <span lang="de">Keine Karten fällig — weiter zum Training …</span>
            </p>
          ) : (
            <>
              <FlashcardSession cards={plan.cards} newLimit={plan.newLimit} onFinished={finishReview} />
              {reviewDone && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Weiter →
                  </button>
                </div>
              )}
            </>
          ))}

        {step === 2 && <MixedTraining sets={sets} count={TRAINING_COUNT} onFinished={finishTraining} />}

        {step === 3 && (
          <div>
            <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
              <NextTopic nodes={nodes} />
              <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
                {lang === 'ru'
                  ? 'Прочитайте статью и выполните упражнения на её странице — это ваш учебный шаг на сегодня.'
                  : "Read the article and try the exercises on its page — that's your learning step for today."}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
              <p className="text-xs uppercase tracking-wide text-stone-400">
                {lang === 'ru' ? 'Итог сессии' : 'Session summary'}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-stone-600 dark:text-stone-300">
                <li>
                  {lang === 'ru' ? 'Карточек повторено' : 'Cards reviewed'}:{' '}
                  <span className="font-semibold">{reviewedCount ?? skippedLabel}</span>
                </li>
                <li>
                  {lang === 'ru' ? 'Упражнений отвечено' : 'Exercise items answered'}:{' '}
                  <span className="font-semibold">{trainedCount ?? skippedLabel}</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 text-center">
              <a
                href="/"
                className="inline-block rounded-md bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Fertig
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
