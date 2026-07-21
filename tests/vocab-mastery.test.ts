import { describe, expect, test } from 'bun:test';
import { State } from 'ts-fsrs';
import { rankDueCards, type CardDef } from '../src/lib/srs';
import type { StoredCard } from '../src/lib/store';
import { STRONG_INTERVAL_DAYS, wordMastery } from '../src/lib/vocab-mastery';

function state(overrides: Partial<StoredCard> = {}): StoredCard {
  return {
    due: '2026-01-01T00:00:00.000Z', stability: 10, difficulty: 5,
    elapsed_days: 1, scheduled_days: 7, learning_steps: 0, reps: 2,
    lapses: 0, state: State.Review, last_review: '2025-12-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('combined vocabulary mastery', () => {
  test('uses the weaker of recognition and production', () => {
    expect(wordMastery()).toBe('new');
    expect(wordMastery(state(), undefined)).toBe('learning');
    expect(wordMastery(state(), state({ state: State.Relearning }))).toBe('learning');
    expect(wordMastery(state(), state())).toBe('established');
    expect(wordMastery(
      state({ scheduled_days: STRONG_INTERVAL_DAYS }),
      state({ scheduled_days: STRONG_INTERVAL_DAYS + 10 }),
    )).toBe('strong');
  });

  test('due ranking is deterministic and puts the most overdue card first', () => {
    const card = (id: string): CardDef => ({
      id, deckId: 'd', dir: 'de-x', de: id, en: id, ru: id,
      exampleDe: '', exampleEn: '', exampleRu: '', pos: 'noun',
    });
    const cards = [card('later'), card('earlier')];
    const states = {
      later: state({ due: '2026-01-02T00:00:00.000Z' }),
      earlier: state({ due: '2026-01-01T00:00:00.000Z' }),
    };
    expect(rankDueCards(cards, states).map((c) => c.id)).toEqual(['earlier', 'later']);
  });
});

// `cards: recognition` exists because two-cards-per-entry does not survive B1: 1996 more
// Goethe-B1 headwords at two cards each is ~7230 cards and ~460 days of introduction at
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
    expect(wordMastery(state({ scheduled_days: STRONG_INTERVAL_DAYS }), undefined, opts))
      .toBe('strong');
  });

  test('an ordinary entry is unaffected — the missing production card still means learning', () => {
    expect(wordMastery(state({ scheduled_days: STRONG_INTERVAL_DAYS }), undefined)).toBe('learning');
  });
});
