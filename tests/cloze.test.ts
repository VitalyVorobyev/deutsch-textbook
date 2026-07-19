/**
 * The graded surface excludes punctuation and typography.
 *
 * Every case in here is a way a learner was marked wrong for typing correct German:
 * a trailing dot in a cloze gap, a `-` where the model answer's dialogue separator
 * is `—`, a missing comma before `weil`. No focus tag grades punctuation, the model
 * answer is always displayed fully punctuated, so none of it may cost an answer.
 */
import { describe, expect, test } from 'bun:test';
import { answerMatches, normalizeTranslation } from '../src/lib/cloze';

describe('normalizeTranslation — punctuation is not part of the graded surface', () => {
  test('the dialogue dash dissolves, typed as — or - or not at all', () => {
    const canonical = normalizeTranslation('Worauf wartet ihr? — Auf die Antwort.');
    expect(normalizeTranslation('Worauf wartet ihr? - Auf die Antwort.')).toBe(canonical);
    expect(normalizeTranslation('Worauf wartet ihr? Auf die Antwort')).toBe(canonical);
  });

  test('internal sentence punctuation is stripped, not only the trailing dot', () => {
    expect(normalizeTranslation('Ich komme später. Ich rufe dich an.')).toBe(
      normalizeTranslation('Ich komme später Ich rufe dich an'),
    );
  });

  test('a comma is typography here, not grammar', () => {
    expect(normalizeTranslation('Ich bleibe zu Hause, weil ich krank bin.')).toBe(
      normalizeTranslation('Ich bleibe zu Hause weil ich krank bin'),
    );
  });

  test('curly apostrophes and quotes fold to what a keyboard produces', () => {
    expect(normalizeTranslation('Wie geht’s dir?')).toBe(normalizeTranslation("Wie geht's dir?"));
    expect(normalizeTranslation('Er sagt: „Guten Morgen!“')).toBe(
      normalizeTranslation('Er sagt: Guten Morgen!'),
    );
  });

  test('word-internal hyphens and apostrophes are spelling and stay', () => {
    expect(normalizeTranslation('die E-Mail')).toBe('die E-Mail');
    expect(normalizeTranslation("Wie geht's?")).toBe("Wie geht's");
  });

  test('case still matters — this is German', () => {
    expect(normalizeTranslation('das essen')).not.toBe(normalizeTranslation('das Essen'));
  });
});

describe('answerMatches — cloze gaps and table cells', () => {
  test('a trailing dot on a sentence-final gap is not an error', () => {
    expect(answerMatches('auf.', ['auf'])).toBe(true);
    expect(answerMatches('gespielt.', ['gespielt', 'gemacht'])).toBe(true);
  });

  test('a trailing comma in a table cell is not an error', () => {
    expect(answerMatches('dem Mann,', ['dem Mann'])).toBe(true);
  });

  test('case in the gap is still graded', () => {
    expect(answerMatches('essen', ['Essen'])).toBe(false);
  });

  test('empty input never matches', () => {
    expect(answerMatches('', ['auf'])).toBe(false);
    expect(answerMatches('.', ['auf'])).toBe(false);
  });
});
