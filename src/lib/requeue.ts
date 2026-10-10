/**
 * When a card graded "Again" comes back within the same review session.
 *
 * The learner sees the right answer at once — typed answers get their verdict with the target,
 * revealed cards their back — but the next *retrieval* is delayed: a retry four cards later, the
 * rule from v1 until 2026-10-10, came back within about a minute and was answered from working
 * memory. Delaying the first retrieval is what carries to long-term retention (Karpicke &
 * Roediger 2007, JEP:LMC 33(4)); a harder successful retrieval at a longer lag is remembered
 * better (Pyc & Rawson 2009, JML 60(4)); spacing helps L2 vocabulary specifically (Nakata 2015,
 * SSLA 37(4)). The gap therefore depends on how likely a delayed retrieval still is to succeed:
 *
 *   - a word the learner could not retrieve at all — new, or still in its first learning steps —
 *     returns after AGAIN_GAP_UNFAMILIAR cards;
 *   - a word learned before (an FSRS lapse: Review or Relearning) or nearly produced (only the
 *     article or an umlaut wrong) returns after AGAIN_GAP_PARTIAL cards;
 *   - every further miss in the same session halves the gap, never below AGAIN_GAP_MIN.
 *
 * A gap longer than what is left of the queue puts the card last. The counts are implementation
 * heuristics, not experimentally optimal values: the research supports delaying, not 8 or 50.
 * Across sessions the card's schedule stays FSRS's alone: this decides only the order of the
 * queue in front of the learner.
 *
 * Leben-in-Deutschland practice uses the same rule for a missed question (`LidPractice`): it
 * shows the key and the explanation at once, and asking again 4 questions later had the same
 * echo. A multiple-choice answer has no near miss, so only the question's FSRS state picks the
 * gap.
 */
import { State } from 'ts-fsrs';
import type { StoredCard } from './store';
import type { AnswerVerdict } from './typing';

export const AGAIN_GAP_UNFAMILIAR = 8;
export const AGAIN_GAP_PARTIAL = 50;
export const AGAIN_GAP_MIN = 3;

/** One card's misses in the current session; `base` is fixed by the first of them. */
export interface MissRecord {
  base: number;
  misses: number;
}

/**
 * Records a miss and returns the gap before the retry. `prior` is the card's state before this
 * grade; it classifies only the first miss, since that grade itself moves the card to
 * Relearning and would make every second miss look like a lapse.
 */
export function recordMiss(
  prev: MissRecord | undefined,
  prior: StoredCard | undefined,
  verdict: AnswerVerdict | null,
): MissRecord & { gap: number } {
  const learnedBefore = prior?.state === State.Review || prior?.state === State.Relearning;
  const nearlyRight = verdict?.kind === 'article' || verdict?.kind === 'umlaut';
  const base = prev?.base ?? (learnedBefore || nearlyRight ? AGAIN_GAP_PARTIAL : AGAIN_GAP_UNFAMILIAR);
  const misses = (prev?.misses ?? 0) + 1;
  return { base, misses, gap: Math.max(AGAIN_GAP_MIN, Math.round(base / 2 ** (misses - 1))) };
}

/** `rest` with `card` inserted after `gap` other cards, or last when fewer remain. */
export function requeueAfter<T>(rest: readonly T[], card: T, gap: number): T[] {
  const pos = Math.min(gap, rest.length);
  return [...rest.slice(0, pos), card, ...rest.slice(pos)];
}
