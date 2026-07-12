import { State } from 'ts-fsrs';
import type { CardDef, Direction } from './srs';
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
  pos: string;
  status: WordMastery;
  due: boolean;
  directions: Record<Direction, DirectionEvidence>;
}

function started(card?: StoredCard): boolean {
  return !!card && card.reps > 0;
}

export function wordMastery(recognition?: StoredCard, production?: StoredCard): WordMastery {
  if (!started(recognition) && !started(production)) return 'new';
  if (!started(recognition) || !started(production)) return 'learning';
  if (recognition!.state !== State.Review || production!.state !== State.Review) return 'learning';
  return Math.min(recognition!.scheduled_days, production!.scheduled_days) >= STRONG_INTERVAL_DAYS
    ? 'strong'
    : 'established';
}

export function rollupWords(cards: CardDef[], states: CardStates, now = new Date()): WordRollup[] {
  const grouped = new Map<string, CardDef[]>();
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
      pos: defs[0].pos,
      status: wordMastery(recognition, production),
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
