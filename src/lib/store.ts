/** IndexedDB-backed progress store (client-side only). */
import { createStore, get, set, update, clear } from 'idb-keyval';

const store = createStore('deutsch-atlas', 'progress');

// ---------------------------------------------------------------------------
// Exercise attempts
// ---------------------------------------------------------------------------

export interface Attempt {
  /** exercise set id, e.g. "a2/perfekt-haben-sein" */
  setId: string;
  itemId: string;
  itemType: string;
  correct: boolean;
  /** what the learner entered/chose, for the personalization loop */
  given: string;
  /** the item's confusion tag (see focus-tag table in CLAUDE.md), when tagged */
  focus?: string;
  ts: number;
}

export async function logAttempt(attempt: Attempt): Promise<void> {
  await update<Attempt[]>('attempts', (arr) => [...(arr ?? []), attempt], store);
}

export async function getAttempts(): Promise<Attempt[]> {
  return (await get<Attempt[]>('attempts', store)) ?? [];
}

// ---------------------------------------------------------------------------
// FSRS card states (serialized ts-fsrs Card objects, dates as ISO strings)
// ---------------------------------------------------------------------------

export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export type CardStates = Record<string, StoredCard>;

export async function getCardStates(): Promise<CardStates> {
  return (await get<CardStates>('cards', store)) ?? {};
}

export async function setCardState(cardId: string, card: StoredCard): Promise<void> {
  await update<CardStates>('cards', (m) => ({ ...(m ?? {}), [cardId]: card }), store);
}

// ---------------------------------------------------------------------------
// Export / import (the agent personalization loop reads these snapshots)
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  version: 1;
  exportedAt: string;
  attempts: Attempt[];
  cards: CardStates;
}

export async function exportSnapshot(): Promise<ProgressSnapshot> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    attempts: await getAttempts(),
    cards: await getCardStates(),
  };
}

/** Replaces the whole store with the snapshot's contents. */
export async function importSnapshot(snapshot: ProgressSnapshot): Promise<void> {
  if (snapshot.version !== 1 || !Array.isArray(snapshot.attempts) || typeof snapshot.cards !== 'object') {
    throw new Error('Not a valid Deutsch-Atlas progress snapshot');
  }
  await clear(store);
  await set('attempts', snapshot.attempts, store);
  await set('cards', snapshot.cards, store);
}
