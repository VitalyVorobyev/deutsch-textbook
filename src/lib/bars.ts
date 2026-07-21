/**
 * The one ratio→colour rule for every progress bar in the app.
 *
 * `GOOD_RATIO` is deliberately the same number as `MASTERY_ACCURACY` and as
 * `PLACEMENT_PASS_RATIO` — pinned by a test, because the learner has no way to tell which
 * green to believe if two surfaces disagree about where "good enough" starts. A third
 * threshold invented locally is exactly how that drift happens.
 */
export const GOOD_RATIO = 0.8;
const FAIR_RATIO = 0.5;

export function barColor(ratio: number): string {
  if (ratio >= GOOD_RATIO) return 'bg-emerald-500';
  if (ratio >= FAIR_RATIO) return 'bg-amber-500';
  return 'bg-red-500';
}
