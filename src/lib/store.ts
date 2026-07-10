/** IndexedDB-backed progress store (client-side only), namespaced per profile. */
import { createStore, get, set, update, clear, type UseStore } from 'idb-keyval';
import { getActiveProfileId, dbNameFor } from './profile';
import { scheduleAutoSync } from './autosync';

// ---------------------------------------------------------------------------
// Profile-aware store handle
// ---------------------------------------------------------------------------

// One idb-keyval store per profile, memoized so we don't reopen the IndexedDB
// connection on every operation. The active profile is read inside each call
// (not at module load) so a mid-session profile switch + reload picks the right
// database. The default profile aliases the legacy `deutsch-atlas` DB.
const stores = new Map<string, UseStore>();

function getStore(): UseStore {
  const id = getActiveProfileId();
  let s = stores.get(id);
  if (!s) {
    s = createStore(dbNameFor(id), 'progress');
    stores.set(id, s);
  }
  return s;
}

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
  await update<Attempt[]>('attempts', (arr) => [...(arr ?? []), attempt], getStore());
  scheduleAutoSync();
}

export async function getAttempts(): Promise<Attempt[]> {
  return (await get<Attempt[]>('attempts', getStore())) ?? [];
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
  return (await get<CardStates>('cards', getStore())) ?? {};
}

export async function setCardState(cardId: string, card: StoredCard): Promise<void> {
  await update<CardStates>('cards', (m) => ({ ...(m ?? {}), [cardId]: card }), getStore());
  scheduleAutoSync();
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
  await update<SessionLogEntry[]>('sessions', (arr) => [...(arr ?? []), entry], getStore());
  scheduleAutoSync();
}

export async function getSessionLog(): Promise<SessionLogEntry[]> {
  return (await get<SessionLogEntry[]>('sessions', getStore())) ?? [];
}

export async function sessionDoneToday(): Promise<boolean> {
  const today = localDateString();
  return (await getSessionLog()).some((e) => e.date === today);
}

// ---------------------------------------------------------------------------
// Topic completion (persisted): the "read" signal + the manual learned override.
// Derived tiers (read/practiced/mastered) are computed in src/lib/mastery.ts.
// ---------------------------------------------------------------------------

export type TopicManual = 'learned' | 'reopened';

export interface TopicProgress {
  /** epoch ms the article was first opened */
  readAt?: number;
  /** manual override set by the learner */
  manual?: TopicManual;
  /** epoch ms the manual override was last changed (for merge last-write-wins) */
  manualAt?: number;
}

export type TopicsState = Record<string, TopicProgress>;

export async function getTopicsState(): Promise<TopicsState> {
  return (await get<TopicsState>('topics', getStore())) ?? {};
}

/** Mark a topic's article as read. Idempotent — keeps the earliest readAt. */
export async function markTopicRead(topicId: string, ts = Date.now()): Promise<void> {
  await update<TopicsState>(
    'topics',
    (m) => {
      const cur = m ?? {};
      if (cur[topicId]?.readAt) return cur;
      return { ...cur, [topicId]: { ...cur[topicId], readAt: ts } };
    },
    getStore(),
  );
  scheduleAutoSync();
}

/** Set (or clear, with null) the manual learned/reopened override for a topic. */
export async function setTopicManual(
  topicId: string,
  manual: TopicManual | null,
  ts = Date.now(),
): Promise<void> {
  await update<TopicsState>(
    'topics',
    (m) => {
      const cur = m ?? {};
      const prev = cur[topicId] ?? {};
      const next: TopicProgress = { ...prev };
      if (manual === null) {
        delete next.manual;
        delete next.manualAt;
      } else {
        next.manual = manual;
        next.manualAt = ts;
      }
      return { ...cur, [topicId]: next };
    },
    getStore(),
  );
  scheduleAutoSync();
}

// ---------------------------------------------------------------------------
// Export / import (the agent personalization loop reads these snapshots)
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  /** written as 3; import accepts 1 (pre-sessions), 2 (pre-topics), 3 */
  version: number;
  exportedAt: string;
  /** profile label, informational only */
  profile?: string;
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
  topics: TopicsState;
}

export async function exportSnapshot(profile?: string): Promise<ProgressSnapshot> {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    profile,
    attempts: await getAttempts(),
    cards: await getCardStates(),
    sessions: await getSessionLog(),
    topics: await getTopicsState(),
  };
}

function isValidSnapshot(s: unknown): s is ProgressSnapshot {
  if (!s || typeof s !== 'object') return false;
  const snap = s as Partial<ProgressSnapshot>;
  const v = snap.version;
  return (
    (v === 1 || v === 2 || v === 3) &&
    Array.isArray(snap.attempts) &&
    typeof snap.cards === 'object' &&
    snap.cards !== null
  );
}

// --- merge helpers (pure) ---------------------------------------------------

function attemptKey(a: Attempt): string {
  return `${a.setId}|${a.itemId}|${a.ts}`;
}

function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const seen = new Set(a.map(attemptKey));
  const out = [...a];
  for (const x of b) {
    const k = attemptKey(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  out.sort((x, y) => x.ts - y.ts);
  return out;
}

/** Keep the more-advanced FSRS state: later last_review, then reps, then stability. */
function moreAdvancedCard(x: StoredCard, y: StoredCard): StoredCard {
  const lx = x.last_review ? Date.parse(x.last_review) : 0;
  const ly = y.last_review ? Date.parse(y.last_review) : 0;
  if (lx !== ly) return lx > ly ? x : y;
  if (x.reps !== y.reps) return x.reps > y.reps ? x : y;
  return x.stability >= y.stability ? x : y;
}

function mergeCards(a: CardStates, b: CardStates): CardStates {
  const out: CardStates = { ...a };
  for (const [id, card] of Object.entries(b)) {
    out[id] = out[id] ? moreAdvancedCard(out[id], card) : card;
  }
  return out;
}

function sessionKey(s: SessionLogEntry): string {
  return `${s.date}|${s.ts}`;
}

function mergeSessions(a: SessionLogEntry[], b: SessionLogEntry[]): SessionLogEntry[] {
  const seen = new Set(a.map(sessionKey));
  const out = [...a];
  for (const s of b) {
    const k = sessionKey(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  out.sort((x, y) => x.ts - y.ts);
  return out;
}

function mergeTopics(a: TopicsState, b: TopicsState): TopicsState {
  const out: TopicsState = { ...a };
  for (const [id, tp] of Object.entries(b)) {
    const prev = out[id];
    if (!prev) {
      out[id] = tp;
      continue;
    }
    const readAt = Math.max(prev.readAt ?? 0, tp.readAt ?? 0) || undefined;
    let manual = prev.manual;
    let manualAt = prev.manualAt;
    if ((tp.manualAt ?? 0) > (prev.manualAt ?? 0)) {
      manual = tp.manual;
      manualAt = tp.manualAt;
    }
    out[id] = {
      ...(readAt ? { readAt } : {}),
      ...(manual ? { manual, manualAt } : {}),
    };
  }
  return out;
}

/**
 * Non-destructive merge: unions attempts/sessions (dedup), keeps the
 * more-advanced card state, and last-write-wins for topic manual overrides.
 * This is the default import so two devices/profiles don't clobber each other.
 */
export async function mergeSnapshot(snapshot: ProgressSnapshot): Promise<void> {
  if (!isValidSnapshot(snapshot)) throw new Error('Not a valid Deutsch-Atlas progress snapshot');
  const store = getStore();
  await update<Attempt[]>('attempts', (cur) => mergeAttempts(cur ?? [], snapshot.attempts), store);
  await update<CardStates>('cards', (cur) => mergeCards(cur ?? {}, snapshot.cards), store);
  await update<SessionLogEntry[]>(
    'sessions',
    (cur) => mergeSessions(cur ?? [], snapshot.sessions ?? []),
    store,
  );
  await update<TopicsState>('topics', (cur) => mergeTopics(cur ?? {}, snapshot.topics ?? {}), store);
  scheduleAutoSync();
}

/** Destructive: replaces the whole store with the snapshot's contents. */
export async function replaceSnapshot(snapshot: ProgressSnapshot): Promise<void> {
  if (!isValidSnapshot(snapshot)) throw new Error('Not a valid Deutsch-Atlas progress snapshot');
  const store = getStore();
  await clear(store);
  await set('attempts', snapshot.attempts, store);
  await set('cards', snapshot.cards, store);
  await set('sessions', Array.isArray(snapshot.sessions) ? snapshot.sessions : [], store);
  await set(
    'topics',
    snapshot.topics && typeof snapshot.topics === 'object' ? snapshot.topics : {},
    store,
  );
  scheduleAutoSync();
}

/** Default import path — non-destructive merge. */
export const importSnapshot = mergeSnapshot;
