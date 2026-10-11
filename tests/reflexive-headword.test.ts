/**
 * A reflexive verb is shown with its `sich`, keyed without it.
 *
 * The learner asked "gewöhnen -> sich gewöhnen?": the production card for "to get used (to)"
 * printed `gewöhnen` as its answer, because `de` is the Goethe Wortliste key and the B1 list
 * keys the bare infinitive. `accept: ["sich gewöhnen"]` already made the full form correct to
 * TYPE; nothing made it the form SHOWN. 23 entries were in that class. The shown form is now
 * derived (`shownHeadword`), and card identity, Wortliste coverage and grading keep the raw key.
 *
 * Every fixture states the fields its assertion depends on — `pos`, `de`, `valence`, `accept`,
 * `gender` — and none is read from the live corpus, so a content edit cannot turn this red.
 */
import { describe, expect, test } from 'bun:test';
import { reflexivityDeclared, shownHeadword, shownHeadwordIndex } from '@da/schema/headword';
import type { VocabEntry } from '@da/schema';
import { buildDeck, cardId } from '../src/lib/srs';
import { checkCardAnswer, shownAnswer } from '../src/lib/typing';

// Declared by `valence` alone: the Wortliste key is bare.
const gewoehnen = { pos: 'verb', de: 'gewöhnen', valence: 'sich gewöhnen an + Akk' };
// Declared by the headword itself: must never become `sich sich bewerben`.
const sichBewerben = { pos: 'verb', de: 'sich bewerben', valence: 'sich + Akk; um + Akk' };
// Dual valence: `anziehen` is "to put on (a garment)" and "to get dressed" — stays bare.
const anziehen = { pos: 'verb', de: 'anziehen', valence: '+ Akk / sich' };
// A non-verb whose valence leads with `sich` (sich einer Sache bewusst sein): not a verb, not touched.
const bewusst = { pos: 'adj', de: 'bewusst', valence: 'sich (Dat) + Gen' };
// A plain verb with no valence.
const wohnen = { pos: 'verb', de: 'wohnen' };

describe('the shown headword is derived from declared reflexivity', () => {
  test('a verb declared reflexive by its valence is shown with sich', () => {
    expect(reflexivityDeclared(gewoehnen)).toBe(true);
    expect(shownHeadword(gewoehnen)).toBe('sich gewöhnen');
  });

  test('a headword that already carries sich is not doubled', () => {
    expect(reflexivityDeclared(sichBewerben)).toBe(true);
    expect(shownHeadword(sichBewerben)).toBe('sich bewerben');
  });

  test('a dual valence does not lead with sich, so the verb stays bare', () => {
    expect(reflexivityDeclared(anziehen)).toBe(false);
    expect(shownHeadword(anziehen)).toBe('anziehen');
  });

  test('a non-verb is never given a reflexive pronoun', () => {
    expect(reflexivityDeclared(bewusst)).toBe(false);
    expect(shownHeadword(bewusst)).toBe('bewusst');
  });

  test('a verb with no valence is unchanged', () => {
    expect(reflexivityDeclared(wohnen)).toBe(false);
    expect(shownHeadword(wohnen)).toBe('wohnen');
  });

  test('the reference index lists only the entries whose shown form differs, keyed by raw de', () => {
    const index = shownHeadwordIndex([
      { id: 'deck-a', entries: [gewoehnen, sichBewerben, anziehen] },
      { id: 'deck-b', entries: [bewusst, wohnen] },
    ]);
    expect([...index]).toEqual([['deck-a::gewöhnen', 'sich gewöhnen']]);
  });
});

/** The minimum a `buildDeck` entry needs, with every field the assertions read stated. */
function entry(fields: Partial<VocabEntry> & Pick<VocabEntry, 'de' | 'pos'>): VocabEntry {
  return {
    en: 'gloss',
    ru: 'глосса',
    example_de: 'Beispiel.',
    example_en: 'Example.',
    example_ru: 'Пример.',
    cards: 'both',
    ...fields,
  } as VocabEntry;
}

describe('the flashcard shows sich, keeps its identity and grades as before', () => {
  const deck = buildDeck('fixture-deck', [
    entry({ pos: 'verb', de: 'gewöhnen', valence: 'sich gewöhnen an + Akk', accept: ['sich gewöhnen'] }),
    entry({ pos: 'verb', de: 'sich bewerben', valence: 'sich + Akk; um + Akk' }),
    entry({ pos: 'verb', de: 'anziehen', valence: '+ Akk / sich', accept: ['sich anziehen'] }),
    entry({ pos: 'noun', de: 'Apfel', gender: 'm' }),
  ]);
  const card = (de: string, dir: 'de-x' | 'x-de') => deck.find((c) => c.de === de && c.dir === dir)!;

  test('both directions of gewöhnen show and speak sich gewöhnen', () => {
    expect(shownAnswer(card('gewöhnen', 'de-x'))).toBe('sich gewöhnen');
    expect(shownAnswer(card('gewöhnen', 'x-de'))).toBe('sich gewöhnen');
  });

  test('card identity still keys on the raw Wortliste headword', () => {
    expect(card('gewöhnen', 'de-x').id).toBe(cardId('fixture-deck', 'gewöhnen', 'de-x'));
    expect(card('gewöhnen', 'x-de').id).toBe('fixture-deck::gewöhnen::x-de');
  });

  test('typing sich gewöhnen is correct, and so is the bare key — exactly as before', () => {
    const production = card('gewöhnen', 'x-de');
    expect(checkCardAnswer('sich gewöhnen', production).kind).toBe('correct');
    expect(checkCardAnswer('gewöhnen', production).kind).toBe('correct');
    expect(checkCardAnswer('sich gewoehnen', production).kind).toBe('umlaut');
    expect(checkCardAnswer('sich gewöhnt', production).kind).toBe('wrong');
  });

  test('the other classes print what they printed before', () => {
    expect(shownAnswer(card('sich bewerben', 'x-de'))).toBe('sich bewerben');
    expect(shownAnswer(card('anziehen', 'x-de'))).toBe('anziehen');
    expect(shownAnswer(card('Apfel', 'x-de'))).toBe('der Apfel');
    // Only a differing shown form travels in the corpus payload.
    expect(card('sich bewerben', 'x-de').deShown).toBeUndefined();
    expect(card('Apfel', 'de-x').deShown).toBeUndefined();
  });
});
