import { useEffect, useState } from 'react';
import {
  dueProbes,
  MAX_PROBES_PER_SESSION,
  remainingProbeBudget,
  type ProbeFamily,
} from '../../lib/probes';
import { getAttempts } from '../../lib/store';
import { withBase } from '../../lib/url';
import { useExplainLang } from '../hooks';

interface Props {
  /** derived at build time from the content (probeFamilies in src/lib/probes.ts) */
  families: ProbeFamily[];
}

/**
 * The "Probe-Rückstand" card: visible only while more probes are due than one ordinary
 * session serves (MAX_PROBES_PER_SESSION) — below that, the daily session's step 0
 * drains the debt by itself and the card would just be noise — **and** while today's
 * derived probe budget is not spent (remainingProbeBudget in src/lib/probes.ts).
 * Without the budget gate, finishing a catch-up run landed right back on Heute with a
 * still-over-cap backlog re-showing the card, and a nine-probe debt could be chained
 * back-to-back in one sitting — exactly the exam the caps exist to prevent. Links to
 * the probes-only catch-up run at /ueben/proben. The session cap itself is deliberately
 * never raised. Like all probe state, everything here is derived from the attempt log.
 */
export default function ProbeBacklog({ families }: Props) {
  const lang = useExplainLang();
  const [state, setState] = useState<{ due: number; budget: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAttempts().then((attempts) => {
      if (cancelled) return;
      setState({
        due: dueProbes(families, attempts).length,
        budget: remainingProbeBudget(families, attempts),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [families]);

  if (state === null || state.due <= MAX_PROBES_PER_SESSION || state.budget <= 0) return null;

  return (
    <a
      href={withBase('/ueben/proben')}
      className="mt-4 block rounded-lg border border-amber-300 bg-amber-50 p-6 hover:border-amber-500 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:border-amber-500"
    >
      <p lang="de" className="font-bold text-stone-900 dark:text-stone-100">
        Probe-Rückstand
      </p>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
        {lang === 'ru'
          ? `Отложенных проверок в очереди: ${state.due} — больше, чем помещается в обычную сессию.`
          : `${state.due} delayed checks are waiting — more than one ordinary session serves.`}
      </p>
      <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
        {lang === 'ru' ? 'Разобрать до пяти за один визит' : 'Clear up to five in one visit'} →
      </p>
    </a>
  );
}
