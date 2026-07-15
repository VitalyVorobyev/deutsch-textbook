import { useEffect, useMemo, useState } from 'react';
import {
  dueProbes,
  probeFamilies,
  remainingProbeBudget,
  type DueProbe,
} from '../../lib/probes';
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
 * of a raised session cap. It serves the due queue most overdue first (dueProbes' own
 * ordering), and ProbeStep logs each answer exactly like an ordinary step-0 probe
 * attempt — probe state stays derived from the attempt log, so a served probe simply
 * stops being due and nothing new is stored.
 *
 * The run is capped by today's *remaining* derived budget, not the visit constant
 * (remainingProbeBudget in src/lib/probes.ts): MAX_PROBES_PER_CATCHUP is a daily
 * ceiling, and probes the ordinary session already served count against it. The Heute
 * card applies the same gate, but this route is reachable without the card, so it
 * defends itself — a spent budget gets a friendly stop instead of five more probes.
 *
 * On finish it returns to Heute; remaining debt stays due and drains tomorrow.
 */
export default function ProbeCatchUp({ sets }: { sets: TrainingSet[] }) {
  const lang = useExplainLang();
  const families = useMemo(() => probeFamilies(sets), [sets]);
  // null = still reading the attempt log
  const [state, setState] = useState<{ due: DueProbe[]; budget: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAttempts().then((attempts) => {
      if (cancelled) return;
      setState({
        due: dueProbes(families, attempts),
        budget: remainingProbeBudget(families, attempts),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [families]);

  if (state === null) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">…</p>;
  }

  if (state.due.length === 0) {
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

  if (state.budget <= 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
        <p lang="de" className="font-semibold">
          Für heute ist genug geprüft — der Rest ist morgen dran.
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru'
            ? 'Проверки измеряют память на холодную голову — усталость исказила бы результат. Очередь не пропадёт: она вернётся завтра.'
            : 'Probes measure cold-start memory, and fatigue would blur exactly that. The queue is not lost — it comes back tomorrow.'}
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
      due={state.due}
      sets={sets}
      cap={state.budget}
      onFinished={() => window.location.assign(withBase('/'))}
    />
  );
}
