import type { Tier } from '../../lib/mastery';
import { t, type StringKey } from '../../lib/strings';
import { useUiLang } from '../hooks';

// Labels live in the chrome strings table (tier.* — singular forms; the plural
// topics.status* keys are the OverviewTable filter labels).
const META: Record<Tier, { label: StringKey; cls: string }> = {
  untouched: { label: 'tier.untouched', cls: 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-300' },
  read: { label: 'tier.read', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200' },
  practiced: { label: 'tier.practiced', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  mastered: {
    label: 'tier.mastered',
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
  const uiLang = useUiLang();
  const m = META[tier];
  return (
    <span
      lang={uiLang}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls} ${className}`}
    >
      {t(m.label, uiLang)}
      {manual && (
        <span className="opacity-60" title={t('tier.manual', uiLang)}>
          ✎
        </span>
      )}
    </span>
  );
}

/** Self-rating marker: the learner marked the topic learned — shown next to the
    measured tier, which it never changes. */
export function SelfAssessedMark({ className = '' }: { className?: string }) {
  const uiLang = useUiLang();
  return (
    <span
      lang={uiLang}
      title={t('tier.selfLearnedTitle', uiLang)}
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 ${className}`}
    >
      ✎ {t('tier.selfLearned', uiLang)}
    </span>
  );
}

/**
 * Placement marker: the learner passed this topic on the level entry test.
 *
 * **Outlined, never the filled `tier.mastered` pill** — and that is the whole point of it
 * being a separate component. Placement is real evidence and it is green, but it is not
 * the ten spaced correct answers across two days that `Gemeistert` means. Rendering it as
 * the mastered badge would let a twenty-item test mint mastery the course never measured.
 */
export function PlacedMark({ className = '' }: { className?: string }) {
  const uiLang = useUiLang();
  return (
    <span
      lang={uiLang}
      title={t('placement.badgeTitle', uiLang)}
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 ${className}`}
    >
      ✓ {t('placement.badge', uiLang)}
    </span>
  );
}
