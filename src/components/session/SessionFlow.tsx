import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardDef } from '../../lib/srs';
import { planReview, type ReviewPlanResult } from '../../lib/decks';
import {
  getAttempts,
  getCardStates,
  getLearningGoal,
  getTopicsState,
  localDateString,
  logSession,
  sessionDoneToday,
} from '../../lib/store';
import { clearResume, loadResume, saveResume } from '../../lib/resume';
import { withBase } from '../../lib/url';
import type { TopicNode } from '../../lib/mastery';
import { dueProbes, probeFamilies, type DueProbe } from '../../lib/probes';
import { useExplainLang } from '../hooks';
import FlashcardSession from '../srs/FlashcardSession';
import MixedTraining, { type TrainingSet } from '../training/MixedTraining';
import NextTopic from '../today/NextTopic';
import ProbeStep from './ProbeStep';

interface Props {
  cards: CardDef[];
  sets: TrainingSet[];
  /** topic ids in recommended-path order (getCurriculum().spine) */
  spine: string[];
  nodes: TopicNode[];
  /** deck id → CEFR level, for gating fresh cards of decks no topic owns */
  deckLevels: Record<string, string>;
}

/** hard cap on flashcards in step 1 — keeps the whole session ~15 min */
const MAX_CARDS = 15;
/** new cards are mixed in only when fewer due cards than this */
const MIN_DUE = 5;
/** exercise items in step 2 */
const TRAINING_COUNT = 8;

/**
 * Step 0 is the delayed probe check, and it only exists on days one is due — which is
 * why the steps are numbered from 0 rather than the visible list being renumbered: a
 * saved resume point from earlier today must keep meaning the same step.
 */
type Step = 0 | 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  0: 'Rückblick',
  1: 'Wiederholen',
  2: 'Training',
  3: 'Weiter lernen',
};

const RESUME_SURFACE = 'session';

interface SessionResume {
  step: Step;
  reviewedCount: number | null;
  /**
   * Whether today's probes have already been answered or waved through.
   *
   * This cannot be inferred from `step`, because step 1 is both "past the probes" and
   * the default starting point — so a session opened before a probe fell due would save
   * step 1, and every later visit that day would read it as "already done" and silently
   * drop the probe. The flag says which of the two it was.
   */
  probesDone?: boolean;
}

export default function SessionFlow({ cards, sets, spine, nodes, deckLevels }: Props) {
  const lang = useExplainLang();
  // a reload mid-session (mobile tab discard, opening a topic page) returns
  // to the saved lesson point; step 3 is never saved — by then the session is
  // already logged and the "done today" gate takes over
  const [initial] = useState<SessionResume | null>(() => {
    const saved = loadResume<SessionResume>(RESUME_SURFACE);
    return saved && (saved.step === 0 || saved.step === 1 || saved.step === 2) ? saved : null;
  });
  const [step, setStep] = useState<Step>(initial?.step ?? 1);
  // null = still deciding whether any probe is due; [] = none, so step 0 does not exist today
  const [due, setDue] = useState<DueProbe[] | null>(null);
  const [probedCount, setProbedCount] = useState<number | null>(null);
  const [probesDone, setProbesDone] = useState(initial?.probesDone ?? false);
  const [plan, setPlan] = useState<ReviewPlanResult | null>(null);
  const [reviewDone, setReviewDone] = useState(false);
  // summary counters: null = step was skipped
  const [reviewedCount, setReviewedCount] = useState<number | null>(initial?.reviewedCount ?? null);
  const [trainedCount, setTrainedCount] = useState<number | null>(null);
  // null = still loading the session log
  const [doneToday, setDoneToday] = useState<boolean | null>(null);
  const [trainingEmpty, setTrainingEmpty] = useState(false);
  const [repeatAnyway, setRepeatAnyway] = useState(false);
  // bumped when the learner opts into reviewing the cards the cap left out
  const [planRound, setPlanRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void sessionDoneToday().then((done) => {
      if (!cancelled) setDoneToday(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Which probes came due. Probe scheduling is derived entirely from the attempt log
  // (see src/lib/probes.ts), so there is no separate state to load or keep in sync.
  const families = useMemo(() => probeFamilies(sets), [sets]);
  useEffect(() => {
    let cancelled = false;
    void getAttempts().then((attempts) => {
      if (cancelled) return;
      const owed = dueProbes(families, attempts);
      setDue(owed);
      // A due probe opens the session, unless the learner already dealt with it today.
      // `owed` is itself the record of that: answering a probe logs an attempt, which
      // advances its stage, so it stops being due. The flag only covers a deliberate skip.
      if (owed.length > 0 && !probesDone) setStep(0);
    });
    return () => {
      cancelled = true;
    };
    // probesDone is read once, at the moment the lookup lands — re-running on a later
    // skip would just re-answer the same question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families]);

  // Plan step 1: most-overdue due cards first (capped), new cards only when
  // little is due — and only from eligible decks (see planReview in decks.ts).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCardStates(), getAttempts(), getTopicsState(), getLearningGoal()]).then(
      ([states, attempts, topics, goal]) => {
        if (cancelled) return;
        setPlan(
          planReview(
            cards,
            { spine, nodes, deckLevels },
            { attempts, cards: states, topics, goal },
            { maxDue: MAX_CARDS, maxTotal: MAX_CARDS, freshPolicy: { kind: 'top-up', minDue: MIN_DUE } },
          ),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cards, spine, nodes, deckLevels, planRound]);

  // Nothing due at all → brief note, then auto-advance to training. Waits for the probe
  // lookup too: advancing out of step 1 while it is still in flight would race the probe
  // step into existence just as the session moved past it.
  useEffect(() => {
    if (step !== 1 || due === null || plan === null || plan.total > 0) return;
    const t = setTimeout(() => {
      setReviewedCount((c) => c ?? 0);
      setStep(2);
    }, 1600);
    return () => clearTimeout(t);
  }, [step, plan, due]);

  const finishTraining = useCallback(
    ({ answered }: { answered: number; correct: number }) => {
      clearResume(RESUME_SURFACE);
      setTrainedCount(answered);
      setStep(3);
      void logSession({
        date: localDateString(),
        reviewed: reviewedCount,
        trained: answered,
        ts: Date.now(),
      });
    },
    [reviewedCount],
  );

  const finishProbes = useCallback(({ answered }: { answered: number; correct: number }) => {
    setProbedCount(answered);
    setProbesDone(true);
    setStep(1);
  }, []);

  // Empty training pool (nothing eligible yet) → same brief-note-then-advance.
  useEffect(() => {
    if (step !== 2 || !trainingEmpty) return;
    const t = setTimeout(() => finishTraining({ answered: 0, correct: 0 }), 1600);
    return () => clearTimeout(t);
  }, [step, trainingEmpty, finishTraining]);

  // Persist the lesson point (steps 0–2; finishTraining clears it).
  //
  // Not before the probe check has resolved. `step` starts at 1, and saving that while
  // the due-probe lookup is still in flight would write a resume point saying "already
  // past the probes" — so the next reload would honour it and skip step 0 for the rest
  // of the day. Every day a probe came due, one reload would silently cancel it.
  useEffect(() => {
    if (step === 3 || due === null) return;
    saveResume<SessionResume>(RESUME_SURFACE, { step, reviewedCount, probesDone });
  }, [step, reviewedCount, probesDone, due]);

  function finishReview() {
    // accumulate across optional extra rounds
    setReviewedCount((c) => (c ?? 0) + (plan?.total ?? 0));
    setReviewDone(true);
  }

  function continueReview() {
    setReviewDone(false);
    setPlan(null); // back to the loading state until the new round's plan lands
    setPlanRound((r) => r + 1);
  }

  // Skipping step 0 does not discard the probe — it stays due and comes back tomorrow
  // with its stage intact (dueProbe counts probes taken, not days offered). The flag only
  // stops it from reappearing on every reload for the rest of today.
  function skip(to: Step) {
    if (step === 0) setProbesDone(true);
    setStep(to);
  }

  const skipTarget: Step | null =
    step === 0 ? 1 : step === 1 && !reviewDone ? 2 : step === 2 ? 3 : null;
  const skippedLabel = lang === 'ru' ? 'пропущено' : 'skipped';

  // Step 0 exists only on days a probe is actually due.
  const steps: Step[] = due !== null && due.length > 0 ? [0, 1, 2, 3] : [1, 2, 3];

  if (doneToday === null || due === null) {
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
          <a href={withBase('/')} className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
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
          {steps.map((n, i) => (
            <li key={n} className="flex items-center gap-2">
              {i > 0 && <span className="text-stone-300 dark:text-stone-600">→</span>}
              <span className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    step === n
                      ? 'bg-amber-600 text-white'
                      : step > n
                        ? 'bg-stone-300 text-stone-600 dark:bg-stone-600 dark:text-stone-300'
                        : 'border border-stone-300 text-stone-400 dark:border-stone-600 dark:text-stone-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  lang="de"
                  className={
                    step === n
                      ? 'font-semibold text-stone-900 dark:text-stone-100'
                      : 'text-stone-400 dark:text-stone-500'
                  }
                >
                  {STEP_LABELS[n]}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {skipTarget !== null && (
          <button
            type="button"
            onClick={() => skip(skipTarget)}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            Überspringen →
          </button>
        )}
      </div>

      <div className="mt-6">
        {step === 0 && <ProbeStep due={due} sets={sets} onFinished={finishProbes} />}

        {step === 1 &&
          (plan === null ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">…</p>
          ) : plan.total === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              <span lang="de">Keine Karten fällig — weiter zum Training …</span>
            </p>
          ) : (
            <>
              <FlashcardSession
                key={planRound}
                cards={plan.queue}
                queue={plan.queue}
                onFinished={finishReview}
              />
              {reviewDone && (
                <div className="mt-4 flex flex-col items-center gap-2 text-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Weiter →
                  </button>
                  {plan.dueRemaining > 0 && (
                    <button
                      type="button"
                      onClick={continueReview}
                      lang="de"
                      className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                    >
                      {plan.dueRemaining === 1
                        ? 'Noch 1 Karte fällig — weiter wiederholen'
                        : `Noch ${plan.dueRemaining} Karten fällig — weiter wiederholen`}
                    </button>
                  )}
                </div>
              )}
            </>
          ))}

        {step === 2 && (
          <MixedTraining
            sets={sets}
            spine={spine}
            nodes={nodes}
            count={TRAINING_COUNT}
            onFinished={finishTraining}
            onEmpty={() => setTrainingEmpty(true)}
            resumeKey="session"
          />
        )}

        {step === 3 && (
          <div>
            <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
              <NextTopic spine={spine} nodes={nodes} />
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
                {probedCount !== null && (
                  <li>
                    {lang === 'ru' ? 'Проверок через время' : 'Delayed checks'}:{' '}
                    <span className="font-semibold">{probedCount}</span>
                  </li>
                )}
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
                href={withBase('/')}
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
