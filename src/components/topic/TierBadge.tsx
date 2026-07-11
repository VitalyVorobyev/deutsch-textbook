import type { Tier } from '../../lib/mastery';

const META: Record<Tier, { label: string; cls: string }> = {
  untouched: { label: 'Neu', cls: 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-300' },
  read: { label: 'Gelesen', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200' },
  practiced: { label: 'Geübt', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  mastered: {
    label: 'Gemeistert',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  },
};

/** Small completion pill for the measured tier. `manual` adds a ✎ mark when the
    tier is manually capped (reopened). */
export function TierBadge({
  tier,
  manual = false,
  className = '',
}: {
  tier: Tier;
  manual?: boolean;
  className?: string;
}) {
  const m = META[tier];
  return (
    <span
      lang="de"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls} ${className}`}
    >
      {m.label}
      {manual && (
        <span className="opacity-60" title="manuell">
          ✎
        </span>
      )}
    </span>
  );
}

/** Self-rating marker: the learner marked the topic learned — shown next to the
    measured tier, which it never changes. */
export function SelfAssessedMark({ className = '' }: { className?: string }) {
  return (
    <span
      lang="de"
      title="Selbsteinschätzung – ändert den gemessenen Stand nicht"
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 ${className}`}
    >
      ✎ gelernt
    </span>
  );
}
