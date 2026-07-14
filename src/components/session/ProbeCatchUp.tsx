import { useEffect, useMemo, useState } from 'react';
import { dueProbes, MAX_PROBES_PER_CATCHUP, probeFamilies, type DueProbe } from '../../lib/probes';
import { getAttempts } from '../../lib/store';
import { withBase } from '../../lib/url';
import { useExplainLang } from '../hooks';
import type { TrainingSet } from '../training/MixedTraining';
import ProbeStep from './ProbeStep';

/**
 * The probes-only catch-up run behind the Heute "Probe-Rückstand" card.
 *
 * One visit, nothing but due probes: no review and no training precede them, so every
 * answer is a cold-start measurement by construction — the reason this exists instead
 * of a raised session cap. It serves up to MAX_PROBES_PER_CATCHUP of the due queue,
 * most overdue first (dueProbes' own ordering), and ProbeStep logs each answer exactly
 * like an ordinary step-0 probe attempt — probe state stays derived from the attempt
 * log, so a served probe simply stops being due and nothing new is stored.
 *
 * On finish it returns to Heute; if debt remains, the backlog card there recomputes it
 * from the attempt log and shows what is still waiting.
 */
export default function ProbeCatchUp({ sets }: { sets: TrainingSet[] }) {
  const lang = useExplainLang();
  const families = useMemo(() => probeFamilies(sets), [sets]);
  // null = still reading the attempt log
  const [due, setDue] = useState<DueProbe[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAttempts().then((attempts) => {
      if (!cancelled) setDue(dueProbes(families, attempts));
    });
    return () => {
      cancelled = true;
    };
  }, [families]);

  if (due === null) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">…</p>;
  }

  if (due.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
        <p lang="de" className="font-semibold">
          Keine Rückfragen fällig
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Отложенных проверок сейчас нет — задолженность разобрана.'
            : 'No delayed checks are waiting right now — the backlog is clear.'}
        </p>
        <a
          href={withBase('/')}
          className="mt-4 inline-block rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Zur Startseite
        </a>
      </div>
    );
  }

  return (
    <ProbeStep
      due={due}
      sets={sets}
      cap={MAX_PROBES_PER_CATCHUP}
      onFinished={() => window.location.assign(withBase('/'))}
    />
  );
}
