import { focusTrends } from '../../lib/trends';
import type { Attempt } from '../../lib/store';
import { Sparkline } from './Sparkline';
import { useExplainLang } from '../hooks';

export function WeaknessTrends({ attempts }: { attempts: Attempt[] }) {
  const lang = useExplainLang();
  const trends = focusTrends(attempts)
    .filter((t) => t.total >= 3)
    .slice(0, 8);
  if (trends.length === 0) return null;

  return (
    <div>
      <h2 lang="de" className="text-sm font-semibold text-stone-600 dark:text-stone-300">
        Schwachstellen im Verlauf
      </h2>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        {lang === 'ru'
          ? 'Доля ошибок по неделям — линия вниз означает, что путаница уходит.'
          : 'Weekly error rate per confusion — a falling line means it is improving.'}
      </p>
      <ul className="mt-3 space-y-2">
        {trends.map((t) => (
          <li key={t.focus} className="flex items-center gap-3 text-sm">
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-200">
              {t.focus}
            </code>
            <span className="ml-auto text-red-600 dark:text-red-400">
              <Sparkline values={t.buckets.map((b) => b.errorRate)} />
            </span>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
              {t.latestErrorRate == null ? '—' : `${Math.round(t.latestErrorRate * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
