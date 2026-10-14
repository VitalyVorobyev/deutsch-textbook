import type { ExerciseItem } from '@da/schema';
import { evaluateFocusEvidence } from '@da/grading/evidence';
import type { Attempt } from './store';

export type ResponseMode = NonNullable<Attempt['responseMode']>;
export type FocusEvidence = NonNullable<Attempt['focusEvidence']>;

/**
 * The predicate evaluator lives in `@da/grading` (`packages/grading/src/evidence.ts`), because
 * `bun run validate` and `progress:audit` must reach the very function the islands log with.
 */
export { evaluateFocusEvidence };

/**
 * The focus tag to log for an attempt.
 *
 * An item's `focus` names the confusion it drills, but a free-production item can be
 * failed for reasons that have nothing to do with it — a translate item tagged
 * `haben-sein` whose auxiliary was right and whose participle was wrong is not
 * evidence about `haben-sein`. Item components may therefore disclaim attribution by
 * returning `focus: null`, and the attempt is logged unattributed. An honest gap in
 * the weakness signal beats a false entry in it, because `weakFocuses()` drives both
 * mixed-training priority and drill authoring.
 */
export function focusForAttempt(
  item: ExerciseItem,
  result: { focus?: string | null },
): string | undefined {
  if (result.focus === undefined) return item.focus;
  return result.focus ?? undefined;
}

/** The channel the learner actually used; curriculum outcomes may target a different CEFR mode. */
export function responseModeForItem(item: ExerciseItem): ResponseMode {
  switch (item.type) {
    case 'mc':
    case 'match':
      return 'selection';
    case 'audio-comprehension':
    case 'listen':
      return 'listening';
    case 'speak':
      return item.mode;
    case 'cloze':
    case 'order':
    case 'table':
    case 'form':
    case 'translate':
    case 'write':
      return 'writing';
  }
}

/**
 * Attribution for the islands whose miss has no `key_tokens` to read — `cloze`, `order` and
 * `table`. Without `focus_evidence` every wrong gap, chip or cell keeps the item's tag, as it
 * always has: nearly every gap *is* the confusion (`dem` for `den`), and dropping the tag
 * wholesale is the inversion `Translate.tsx` measured. Where an item authors predicates they
 * decide, exactly as they do for `translate` — read against `response`, the sentence the learner
 * built (`fillCloze` for a cloze, the assembled chips for an order, the asked cells joined by
 * ` / ` for a table) — and a miss they do not call `failed` is logged unattributed.
 */
export function islandAttribution(
  item: Pick<ExerciseItem, 'focus' | 'focus_evidence'>,
  correct: boolean,
  response: string,
): { focus?: null; focusEvidence?: FocusEvidence } {
  if (!item.focus || !item.focus_evidence) return {};
  const focusEvidence = evaluateFocusEvidence(response, correct, item.focus_evidence);
  return correct || focusEvidence === 'failed' ? { focusEvidence } : { focus: null, focusEvidence };
}
