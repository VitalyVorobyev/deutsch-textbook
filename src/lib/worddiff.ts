/** Word-level answer diffing shared by Translate and Listen renderers. */

/** Strip attached punctuation so "Hund." and "Hund" count as the same word in the diff. */
const wordKey = (w: string) => w.replace(/[.,!?;:]+$/, '');

/**
 * Word-level diff via longest common subsequence: returns one flag per word of
 * `expected` — true if that word has no counterpart in `given` (i.e. differs).
 */
export function diffExpectedWords(expected: string[], given: string[]): boolean[] {
  const a = expected.map(wordKey);
  const b = given.map(wordKey);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const differs = expected.map(() => true);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      differs[i] = false;
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return differs;
}
