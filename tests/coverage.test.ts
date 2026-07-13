/**
 * The Wortliste coverage instrument.
 *
 * The Über page publishes these numbers, so the thing under test is not really
 * arithmetic — it is whether a coverage claim can be made without paying for it.
 * A `~` (taught as grammar, no flashcard) used to be a self-certification: the
 * manifest asserted the course taught the word, and nothing checked. Nine marks
 * turned out to be false. These tests are what stops that coming back.
 */
import { describe, expect, test } from 'bun:test';
import { addresses, goetheCoverage, MEASURED_LEVELS, taughtSurface } from '../src/lib/coverage';

const surface = taughtSurface();

describe('every "~" grammar claim is earned', () => {
  for (const level of MEASURED_LEVELS) {
    test(`${level}: no unearned grammar claims`, () => {
      // If this fails, the named word is marked "~" in the manifest but appears in
      // no article (outside its En/Ru blocks), no reading and no practice/drill item.
      // Teach it, or drop the "~" and give it a flashcard. Do not relax the matcher.
      expect(goetheCoverage(level).unearned).toEqual([]);
    });
  }
});

describe('the taught surface is the German the course teaches', () => {
  test('a word only named inside an English explanation is not taught', () => {
    // The exact case that let A1 claim `euer`: the possessive table stopped at the
    // `sie` row, and the word appeared only in English prose *about* German.
    expect(addresses('der mann gibt dem kind einen apfel', 'euer')).toBe(false);
  });

  test('a determiner is matched through its inflections, not only its citation form', () => {
    // No German sentence contains a bare `dieser` in every use, so a strict token
    // match would report the whole determiner set unearned.
    expect(addresses('ich nehme diesen apfel', 'dieser')).toBe(true);
    expect(addresses('ich sehe eure schwester', 'euer')).toBe(true);
  });

  test('a stem headword matches only real endings', () => {
    // `manch-` + an ending, never `manchmal` — the ending list is what keeps a
    // stem match from laundering an unrelated word that merely starts the same.
    expect(addresses('manche geschäfte nehmen kein bargeld', 'manch-')).toBe(true);
    expect(addresses('ich gehe manchmal ins kino', 'manch-')).toBe(false);
  });

  test('a phrase headword is matched after normalization, not before', () => {
    // `d.h.` has no space but folds to `d h`. Deciding phrase-vs-token on the raw
    // string takes the token branch and can never match anything.
    expect(addresses('das heißt d h wir bleiben zu hause', 'd.h.')).toBe(true);
    expect(addresses('wie viel kostet das', 'wie viel')).toBe(true);
    expect(addresses('wie teuer ist das', 'wie viel')).toBe(false);
  });

  test('the surface carries German from articles, readings and practice items', () => {
    // A sanity floor: if the surface builder silently read nothing (a renamed schema
    // field, say), every "~" would still pass by matching an empty string against
    // itself — so assert it actually found the German it claims to gather.
    expect(surface.length).toBeGreaterThan(100_000);
    expect(surface.split(' ')).toContain('dativ');
  });
});

describe('coverage arithmetic', () => {
  for (const level of MEASURED_LEVELS) {
    test(`${level}: cards + grammar + missing = total`, () => {
      const c = goetheCoverage(level);
      expect(c.cards + c.grammar + c.missing).toBe(c.total);
      expect(c.percent).toBe(Math.round(((c.cards + c.grammar) / c.total) * 100));
    });
  }

  test('a headword is matched case-sensitively against the decks', () => {
    // German case carries the lexeme, and the decks already teach four such pairs
    // as separate words: das Essen / essen, der Morgen / morgen, das Leben / leben,
    // das Fernsehen / fernsehen. The manifests add arm/Arm, weg/Weg, bitte/Bitte,
    // husten/Husten. Folding case in the deck lookup would mark each lowercase word
    // covered by the noun that merely shares its spelling — so the *surface* check
    // lowercases (a sentence capitalizes whatever starts it) and this one must not.
    const { ownedBy } = goetheCoverage('A2');
    for (const [upper, lower] of [
      ['Essen', 'essen'],
      ['Morgen', 'morgen'],
      ['Leben', 'leben'],
    ]) {
      expect(ownedBy.has(upper!)).toBe(true);
      expect(ownedBy.has(lower!)).toBe(true);
    }
  });
});
