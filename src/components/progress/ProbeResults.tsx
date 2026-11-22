import type { Attempt } from '../../lib/store';
import {
  exhaustedFailed,
  probeResults,
  PROBE_INTERVALS_DAYS,
  type ProbeFamily,
} from '../../lib/probes';
import { pick, type ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { Tip } from '../Tip';

/**
 * What the delayed probes showed — the one block on Fortschritt that speaks to *retention*.
 *
 * Attempts, streaks and immediate accuracy are engagement and performance-during-practice;
 * they are inflated by the material being fresh. A probe is the same competence, a real
 * interval later, in a task the learner had not seen. It is deliberately not folded into the
 * accuracy figures — averaging it with practice would hide exactly the gap it exists to expose.
 *
 * Only topics with a failed stage are listed, the most recent failure first: a row of passed
 * checks asks nothing of the learner, and a full list ran to one row per family taken.
 */
export interface ProbeFamilyLabel {
  setId: string;
  title_de: string;
}

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  title: { en: 'Delayed checks', ru: 'Проверки через время' },
  intro: {
    en: 'The same competence asked again {days} days after you learned it, in a task you have not seen.',
    ru: 'Тот же навык в новом задании — через {days} дн. после изучения темы.',
  },
  none: {
    en: 'No delayed check taken yet. The first one falls due two days after you learn a topic, and opens the session.',
    ru: 'Пока ни одной проверки. Первая появится через два дня после изучения темы — в начале сессии.',
  },
  lifetime: { en: 'delayed checks passed', ru: 'проверок пройдено' },
  notHeld: { en: 'Did not hold', ru: 'Не удержалось' },
  allHeld: {
    en: 'Every check taken so far was passed.',
    ru: 'Все проверки до сих пор пройдены.',
  },
  more: { en: '{n} more', ru: 'ещё {n}' },
  dayAbbrev: { en: 'd', ru: 'д' },
  due: { en: 'due', ru: 'сегодня' },
  later: { en: 'later', ru: 'позже' },
} as const satisfies Record<string, { en: string; ru: string }>;

/** Locale for the scheduled-stage date chips. */
const DATE_LOCALE = { en: 'en-GB', ru: 'ru-RU' } as const;

interface Props {
  families: ProbeFamily[];
  labels: Record<string, string>;
  topicPaths: Record<string, string>;
  attempts: Attempt[];
  lang: ExplainLang;
}

/** Rows shown before the rest folds away. */
const VISIBLE_ROWS = 4;

export function ProbeResults({ families, labels, topicPaths, attempts, lang }: Props) {
  const uiLang = useUiLang();
  const results = probeResults(families, attempts).filter((r) => r.taken.length > 0);

  const answered = results.flatMap((r) => r.taken);
  const correct = answered.filter((x) => x.correct).length;
  const lastFailure = (r: (typeof results)[number]) =>
    Math.max(0, ...r.taken.filter((x) => !x.correct).map((x) => x.ts));
  // One row per topic, its most recent failure: a row links to the topic, and two rows
  // under one title would read as a duplicate.
  const seenTopics = new Set<string>();
  const failed = results
    .filter((r) => r.taken.some((x) => !x.correct))
    .sort((a, b) => lastFailure(b) - lastFailure(a))
    .filter((r) => !seenTopics.has(r.family.topicId) && seenTopics.add(r.family.topicId));

  const row = (r: (typeof results)[number]) => {
    const path = topicPaths[r.family.topicId];
    const title = labels[r.family.setId] ?? r.family.topicId;
    return (
      <li
        key={r.family.setId}
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-stone-50 px-3 py-2 dark:bg-stone-900/50"
      >
        <span className="min-w-0 text-sm">
          {path ? (
            <a
              href={path}
              lang="de"
              className="font-medium hover:text-amber-700 hover:underline dark:hover:text-amber-400"
            >
              {title}
            </a>
          ) : (
            <span lang="de" className="font-medium">
              {title}
            </span>
          )}
          {exhaustedFailed(r.family, attempts) && (
            <span
              lang="de"
              className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            >
              {t('probe.remediationExhausted', uiLang)}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {r.stages.map((stage) => (
            <span
              key={stage.stage}
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                stage.status === 'passed'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : stage.status === 'failed'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : stage.status === 'due'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                      : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-300'
              }`}
            >
              {stage.scheduledDays}
              {pick(lang, UI.dayAbbrev)}{' '}
              {stage.status === 'passed'
                ? '✓'
                : stage.status === 'failed'
                  ? '✗'
                  : stage.status === 'due'
                    ? pick(lang, UI.due)
                    : stage.status === 'scheduled' && stage.dueAt
                      ? new Date(stage.dueAt).toLocaleDateString(pick(lang, DATE_LOCALE), {
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : pick(lang, UI.later)}
            </span>
          ))}
        </span>
      </li>
    );
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          <Tip
            align="left"
            text={pick(lang, UI.intro).replace('{days}', PROBE_INTERVALS_DAYS.join(', '))}
            className="underline decoration-dotted underline-offset-2"
          >
            {pick(lang, UI.title)}
          </Tip>
        </h2>
        {answered.length > 0 && (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            <span className="text-lg font-bold tabular-nums">
              {correct} / {answered.length}
            </span>{' '}
            {pick(lang, UI.lifetime)}
          </p>
        )}
      </div>

      {answered.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.none)}</p>
      ) : failed.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.allHeld)}</p>
      ) : (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
            {pick(lang, UI.notHeld)} · {failed.length}
          </h3>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {failed.slice(0, VISIBLE_ROWS).map(row)}
          </ul>
          {failed.length > VISIBLE_ROWS && (
            <details className="group mt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-amber-700 dark:text-stone-400 dark:hover:text-amber-400 sm:min-h-0">
                <span aria-hidden className="text-xs transition-transform group-open:rotate-90">
                  ▸
                </span>
                {pick(lang, UI.more).replace('{n}', String(failed.length - VISIBLE_ROWS))}
              </summary>
              <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                {failed.slice(VISIBLE_ROWS).map(row)}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
