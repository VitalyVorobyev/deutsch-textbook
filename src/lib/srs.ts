/** FSRS scheduling and deck building. */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { VocabEntry } from './schemas';
import type { StoredCard } from './store';

export { Rating, State };
export type { Grade };

export const scheduler = fsrs({ enable_fuzz: true });

// ---------------------------------------------------------------------------
// Card identity & deck building
// ---------------------------------------------------------------------------

export type Direction = 'de-x' | 'x-de';

/** Stable card id: vocab file id + German headword + direction.
    Renaming a headword resets that card's history — see CLAUDE.md. */
export function cardId(deckId: string, de: string, dir: Direction): string {
  return `${deckId}::${de}::${dir}`;
}

/** Everything a flashcard needs at review time, serializable as island props. */
export interface CardDef {
  id: string;
  deckId: string;
  dir: Direction;
  de: string;
  en: string;
  ru: string;
  /** display form with article/plural for nouns, aux+partizip for verbs */
  deDetail?: string;
  exampleDe: string;
  exampleEn: string;
  exampleRu: string;
  pos: string;
  /** nouns only — the typed answer must include the matching article */
  gender?: 'm' | 'f' | 'n';
}

function deDetail(e: VocabEntry): string | undefined {
  if (e.pos === 'noun' && e.plural) return `Plural: ${e.plural}`;
  if (e.pos === 'verb') {
    const parts: string[] = [];
    if (e.praesens_3sg) parts.push(`er/sie ${e.praesens_3sg}`);
    if (e.partizip2) parts.push(`${e.aux === 'sein' ? 'ist' : 'hat'} ${e.partizip2}`);
    if (e.valence) parts.push(e.valence);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (e.valence) return e.valence;
  return undefined;
}

export function buildDeck(deckId: string, entries: VocabEntry[]): CardDef[] {
  const cards: CardDef[] = [];
  for (const e of entries) {
    const base = {
      deckId,
      de: e.de,
      en: e.en,
      ru: e.ru,
      deDetail: deDetail(e),
      exampleDe: e.example_de,
      exampleEn: e.example_en,
      exampleRu: e.example_ru,
      pos: e.pos,
      gender: e.pos === 'noun' ? e.gender : undefined,
    };
    cards.push({ ...base, id: cardId(deckId, e.de, 'de-x'), dir: 'de-x' });
    cards.push({ ...base, id: cardId(deckId, e.de, 'x-de'), dir: 'x-de' });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// FSRS state (de)serialization
// ---------------------------------------------------------------------------

export function serializeCard(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

export function deserializeCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as Card['state'],
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

/** Grade a card (existing state or fresh) and return its next stored state. */
export function gradeCard(stored: StoredCard | undefined, grade: Grade, now = new Date()): StoredCard {
  const card = stored ? deserializeCard(stored) : createEmptyCard(now);
  const next = scheduler.next(card, now, grade);
  return serializeCard(next.card);
}

// ---------------------------------------------------------------------------
// Session queue
// ---------------------------------------------------------------------------

export interface QueueSplit {
  due: CardDef[];
  fresh: CardDef[];
}

/** Split a deck into due cards (have state, due <= now) and new cards (no state). */
export function splitQueue(
  cards: CardDef[],
  states: Record<string, StoredCard>,
  now = new Date(),
): QueueSplit {
  const due: CardDef[] = [];
  const fresh: CardDef[] = [];
  for (const c of cards) {
    const s = states[c.id];
    if (!s) fresh.push(c);
    else if (new Date(s.due) <= now) due.push(c);
  }
  return { due, fresh };
}
