/**
 * The /leben overview (ADR 0021): where the learner starts each day, and what they stand on.
 *
 * Readiness is reported as facts — seen, right the last two times, due, open mistakes, mock
 * scores against both pass marks — never as a pass probability or a composite score. A failed
 * read renders `ProgressLoadError`, never zeros; a learner with no LiD answers yet gets an
 * invitation instead of a wall of zeros, but only when `hasSeenData('lid')` says that is true.
 *
 * The five entries render whatever the read does, so a stalled store never hides the way in.
 */
import { useEffect, useMemo, useState } from 'react';
import { LID_EXAM } from '@da/schema/lid';
import { lidReadiness, planLidPractice, type LidReadiness, type LidState } from '../../lib/lid';
import { getLidState, withReadRetry } from '../../lib/store';
import { t } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { hasSeenData } from '../../lib/write-journal';
import { useUiLang } from '../hooks';
import ProgressLoadError from '../ProgressLoadError';
import {
  CARD,
  NEW_PER_DAY_CHOICES,
  lidText,
  readNewPerDay,
  stateName,
  writeNewPerDay,
  type LidModuleView,
} from './shared';

interface Props {
  /** topics.yaml's modules, each topic's question ids in teaching order */
  modules: LidModuleView[];
  /** `bank.states[0]` */
  state: string;
  /** how many lessons there are (`/leben/lernen`) */
  lessons: number;
}

interface Loaded {
  lid: LidState;
  /** read once per load: "due" is a fact about the moment of the read, like `planReview`'s */
  now: Date;
}

/** Mock scores, oldest left, as bars against the two pass-mark lines. A single series, so no
    legend: the lines are labelled where they end, and every bar carries its score as a tooltip
    and in the list beside the chart. */
function MockChart({ exams }: { exams: LidReadiness['exams'] }) {
  const uiLang = useUiLang();
  const W = 240;
  const H = 132;
  const TOP = 6;
  const max = LID_EXAM.questions;
  const y = (score: number) => TOP + H - (score / max) * H;
  const slot = W / 10;
  // The two marks sit two points apart, so their labels go on opposite sides of their lines.
  const marks = [
    { score: LID_EXAM.passEinbuergerung, dy: -3 },
    { score: LID_EXAM.passOrientierungskurs, dy: 10 },
  ];
  return (
    <svg
      viewBox={`0 0 ${W + 24} ${TOP + H + 2}`}
      className="h-auto w-full max-w-xs shrink-0 text-stone-700 dark:text-stone-200"
      role="img"
      aria-label={t('lid.mocksTitle', uiLang)}
    >
      <line x1="0" y1={TOP + H} x2={W} y2={TOP + H} stroke="currentColor" strokeOpacity="0.2" />
      {marks.map(({ score, dy }) => (
        <g key={score}>
          <line x1="0" y1={y(score)} x2={W} y2={y(score)} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="3 3" />
          <text x={W + 4} y={y(score) + dy} fontSize="10" fill="currentColor" fillOpacity="0.75">
            {score}
          </text>
        </g>
      ))}
      {exams.map((exam, i) => (
        <rect
          key={exam.submittedAt}
          x={i * slot + slot * 0.2}
          y={y(exam.correct)}
          width={slot * 0.6}
          height={Math.max(1, TOP + H - y(exam.correct))}
          rx="2"
          className={exam.correct >= LID_EXAM.passEinbuergerung ? 'fill-amber-600 dark:fill-amber-400' : 'fill-stone-400 dark:fill-stone-500'}
        >
          <title>{`${exam.correct}/${max} · ${new Date(exam.submittedAt).toLocaleDateString('de-DE')}`}</title>
        </rect>
      ))}
    </svg>
  );
}

export default function LidOverview({ modules, state, lessons }: Props) {
  const uiLang = useUiLang();
  const ids = useMemo(() => modules.flatMap((m) => m.topics.flatMap((topic) => topic.ids)), [modules]);
  const [newPerDay, setNewPerDay] = useState(() => readNewPerDay());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void withReadRetry(() => getLidState(), { surface: 'leben' }).then(
      (lid) => {
        if (cancelled) return;
        if (lid.answers.length === 0 && Object.keys(lid.cards).length === 0 && hasSeenData('lid')) {
          setLoadError(true);
          return;
        }
        setLoadError(false);
        setLoaded({ lid, now: new Date() });
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [round]);

  const readiness = useMemo(() => (loaded ? lidReadiness(loaded.lid, ids, loaded.now) : null), [loaded, ids]);
  const plan = useMemo(() => {
    if (!loaded) return null;
    const queue = planLidPractice({ questionIds: ids, state: loaded.lid, now: loaded.now, newPerDay });
    const due = queue.filter((id) => loaded.lid.cards[id]).length;
    return { due, fresh: queue.length - due };
  }, [loaded, ids, newPerDay]);
  const moduleRows = useMemo(
    () =>
      loaded
        ? modules.map((m) => {
            const own = m.topics.flatMap((topic) => topic.ids);
            const r = lidReadiness(loaded.lid, own, loaded.now);
            // `mistakes` counts the seen questions whose last answer was wrong, so the rest of
            // the seen ones are exactly those whose last answer was right.
            return { id: m.id, title: m.title, total: r.total, seen: r.seen, right: r.seen - r.mistakes, wrong: r.mistakes };
          })
        : null,
    [loaded, modules],
  );

  const fresh = readiness !== null && readiness.seen === 0 && readiness.exams.length === 0;

  function chooseNewPerDay(value: number) {
    writeNewPerDay(value);
    setNewPerDay(value);
  }

  const entryLink =
    'flex min-h-11 flex-col justify-center rounded-lg border border-stone-200 bg-white px-4 py-3 hover:border-amber-400 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-amber-500';

  return (
    <div className="space-y-8">
      {/* The way in comes first: this page is opened every day to start, not to read. */}
      <section className="space-y-3">
        <a href={withBase('/leben/ueben')} className="block rounded-lg bg-amber-600 p-5 text-white shadow-sm hover:bg-amber-700">
          <span className="block text-xl font-bold">{t('lid.practice', uiLang)} →</span>
          <span className="mt-1 block text-sm text-amber-100">
            {plan ? lidText('lid.queueCounts', uiLang, { due: plan.due, fresh: plan.fresh }) : ' '}
          </span>
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={withBase('/leben/fehler')} className={entryLink}>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t('lid.mistakes', uiLang)}</span>
            {readiness && (
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {lidText('lid.mistakesOpen', uiLang, { n: readiness.mistakes })}
              </span>
            )}
          </a>
          <a href={withBase('/leben/pruefung')} className={entryLink}>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t('lid.mock', uiLang)}</span>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              {lidText('lid.mockFacts', uiLang, {
                questions: LID_EXAM.questions,
                general: LID_EXAM.questions - LID_EXAM.stateQuestions,
                local: LID_EXAM.stateQuestions,
                state: stateName(state),
                minutes: LID_EXAM.minutes,
              })}
            </span>
          </a>
          <a href={withBase('/leben/lernen')} className={entryLink}>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t('lid.learn', uiLang)}</span>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              {lessons > 0 ? lidText('lid.learnHint', uiLang, { n: lessons }) : t('lid.lessonsNone', uiLang)}
            </span>
          </a>
          <a href={withBase('/leben/fragen')} className={entryLink}>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t('lid.catalogue', uiLang)}</span>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              {lidText('lid.catalogueHint', uiLang, { n: ids.length })}
            </span>
          </a>
        </div>
      </section>

      {loadError && (
        <ProgressLoadError
          onRetry={() => {
            setLoadError(false);
            setRound((r) => r + 1);
          }}
        />
      )}
      {!loadError && !readiness && <p className="text-sm text-stone-500 dark:text-stone-400">…</p>}

      {fresh && (
        <section className="rounded-lg border border-dashed border-stone-300 p-6 dark:border-stone-600">
          <p className="font-semibold">{t('lid.emptyTitle', uiLang)}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            {lidText('lid.emptyBody', uiLang, { n: newPerDay })}
          </p>
        </section>
      )}

      {readiness && !fresh && (
        <section className={`${CARD} p-5`}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ['lid.statSeen', `${readiness.seen}/${readiness.total}`],
                ['lid.statLastTwo', readiness.lastTwoCorrect],
                ['lid.statDue', readiness.due],
                ['lid.statMistakes', readiness.mistakes],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-stone-500 dark:text-stone-400">{t(key, uiLang)}</dt>
                <dd className="mt-0.5 text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {moduleRows && (
        <section>
          <h2 className="text-lg font-bold">{t('lid.modulesTitle', uiLang)}</h2>
          {!fresh && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
              <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-3 rounded-sm bg-green-600 dark:bg-green-500" />{t('lid.legendRight', uiLang)}</span>
              <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-3 rounded-sm bg-red-500" />{t('lid.legendWrong', uiLang)}</span>
              <span><span aria-hidden="true" className="mr-1 inline-block h-2 w-3 rounded-sm bg-stone-200 dark:bg-stone-700" />{t('lid.legendUnseen', uiLang)}</span>
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {moduleRows.map((row) => (
              <li key={row.id} className={`${CARD} px-4 py-3`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
                    {fresh
                      ? lidText('lid.moduleQuestions', uiLang, { n: row.total })
                      : lidText('lid.moduleSeen', uiLang, { seen: row.seen, total: row.total })}
                  </span>
                </div>
                {!fresh && (
                  <>
                    <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700" aria-hidden="true">
                      <div className="bg-green-600 dark:bg-green-500" style={{ width: `${(row.right / row.total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(row.wrong / row.total) * 100}%` }} />
                    </div>
                    {row.seen > 0 && (
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {lidText('lid.moduleRight', uiLang, { right: row.right, pct: Math.round((row.right / row.seen) * 100) })}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {readiness && !fresh && (
        <section>
          <h2 className="text-lg font-bold">{t('lid.mocksTitle', uiLang)}</h2>
          {readiness.exams.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('lid.mocksNone', uiLang)}</p>
          ) : (
            <div className={`${CARD} mt-3 flex flex-col gap-4 p-4 sm:flex-row sm:items-center`}>
              <MockChart exams={readiness.exams} />
              <ol className="space-y-1 text-sm">
                {[...readiness.exams].reverse().slice(0, 3).map((exam) => (
                  <li key={exam.submittedAt}>
                    <span className="font-semibold tabular-nums">
                      {exam.correct}/{LID_EXAM.questions}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400">
                      {' · '}
                      {new Date(exam.submittedAt).toLocaleDateString('de-DE')}
                    </span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">
                      {t('lid.einbuergerung', uiLang)} {exam.correct >= LID_EXAM.passEinbuergerung ? '✓' : '✗'}
                      {' · '}
                      {t('lid.orientierungskurs', uiLang)} {exam.correct >= LID_EXAM.passOrientierungskurs ? '✓' : '✗'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold">{t('lid.newPerDay', uiLang)}</h2>
        <div
          className="mt-2 inline-flex rounded-md border border-stone-300 p-0.5 text-sm dark:border-stone-600"
          role="radiogroup"
          aria-label={t('lid.newPerDay', uiLang)}
        >
          {NEW_PER_DAY_CHOICES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={newPerDay === value}
              onClick={() => chooseNewPerDay(value)}
              className={`min-h-11 min-w-14 rounded px-3 font-medium tabular-nums ${
                newPerDay === value
                  ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
