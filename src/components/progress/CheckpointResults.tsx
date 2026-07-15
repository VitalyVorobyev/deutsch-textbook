import type { Attempt } from '../../lib/store';
import {
  checkpointOutcomeResults,
  type CheckpointItemRef,
  type CheckpointOutcomeResult,
} from '../../lib/checkpoint';
import { pick } from '../../lib/prefs';
import { useExplainLang } from '../hooks';

export interface CheckpointInfo {
  title: string;
  setId: string;
  path: string;
  items: CheckpointItemRef[];
}

interface Props {
  checkpoint: CheckpointInfo;
  outcomeModes: Record<string, string>;
  /** outcome id → learner-facing can-do text (shared by every checkpoint) */
  outcomeLabels: Record<string, { en: string; ru: string }>;
  attempts: Attempt[];
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  retake: { en: 'Retake →', ru: 'Пройти ещё раз →' },
  latest: {
    en: 'Latest result: {pct}% · {answered}/{total} tasks answered · {when}',
    ru: 'Последний результат: {pct}% · задания: {answered}/{total} · {when}',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

const MODE_LABELS: Record<string, { en: string; ru: string }> = {
  listening: { en: 'Listening', ru: 'Аудирование' },
  reading: { en: 'Reading', ru: 'Чтение' },
  writing: { en: 'Writing', ru: 'Письмо' },
  'spoken-production': { en: 'Spoken production', ru: 'Устная речь' },
  'spoken-interaction': { en: 'Spoken interaction', ru: 'Диалог' },
};

function barColor(ratio: number): string {
  if (ratio >= 0.8) return 'bg-emerald-500';
  if (ratio >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function OutcomeRow({ result, label }: { result: CheckpointOutcomeResult; label?: string }) {
  const ratio = result.items ? result.score / result.items : 0;
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-stone-600 dark:text-stone-300">{label ?? result.outcome}</span>
        <span className="shrink-0 tabular-nums text-xs text-stone-400">
          {Math.round(ratio * 100)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
        <div className={`h-full ${barColor(ratio)}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </li>
  );
}

/** Latest checkpoint result per outcome, grouped by CEFR mode. Hidden until first taken. */
export function CheckpointResults({ checkpoint, outcomeModes, outcomeLabels, attempts }: Props) {
  const lang = useExplainLang();
  const summary = checkpointOutcomeResults(
    checkpoint.items,
    attempts,
    checkpoint.setId,
    outcomeModes,
  );
  if (!summary) return null;

  const pct = summary.total ? Math.round((summary.score / summary.total) * 100) : 0;
  const when = new Date(summary.lastTs).toLocaleDateString(lang);
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">{checkpoint.title}</h2>
        <a
          href={checkpoint.path}
          className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          {pick(lang, UI.retake)}
        </a>
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {pick(lang, UI.latest)
          .replace('{pct}', String(pct))
          .replace('{answered}', String(summary.answered))
          .replace('{total}', String(summary.total))
          .replace('{when}', when)}
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {summary.byMode.map((group) => (
          <div key={group.mode}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              {MODE_LABELS[group.mode] ? pick(lang, MODE_LABELS[group.mode]) : group.mode}
            </h3>
            <ul className="mt-2 space-y-3">
              {group.outcomes.map((result) => (
                <OutcomeRow
                  key={result.outcome}
                  result={result}
                  label={outcomeLabels[result.outcome] && pick(lang, outcomeLabels[result.outcome])}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
