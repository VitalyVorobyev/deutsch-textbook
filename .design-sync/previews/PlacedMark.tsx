import { PlacedMark, TierBadge } from 'deutsch-atlas';

// Outlined, deliberately NOT the filled Gemeistert pill — and that is the whole
// point of it being a separate component. A passed placement is real, green
// evidence, but it is not the ten spaced correct answers across two days that
// mastery measures. Rendering it as the mastered badge would let a twenty-item
// test mint mastery the course never measured.

/** The marker on its own. */
export function Default() {
  return <PlacedMark />;
}

/** Against the filled mastered pill, so the difference is visible. */
export function NotTheMasteredBadge() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <PlacedMark />
        <span className="text-xs text-stone-500">passed the entry test</span>
      </div>
      <div className="flex items-center gap-2">
        <TierBadge tier="mastered" />
        <span className="text-xs text-stone-500">ten spaced correct answers across two days</span>
      </div>
    </div>
  );
}

/** In a topic row: placed, but the measured tier is still untouched. */
export function InATopicRow() {
  return (
    <div className="flex w-full max-w-lg flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 py-2 dark:border-stone-700">
      <span lang="de" className="font-medium text-stone-800 dark:text-stone-100">
        Artikel im Nominativ
      </span>
      <span className="text-xs text-stone-400">A1</span>
      <div className="ml-auto flex items-center gap-1.5">
        <TierBadge tier="untouched" />
        <PlacedMark />
      </div>
    </div>
  );
}
