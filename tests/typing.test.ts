/**
 * Typed production answers.
 *
 * The card's `de` is three things at once: the Wortliste key, the answer shown on
 * the back, and the answer the learner must type. For most words those coincide.
 * For three classes they do not, and the card used to mark correct German wrong.
 */
import { describe, expect, test } from 'bun:test';
import { articledForm, checkTypedAnswer } from '../src/lib/typing';

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
