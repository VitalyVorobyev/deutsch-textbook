/**
 * `focus_evidence`: authored response predicates that decide which of a free-typed item's misses
 * its `focus` tag owns.
 *
 * It lives beside the grader because the same verdict has to be reachable from three places that
 * must never disagree about one attempt: the `Translate`/`Listen` islands that log it, `bun run
 * validate` checking each predicate against the item's own accepted renderings, and
 * `progress:audit` re-reading a logged probe attempt.
 */
import { normalizeTranslation } from './cloze';

export interface FocusPredicates {
  /** All of these must match for an incorrect response to count as the competence surviving. */
  retained: readonly string[];
  /** Any of these matching makes the response an explicit failure of the focus. */
  failed: readonly string[];
  /**
   * Match case-sensitively. Off by default, so every predicate written before the option existed
   * means what it meant. Turn it on only where the capital *is* the graded decision — a
   * nominalized adjective (*etwas Neues*) cannot be told from its lower-case slip otherwise.
   */
  case_sensitive?: boolean;
}

export type FocusVerdict = 'retained' | 'failed' | 'unknown';

/** The regex a predicate compiles to — the one place its flags are decided. */
export function focusPredicate(pattern: string, predicates: Pick<FocusPredicates, 'case_sensitive'>): RegExp {
  return new RegExp(pattern, predicates.case_sensitive ? 'u' : 'iu');
}

/** Evaluate authored regex predicates without guessing from a whole-sentence miss. */
export function evaluateFocusEvidence(
  given: string,
  correct: boolean,
  predicates?: FocusPredicates,
): FocusVerdict {
  if (correct) return 'retained';
  if (!predicates) return 'unknown';
  const normalized = normalizeTranslation(given);
  const matches = (pattern: string) => focusPredicate(pattern, predicates).test(normalized);
  if (predicates.failed.some(matches)) return 'failed';
  if (predicates.retained.length > 0 && predicates.retained.every(matches)) return 'retained';
  return 'unknown';
}
