/**
 * How many never-seen cards a learner may be dealt in one day, across every gated surface
 * together. `newLimit` caps a single queue *build* and `planReview` re-runs on every mount, so
 * without a daily budget a reload of /ueben/wiederholen simply dealt the next 15 — five reloads,
 * 75 new cards, and a review debt FSRS delivers for months.
 *
 * `DAILY_NEW_CARDS` is the default. A learner may choose another of `DAILY_NEW_CARD_CHOICES` per
 * profile (`getDailyNewCards`, src/lib/prefs.ts), and every gated surface passes that choice to
 * `planReview` as `dailyNewCap`. This module has no imports on purpose: prefs.ts is loaded by the
 * header script of every page, and must not pull queue planning in with it.
 */
export const DAILY_NEW_CARDS = 15;

/** The daily new-card budgets a learner can choose from. */
export const DAILY_NEW_CARD_CHOICES = [10, 15, 20, 25] as const;
export type DailyNewCards = (typeof DAILY_NEW_CARD_CHOICES)[number];

/**
 * A stored daily new-card choice, read back. Anything that is not one of the choices — nothing
 * stored, a hand-edited value, a choice a later version dropped — is the default, so a learner who
 * never opened the setting is rationed exactly as before the setting existed.
 */
export function dailyNewCardsChoice(stored: unknown): DailyNewCards {
  const n = typeof stored === 'string' && /^\d+$/.test(stored) ? Number(stored) : stored;
  return (DAILY_NEW_CARD_CHOICES as readonly unknown[]).includes(n)
    ? (n as DailyNewCards)
    : DAILY_NEW_CARDS;
}
