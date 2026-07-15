import { useMemo } from 'react';
import { localDateString, type Attempt, type SessionLogEntry } from '../../lib/store';
import { attemptScore, isVerifiedEvidence } from '../../lib/scoring';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  title: { en: 'Session history', ru: 'История занятий' },
  date: { en: 'Date', ru: 'Дата' },
  reviewed: { en: 'Reviewed', ru: 'Повторено' },
  trained: { en: 'Trained', ru: 'Упражнений' },
  accuracy: { en: 'Accuracy', ru: 'Точность' },
} as const satisfies Record<string, { en: string; ru: string }>;

export function SessionLog({
  attempts,
  sessions,
}: {
  attempts: Attempt[];
  sessions: SessionLogEntry[];
}) {
  const lang = useExplainLang();

  const accByDate = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      if (!isVerifiedEvidence(a)) continue;
      const d = localDateString(new Date(a.ts));
      const e = m.get(d) ?? { correct: 0, total: 0 };
      e.total++;
      e.correct += attemptScore(a);
      m.set(d, e);
    }
    return m;
  }, [attempts]);

  const rows = [...sessions].sort((a, b) => b.ts - a.ts).slice(0, 30);
  // Owns its card, so an empty log leaves no empty box behind.
  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
        {pick(lang, UI.title)}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="py-1 pr-4 font-medium">{pick(lang, UI.date)}</th>
              <th className="py-1 pr-4 text-right font-medium">{pick(lang, UI.reviewed)}</th>
              <th className="py-1 pr-4 text-right font-medium">{pick(lang, UI.trained)}</th>
              <th className="py-1 text-right font-medium">{pick(lang, UI.accuracy)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const acc = accByDate.get(s.date);
              return (
                <tr key={s.ts} className="border-t border-stone-100 dark:border-stone-700">
                  <td className="py-1.5 pr-4 tabular-nums">{s.date}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{s.reviewed ?? '—'}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{s.trained}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {acc && acc.total ? `${Math.round((acc.correct / acc.total) * 100)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
