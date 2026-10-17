import { describe, expect, test } from 'bun:test';
import { State } from 'ts-fsrs';
import { buildDeck, rankDueCards, type CardDef } from '../src/lib/srs';
import type { StoredCard } from '../src/lib/store';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import {
  deckCardRefs,
  deckWords,
  decksOf,
  rollupWords,
  STRONG_INTERVAL_DAYS,
  wordMastery,
} from '../src/lib/vocab-mastery';

function state(overrides: Partial<StoredCard> = {}): StoredCard {
  return {
    due: '2026-01-01T00:00:00.000Z',
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 7,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: State.Review,
    last_review: '2025-12-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('combined vocabulary mastery', () => {
  test('uses the weaker of recognition and production', () => {
    expect(wordMastery()).toBe('new');
    expect(wordMastery(state(), undefined)).toBe('learning');
    expect(wordMastery(state(), state({ state: State.Relearning }))).toBe('learning');
    expect(wordMastery(state(), state())).toBe('established');
    expect(
      wordMastery(
        state({ scheduled_days: STRONG_INTERVAL_DAYS }),
        state({ scheduled_days: STRONG_INTERVAL_DAYS + 10 }),
      ),
    ).toBe('strong');
  });

  test('due ranking is deterministic and puts the most overdue card first', () => {
    const card = (id: string): CardDef => ({
      id,
      deckId: 'd',
      dir: 'de-x',
      de: id,
      en: id,
      ru: id,
      exampleDe: '',
      exampleEn: '',
      exampleRu: '',
      pos: 'noun',
    });
    const cards = [card('later'), card('earlier')];
    const states = {
      later: state({ due: '2026-01-02T00:00:00.000Z' }),
      earlier: state({ due: '2026-01-01T00:00:00.000Z' }),
    };
    expect(rankDueCards(cards, states).map((c) => c.id)).toEqual(['earlier', 'later']);
  });
});

// `cards: recognition` exists because two-cards-per-entry does not survive B1: the 1694
// Goethe-B1 headwords still missing (`bun scripts/coverage.ts B1`) at two cards each is
// ~3400 cards on top of today's 3742, i.e. ~460 days of introduction at
// DAILY_NEW_CARDS = 15. The mechanism has two hazards, and both are pinned here.
describe('recognition-only entries', () => {
  test('a one-direction word is graded on the direction it has', () => {
    // Without this the two-direction rule parks every recognition-only word at `learning`
    // forever — "one direction unstarted" is exactly how that state is defined — and the
    // B1 long tail would report hundreds of fully-learned words as half-learned.
    const opts = { hasProduction: false };
    expect(wordMastery(undefined, undefined, opts)).toBe('new');
    expect(wordMastery(state({ state: State.Learning }), undefined, opts)).toBe('learning');
    expect(wordMastery(state({ scheduled_days: 7 }), undefined, opts)).toBe('established');
    expect(wordMastery(state({ scheduled_days: STRONG_INTERVAL_DAYS }), undefined, opts)).toBe(
      'strong',
    );
  });

  test('an ordinary entry is unaffected — the missing production card still means learning', () => {
    expect(wordMastery(state({ scheduled_days: STRONG_INTERVAL_DAYS }), undefined)).toBe(
      'learning',
    );
  });
});

// Codex review, PR #92: `recognitionOnly` was computed and never consumed. The per-deck
// page (/vocab/[id] → VocabWordTable) iterated both directions unconditionally and rendered
// the absent x-de card as "not started", so exactly the words this feature exists for —
// the unowned Wortliste completion decks, which never render VocabTable.astro — looked
// permanently half-finished. The rollup has to carry the flag for the UI to act on.
describe('rollupWords reports which words have no production card', () => {
  const entry = {
    de: 'Zuschlag',
    pos: 'noun',
    gender: 'm',
    plural: 'die Zuschläge',
    ipa: 'ˈtsuːʃlaːk',
    en: 'surcharge',
    ru: 'доплата',
    example_de: 'Der Zuschlag kostet drei Euro.',
    example_en: 'The surcharge costs three euros.',
    example_ru: 'Доплата стоит три евро.',
  };

  test('a recognition-only entry is flagged and has no x-de direction', () => {
    const cards = buildDeck('d', [{ ...entry, cards: 'recognition' }] as never);
    const [word] = rollupWords(cards, {});
    expect(word!.recognitionOnly).toBe(true);
    expect(word!.directions['x-de'].card).toBeUndefined();
  });

  test('an ordinary entry is not flagged', () => {
    const cards = buildDeck('d', [{ ...entry, cards: 'both' }] as never);
    const [word] = rollupWords(cards, {});
    expect(word!.recognitionOnly).toBe(false);
  });
});

// /ueben/wortschatz ships each deck as headwords plus its recognition-only list and rebuilds the
// card ids in the browser, instead of inlining the built cards (9 MB of island props, P23-1).
// A rebuilt id that differs from the built one would read no state and show a mastered word as
// new — silently, since the bar still renders.
describe('deckWords → deckCardRefs rebuilds exactly the built cards', () => {
  const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);
  const entry = (de: string, cards: 'both' | 'recognition') => ({
    de,
    pos: 'noun',
    gender: 'm',
    plural: `die ${de}e`,
    ipa: 'x',
    en: de,
    ru: 'слово',
    cards,
    example_de: `Der ${de}.`,
    example_en: `The ${de}.`,
    example_ru: 'Слово.',
  });

  test('a mixed deck: one card for a recognition-only word, two for the rest, in deck order', () => {
    const built = buildDeck('d', [
      entry('Tisch', 'both'),
      entry('Zuschlag', 'recognition'),
      entry('Stuhl', 'both'),
    ] as never);
    const deck = deckWords('d', built);
    expect(deck).toEqual({
      id: 'd',
      words: ['Tisch', 'Zuschlag', 'Stuhl'],
      recognitionOnly: ['Zuschlag'],
    });
    expect(ids(deckCardRefs(deck))).toEqual(ids(built));
  });

  test('decksOf splits a mixed card list by deck, and the refs come back in the same order', () => {
    const built = [
      ...buildDeck('a', [entry('Tisch', 'both'), entry('Zuschlag', 'recognition')] as never),
      ...buildDeck('b', [entry('Stuhl', 'both')] as never),
    ];
    const decks = decksOf(built);
    expect(decks.map((d) => d.id)).toEqual(['a', 'b']);
    expect(ids(decks.flatMap(deckCardRefs))).toEqual(ids(built));
  });

  test('for every deck in the corpus', () => {
    type Entry = Parameters<typeof buildDeck>[1][number];
    const root = join(process.cwd(), 'content', 'vocab');
    const files = readdirSync(root).filter((f) => f.endsWith('.yaml'));
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) {
      const { id, entries } = YAML.parse(readFileSync(join(root, f), 'utf8')) as {
        id: string;
        entries: Entry[];
      };
      const built = buildDeck(id, entries);
      expect({ id, cards: ids(deckCardRefs(deckWords(id, built))) }).toEqual({
        id,
        cards: ids(built),
      });
    }
  });
});
