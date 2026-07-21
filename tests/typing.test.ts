/**
 * Typed production answers.
 *
 * The card's `de` is three things at once: the Wortliste key, the answer shown on
 * the back, and the answer the learner must type. For most words those coincide.
 * For three classes they do not, and the card used to mark correct German wrong.
 */
import { describe, expect, test } from 'bun:test';
import { articledForm, checkTypedAnswer, GERMAN_INPUT_KEYS } from '../src/lib/typing';

describe('the article rules that already worked', () => {
  test('a noun needs its article', () => {
    expect(checkTypedAnswer('der Apfel', articledForm('Apfel', 'm'), 'noun').kind).toBe('correct');
    expect(checkTypedAnswer('Apfel', articledForm('Apfel', 'm'), 'noun').kind).toBe('article');
    expect(checkTypedAnswer('die Apfel', articledForm('Apfel', 'm'), 'noun').kind).toBe('article');
  });

  test('umlaut substitutes are recognised, not silently accepted', () => {
    expect(checkTypedAnswer('die Aepfel', 'die Äpfel', 'noun').kind).toBe('umlaut');
  });
});

describe('a reflexive verb: the learner who types the full form is not wrong', () => {
  // The manifest headword is the bare infinitive `ärgern`, but the form a learner
  // should produce is `sich ärgern`. Typing it used to be marked wrong.
  const accept = ['sich ärgern'];
  test('the full reflexive form is correct', () => {
    expect(checkTypedAnswer('sich ärgern', 'ärgern', 'verb', accept).kind).toBe('correct');
  });
  test('the bare headword is still correct', () => {
    expect(checkTypedAnswer('ärgern', 'ärgern', 'verb', accept).kind).toBe('correct');
  });
  test('a wrong verb is still wrong', () => {
    expect(checkTypedAnswer('sich freuen', 'ärgern', 'verb', accept).kind).toBe('wrong');
  });
});

describe('an adjectival noun has no single citation form', () => {
  // die Deutsche is one correct form; der Deutsche and ein Deutscher are equally
  // correct. The card shows one and used to call the others a wrong article.
  const accept = ['der Deutsche', 'ein Deutscher', 'eine Deutsche', 'Deutsche'];
  const shown = articledForm('Deutsche', 'f'); // "die Deutsche"

  test('every real form is accepted', () => {
    for (const form of ['die Deutsche', 'der Deutsche', 'ein Deutscher', 'eine Deutsche', 'Deutsche']) {
      expect(checkTypedAnswer(form, shown, 'noun', accept).kind).toBe('correct');
    }
  });

  test('accept is consulted BEFORE the article logic', () => {
    // Without that ordering, `der Deutsche` returns {kind:'article'} and tells the
    // learner their article is wrong when it is not.
    expect(checkTypedAnswer('der Deutsche', shown, 'noun', accept).kind).not.toBe('article');
  });

  test('a genuinely wrong article is still caught', () => {
    expect(checkTypedAnswer('das Deutsche', shown, 'noun', accept).kind).toBe('article');
  });
});

describe('an article-free country name demands no article', () => {
  // Modelled as `pos: phrase`, so the noun path never prepends one. "das Deutschland"
  // is not German, and the card must not ask for it.
  test('the bare name is correct and no article is expected', () => {
    expect(articledForm('Deutschland', undefined)).toBe('Deutschland');
    expect(checkTypedAnswer('Deutschland', 'Deutschland', 'phrase').kind).toBe('correct');
  });
  test('die Schweiz keeps its article — it really has one', () => {
    expect(articledForm('Schweiz', 'f')).toBe('die Schweiz');
    expect(checkTypedAnswer('Schweiz', 'die Schweiz', 'noun').kind).toBe('article');
    expect(checkTypedAnswer('die Schweiz', 'die Schweiz', 'noun').kind).toBe('correct');
  });
});

describe('typography folds to what the keyboard produces', () => {
  test('a typographic apostrophe matches the straight one', () => {
    expect(checkTypedAnswer("Wie geht’s?", "Wie geht's?", 'phrase').kind).toBe('correct');
  });

  test('an en/em dash matches the plain hyphen', () => {
    expect(checkTypedAnswer('die E–Mail', 'die E-Mail', 'noun').kind).toBe('correct');
  });

  test('a trailing comma is not an error', () => {
    expect(checkTypedAnswer('der Apfel,', 'der Apfel', 'noun').kind).toBe('correct');
  });
});

describe('punctuation inside a phrase card is not graded', () => {
  // Codex review finding on PR #82: the normalizer only stripped punctuation at
  // the string end, so `Ja, gern!` typed as `Ja gern` was still wrong.
  test('an internal comma does not fail the phrase', () => {
    expect(checkTypedAnswer('Ja gern', 'Ja, gern!', 'phrase').kind).toBe('correct');
  });
  test('the fully punctuated rendering also matches', () => {
    expect(checkTypedAnswer('Ja, gern!', 'Ja, gern!', 'phrase').kind).toBe('correct');
  });
});

describe('a German answer must be typeable on a non-German keyboard', () => {
  // Reported by the learner: the `Café` card could not be answered at all,
  // because the insert bar offered ä/ö/ü/ß and nothing else — the card graded
  // keyboard layout, not German. `Café` is the only accented headword in the
  // A1, A2 and B1 Goethe Wortlisten, and no graded answer in the exercise
  // corpus contains one, so one key covers the course through B1.
  test('every character a headword needs is on the insert bar', () => {
    expect(GERMAN_INPUT_KEYS).toContain('é');
    for (const ch of ['ä', 'ö', 'ü', 'ß']) expect(GERMAN_INPUT_KEYS).toContain(ch);
  });

  test('the accent-less loanword spelling is accepted, the article still is not', () => {
    const accept = ['das Cafe'];
    expect(checkTypedAnswer('das Café', 'das Café', 'noun', accept).kind).toBe('correct');
    expect(checkTypedAnswer('das Cafe', 'das Café', 'noun', accept).kind).toBe('correct');
    // é is a French diacritic on a loanword, not German orthography — but the
    // article is German and stays required in both spellings.
    expect(checkTypedAnswer('Café', 'das Café', 'noun', accept).kind).toBe('article');
    expect(checkTypedAnswer('der Café', 'das Café', 'noun', accept).kind).toBe('article');
  });
});
