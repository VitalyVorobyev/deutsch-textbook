import { PlacedMark, SelfAssessedMark, TierBadge } from 'deutsch-atlas';

// Labels come from the chrome strings table, which is pinned to German
// (resolveUiLang) — deliberate immersion, so these render "Gelesen", "Geübt",
// "Gemeistert" regardless of the learner's explanation language.

/** The measured tier, which is the only thing this badge ever reports. */
export function Tiers() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TierBadge tier="untouched" />
      <TierBadge tier="read" />
      <TierBadge tier="practiced" />
      <TierBadge tier="mastered" />
    </div>
  );
}

/** `manual` adds a ✎ when the learner reopened a topic, capping the tier. */
export function ManuallyCapped() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TierBadge tier="read" manual />
      <TierBadge tier="practiced" manual />
    </div>
  );
}

/**
 * The two outlined markers that sit *beside* a tier and never replace it.
 * Both are green and both are real, but neither is the ten spaced correct
 * answers across two days that Gemeistert measures.
 */
export function MarkersBesideTheTier() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier="read" />
        <SelfAssessedMark />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier="untouched" />
        <PlacedMark />
      </div>
    </div>
  );
}

/** How a row in the Fortschritt list actually reads. */
export function InATopicRow() {
  return (
    <ul className="w-full max-w-lg">
      {[
        { title: 'Perfekt mit haben und sein', level: 'A2', tier: 'mastered' as const },
        { title: 'Adjektivdeklination', level: 'A2', tier: 'practiced' as const },
        { title: 'Wechselpräpositionen', level: 'A2', tier: 'read' as const },
      ].map((row) => (
        <li
          key={row.title}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 py-2 dark:border-stone-700"
        >
          <span lang="de" className="font-medium text-stone-800 dark:text-stone-100">
            {row.title}
          </span>
          <span className="text-xs text-stone-400">{row.level}</span>
          <div className="ml-auto">
            <TierBadge tier={row.tier} />
          </div>
        </li>
      ))}
    </ul>
  );
}
