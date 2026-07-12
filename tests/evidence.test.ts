import { describe, expect, test } from 'bun:test';
import { responseModeForItem } from '../src/lib/evidence';
import type { ExerciseItem } from '../src/lib/schemas';

const base = { id: 'item', outcomes: [], preview: false };

describe('actual response mode', () => {
  test('does not mistake selected evidence for the target outcome mode', () => {
    const item = {
      ...base,
      type: 'mc',
      prompt: 'Was sagen Sie?',
      options: ['Hallo', 'Tschüs'],
      correct: 0,
    } satisfies ExerciseItem;
    expect(responseModeForItem(item)).toBe('selection');
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
