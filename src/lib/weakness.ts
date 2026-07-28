/**
 * Confusion-level weakness detection over the attempt log.
 *
 * Attempts carry an optional `focus` tag (the confusion an exercise item
 * drills, e.g. "haben-sein" — see the focus-tag table in docs/focus-tags.md). These
 * pure functions aggregate recent error rates per tag; MixedTraining and the
 * progress page use them to steer practice toward weak confusions.
 */
import type { Attempt } from './store';
import { attemptScore } from './scoring';
import { isVerifiedEvidence } from './scoring';

/**
 * A pretest attempt — excluded from every weakness signal.
 *
 * A pretest is taken **before** the lesson, which is why it is already excluded from mastery,
 * from `Geübt`, from mixed training, from outcome measurement and from both coverage figures.
 * Leaving it in the weakness signal was an oversight, not a decision, and it was not harmless:
 * all 96 pretest items are `mc`, the one format the pilot learner scores ~93% on, so 91 easy
 * recognition attempts sat in the denominators of a signal that exists to find **production**
 * confusion. Measured against this repo's log, removing them changes the error rate of 27 tags
 * and swaps a member of the weak set outright — `nebensatz-vorfeld` was masked below the
 * threshold and `konjunktionaladverb-inversion` was pushed above it. Both directions are wrong,
 * and `weakFocuses` drives mixed-training priority and drill authoring.
 *
 * Identified by the path, which `bun run validate` enforces both ways (a `role: pretest` set
 * must be named `-pretest`, and a set so named must declare the role), so this is a checked
 * contract rather than a naming habit the runtime quietly depends on.
 */
export const isPretestAttempt = (attempt: Pick<Attempt, 'setId'>): boolean =>
  attempt.setId.endsWith('-pretest');

/** Current `revision` of an item, by set and item id. `undefined` for anything not in content. */
export type RevisionLookup = (setId: string, itemId: string) => number | undefined;

/**
 * An attempt answered against a task contract that no longer exists — excluded from every
 * weakness signal.
 *
 * A `revision` bump declares that prompts, accepted answers, scoring, outcomes or focus semantics
 * changed, i.e. today's key would grade an answer to a question the learner was never asked. That
 * is already why `progress-audit.ts` refuses to replay such an attempt through the grader; the
 * same reasoning says its result is not evidence about the tag. `a2/verbindungen-folgen:table-
 * drei-wortarten` is the case that forced it: three wrong attempts charging
 * `konjunktionaladverb-inversion` from a learner who produced every word order correctly and was
 * rejected by revision 1 for omitting the connector and by revision 2 for restating it.
 *
 * Two boundaries, both load-bearing:
 *
 * - **Unknown is never a mismatch.** Only 1362 of 2215 attempts carry an `itemRevision` at all,
 *   and an item absent from content resolves to `undefined` — treating either as "changed" would
 *   retire the other 853 from a signal that needs them. (`counts.revisionKnown`,
 *   `bun run progress:audit --profile vitaly`; 68 of those 1362 mismatch.)
 * - **Correct attempts drop too.** Dropping only the wrong ones would leave the passes behind and
 *   make the tag look healthier than any current evidence supports — the same shape as the
 *   pretest dilution above, pointed the other way. A retired contract is retired in both
 *   directions.
 */
export const isRetiredRevision = (
  attempt: Pick<Attempt, 'setId' | 'itemId' | 'itemRevision'>,
  current?: RevisionLookup,
): boolean => {
  if (attempt.itemRevision === undefined || !current) return false;
  const now = current(attempt.setId, attempt.itemId);
  return now !== undefined && now !== attempt.itemRevision;
};

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
  /** current item revisions; attempts against a retired one stop counting (default: off) */
  current?: RevisionLookup;
}

const DEFAULT_WINDOW = 30;

/**
 * Per-focus stats over each focus's most recent `window` attempts.
 *
 * `current` is optional and defaults to off: a caller without the content catalog to hand keeps
 * today's behaviour rather than silently treating every revision as unknown.
 */
export function focusStats(
  attempts: Attempt[],
  window = DEFAULT_WINDOW,
  current?: RevisionLookup,
): FocusStat[] {
  const byFocus = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.focus || !isVerifiedEvidence(a) || isPretestAttempt(a)) continue;
    if (isRetiredRevision(a, current)) continue;
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
  { minAttempts = 4, minErrorRate = 0.35, window = DEFAULT_WINDOW, current }: WeakFocusOptions = {},
): FocusStat[] {
  return focusStats(attempts, window, current)
    .filter((s) => s.attempts >= minAttempts && s.errorRate >= minErrorRate)
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts || b.lastTs - a.lastTs);
}
