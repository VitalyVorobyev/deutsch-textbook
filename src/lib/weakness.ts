/**
 * Confusion-level weakness detection over the attempt log.
 *
 * Attempts carry an optional `focus` tag (the confusion an exercise item
 * drills, e.g. "haben-sein" — see the focus-tag table in CLAUDE.md). These
 * pure functions aggregate recent error rates per tag; MixedTraining and the
 * progress page use them to steer practice toward weak confusions.
 */
import type { Attempt } from './store';
import { attemptScore } from './scoring';
import { isVerifiedEvidence } from './scoring';

export interface FocusStat {
  focus: string;
  /** attempts counted (at most `window` most recent per focus) */
  attempts: number;
  /** parts-weighted errors — a 5-of-6 table contributes 1/6, not 1 */
  errors: number;
  /** errors / attempts within the window */
  errorRate: number;
  /** timestamp of the most recent attempt for this focus */
  lastTs: number;
}

export interface WeakFocusOptions {
  /** ignore focuses with fewer recent attempts than this (default 4) */
  minAttempts?: number;
  /** minimum error rate to count as weak (default 0.35) */
  minErrorRate?: number;
  /** per-focus recency window, in attempts (default 30) */
  window?: number;
}

const DEFAULT_WINDOW = 30;

/** Per-focus stats over each focus's most recent `window` attempts. */
export function focusStats(attempts: Attempt[], window = DEFAULT_WINDOW): FocusStat[] {
  const byFocus = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.focus || !isVerifiedEvidence(a)) continue;
    const arr = byFocus.get(a.focus);
    if (arr) arr.push(a);
    else byFocus.set(a.focus, [a]);
  }

  const stats: FocusStat[] = [];
  for (const [focus, own] of byFocus) {
    const recent = [...own].sort((a, b) => a.ts - b.ts).slice(-window);
    const errors = recent.reduce((s, a) => s + (1 - attemptScore(a)), 0);
    stats.push({
      focus,
      attempts: recent.length,
      errors,
      errorRate: errors / recent.length,
      lastTs: recent.at(-1)!.ts,
    });
  }
  return stats;
}

/**
 * Focuses the learner is currently weak on, sorted worst-first
 * (highest error rate, then more evidence, then most recent).
 */
export function weakFocuses(
  attempts: Attempt[],
  { minAttempts = 4, minErrorRate = 0.35, window = DEFAULT_WINDOW }: WeakFocusOptions = {},
): FocusStat[] {
  return focusStats(attempts, window)
    .filter((s) => s.attempts >= minAttempts && s.errorRate >= minErrorRate)
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts || b.lastTs - a.lastTs);
}
