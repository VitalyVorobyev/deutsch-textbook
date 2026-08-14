/**
 * Committed linguistic rulings on rejected `translate` renderings.
 *
 * The audit's grading-review queue is derived from the attempt log, so it has no
 * memory: without a committed home for rulings the same rendering would return for
 * review on every run and the queue could never drain. `data/grading-decisions.yaml`
 * is that home. This module is the one loader and matcher shared by the validator
 * and the audit, so the two can never disagree about which rendering a decision
 * refers to.
 *
 * Exclusion semantics (applied in `scripts/progress-audit.ts`):
 * - `accept` / `constrain` — the rendering was never the learner's grammar error
 *   (correct German, or good German that bypassed the target), so its attempts stay
 *   excluded from the focus signals.
 * - `confirm` — the rejection was right: the exclusion lifts, and the attempts
 *   re-enter the signals with attribution **recomputed under today's grading
 *   contract**, never with the stored historical `focus` tag. Many rows are queued
 *   precisely because today's grader leaves the divergence outside the targeted
 *   focus; replaying a stale tag from an older grader would inject exactly the
 *   false entry the weakness signal must not contain.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { normalizeTranslation } from './cloze';
import { gradeTranslation } from './production';
import { gradingDecisionsSchema, type GradingDecision } from '@da/schema';

export const GRADING_DECISIONS_FILE = join('data', 'grading-decisions.yaml');

/** Parse and validate the decisions file. An absent file is an empty ledger. */
export function loadGradingDecisions(root: string): GradingDecision[] {
  const path = join(root, GRADING_DECISIONS_FILE);
  if (!existsSync(path)) return [];
  return gradingDecisionsSchema.parse(YAML.parse(readFileSync(path, 'utf8')) ?? []);
}

/**
 * The identity a decision is matched by: the item ref plus the rendering normalized
 * exactly the way the audit groups rejected renderings (`normalizeTranslation`), so
 * whitespace and trailing sentence punctuation never split one rendering in two.
 *
 * NUL separates the halves because no rendering can contain one, so no pair of parts can
 * collide. Written as the \u0000 **escape**, never as a literal NUL byte: a literal one makes
 * the whole file `data` rather than text, and grep then skips it silently — this file and
 * progress-audit.ts both sat invisible to search that way. Identical string at runtime,
 * greppable source; tests/source-hygiene.test.ts keeps it that way.
 */
export const decisionKey = (item: string, given: string): string =>
  `${item}\u0000${normalizeTranslation(given)}`;

/** What the decision checks need to know about the referenced exercise item. */
export interface DecisionTarget {
  type: string;
  answer?: string;
  accept?: string[];
  focus?: string;
  keyTokens?: string[];
}

/**
 * The machine-checkable claims a decision makes, shared by `scripts/validate.ts`
 * and the tests:
 *
 * - the `item` ref must resolve to an existing exercise item — a dangling ruling
 *   is a hard failure;
 * - an `accept` ruling claims the rendering is correct, target-preserving German,
 *   so it must pass today's grader — either the scorer's slip-forgiveness covers
 *   it, or the item's `accept` list contains it. An accepted rendering the grader
 *   still rejects is a stale claim, and the queue it was meant to drain would
 *   silently refill;
 * - an item that is no longer a graded translate item makes the ruling an orphan:
 *   a **warning**, not a failure — orphans happen when content or normalization
 *   evolves. (Whether a ruling still matches a *queueable* rendering is
 *   snapshot-relative, so that half of orphan detection lives in the audit.)
 *
 * `constrain` and `confirm` have no machine-checkable semantics: whether an
 * `instruction` really pins the target, or a rejection was linguistically right,
 * is a judgement about meaning — on the author, not on this checker.
 */
export function checkGradingDecisions(
  decisions: GradingDecision[],
  itemFor: (ref: string) => DecisionTarget | undefined,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const decision of decisions) {
    const at = `${decision.item} ("${decision.given}")`;
    const key = decisionKey(decision.item, decision.given);
    if (seen.has(key)) errors.push(`${at}: duplicate ruling for this rendering`);
    seen.add(key);

    const target = itemFor(decision.item);
    if (!target) {
      errors.push(`${at}: item ref does not resolve to any exercise item`);
      continue;
    }
    if (target.type !== 'translate' || !target.answer) {
      warnings.push(
        `${at}: item is not a graded translate item, so the ruling matches nothing queueable`,
      );
      continue;
    }
    if (decision.decision === 'accept') {
      const verdict = gradeTranslation(decision.given, {
        answer: target.answer,
        accept: target.accept,
        focus: target.focus,
        keyTokens: target.keyTokens,
      });
      if (verdict.kind === 'wrong') {
        errors.push(
          `${at}: ruled accept, but today's grader still rejects the rendering — ` +
            `add it to the item's accept list (and bump revision), or the ruling is a stale claim`,
        );
      }
    }
  }
  return { errors, warnings };
}
