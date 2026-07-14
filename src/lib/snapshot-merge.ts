import type {
  ArtifactFeedbackState,
  Attempt,
  CardStates,
  SessionLogEntry,
  StoredCard,
  TopicsState,
} from './store';

const attemptKey = (attempt: Attempt) => `${attempt.setId}|${attempt.itemId}|${attempt.ts}`;

export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const seen = new Set(a.map(attemptKey));
  const out = [...a];
  for (const attempt of b) {
    const key = attemptKey(attempt);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(attempt);
    }
  }
  return out.sort((x, y) => x.ts - y.ts);
}

export function moreAdvancedCard(x: StoredCard, y: StoredCard): StoredCard {
  const xReviewed = x.last_review ? Date.parse(x.last_review) : 0;
  const yReviewed = y.last_review ? Date.parse(y.last_review) : 0;
  if (xReviewed !== yReviewed) return xReviewed > yReviewed ? x : y;
  if (x.reps !== y.reps) return x.reps > y.reps ? x : y;
  return x.stability >= y.stability ? x : y;
}

export function mergeCards(a: CardStates, b: CardStates): CardStates {
  const out: CardStates = { ...a };
  for (const [id, card] of Object.entries(b)) {
    out[id] = out[id] ? moreAdvancedCard(out[id], card) : card;
  }
  return out;
}

const sessionKey = (session: SessionLogEntry) => `${session.date}|${session.ts}`;

export function mergeSessions(a: SessionLogEntry[], b: SessionLogEntry[]): SessionLogEntry[] {
  const seen = new Set(a.map(sessionKey));
  const out = [...a];
  for (const session of b) {
    const key = sessionKey(session);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(session);
    }
  }
  return out.sort((x, y) => x.ts - y.ts);
}

export function mergeTopics(a: TopicsState, b: TopicsState): TopicsState {
  const out: TopicsState = { ...a };
  for (const [id, topic] of Object.entries(b)) {
    const previous = out[id];
    if (!previous) {
      out[id] = topic;
      continue;
    }
    const readAt = Math.max(previous.readAt ?? 0, topic.readAt ?? 0) || undefined;
    const newerManual = (topic.manualAt ?? 0) > (previous.manualAt ?? 0);
    const manual = newerManual ? topic.manual : previous.manual;
    const manualAt = newerManual ? topic.manualAt : previous.manualAt;
    out[id] = {
      ...(readAt ? { readAt } : {}),
      ...(manual ? { manual, manualAt } : {}),
    };
  }
  return out;
}

export function mergeFeedback(
  a: ArtifactFeedbackState,
  b: ArtifactFeedbackState,
): ArtifactFeedbackState {
  const out = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    if (!out[id] || entry.ts > out[id].ts) out[id] = entry;
  }
  return out;
}
