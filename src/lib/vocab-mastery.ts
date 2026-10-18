import { State } from 'ts-fsrs';
import { cardId, type CardRef, type Direction } from './srs';
import type { CardStates, StoredCard } from './store';

export const STRONG_INTERVAL_DAYS = 21;
export type WordMastery = 'new' | 'learning' | 'established' | 'strong';

export interface DirectionEvidence {
  direction: Direction;
  card?: StoredCard;
}

export interface WordRollup {
  key: string;
  deckId: string;
  de: string;
  status: WordMastery;
  /** true when the entry is `cards: recognition` — understood, never produced */
  recognitionOnly: boolean;
  due: boolean;
  directions: Record<Direction, DirectionEvidence>;
}

function started(card?: StoredCard): boolean {
  return !!card && card.reps > 0;
}

/**
 * Word status from its cards' FSRS state.
 *
 * The two-direction rule — "one direction unstarted means `learning`" — is right for an
 * ordinary entry and wrong for a `cards: recognition` one, whose production card does not
 * exist and never will. Applying it there would park every recognition-only word at
 * `learning` permanently, inflating that bucket with words the learner has fully learned to
 * the depth intended. Since the whole point of recognition-only entries is the B1 long
 * tail, that would be hundreds of words misreported, which is a calibration failure
 * introduced by a fix — grade a one-direction word on the direction it has.
 *
 * The caller says which case it is by passing the directions the entry actually has;
 * `rollupWords` reads that off the built deck rather than re-reading the schema.
 */
export function wordMastery(
  recognition?: StoredCard,
  production?: StoredCard,
  options: {
    /** false for a `cards: recognition` entry, whose x-de card was never built */
    hasProduction?: boolean;
  } = {},
): WordMastery {
  const hasProduction = options.hasProduction ?? true;
  const evidence = hasProduction ? [recognition, production] : [recognition];
  if (!evidence.some(started)) return 'new';
  if (!evidence.every(started)) return 'learning';
  if (evidence.some((card) => card!.state !== State.Review)) return 'learning';
  return Math.min(...evidence.map((card) => card!.scheduled_days)) >= STRONG_INTERVAL_DAYS
    ? 'strong'
    : 'established';
}

export function rollupWords(
  cards: readonly CardRef[],
  states: CardStates,
  now = new Date(),
): WordRollup[] {
  const grouped = new Map<string, CardRef[]>();
  for (const card of cards) {
    const key = `${card.deckId}::${card.de}`;
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }
  return [...grouped.entries()].map(([key, defs]) => {
    const recognitionDef = defs.find((card) => card.dir === 'de-x');
    const productionDef = defs.find((card) => card.dir === 'x-de');
    const recognition = recognitionDef ? states[recognitionDef.id] : undefined;
    const production = productionDef ? states[productionDef.id] : undefined;
    return {
      key,
      deckId: defs[0].deckId,
      de: defs[0].de,
      // `buildDeck` omits the x-de card for a `cards: recognition` entry, so the built deck
      // is the authority on which directions exist — no second read of the schema, and no
      // way for the two to disagree.
      status: wordMastery(recognition, production, { hasProduction: !!productionDef }),
      recognitionOnly: !productionDef,
      due: [recognition, production].some((card) => !!card && new Date(card.due) <= now),
      directions: {
        'de-x': { direction: 'de-x', card: recognition },
        'x-de': { direction: 'x-de', card: production },
      },
    };
  });
}

export type MasteryCounts = Record<WordMastery, number>;
export function masteryCounts(words: WordRollup[]): MasteryCounts {
  const counts: MasteryCounts = { new: 0, learning: 0, established: 0, strong: 0 };
  for (const word of words) counts[word.status]++;
  return counts;
}

/**
 * A deck reduced to what its mastery summary needs: the headwords, and which of them have no
 * production card. A page listing every deck ships this instead of the built cards — the cards
 * carry glosses, examples and notes, and /ueben/wortschatz once inlined 9 MB of them as island
 * props to draw one bar per deck.
 */
export interface DeckWords {
  id: string;
  words: string[];
  /** Headwords built without an x-de card (`cards: recognition`). */
  recognitionOnly: string[];
}

export function deckWords(deckId: string, cards: readonly CardRef[]): DeckWords {
  const words = [...new Set(cards.map((card) => card.de))];
  const produced = new Set(cards.filter((card) => card.dir === 'x-de').map((card) => card.de));
  return { id: deckId, words, recognitionOnly: words.filter((de) => !produced.has(de)) };
}

/** The card identities `deckWords` was built from, through the same `cardId` the deck uses. */
export function deckCardRefs({ id, words, recognitionOnly }: DeckWords): CardRef[] {
  const once = new Set(recognitionOnly);
  return words.flatMap((de): CardRef[] => [
    { id: cardId(id, de, 'de-x'), deckId: id, de, dir: 'de-x' },
    ...(once.has(de) ? [] : [{ id: cardId(id, de, 'x-de'), deckId: id, de, dir: 'x-de' as const }]),
  ]);
}

/** `deckWords` for every deck in a mixed card list, in first-seen deck order. */
export function decksOf(cards: readonly CardRef[]): DeckWords[] {
  const byDeck = new Map<string, CardRef[]>();
  for (const card of cards) byDeck.set(card.deckId, [...(byDeck.get(card.deckId) ?? []), card]);
  return [...byDeck].map(([deckId, deckCards]) => deckWords(deckId, deckCards));
}
