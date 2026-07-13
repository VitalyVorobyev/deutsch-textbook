/**
 * Grading free-typed German sentences (`translate` items).
 *
 * A translate item asks for a whole sentence, so one mistyped character anywhere in
 * it used to sink the item — and, worse, be recorded as a failure of the grammar the
 * item was drilling. Both halves of that are measurement bugs, and both fed
 * `weakFocuses()`, which steers mixed training and drill authoring.
 *
 * Two rules keep the signal honest:
 *
 *  1. A one-token near-miss outside the graded tokens is a spelling slip: the learner
 *     sees the correction, the attempt scores correct, and no focus error is logged.
 *     `Ich kann gut schimmen` is a typo, not a broken Satzklammer.
 *  2. A real error is attributed to the item's `focus` tag only when a token that tag
 *     actually grades is one of the tokens that diverged. Otherwise the attempt is
 *     logged wrong but *unattributed*: an honest gap beats a false signal.
 *     `Sie ist zu Hause gebliebt` is not evidence about `haben-sein` — `ist` is right.
 *
 * `key_tokens` on the item names the tokens it actually grades. Where it is absent the
 * fallbacks are the old behaviour (attribute to the item's tag), so an unaudited item
 * is never made *worse* than it was — only a declared item gets the sharper treatment.
 *
 * Dictation (`listen`) deliberately uses none of this: there, spelling IS the drill.
 */

import { normalizeTranslation } from './cloze';
import { diffExpectedWords } from './worddiff';

/** Strip attached punctuation, so `Bahnhof?` and `Bahnhof` are the same token. */
const bare = (w: string) => w.replace(/[.,!?;:]+$/, '');

const tokenize = (s: string) => normalizeTranslation(s).split(/\s+/).filter(Boolean);

/**
 * True when `a` becomes `b` with at most one insertion, deletion, substitution or
 * adjacent transposition (Damerau-Levenshtein ≤ 1). Case-sensitive, so `Morgen` →
 * `morgen` is one substitution — miscapitalizing a noun is a slip, not a grammar error.
 *
 * Deliberately tight: two edits is no longer unmistakably a slip. `we` → `wir` needs
 * two, so it stays a real error (and rule 2 keeps it from being blamed on the wrong tag).
 */
export function isOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    let at = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (at >= 0) {
        // A second divergence is only forgivable as one adjacent transposition.
        return (
          at === i - 1 &&
          a[at] === b[i] &&
          a[i] === b[at] &&
          a.slice(i + 1) === b.slice(i + 1)
        );
      }
      at = i;
    }
    return at >= 0;
  }

  // One insertion or deletion: walk the shorter string against the longer, allowing
  // exactly one character of the longer to go unmatched.
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let skipped = false;
  for (let j = 0; j < long.length && i < short.length; j++) {
    if (short[i] === long[j]) {
      i++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
  }
  return true;
}

/**
 * German function words are densely one-edit-confusable with each other — and the
 * difference between them is exactly what the focus taxonomy grades. `den`/`dem`,
 * `ihn`/`ihm`, `einen`/`einem` are each a single character apart, so a blanket
 * "one edit is a typo" rule would forgive precisely the errors we are trying to
 * measure.
 *
 * The guard fires only when the learner swapped one *real* function word for another
 * (`den` for `dem`) — that is a grammatical choice, and choices are graded. Typing
 * `do` for `du` is not a choice, because `do` is not a German word; it stays a slip.
 *
 * Open-class words (nouns, adjectives, adverbs, and verbs whose *form* an item
 * grades) are not listed here: those rely on the item's own `keyTokens`, because
 * whether the exact form matters is a property of the item, not of the word.
 */
const CLOSED_CLASS = new Set([
  // definite / indefinite / negative determiners
  'der', 'die', 'das', 'dem', 'den', 'des',
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines',
  // possessives (nominative + the endings that differ by one character)
  'mein', 'meine', 'meinen', 'meinem', 'meiner',
  'dein', 'deine', 'deinen', 'deinem', 'deiner',
  'sein', 'seine', 'seinen', 'seinem', 'seiner',
  'ihre', 'ihren', 'ihrem', 'ihrer',
  'unser', 'unsere', 'unseren', 'unserem',
  // personal pronouns
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr',
  'mich', 'dich', 'ihn', 'uns', 'euch',
  'mir', 'dir', 'ihm', 'ihnen',
  // contracted prepositions
  'zum', 'zur', 'beim', 'vom', 'im', 'am', 'ins', 'ans',
]);

const isClosedClass = (token: string) => CLOSED_CLASS.has(bare(token).toLowerCase());

/** The learner swapped one real German function word for another — a graded choice. */
const isFunctionWordSwap = (typed: string, expected: string) =>
  isClosedClass(expected) && isClosedClass(typed);

export interface TranslationSpec {
  /** canonical German answer */
  answer: string;
  /** other legitimate German renderings (word order, wording — not typo tolerance) */
  accept?: string[];
  /** the confusion this item drills */
  focus?: string;
  /**
   * The tokens of `answer` whose exact *form* this item grades. A divergence here is
   * a real error and is attributed to `focus`; a near-miss here is never forgiven as
   * a typo (`geflügen` for `geflogen` is a participle the learner built wrong, not a
   * slip). Everything else is scaffolding and gets typo tolerance.
   *
   * Word order needs no declaration: tokens are compared by position, so a reordered
   * sentence can never look like a one-token slip. An item that grades only placement
   * (`modal-satzklammer`, `verbzweit`) therefore needs no `keyTokens` at all.
   *
   * Closed-class words are protected automatically — see CLOSED_CLASS.
   */
  keyTokens?: string[];
}

export interface SpellingCorrection {
  given: string;
  expected: string;
}

export type TranslationVerdict =
  /** exact match against the answer or an accepted variant */
  | { kind: 'correct' }
  /** right sentence, one slipped token — scores correct, logs no focus error */
  | { kind: 'spelling'; correction: SpellingCorrection }
  /** a real error; `focus` present only when a graded token is what diverged */
  | { kind: 'wrong'; focus?: string };

/** Whether a verdict counts as a correct answer for scoring. */
export const verdictIsCorrect = (v: TranslationVerdict): boolean => v.kind !== 'wrong';

export function gradeTranslation(given: string, spec: TranslationSpec): TranslationVerdict {
  const candidates = [spec.answer, ...(spec.accept ?? [])];
  const normalized = normalizeTranslation(given);
  if (candidates.some((c) => normalizeTranslation(c) === normalized)) return { kind: 'correct' };

  const givenTokens = tokenize(given);
  const graded = new Set((spec.keyTokens ?? []).map(bare));

  /**
   * The mirror of the index-0 rule below, and it has to happen here rather than there.
   *
   * A key token standing first in `answer` is capitalized by sentence position, not by
   * grammar: `Im Sommer stehe ich um sechs Uhr auf.` pins `Im`. An `accept` rendering that
   * moves it mid-sentence lowercases it — `Ich stehe im Sommer um sechs Uhr auf.` — and
   * `im` is then a different string from the pinned `Im`, so it stops being graded for that
   * rendering. Rule 1 would forgive `um` for `im` as a one-edit spelling slip, which is
   * exactly the `um-am-zeit` error the item exists to measure, and Rule 2 would never blame
   * the tag for it. The index-0 rule only covers the opposite move (lowercase in `answer`,
   * fronted and capitalized in an `accept`), so without this the hole is one-directional.
   *
   * Narrow on purpose: the lowercase form is derived only when the key token really is the
   * first word of `answer`. Mid-sentence capitalization *is* grammar in German — `Sie` and
   * `sie` are different words — so nothing else is folded together.
   */
  const answerHead = bare(tokenize(spec.answer)[0] ?? '');
  if (graded.has(answerHead)) {
    graded.add(answerHead.charAt(0).toLowerCase() + answerHead.slice(1));
  }

  /**
   * Is the token at position `i` of `tokens` one this item grades?
   *
   * Sentence-initial capitalization is orthography, not grammar, and an `accept` variant
   * that fronts a time phrase capitalizes whatever was there: `am Samstag` becomes
   * `Am Samstag`. Matched case-sensitively, the graded `am` then stops being graded for
   * that rendering — so a genuine `Um`-for-`Am` error would be forgiven as a spelling slip
   * and never logged against `um-am-zeit`, which is the confusion the item exists to
   * measure. The forgiveness rule would be silently inverted by an `accept` line.
   *
   * So position 0 matches case-insensitively. Everywhere else the comparison stays exact,
   * because mid-sentence capitalization *is* grammar in German: `Sie` (formal you) and
   * `sie` (she) are different words, and a `du-sie` item that graded both would blame the
   * register tag for a pronoun error that has nothing to do with register.
   */
  const isGraded = (tokens: readonly string[], i: number): boolean => {
    const token = bare(tokens[i]!);
    if (graded.has(token)) return true;
    return i === 0 && graded.has(token.charAt(0).toLowerCase() + token.slice(1));
  };

  // Rule 1 — a single slipped token, in any of the accepted renderings.
  for (const candidate of candidates) {
    const want = tokenize(candidate);
    if (want.length !== givenTokens.length) continue;

    const diverged = want.reduce<number[]>((acc, tok, i) => {
      if (tok !== givenTokens[i]) acc.push(i);
      return acc;
    }, []);
    if (diverged.length !== 1) continue;

    const at = diverged[0]!;
    const expected = want[at]!;
    const typed = givenTokens[at]!;
    if (isGraded(want, at)) continue; // a token this item grades is never forgiven
    if (isFunctionWordSwap(typed, expected)) continue; // den for dem is a choice, not a slip
    if (!isOneEdit(typed, expected)) continue;

    return { kind: 'spelling', correction: { given: typed, expected } };
  }

  // Rule 2 — a real error. Blame the item's tag only if a token that tag grades is
  // among the ones that actually diverged.
  if (!spec.focus) return { kind: 'wrong' };
  if (graded.size === 0) return { kind: 'wrong', focus: spec.focus };

  const answerTokens = tokenize(spec.answer);
  const differs = diffExpectedWords(answerTokens, givenTokens);
  const hitGraded = answerTokens.some((_tok, i) => differs[i] && isGraded(answerTokens, i));
  return hitGraded ? { kind: 'wrong', focus: spec.focus } : { kind: 'wrong' };
}
