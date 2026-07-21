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

/**
 * Merge two topic states field by field.
 *
 * NOTE: this rebuilds its output from the fields it knows, so **a field added to
 * `TopicProgress` and not added here is silently dropped on every import** — no error, no
 * warning, just a learner who reconnects a device and finds progress missing. Extend this
 * in the same change as the type.
 *
 * `placement` merges higher-score-wins, matching `setTopicPlacement`: a merge must never
 * be able to produce a state the writer itself could not, or a round-trip through export
 * and import could un-place a topic the writer had refused to un-place.
 */
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
    const placement =
      previous.placement && topic.placement
        ? topic.placement.score > previous.placement.score
          ? topic.placement
          : previous.placement
        : previous.placement ?? topic.placement;
    out[id] = {
      ...(readAt ? { readAt } : {}),
      ...(manual ? { manual, manualAt } : {}),
      ...(placement ? { placement } : {}),
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
