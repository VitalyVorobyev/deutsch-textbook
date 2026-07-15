/** Parts-weighted attempt scoring — the one accuracy rule every consumer shares. */
import type { ExplainLang } from './prefs';

/** The fields scoring needs — satisfied by both `Attempt` and `ItemResult`. */
export interface Scorable {
  correct: boolean;
  correctParts?: number;
  totalParts?: number;
  evidence?: 'verified' | 'practice';
}

/** Historical attempts omit the field and are verified by definition. */
export function isVerifiedEvidence(a: Pick<Scorable, 'evidence'>): boolean {
  return a.evidence !== 'practice';
}

/**
 * Score in [0, 1]: `correctParts / totalParts` when the attempt carries partial
 * credit, else binary `correct`. Malformed parts (missing pair, totalParts < 1)
 * fall back to `correct`, so a hand-edited snapshot can never divide by zero.
 */
export function attemptScore(a: Scorable): number {
  if (!isVerifiedEvidence(a)) return 0;
  if (
    typeof a.correctParts === 'number' &&
    typeof a.totalParts === 'number' &&
    a.totalParts >= 1
  ) {
    return Math.min(1, Math.max(0, a.correctParts) / a.totalParts);
  }
  return a.correct ? 1 : 0;
}

export function verifiedOnly<T extends Pick<Scorable, 'evidence'>>(items: readonly T[]): T[] {
  return items.filter(isVerifiedEvidence);
}

/** Sum of scores — "how many items' worth were answered correctly". */
export function scoreTotal(items: readonly Scorable[]): number {
  return items.reduce((s, a) => s + attemptScore(a), 0);
}

/**
 * Renders a possibly-fractional score for "x / y" displays: whole numbers stay
 * bare, fractions get one decimal — with a decimal comma except in English
 * ("7,5 / 10" for de/ru readers, "7.5 / 10" for en).
 */
export function formatScore(n: number, lang: ExplainLang = 'en'): string {
  const r = Math.round(n * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  // Binary on purpose: RU, UK and DE all write the decimal comma, so the
  // en-vs-rest split stays correct for all four explanation languages.
  return lang === 'en' ? s : s.replace('.', ',');
}
