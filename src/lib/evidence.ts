import type { ExerciseItem } from './schemas';
import type { Attempt } from './store';

export type ResponseMode = NonNullable<Attempt['responseMode']>;

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
    case 'translate':
    case 'write':
      return 'writing';
  }
}
