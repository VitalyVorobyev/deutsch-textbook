import type { Attempt } from '../../lib/store';
import { probeResults, PROBE_INTERVALS_DAYS, type ProbeFamily } from '../../lib/probes';
import { pick, type ExplainLang } from '../../lib/prefs';

/**
 * What the delayed probes showed — reported apart from everything else on this page,
 * because it answers a different question.
 *
 * Attempts, streaks and immediate accuracy are engagement and performance-during-practice;
 * they are inflated by the material being fresh. A probe is the only number here that
 * speaks to *retention*: the same competence, a real interval later, in a task the learner
 * had not seen. It is deliberately not folded into the accuracy figures — averaging it with
 * practice would hide exactly the gap it exists to expose.
 */
export interface ProbeFamilyLabel {
  setId: string;
  title_de: string;
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  title: { en: 'Delayed checks', ru: 'Проверки через время' },
  intro: {
    en: '{days} days after you learn a topic, the same competence is asked again — in a task you have not seen. It is the only figure on this page that speaks to what survived, rather than to how much you practised.',
    ru: 'Через {days} дн. после изучения темы задаётся тот же навык — но в новом задании, которого вы не видели. Это единственный показатель здесь, который говорит о том, что знание сохранилось, а не о том, что вы занимались.',
  },
  none: {
    en: 'No delayed check taken yet. The first one falls due two days after you learn a topic, and opens the session.',
    ru: 'Пока ни одной проверки. Первая появится через два дня после изучения темы — в начале сессии.',
  },
  lifetime: { en: 'lifetime delayed checks passed', ru: 'успешных проверок за всё время' },
  reviewTopic: { en: 'review topic', ru: 'повторить тему' },
  actualDays: { en: 'Actually taken after {n} days', ru: 'Фактически через {n} дн.' },
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

export function ProbeResults({ families, labels, topicPaths, attempts, lang }: Props) {
  const results = probeResults(families, attempts).filter((r) => r.taken.length > 0);

  const answered = results.flatMap((r) => r.taken);
  const correct = answered.filter((t) => t.correct).length;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">
        {pick(lang, UI.title)}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {pick(lang, UI.intro).replace('{days}', PROBE_INTERVALS_DAYS.join(', '))}
      </p>

      {answered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-sm text-stone-500 dark:border-stone-600 dark:text-stone-400">
          {pick(lang, UI.none)}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
            <span className="text-2xl font-bold">
              {correct} / {answered.length}
            </span>{' '}
            {pick(lang, UI.lifetime)}
          </p>
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li
                key={r.family.setId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
              >
                <span className="text-sm">
                  <span lang="de" className="font-medium">{labels[r.family.setId] ?? r.family.topicId}</span>
                  {r.taken.some((t) => !t.correct) && topicPaths[r.family.topicId] && (
                    <a href={topicPaths[r.family.topicId]} className="ml-2 text-xs text-amber-700 hover:underline dark:text-amber-400">
                      {pick(lang, UI.reviewTopic)}
                    </a>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {r.stages.map((stage) => (
                    <span
                      key={stage.stage}
                      title={stage.actualDays === undefined ? undefined
                        : pick(lang, UI.actualDays).replace('{n}', String(stage.actualDays))}
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
                      {stage.scheduledDays}{pick(lang, UI.dayAbbrev)}{' '}
                      {stage.status === 'passed' ? '✓' : stage.status === 'failed' ? '✗' : stage.status === 'due'
                        ? pick(lang, UI.due)
                        : stage.status === 'scheduled' && stage.dueAt
                          ? new Date(stage.dueAt).toLocaleDateString(pick(lang, DATE_LOCALE), { day: '2-digit', month: '2-digit' })
                          : pick(lang, UI.later)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
