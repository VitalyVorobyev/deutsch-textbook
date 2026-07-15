/** IndexedDB-backed progress store (client-side only), namespaced per profile. */
import { createStore, get, set, update, clear, type UseStore } from 'idb-keyval';
import { getActiveProfileId, dbNameFor, resolveProfileState, type ProfileRecord } from './profile';
import { scheduleAutoSync } from './autosync';
import { isProgressSnapshot, parseProgressSnapshot } from './snapshot-schema';
import {
  mergeAttempts,
  mergeCards,
  mergeFeedback,
  mergeSessions,
  mergeTopics,
} from './snapshot-merge';

// ---------------------------------------------------------------------------
// Profile-aware store handle
// ---------------------------------------------------------------------------

// One idb-keyval store per profile, memoized so we don't reopen the IndexedDB
// connection on every operation. The active profile is read inside each call
// (not at module load) so a mid-session profile switch + reload picks the right
// database. The legacy profile aliases the pre-profile `deutsch-atlas` DB.
const stores = new Map<string, UseStore>();

// Awaits the first-run/legacy decision before touching IndexedDB: creating a
// store here would otherwise race the legacy-DB detection in profile.ts (e.g.
// markTopicRead fires on topic-page mount with no user interaction). While the
// first-run gate is up there is no profile to own a write, so park forever —
// creating the profile reloads the page, which discards parked operations.
async function getStore(): Promise<UseStore> {
  if ((await resolveProfileState()) === 'first-run') {
    await new Promise<never>(() => {});
  }
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
  /** Authored task contract used for this attempt; absent on v1-v4 history. */
  itemRevision?: number;
  /** fully correct (partial credit lives in correctParts/totalParts) */
  correct: boolean;
  /** parts answered correctly, for multi-part items (cloze gaps, match pairs, table cells) */
  correctParts?: number;
  /** parts asked; ≥ 1 when present — emitters and snapshot import both enforce it */
  totalParts?: number;
  /** what the learner entered/chose, for the personalization loop */
  given: string;
  /** the item's confusion tag (see focus-tag table in CLAUDE.md), when tagged */
  focus?: string;
  /** omitted in historical snapshots; absence means verified */
  evidence?: 'verified' | 'practice';
  /** actual response channel; absent in historical snapshots */
  responseMode?: 'selection' | 'writing' | 'listening' | 'spoken-production' | 'spoken-interaction';
  /** stable curriculum outcome ids exercised by this attempt */
  outcomes?: string[];
  /** Structured open-production evidence. Never contributes verified accuracy. */
  practice?: PracticePayload;
  ts: number;
}

export type CriterionAssessment = 'met' | 'needs-work';

export type PracticePayload =
  | {
      kind: 'writing';
      draft: string;
      revision: string;
      /** Legacy only: the retired staged self-assessment logged these; nothing writes them now. */
      before?: CriterionAssessment[];
      after?: CriterionAssessment[];
    }
  | {
      kind: 'speaking';
      recorded: boolean;
      /** Legacy only: the retired staged self-assessment logged these; nothing writes them now. */
      before?: CriterionAssessment[];
      after?: CriterionAssessment[];
    };

/** Write boundary: historical attempts may omit a revision; newly logged ones may not. */
export type NewAttempt = Omit<Attempt, 'itemRevision'> & { itemRevision: number };

export async function logAttempt(attempt: NewAttempt): Promise<void> {
  await update<Attempt[]>('attempts', (arr) => [...(arr ?? []), attempt], await getStore());
  scheduleAutoSync();
}

export async function getAttempts(): Promise<Attempt[]> {
  return (await get<Attempt[]>('attempts', await getStore())) ?? [];
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
  /** Local date this card was first ever graded (YYYY-MM-DD) — the daily new-card
      budget counts these. Stamped once by `gradeCard`, never updated. Absent on
      cards introduced before the field existed, which reads correctly as "not
      today". See `introducedToday` in srs.ts for why FSRS's own fields cannot
      answer this. */
  introducedAt?: string;
}

export type CardStates = Record<string, StoredCard>;

export async function getCardStates(): Promise<CardStates> {
  return (await get<CardStates>('cards', await getStore())) ?? {};
}

export async function setCardState(cardId: string, card: StoredCard): Promise<void> {
  await update<CardStates>('cards', (m) => ({ ...(m ?? {}), [cardId]: card }), await getStore());
  scheduleAutoSync();
}

// ---------------------------------------------------------------------------
// Active curriculum goal (profile-scoped and snapshot-synced)
// ---------------------------------------------------------------------------

export interface LearningGoal {
  /** absent is a timestamped clear marker, so clearing also merges across devices */
  topicId?: string;
  setAt: number;
}

export async function getLearningGoal(): Promise<LearningGoal | undefined> {
  return await get<LearningGoal>('goal', await getStore());
}

export async function setLearningGoal(goal: LearningGoal): Promise<void> {
  await set('goal', goal, await getStore());
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
  await update<SessionLogEntry[]>('sessions', (arr) => [...(arr ?? []), entry], await getStore());
  scheduleAutoSync();
}

export async function getSessionLog(): Promise<SessionLogEntry[]> {
  return (await get<SessionLogEntry[]>('sessions', await getStore())) ?? [];
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
  return (await get<TopicsState>('topics', await getStore())) ?? {};
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
    await getStore(),
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
    await getStore(),
  );
  scheduleAutoSync();
}

// ---------------------------------------------------------------------------
// Optional-artifact feedback (engagement/editorial signal, never mastery)
// ---------------------------------------------------------------------------

export interface ArtifactFeedback {
  artifactId: string;
  difficulty?: 'too-easy' | 'comfortable' | 'too-hard';
  useful?: boolean;
  wantsMore?: boolean;
  ts: number;
}

export type ArtifactFeedbackState = Record<string, ArtifactFeedback>;

export async function getArtifactFeedback(): Promise<ArtifactFeedbackState> {
  return (await get<ArtifactFeedbackState>('feedback', await getStore())) ?? {};
}

export async function setArtifactFeedback(
  entry: Omit<ArtifactFeedback, 'ts'>,
): Promise<ArtifactFeedback> {
  const stamped = { ...entry, ts: Date.now() };
  await update<ArtifactFeedbackState>(
    'feedback',
    (current) => ({ ...(current ?? {}), [stamped.artifactId]: stamped }),
    await getStore(),
  );
  scheduleAutoSync();
  return stamped;
}

// ---------------------------------------------------------------------------
// Export / import (the agent personalization loop reads these snapshots)
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  /** written as 5; import accepts v1-v5 through explicit migration. */
  version: 5;
  exportedAt: string;
  /** profile label, informational only */
  profile?: string;
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
  topics: TopicsState;
  goal?: LearningGoal;
  feedback: ArtifactFeedbackState;
}

export async function exportSnapshot(profile?: string): Promise<ProgressSnapshot> {
  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    profile,
    attempts: await getAttempts(),
    cards: await getCardStates(),
    sessions: await getSessionLog(),
    topics: await getTopicsState(),
    goal: await getLearningGoal(),
    feedback: await getArtifactFeedback(),
  };
}

export function isValidSnapshot(s: unknown): boolean {
  return isProgressSnapshot(s);
}

/** Strip malformed partial-credit fields so attemptScore() can trust totalParts ≥ 1. */
export function sanitizeAttempts(attempts: Attempt[]): Attempt[] {
  return attempts.map((a) => {
    if (a.correctParts === undefined && a.totalParts === undefined) return a;
    if (
      typeof a.correctParts === 'number' &&
      typeof a.totalParts === 'number' &&
      Number.isFinite(a.correctParts) &&
      a.correctParts >= 0 &&
      a.totalParts >= 1
    ) {
      return a;
    }
    const { correctParts: _cp, totalParts: _tp, ...rest } = a;
    return rest;
  });
}

/**
 * Non-destructive merge: unions attempts/sessions (dedup), keeps the
 * more-advanced card state, and last-write-wins for topic manual overrides.
 * This is the default import so two devices/profiles don't clobber each other.
 */
export async function mergeSnapshot(snapshot: unknown): Promise<void> {
  const migrated = parseProgressSnapshot(snapshot);
  const store = await getStore();
  await update<Attempt[]>(
    'attempts',
    (cur) => mergeAttempts(cur ?? [], sanitizeAttempts(migrated.attempts)),
    store,
  );
  await update<CardStates>('cards', (cur) => mergeCards(cur ?? {}, migrated.cards), store);
  await update<SessionLogEntry[]>(
    'sessions',
    (cur) => mergeSessions(cur ?? [], migrated.sessions),
    store,
  );
  await update<TopicsState>('topics', (cur) => mergeTopics(cur ?? {}, migrated.topics), store);
  await update<ArtifactFeedbackState>(
    'feedback',
    (cur) => mergeFeedback(cur ?? {}, migrated.feedback),
    store,
  );
  if (migrated.goal) {
    await update<LearningGoal | undefined>(
      'goal',
      (cur) => (!cur || migrated.goal!.setAt > cur.setAt ? migrated.goal : cur),
      store,
    );
  }
  scheduleAutoSync();
}

/** Destructive: replaces the whole store with the snapshot's contents. */
export async function replaceSnapshot(snapshot: unknown): Promise<void> {
  const migrated = parseProgressSnapshot(snapshot);
  const store = await getStore();
  // The identity record names this database for discovery — it outlives its contents.
  const identity = await get<ProfileRecord>('profile', store);
  await clear(store);
  if (identity) await set('profile', identity, store);
  await set('attempts', sanitizeAttempts(migrated.attempts), store);
  await set('cards', migrated.cards, store);
  await set('sessions', migrated.sessions, store);
  await set('topics', migrated.topics, store);
  await set('feedback', migrated.feedback, store);
  if (migrated.goal) await set('goal', migrated.goal, store);
  scheduleAutoSync();
}

/** Default import path — non-destructive merge. */
export const importSnapshot = mergeSnapshot;
