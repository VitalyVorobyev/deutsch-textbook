import { describe, expect, test } from 'bun:test';
import type { ExerciseItem } from '@da/schema';
import { mistakeCatalog, ownMistakes } from '../src/lib/own-mistakes';

const items = [
  { id: 'cl', type: 'cloze', revision: 2, text: 'Ich helfe {{dem|einem}} Mann {{gern}}.' },
  {
    id: 'mc',
    type: 'mc',
    revision: 1,
    prompt: 'Kannst du ___ helfen?',
    options: ['mich', 'mir'],
    correct: 1,
  },
  {
    id: 'tr',
    type: 'translate',
    revision: 1,
    prompt_en: 'I thank you.',
    prompt_ru: 'Я благодарю вас.',
    answer: 'Ich danke Ihnen.',
    accept: ['Ich danke dir.'],
  },
  {
    id: 'or',
    type: 'order',
    revision: 1,
    words: ['Das', 'Buch', 'gefällt', 'mir', '.'],
    accept: [],
  },
  { id: 'wr', type: 'write', revision: 1 },
] as unknown as ExerciseItem[];
const catalog = mistakeCatalog([{ id: 'a2/x', items }]);
const attempt = (itemId: string, correct: boolean, given: string, ts: number, extra = {}) => ({
  setId: 'a2/x',
  itemId,
  correct,
  given,
  ts,
  ...extra,
});

describe('mistakeCatalog', () => {
  test('keeps the four one-line types, with the expected answer as a sentence', () => {
    expect(catalog.map((entry) => [entry.itemId, entry.correct])).toEqual([
      ['cl', 'Ich helfe dem Mann gern.'],
      ['mc', 'mir'],
      ['tr', 'Ich danke Ihnen.'],
      ['or', 'Das Buch gefällt mir.'],
    ]);
  });
});

describe('ownMistakes', () => {
  test('an item is a mistake only while its latest attempt is wrong', () => {
    const log = [
      attempt('mc', false, 'mich', 1),
      attempt('mc', true, 'mir', 2),
      attempt('or', true, 'Das Buch gefällt mir.', 1),
      attempt('or', false, 'Mir das Buch gefällt.', 3),
    ];
    expect(ownMistakes(catalog, log).map((m) => [m.entry.itemId, m.given])).toEqual([
      ['or', 'Mir das Buch gefällt.'],
    ]);
  });

  test('a cloze answer is shown inside its sentence, an empty gap as a gap', () => {
    const [mistake] = ownMistakes(catalog, [
      attempt('cl', false, 'den / ', 1, { itemRevision: 2 }),
    ]);
    expect(mistake?.given).toBe('Ich helfe den Mann ___.');
  });

  test('skips an older revision, unverified practice and a rendering accepted today', () => {
    const log = [
      attempt('cl', false, 'den / gern', 1, { itemRevision: 1 }),
      attempt('mc', false, 'mich', 2, { evidence: 'practice' }),
      attempt('tr', false, 'Ich danke dir', 3),
      attempt('wr', false, 'x', 4),
    ];
    expect(ownMistakes(catalog, log)).toEqual([]);
  });

  test('newest first, capped, and blind to other sets', () => {
    const log = [
      attempt('mc', false, 'mich', 1),
      attempt('tr', false, 'Ich danke Sie.', 5),
      attempt('or', false, 'Mir gefällt das Buch nicht.', 3),
      { ...attempt('mc', false, 'mich', 9), setId: 'a2/y' },
    ];
    expect(ownMistakes(catalog, log, 2).map((m) => m.entry.itemId)).toEqual(['tr', 'or']);
  });
});
