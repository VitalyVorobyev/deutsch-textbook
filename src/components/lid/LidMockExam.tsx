/**
 * The Leben-in-Deutschland mock exam (ADR 0021): 30 general questions and 3 of the learner's
 * state, drawn at random (`drawMockExam`), 60 minutes on a wall clock, options exactly as
 * printed. A SIMULATION — the real Fragebögen are not published (EinbTestV §1 Abs. 2), so a draw
 * is never presented as an official sheet.
 *
 * The run survives a reload: seed, items, answers and the start time are written to
 * `da:lid-mock:<profileId>` on every change, and the clock is a deadline (`startedAt + 60 min`)
 * read on a 500 ms interval, never a counter — a reload, a sleeping laptop or a discarded tab
 * cannot hand back time. A run found after its deadline is submitted as it stands, `timedOut`.
 *
 * The score is calibration, never mastery, and it is reported against BOTH pass marks, which
 * belong to different tests. A question missed here is still scheduled for review: the run is
 * saved with one exam-mode answer per item (`lidExamAnswers`) through `logLidExamDurably`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LID_EXAM, type LidOptionKey } from '@da/schema/lid';
import { drawMockExam, lidExamAnswers, mulberry32, scoreMock, type LidExamRun } from '../../lib/lid';
import { t } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { logLidExamDurably } from '../../lib/write-journal';
import { formatClock } from '../pruefung/shared';
import { useUiLang } from '../hooks';
import LidQuestion from './LidQuestion';
import {
  CARD,
  LID_OPTION_ORDER,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
  lidText,
  mockKey,
  revealTop,
  stateName,
  type LidEntry,
} from './shared';

const DURATION_MS = LID_EXAM.minutes * 60_000;
const WARN_MS = 5 * 60_000;
const ALARM_MS = 60_000;

/** What is written to localStorage while a mock runs. */
interface MockInProgress {
  seed: number;
  items: string[];
  /** chosen SOURCE key per item id; an absent id is unanswered */
  answers: Record<string, LidOptionKey>;
  startedAt: number;
  /** the question on screen, so a reload lands where the learner was */
  current: number;
}

type Phase =
  | { kind: 'start' }
  | { kind: 'running'; run: MockInProgress }
  | { kind: 'results'; run: LidExamRun };

interface Props {
  /** the general questions plus the state's — `drawMockExam` reads `scope` and `stateCode` */
  entries: LidEntry[];
  bankVersion: string;
  /** `bank.states[0]` */
  state: string;
  pdfUrl: string;
}

function saveRun(run: MockInProgress): void {
  try {
    localStorage.setItem(mockKey(), JSON.stringify(run));
  } catch {
    // storage blocked — the run still works, it just will not survive a reload
  }
}

function clearRun(): void {
  try {
    localStorage.removeItem(mockKey());
  } catch {
    // ignore
  }
}

/** A stored run, or null when there is none or it no longer fits this bank. */
function loadRun(known: ReadonlySet<string>): MockInProgress | null {
  try {
    const raw = localStorage.getItem(mockKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MockInProgress>;
    const { seed, items, answers, startedAt, current } = parsed;
    const valid =
      typeof seed === 'number' &&
      typeof startedAt === 'number' &&
      Number.isFinite(startedAt) &&
      Array.isArray(items) &&
      items.length === LID_EXAM.questions &&
      items.every((id) => typeof id === 'string' && known.has(id)) &&
      typeof answers === 'object' &&
      answers !== null &&
      Object.entries(answers).every(
        ([id, key]) => items.includes(id) && (LID_OPTION_ORDER as readonly unknown[]).includes(key),
      );
    if (!valid) {
      clearRun();
      return null;
    }
    const at = typeof current === 'number' && current >= 0 && current < items.length ? Math.floor(current) : 0;
    return { seed, items, answers, startedAt, current: at };
  } catch {
    return null;
  }
}

function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

const clockTone = (remaining: number): string =>
  remaining < ALARM_MS
    ? 'text-red-600 dark:text-red-400'
    : remaining < WARN_MS
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-stone-700 dark:text-stone-200';

export default function LidMockExam({ entries, bankVersion, state, pdfUrl }: Props) {
  const uiLang = useUiLang();
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.question.id, entry])), [entries]);
  const solutions = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.question.id, entry.question.solution])),
    [entries],
  );
  const [phase, setPhase] = useState<Phase>(() => {
    const stored = loadRun(new Set(byId.keys()));
    return stored ? { kind: 'running', run: stored } : { kind: 'start' };
  });
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [confirming, setConfirming] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  // The interval closes over its own render; these refs are what let a submit at 0:00 record
  // the sheet as it actually stands, and stop the clock and the button both recording it.
  const runRef = useRef<MockInProgress | null>(phase.kind === 'running' ? phase.run : null);
  const finishedRef = useRef(false);
  useEffect(() => {
    runRef.current = phase.kind === 'running' ? phase.run : null;
  });

  const finish = useCallback(
    (timedOut: boolean) => {
      const run = runRef.current;
      if (!run || finishedRef.current) return;
      finishedRef.current = true;
      const submittedAt = Math.min(Date.now(), run.startedAt + DURATION_MS);
      const answers = Object.fromEntries(run.items.map((id) => [id, run.answers[id] ?? null]));
      const exam: LidExamRun = {
        // From the stored run alone, so a run finalised twice (a reload mid-save) keeps one id
        // and `applyLidExam` drops the second copy.
        id: `mock-${run.startedAt}-${run.seed}`,
        state,
        bank: bankVersion,
        startedAt: run.startedAt,
        submittedAt,
        items: run.items,
        answers,
        correct: scoreMock(run.items, answers, solutions).correct,
        timedOut,
      };
      clearRun();
      // Journaled synchronously before the drain starts — the results never wait for the store.
      void logLidExamDurably(exam, lidExamAnswers(exam, solutions));
      setConfirming(false);
      setPhase({ kind: 'results', run: exam });
    },
    [bankVersion, solutions, state],
  );

  // Abgeben sits at the foot of a long page on a phone, and the grid below the question: when
  // the screen changes under the learner, bring its top back into view.
  const shown = phase.kind === 'running' ? phase.run.current : -1;
  useEffect(() => {
    revealTop(phase.kind === 'results' ? topRef.current : questionRef.current);
  }, [phase.kind, shown]);

  const running = phase.kind === 'running';
  const startedAt = running ? phase.run.startedAt : null;
  useEffect(() => {
    if (startedAt === null) return;
    const deadline = startedAt + DURATION_MS;
    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) finish(true);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt, finish]);

  function start() {
    const seed = randomSeed();
    const items = drawMockExam({ questions: entries.map((entry) => entry.question) }, state, mulberry32(seed));
    const run: MockInProgress = { seed, items, answers: {}, startedAt: Date.now(), current: 0 };
    finishedRef.current = false;
    runRef.current = run;
    saveRun(run);
    setConfirming(false);
    setPhase({ kind: 'running', run });
  }

  function update(change: (run: MockInProgress) => MockInProgress) {
    if (phase.kind !== 'running') return;
    const run = change(phase.run);
    runRef.current = run;
    saveRun(run);
    setPhase({ kind: 'running', run });
  }

  if (phase.kind === 'start') {
    return (
      <div className={`${CARD} p-6`}>
        <ul className="space-y-2 text-sm">
          <li className="text-base font-semibold">
            {lidText('lid.mockFacts', uiLang, {
              questions: LID_EXAM.questions,
              general: LID_EXAM.questions - LID_EXAM.stateQuestions,
              local: LID_EXAM.stateQuestions,
              state: stateName(state),
              minutes: LID_EXAM.minutes,
            })}
          </li>
          <li>{lidText('lid.passEinbuergerung', uiLang, { n: LID_EXAM.passEinbuergerung })}</li>
          <li>{lidText('lid.passOrientierungskurs', uiLang, { n: LID_EXAM.passOrientierungskurs })}</li>
          <li className="text-stone-500 dark:text-stone-400">{t('lid.mockRules', uiLang)}</li>
        </ul>
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('lid.simulationNote', uiLang)}
        </p>
        <button type="button" onClick={start} className={`${PRIMARY_BUTTON} mt-5`}>
          {t('lid.mockStart', uiLang)}
        </button>
      </div>
    );
  }

  if (phase.kind === 'results')
    return (
      <div ref={topRef} className="scroll-mt-32">
        <Results run={phase.run} byId={byId} pdfUrl={pdfUrl} onRestart={() => setPhase({ kind: 'start' })} />
      </div>
    );

  const { run } = phase;
  const index = run.current;
  const entry = byId.get(run.items[index]!)!;
  const answered = run.items.filter((id) => run.answers[id]).length;
  const missing = run.items.length - answered;
  const last = index === run.items.length - 1;
  const goTo = (at: number) =>
    update((r) => ({ ...r, current: Math.max(0, Math.min(r.items.length - 1, at)) }));

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
        <div className={`${CARD} flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3`}>
          <div>
            <p className="font-semibold tabular-nums">
              {lidText('lid.mockQuestionOf', uiLang, { k: index + 1, n: run.items.length })}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {lidText('lid.answeredOf', uiLang, { k: answered, n: run.items.length })}
            </p>
          </div>
          <span
            role="timer"
            aria-label={t('lid.timeLeft', uiLang)}
            className={`text-2xl font-bold tabular-nums ${clockTone(remainingMs)}`}
          >
            {formatClock(remainingMs)}
          </span>
        </div>

        <div ref={questionRef} className={`${CARD} scroll-mt-32 p-4 sm:p-6`}>
          <LidQuestion
            key={entry.question.id}
            mode="exam"
            entry={entry}
            pdfUrl={pdfUrl}
            chosen={run.answers[entry.question.id] ?? null}
            onChoose={(key) => {
              setConfirming(false);
              update((r) => ({ ...r, answers: { ...r.answers, [entry.question.id]: key } }));
            }}
            onNext={() => {
              if (!last) goTo(index + 1);
            }}
          />
        </div>

        <div className="flex justify-between gap-2">
          <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className={QUIET_BUTTON}>
            {t('lid.prev', uiLang)}
          </button>
          <button type="button" onClick={() => goTo(index + 1)} disabled={last} className={QUIET_BUTTON}>
            {t('action.next', uiLang)}
          </button>
        </div>
      </div>

      <div className="space-y-4 lg:self-start">
        <nav aria-label={t('lid.grid', uiLang)} className={`${CARD} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {t('lid.grid', uiLang)}
          </p>
          <ol className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
            {run.items.map((id, at) => {
              const done = !!run.answers[id];
              const here = at === index;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => goTo(at)}
                    aria-current={here ? 'step' : undefined}
                    aria-label={lidText('lid.gridCell', uiLang, {
                      n: at + 1,
                      status: done ? t('lid.cellAnswered', uiLang) : t('lid.cellOpen', uiLang),
                    })}
                    className={`flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium tabular-nums ${
                      done
                        ? 'border-stone-700 bg-stone-700 text-white dark:border-stone-300 dark:bg-stone-300 dark:text-stone-900'
                        : 'border-stone-300 text-stone-600 hover:border-amber-500 dark:border-stone-600 dark:text-stone-300'
                    } ${here ? 'ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-stone-800' : ''}`}
                  >
                    {at + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={`${CARD} p-4`}>
          {confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-700 dark:text-stone-200">
                {missing === 1
                  ? t('lid.confirmOne', uiLang)
                  : lidText('lid.confirmMany', uiLang, { n: missing })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => finish(false)} className={PRIMARY_BUTTON}>
                  {t('lid.confirmYes', uiLang)}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={QUIET_BUTTON}>
                  {t('lid.confirmNo', uiLang)}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (missing > 0 ? setConfirming(true) : finish(false))}
              className={`${PRIMARY_BUTTON} w-full`}
            >
              {t('lid.submit', uiLang)}
            </button>
          )}
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">{t('lid.simulationNote', uiLang)}</p>
        </div>
      </div>
    </div>
  );
}

/** One pass mark, with its verdict and what the test it belongs to is for. */
function PassLine({ passed, name, context }: { passed: boolean; name: string; context: string }) {
  const uiLang = useUiLang();
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 font-bold ${passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
      >
        {passed ? '✓' : '✗'}
      </span>
      <span>
        <span className="font-semibold">{name}</span>
        {': '}
        <span className={passed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
          {passed ? t('lid.passed', uiLang) : t('lid.failed', uiLang)}
        </span>
        <span className="block text-sm text-stone-500 dark:text-stone-400">{context}</span>
      </span>
    </li>
  );
}

function Results({
  run,
  byId,
  pdfUrl,
  onRestart,
}: {
  run: LidExamRun;
  byId: ReadonlyMap<string, LidEntry>;
  pdfUrl: string;
  onRestart: () => void;
}) {
  const uiLang = useUiLang();
  const missed = run.items.filter((id) => run.answers[id] !== byId.get(id)?.question.solution);
  const minutes = Math.max(1, Math.round((run.submittedAt - run.startedAt) / 60_000));

  return (
    <div className="space-y-6">
      <section className={`${CARD} p-6`}>
        <p className="text-3xl font-bold tabular-nums">
          {lidText('lid.resultScore', uiLang, { n: run.correct, total: run.items.length })}
        </p>
        <ul className="mt-4 space-y-3">
          <PassLine
            passed={run.correct >= LID_EXAM.passEinbuergerung}
            name={t('lid.einbuergerung', uiLang)}
            context={lidText('lid.einbuergerungContext', uiLang, { n: LID_EXAM.passEinbuergerung })}
          />
          <PassLine
            passed={run.correct >= LID_EXAM.passOrientierungskurs}
            name={t('lid.orientierungskurs', uiLang)}
            context={lidText('lid.orientierungskursContext', uiLang, { n: LID_EXAM.passOrientierungskurs })}
          />
        </ul>
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
          {lidText('lid.timeUsed', uiLang, { min: minutes })}
          {run.timedOut && ` · ${t('lid.timedOut', uiLang)}`}
          {' · '}
          {lidText('lid.bankVersion', uiLang, { v: run.bank })}
          {' · '}
          {t('lid.simulationNote', uiLang)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onRestart} className={PRIMARY_BUTTON}>
            {t('lid.newMock', uiLang)}
          </button>
          <a href={withBase('/leben/fehler')} className={QUIET_BUTTON}>
            {t('lid.mistakes', uiLang)}
          </a>
          <a href={withBase('/leben')} className={QUIET_BUTTON}>
            {t('lid.toOverview', uiLang)}
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">
          {missed.length > 0 ? lidText('lid.reviewTitle', uiLang, { n: missed.length }) : t('lid.allCorrect', uiLang)}
        </h2>
        <ol className="mt-3 space-y-4">
          {missed.map((id) => {
            const entry = byId.get(id);
            if (!entry) return null;
            return (
              <li key={id} className={`${CARD} p-4 sm:p-6`}>
                <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
                  {lidText('lid.mockQuestionOf', uiLang, { k: run.items.indexOf(id) + 1, n: run.items.length })}
                </p>
                <LidQuestion mode="exam" reveal entry={entry} pdfUrl={pdfUrl} chosen={run.answers[id] ?? null} />
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
