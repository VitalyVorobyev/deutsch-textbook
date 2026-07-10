import { useMemo } from 'react';
import { localDateString, type Attempt, type SessionLogEntry } from '../../lib/store';
import { useExplainLang } from '../hooks';

export function SessionLog({
  attempts,
  sessions,
}: {
  attempts: Attempt[];
  sessions: SessionLogEntry[];
}) {
  const lang = useExplainLang();
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  const accByDate = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const d = localDateString(new Date(a.ts));
      const e = m.get(d) ?? { correct: 0, total: 0 };
      e.total++;
      if (a.correct) e.correct++;
      m.set(d, e);
    }
    return m;
  }, [attempts]);

  const rows = [...sessions].sort((a, b) => b.ts - a.ts).slice(0, 30);
  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
        {t('Session history', 'История занятий')}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="py-1 pr-4 font-medium">{t('Date', 'Дата')}</th>
              <th className="py-1 pr-4 text-right font-medium">{t('Reviewed', 'Повторено')}</th>
              <th className="py-1 pr-4 text-right font-medium">{t('Trained', 'Упражнений')}</th>
              <th className="py-1 text-right font-medium">{t('Accuracy', 'Точность')}</th>
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
    </div>
  );
}
