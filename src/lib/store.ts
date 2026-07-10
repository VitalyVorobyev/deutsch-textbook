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
// Daily session log ("done today" state + cadence history for the agent loop)
// ---------------------------------------------------------------------------

export interface SessionLogEntry {
  /** local calendar date, YYYY-MM-DD */
  date: string;
  /** cards reviewed in step 1 (null = step was skipped) */
  reviewed: number | null;
  /** exercise items answered in step 2 */
  trained: number;
  ts: number;
}

/** Local calendar date — not UTC, so a late-evening session still counts for its own day. */
export function localDateString(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function logSession(entry: SessionLogEntry): Promise<void> {
  await update<SessionLogEntry[]>('sessions', (arr) => [...(arr ?? []), entry], store);
}

export async function getSessionLog(): Promise<SessionLogEntry[]> {
  return (await get<SessionLogEntry[]>('sessions', store)) ?? [];
}

export async function sessionDoneToday(): Promise<boolean> {
  const today = localDateString();
  return (await getSessionLog()).some((e) => e.date === today);
}

// ---------------------------------------------------------------------------
// Export / import (the agent personalization loop reads these snapshots)
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  version: 2;
  exportedAt: string;
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
}

export async function exportSnapshot(): Promise<ProgressSnapshot> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    attempts: await getAttempts(),
    cards: await getCardStates(),
    sessions: await getSessionLog(),
  };
}

/** Replaces the whole store with the snapshot's contents. Accepts v1 (pre-sessions) and v2. */
export async function importSnapshot(snapshot: ProgressSnapshot): Promise<void> {
  const version: number = snapshot.version;
  if (
    (version !== 1 && version !== 2) ||
    !Array.isArray(snapshot.attempts) ||
    typeof snapshot.cards !== 'object'
  ) {
    throw new Error('Not a valid Deutsch-Atlas progress snapshot');
  }
  await clear(store);
  await set('attempts', snapshot.attempts, store);
  await set('cards', snapshot.cards, store);
  await set('sessions', Array.isArray(snapshot.sessions) ? snapshot.sessions : [], store);
}
