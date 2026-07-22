import { SelfAssessedMark, TierBadge } from 'deutsch-atlas';

// Outlined, never filled. The learner marked the topic learned; that is a
// self-rating, not evidence, so it sits beside the measured tier and never
// changes it.

/** The marker on its own. */
export function Default() {
  return <SelfAssessedMark />;
}

/** Beside the tier it does not change — the only way it ever appears. */
export function BesideTheMeasuredTier() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TierBadge tier="untouched" />
        <SelfAssessedMark />
      </div>
      <div className="flex items-center gap-2">
        <TierBadge tier="read" />
        <SelfAssessedMark />
      </div>
    </div>
  );
}

/** In a topic row, right-aligned as the Fortschritt list renders it. */
export function InATopicRow() {
  return (
    <div className="flex w-full max-w-lg flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 py-2 dark:border-stone-700">
      <span lang="de" className="font-medium text-stone-800 dark:text-stone-100">
        Wechselpräpositionen
      </span>
      <span className="text-xs text-stone-400">A2</span>
      <div className="ml-auto flex items-center gap-1.5">
        <TierBadge tier="read" />
        <SelfAssessedMark />
      </div>
    </div>
  );
}
