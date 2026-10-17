/**
 * The graded surface excludes punctuation and typography.
 *
 * Every case in here is a way a learner was marked wrong for typing correct German:
 * a trailing dot in a cloze gap, a `-` where the model answer's dialogue separator
 * is `—`, a missing comma before `weil`. No focus tag grades punctuation, the model
 * answer is always displayed fully punctuated, so none of it may cost an answer.
 */
import { describe, expect, test } from 'bun:test';
import {
  answerMatches,
  capitalizeSentenceHeads,
  clozeGapHeads,
  fillCloze,
  normalizeTranslation,
  sentenceInitialIndices,
} from '@da/grading/cloze';

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

describe('sentenceInitialIndices', () => {
  test('maps raw sentence boundaries onto normalized token indices', () => {
    expect([
      ...sentenceInitialIndices(
        'Vor der Prüfung schlafe ich schlecht. Nach der Prüfung schlafe ich gut.',
      ),
    ]).toEqual([0, 6]);
  });

  test('a comma is not a sentence boundary', () => {
    expect([...sentenceInitialIndices('Ich schlafe schlecht, du schläfst gut.')]).toEqual([0]);
  });

  test('a dissolving dialogue dash advances no index; the question mark before it still closes the sentence', () => {
    expect([...sentenceInitialIndices('Worauf wartet ihr? — Auf die Antwort.')]).toEqual([0, 3]);
  });

  test('question and exclamation marks close sentences too', () => {
    expect([...sentenceInitialIndices('Kommst du mit? Ja! Dann los.')]).toEqual([0, 3, 4]);
  });
});

/**
 * At a sentence head the capital is the position's, not the grammar's. `{{Wenn}} ich Zeit habe`
 * typed `wenn` has the conjunction right; before the fold it was rejected and charged to
 * `falls-wenn` (`b1/bildungswege`), and the learner's log holds two such misses — a probe among
 * them (`b1/probe-reisen-probleme` variant-b, *hätte* for *Hätte*).
 */
describe('sentence-head gaps fold the first letter, and only there', () => {
  test('clozeGapHeads finds the gaps that open a sentence', () => {
    expect(clozeGapHeads('{{Wenn}} ich Zeit habe, {{komme}} ich.')).toEqual([true, false]);
    expect(clozeGapHeads('Ich komme. {{Morgen}} nicht.')).toEqual([true]);
    expect(clozeGapHeads('Er fragt: {{Könnten}} Sie mir helfen?')).toEqual([true]);
    expect(clozeGapHeads('Sie fragt: „{{Hätten}} Sie Zeit?“')).toEqual([true]);
    expect(clozeGapHeads('Ich glaube, {{dass}} er kommt.')).toEqual([false]);
    // A cue in brackets after a sentence does not hide the boundary before it.
    expect(clozeGapHeads('Darf ich? (dürfen) {{Könnten}} Sie das wiederholen? (können)')).toEqual([
      true,
    ]);
    expect(clozeGapHeads('Ich bei {{offenem}} (offen) Fenster.')).toEqual([false]);
    // An earlier gap is read as its answer, so a sentence it closes still opens the next one.
    expect(clozeGapHeads('Wir {{warten}}. {{Dann}} gehen wir.')).toEqual([false, true]);
  });

  test('a lower-case head matches, and so does an upper-case one where the key is lower', () => {
    expect(answerMatches('wenn', ['Wenn'], { sentenceHead: true })).toBe(true);
    expect(answerMatches('Wenn', ['wenn'], { sentenceHead: true })).toBe(true);
    expect(answerMatches('ob', ['Wenn'], { sentenceHead: true })).toBe(false);
  });

  test('mid-sentence case is still graded — there it is grammar', () => {
    expect(answerMatches('wenn', ['Wenn'])).toBe(false);
    expect(answerMatches('sie', ['Sie'])).toBe(false);
  });

  test('capitalizeSentenceHeads capitalizes every head and nothing else', () => {
    expect(capitalizeSentenceHeads('wenn ich Zeit habe, komme ich. dann gehen wir.')).toBe(
      'Wenn ich Zeit habe, komme ich. Dann gehen wir.',
    );
    expect(capitalizeSentenceHeads('„wenn du willst“')).toBe('Wenn du willst');
  });

  test('fillCloze puts the typed values where the gaps were', () => {
    expect(fillCloze('{{Wenn}} ich Zeit {{habe}}, komme ich.', ['falls ', 'hätte'])).toBe(
      'falls ich Zeit hätte, komme ich.',
    );
  });
});
