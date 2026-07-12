import type { Attempt } from '../../lib/store';
import { probeResults, PROBE_INTERVALS_DAYS, type ProbeFamily } from '../../lib/probes';
import type { ExplainLang } from '../../lib/prefs';

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

interface Props {
  families: ProbeFamily[];
  labels: Record<string, string>;
  attempts: Attempt[];
  lang: ExplainLang;
}

export function ProbeResults({ families, labels, attempts, lang }: Props) {
  const results = probeResults(families, attempts).filter((r) => r.taken.length > 0);

  const answered = results.flatMap((r) => r.taken);
  const correct = answered.filter((t) => t.correct).length;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">
        {lang === 'ru' ? 'Проверки через время' : 'Delayed checks'}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {lang === 'ru'
          ? `Через ${PROBE_INTERVALS_DAYS.join(', ')} дн. после изучения темы задаётся тот же навык — но в новом задании, которого вы не видели. Это единственный показатель здесь, который говорит о том, что знание сохранилось, а не о том, что вы занимались.`
          : `${PROBE_INTERVALS_DAYS.join(', ')} days after you learn a topic, the same competence is asked again — in a task you have not seen. It is the only figure on this page that speaks to what survived, rather than to how much you practised.`}
      </p>

      {answered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-sm text-stone-500 dark:border-stone-600 dark:text-stone-400">
          {lang === 'ru'
            ? 'Пока ни одной проверки. Первая появится через два дня после изучения темы — в начале сессии.'
            : 'No delayed check taken yet. The first one falls due two days after you learn a topic, and opens the session.'}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
            <span className="text-2xl font-bold">
              {correct} / {answered.length}
            </span>{' '}
            {lang === 'ru' ? 'после интервала' : 'after the interval'}
          </p>
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li
                key={r.family.setId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
              >
                <span lang="de" className="text-sm font-medium">
                  {labels[r.family.setId] ?? r.family.topicId}
                </span>
                <span className="flex items-center gap-2">
                  {r.taken.map((t) => (
                    <span
                      key={t.itemId}
                      title={
                        lang === 'ru'
                          ? `${t.days} дн. спустя — ${t.correct ? 'верно' : 'неверно'}`
                          : `${t.days} days later — ${t.correct ? 'correct' : 'wrong'}`
                      }
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        t.correct
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {/* the interval that actually elapsed, not the one that was scheduled */}
                      {t.days}
                      {lang === 'ru' ? 'д' : 'd'} {t.correct ? '✓' : '✗'}
                    </span>
                  ))}
                  {r.remaining > 0 && (
                    <span className="text-xs text-stone-400">
                      {lang === 'ru' ? `+${r.remaining} впереди` : `+${r.remaining} to come`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
