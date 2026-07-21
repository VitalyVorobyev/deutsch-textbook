/** Pure matching/diff logic for typed flashcard answers (x-de production direction). */

import { normalizeTranslation } from './cloze';

/** Normalize typed input the same way every other typed answer is normalized:
    punctuation and typography are not graded anywhere, including *inside* a
    phrase card — `Ja, gern!` typed as `Ja gern` is the phrase, not a miss.
    Case survives, so noun capitalization stays part of the answer. */
export function normalizeTyped(s: string): string {
  return normalizeTranslation(s);
}

/** Fold umlaut substitutes into a comparable space: ä↔ae, ö↔oe, ü↔ue, ß↔ss.
    Folding BOTH sides catches mixed inputs ("schoen", "Füsse") without
    falsely rewriting genuine digraphs ("Frauen", "neu"). Case-sensitive. */
export function foldUmlauts(s: string): string {
  return s
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}

/**
 * Characters a German answer may need that a non-German keyboard layout cannot
 * type. Rendered as an insert bar under every typed field (flashcards, Translate,
 * Listen), which is why it lives here rather than being redeclared in each — it
 * was three separate copies of `['ä','ö','ü','ß']` before, free to drift.
 *
 * `é` is here because the learner reported being unable to answer the `Café`
 * card at all: the bar offered no way to type the accent, so the card was
 * ungradeable regardless of what they knew — difficulty from the keyboard, not
 * from the German. Measured before adding it: `Café` is the ONLY accented
 * headword in the A1, A2 *and* B1 Goethe Wortlisten, and no graded answer
 * anywhere in the exercise corpus contains one (the 28 `Café` occurrences are
 * English prose, instructions, or an untyped cloze frame).
 *
 * **Ä/Ö/Ü were missing too**, and that is the more serious half — found not by
 * inspection but by `checkAnswerIsTypeable` in scripts/validate.ts, written to
 * stop the *next* `Café`, which failed on eleven existing cards the moment it
 * ran. German capitalizes its nouns, so `die Ärztin`, `Österreich`, `die Übung`
 * and `die Öffnungszeiten` all need a capital umlaut, the grader is
 * case-sensitive, and the bar offered only the lowercase forms. Every one of
 * those cards was a permanent soft miss — `foldUmlauts` turns `Aerztin` into an
 * `umlaut` verdict, which suggests Again — for any learner without a German
 * keyboard layout. Nobody reported it, because a card that is merely *hard to
 * type* looks like a card you keep getting wrong.
 */
export const GERMAN_INPUT_KEYS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü', 'é'] as const;

const ARTICLES = { m: 'der', f: 'die', n: 'das' } as const;

/** Answer/display form of a headword: nouns get their article prepended
    ("Apfel" + m → "der Apfel"). Vocab headwords are stored bare; the article
    lives in `gender`, so typed recall must require it explicitly. */
export function articledForm(de: string, gender?: 'm' | 'f' | 'n'): string {
  return gender ? `${ARTICLES[gender]} ${de}` : de;
}

/** Split a noun headword like "der Apfel" into article + noun, or null. */
export function splitArticle(de: string): { article: string; noun: string } | null {
  const m = /^(der|die|das) (.+)$/.exec(de);
  return m ? { article: m[1], noun: m[2] } : null;
}

export type AnswerVerdict =
  | { kind: 'correct' }
  /** Noun matched but the article is missing (givenArticle: null) or wrong. */
  | { kind: 'article'; article: string; noun: string; givenArticle: string | null }
  /** Would match after umlaut-substitute folding (ae/oe/ue/ss). */
  | { kind: 'umlaut' }
  | { kind: 'wrong' };

/**
 * Check a typed answer against the vocab entry's `de` headword.
 * Whitespace-normalized, case-sensitive, trailing . ! ? optional.
 * For nouns (pos === 'noun') the article is part of the answer and required.
 *
 * `accept` carries the entry's other correct forms, and it is checked *before* the
 * article logic — otherwise a learner who writes `der Deutsche` for an adjectival
 * noun whose shown answer is `die Deutsche` is told their article is wrong when it
 * is not, and a learner who writes the full `sich ärgern` for the headword `ärgern`
 * is simply marked wrong for knowing more German than the card asked for.
 */
export function checkTypedAnswer(
  given: string,
  expectedDe: string,
  pos?: string,
  accept: string[] = [],
): AnswerVerdict {
  const input = normalizeTyped(given);
  const target = normalizeTyped(expectedDe);
  if (input === target) return { kind: 'correct' };
  if (input === '') return { kind: 'wrong' };

  for (const alt of accept) {
    const a = normalizeTyped(alt);
    if (input === a) return { kind: 'correct' };
    if (foldUmlauts(input) === foldUmlauts(a)) return { kind: 'umlaut' };
  }

  const split = pos === 'noun' ? splitArticle(target) : null;
  if (split) {
    const { article, noun } = split;
    const m = /^(der|die|das)\s+(.+)$/i.exec(input);
    if (m) {
      const givenArticle = m[1].toLowerCase();
      const rest = m[2];
      if (foldUmlauts(rest) === foldUmlauts(noun)) {
        if (givenArticle !== article) return { kind: 'article', article, noun, givenArticle };
        // right article: either umlaut substitutes in the noun, or casing — let the diff show casing
        if (rest !== noun) return { kind: 'umlaut' };
        return { kind: 'wrong' };
      }
    } else if (foldUmlauts(input) === foldUmlauts(noun)) {
      return { kind: 'article', article, noun, givenArticle: null };
    }
  }

  if (foldUmlauts(input) === foldUmlauts(target)) return { kind: 'umlaut' };
  return { kind: 'wrong' };
}

// ---------------------------------------------------------------------------
// Diff: highlight the parts of the expected answer the learner got wrong
// ---------------------------------------------------------------------------

export interface DiffSeg {
  text: string;
  /** true = this part of the expected answer was missing/different in the input */
  miss: boolean;
}

/** Character-level LCS diff, rendered over the EXPECTED string: segments not
    matched by the given input are flagged `miss`. Adjacent runs are merged. */
export function diffExpected(expected: string, given: string): DiffSeg[] {
  const n = expected.length;
  const m = given.length;
  if (n === 0) return [];
  if (m === 0) return [{ text: expected, miss: true }];
  if (n * m > 40000) return [{ text: expected, miss: false }];

  // dp[i][j] = LCS length of expected[i..] vs given[j..]
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        expected[i] === given[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const miss: boolean[] = new Array<boolean>(n).fill(true);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === given[j]) {
      miss[i] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const segs: DiffSeg[] = [];
  for (let k = 0; k < n; k++) {
    const last = segs[segs.length - 1];
    if (last && last.miss === miss[k]) last.text += expected[k];
    else segs.push({ text: expected[k], miss: miss[k] });
  }
  return segs;
}
