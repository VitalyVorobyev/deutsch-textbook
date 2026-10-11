import { describe, expect, test } from 'bun:test';
import { evaluateFocusEvidence, responseModeForItem } from '../src/lib/evidence';
import type { ExerciseItem } from '@da/schema';

const base = { id: 'item', outcomes: [], preview: false };

describe('actual response mode', () => {
  test('does not mistake selected evidence for the target outcome mode', () => {
    const item = {
      ...base,
      type: 'mc',
      target_mode: 'spoken-interaction',
      prompt: 'Was sagen Sie?',
      options: ['Hallo', 'Tschüs'],
      correct: 0,
    } satisfies ExerciseItem;
    expect(responseModeForItem(item)).toBe('selection');
    expect(item.target_mode).toBe('spoken-interaction');
  });

  test('separates listening, writing and spoken practice', () => {
    const listen = { ...base, type: 'listen', text: 'Guten Morgen', accept: [] } satisfies ExerciseItem;
    const write = {
      ...base,
      type: 'translate',
      prompt_en: 'Good morning',
      prompt_ru: 'Доброе утро',
      answer: 'Guten Morgen',
      accept: [],
    } satisfies ExerciseItem;
    const speak = {
      ...base,
      type: 'speak',
      mode: 'spoken-interaction',
      prompt: { en: 'Reply.', ru: 'Ответьте.' },
      goal: { en: 'Reply politely.', ru: 'Ответьте вежливо.' },
      checklist: [{ en: 'I replied.', ru: 'Я ответил(а).' }],
      model_answer: 'Ja, gern.',
    } satisfies ExerciseItem;

    expect(responseModeForItem(listen)).toBe('listening');
    expect(responseModeForItem(write)).toBe('writing');
    expect(responseModeForItem(speak)).toBe('spoken-interaction');
  });

});

describe('explicit focus evidence', () => {
  const modal = {
    retained: ['\\b(willst|möchtest) du mitkommen\\b', '\\bmusst du arbeiten$'],
    failed: ['\\bzu mitkommen\\b', '\\bmitzukommen\\b', '\\bzu arbeiten$'],
  };

  test('distinguishes retained, failed and unknown instead of guessing from whole-answer correctness', () => {
    expect(evaluateFocusEvidence('Willst du mitkommen, oder musst du arbeiten?', true, modal))
      .toBe('retained');
    expect(evaluateFocusEvidence('Willst du zu mitkommen, oder musst du arbeiten?', false, modal))
      .toBe('failed');
    // The lexical substitution is wrong, but it is not evidence about the presence of zu.
    expect(evaluateFocusEvidence('Willst du kommen, oder musst du arbeiten?', false, modal))
      .toBe('unknown');
  });

  test('a focused free-typed miss without predicates is unknown', () => {
    expect(evaluateFocusEvidence('Da ich keine Zeit habe', false)).toBe('unknown');
  });
});

describe('case-sensitive predicates', () => {
  // The capital of a nominalized adjective is the graded decision, and the default matching
  // folds case — so the slip `etwas neues` and the target `etwas Neues` are one string to it.
  const neues = {
    retained: ['\\betwas Neues\\b'],
    failed: ['\\betwas neu', '\\betwas Neu(e[mnr]?)?\\b'],
  };
  const target = 'Als Verkäufer habe ich immer etwas Neues gelernt.';

  test('are off by default: every predicate keeps the case-insensitive meaning it was written with', () => {
    // Folded, the lower-case predicate fires on the correct capital — which is exactly why the
    // validator refuses it on this item unless `case_sensitive` is declared.
    expect(evaluateFocusEvidence(target, false, neues)).toBe('failed');
    expect(evaluateFocusEvidence(target, false, { ...neues, case_sensitive: false })).toBe('failed');
  });

  test('opted in, they tell the capital from its slip', () => {
    const strict = { ...neues, case_sensitive: true };
    expect(evaluateFocusEvidence('Als Verkäufer habe ich immer etwas neues gelernt.', false, strict))
      .toBe('failed');
    expect(evaluateFocusEvidence('Als Verkäufer habe ich immer etwas Neue gelernt.', false, strict))
      .toBe('failed');
    // The noun phrase survived; the miss is elsewhere (a mishearing of Verkäufer).
    expect(evaluateFocusEvidence('Als Verkaufer habe ich immer etwas Neues gelernt.', false, strict))
      .toBe('retained');
  });
});
