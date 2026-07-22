import { Sparkline } from 'deutsch-atlas';

// Values are in [0,1]; null renders a gap for a day with no attempts. The
// component inherits its stroke from the parent via currentColor, so the colour
// is set on the wrapper, never on the component.

/** Accuracy climbing over two weeks — the shape a working topic makes. */
export function Rising() {
  return (
    <span className="text-emerald-600 dark:text-emerald-400">
      <Sparkline values={[0.4, 0.45, 0.55, 0.5, 0.65, 0.7, 0.72, 0.8, 0.85, 0.9]} />
    </span>
  );
}

/**
 * Days with no attempts, passed as null.
 *
 * Note what this actually draws: the stroke is a single continuous path, so a
 * null does NOT break the line — the point is skipped and the line runs
 * straight to the next one. What a null costs is horizontal room, because the
 * x position still comes from the original index. So a stretch of missing days
 * reads as a long segment with no dot on it, not as a gap in the stroke.
 * (The component's own JSDoc says "null renders a gap", which overstates it.)
 */
export function MissingDays() {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sky-600 dark:text-sky-400">
        <Sparkline
          values={[0.6, null, null, 0.55, 0.7, null, 0.75, 0.8, null, 0.85]}
          width={240}
          height={64}
        />
      </span>
      <span className="text-stone-400 dark:text-stone-500">
        <Sparkline
          values={[0.6, 0.58, 0.56, 0.55, 0.7, 0.72, 0.75, 0.8, 0.82, 0.85]}
          width={240}
          height={64}
        />
      </span>
      <p className="max-w-sm text-xs text-stone-500 dark:text-stone-400">
        Same ten days: above with three missing, below complete. The dots mark the
        days that have data.
      </p>
    </div>
  );
}

/** A declining series, which is what a weak-focus trend looks like. */
export function Declining() {
  return (
    <span className="text-red-600 dark:text-red-400">
      <Sparkline values={[0.9, 0.85, 0.8, 0.7, 0.72, 0.6, 0.55, 0.5, 0.45, 0.4]} />
    </span>
  );
}

/** Inherits colour from the parent — the same data in three contexts. */
export function InheritsColor() {
  const values = [0.3, 0.5, 0.45, 0.6, 0.75, 0.7, 0.85];
  return (
    <div className="flex items-center gap-4">
      <span className="text-stone-500">
        <Sparkline values={values} />
      </span>
      <span className="text-amber-600">
        <Sparkline values={values} />
      </span>
      <span className="text-emerald-600">
        <Sparkline values={values} />
      </span>
    </div>
  );
}

/** At a larger size, as a panel header rather than an inline row ornament. */
export function Larger() {
  return (
    <span className="text-amber-600 dark:text-amber-400">
      <Sparkline
        values={[0.2, 0.35, 0.3, 0.5, 0.55, 0.5, 0.7, 0.65, 0.8, 0.85, 0.9, 0.88]}
        width={240}
        height={64}
      />
    </span>
  );
}

/** Inside a row, at its natural inline size. */
export function InAProgressRow() {
  return (
    <div className="flex w-full max-w-md items-center justify-between border-t border-stone-100 py-2 dark:border-stone-700">
      <span lang="de" className="text-sm font-medium text-stone-800 dark:text-stone-100">
        Perfekt mit haben und sein
      </span>
      <span className="text-emerald-600 dark:text-emerald-400">
        <Sparkline values={[0.5, 0.6, 0.55, 0.7, 0.8, 0.85, 0.9]} />
      </span>
    </div>
  );
}
