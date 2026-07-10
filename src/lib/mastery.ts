/** Topic completion tiers derived from the attempt/card log + persisted read/manual state. */
import type { Attempt, CardStates, TopicsState, TopicManual } from './store';

/** The minimum a topic needs for its progress to be rolled up. */
export interface TopicRollup {
  /** topic id (frontmatter id) */
  id: string;
  /** exercise set ids belonging to this topic */
  exerciseSets: string[];
  /** vocab file ids whose decks belong to this topic */
  vocabIds: string[];
  /** reading ids belonging to this topic (attempts log under `reading:<id>`) */
  readingIds: string[];
  /** pretest set id, if any */
  pretestId?: string;
}

export interface TopicNode extends TopicRollup {
  /** route path, e.g. "/topics/a2/perfekt-haben-sein" */
  path: string;
  level: string;
  kind: string;
  title_de: string;
  title_en: string;
  title_ru: string;
  prerequisites: string[];
}

export type Tier = 'untouched' | 'read' | 'practiced' | 'mastered';
const TIER_ORDER: Record<Tier, number> = { untouched: 0, read: 1, practiced: 2, mastered: 3 };

const MASTERY_WINDOW = 10;
const MASTERY_MIN_ATTEMPTS = 5;
const MASTERY_ACCURACY = 0.8;

/** Every attempt setId keying that belongs to this topic: exercises, pretest, and reading:<id>. */
export function topicSetIds(node: TopicRollup): string[] {
  return [
    ...node.exerciseSets,
    ...node.readingIds.map((id) => `reading:${id}`),
    ...(node.pretestId ? [node.pretestId] : []),
  ];
}

/** Cards that belong to this topic — cardId is `<vocabId>::<de>::<dir>`. */
function topicCardIds(node: TopicRollup, cards: CardStates): string[] {
  return Object.keys(cards).filter((k) => node.vocabIds.some((v) => k.startsWith(`${v}::`)));
}

export interface TopicContext {
  attempts: Attempt[];
  cards: CardStates;
  topics: TopicsState;
}

/**
 * Auto tier from real activity (ignores the manual override):
 *  read      — article opened;
 *  practiced — ≥1 exercise/reading/pretest attempt;
 *  mastered  — recent accuracy ≥ threshold AND (if the topic has vocab) ≥1 card reviewed.
 */
export function topicTier(node: TopicRollup, ctx: TopicContext): Tier {
  const setIds = new Set(topicSetIds(node));
  const own = ctx.attempts.filter((a) => setIds.has(a.setId));
  const read = !!ctx.topics[node.id]?.readAt;

  if (own.length > 0) {
    const recent = own.slice(-MASTERY_WINDOW);
    const accuracy = recent.filter((a) => a.correct).length / recent.length;
    const hasVocab = node.vocabIds.length > 0;
    const cardReviewed =
      !hasVocab || topicCardIds(node, ctx.cards).some((id) => (ctx.cards[id]?.reps ?? 0) > 0);
    if (recent.length >= MASTERY_MIN_ATTEMPTS && accuracy >= MASTERY_ACCURACY && cardReviewed) {
      return 'mastered';
    }
    return 'practiced';
  }
  return read ? 'read' : 'untouched';
}

/** Apply the manual override: learned → mastered; reopened → capped at practiced. */
export function effectiveTier(auto: Tier, manual?: TopicManual): Tier {
  if (manual === 'learned') return 'mastered';
  if (manual === 'reopened') return TIER_ORDER[auto] > TIER_ORDER.practiced ? 'practiced' : auto;
  return auto;
}

export interface Completion {
  auto: Tier;
  tier: Tier;
  manual?: TopicManual;
}

export function topicCompletion(node: TopicRollup, ctx: TopicContext): Completion {
  const auto = topicTier(node, ctx);
  const manual = ctx.topics[node.id]?.manual;
  return { auto, tier: effectiveTier(auto, manual), manual };
}

// ---------------------------------------------------------------------------
// Next-topic suggestion (3-state view over the attempt log)
// ---------------------------------------------------------------------------

export type MasteryState = 'untouched' | 'started' | 'mastered';

/** Attempts-only 3-state used by suggestNextTopic (read/practiced collapse to "started"). */
export function topicMastery(node: TopicRollup, attempts: Attempt[]): MasteryState {
  const setIds = new Set(topicSetIds(node));
  const own = attempts.filter((a) => setIds.has(a.setId));
  if (own.length === 0) return 'untouched';
  const recent = own.slice(-MASTERY_WINDOW);
  if (recent.length >= MASTERY_MIN_ATTEMPTS) {
    const accuracy = recent.filter((a) => a.correct).length / recent.length;
    if (accuracy >= MASTERY_ACCURACY) return 'mastered';
  }
  return 'started';
}

const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

/** Suggest the next topic: lowest level first; prefer topics already started,
    then untouched topics whose prerequisites are all mastered, then any untouched. */
export function suggestNextTopic(nodes: TopicNode[], attempts: Attempt[]): TopicNode | undefined {
  const mastery = new Map(nodes.map((n) => [n.id, topicMastery(n, attempts)]));
  const sorted = [...nodes].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.id.localeCompare(b.id),
  );
  const started = sorted.find((n) => mastery.get(n.id) === 'started');
  if (started) return started;
  const ready = sorted.find(
    (n) =>
      mastery.get(n.id) === 'untouched' &&
      n.prerequisites.every((p) => !mastery.has(p) || mastery.get(p) === 'mastered'),
  );
  if (ready) return ready;
  return sorted.find((n) => mastery.get(n.id) !== 'mastered');
}
