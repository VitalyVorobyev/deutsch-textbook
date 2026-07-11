/** Topic completion tiers derived from the attempt/card log + persisted read/manual state. */
import type { Attempt, CardStates, TopicsState, TopicManual } from './store';
import { localDateString } from './store';
import { scoreTotal } from './scoring';

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
// Mastery must show retention across sessions, not one massed day — same-day
// accuracy is fluent-but-fragile, so the badge would inflate without this.
const MASTERY_MIN_DAYS = 2;

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

/** The requirements a topic must meet to count as mastered. */
export type MasteryReq = 'attempts' | 'accuracy' | 'days' | 'cards';

export interface MasteryGap {
  req: MasteryReq;
  met: boolean;
  /** what the learner has so far (attempts / accuracy in percent / days / reviewed cards) */
  have: number;
  /** what mastery requires */
  need: number;
}

/**
 * The mastery requirements with their current values — the single source of
 * truth for both topicTier() and the "what's still missing" checklist, so the
 * badge and the explanation can never drift apart.
 *
 * `cards` is omitted for topics without a vocab deck (there is nothing to review).
 */
export function masteryGaps(node: TopicRollup, ctx: TopicContext): MasteryGap[] {
  const setIds = new Set(topicSetIds(node));
  const own = ctx.attempts.filter((a) => setIds.has(a.setId));
  // Pretest answers are guesses by design: they mark the topic as practiced
  // but must not count toward (or against) mastery accuracy.
  const scored = node.pretestId ? own.filter((a) => a.setId !== node.pretestId) : own;
  const recent = scored.slice(-MASTERY_WINDOW);
  const accuracy = recent.length ? scoreTotal(recent) / recent.length : 0;
  const practiceDays = new Set(scored.map((a) => localDateString(new Date(a.ts))));
  const reviewedCards = topicCardIds(node, ctx.cards).filter(
    (id) => (ctx.cards[id]?.reps ?? 0) > 0,
  ).length;

  const gaps: MasteryGap[] = [
    {
      req: 'attempts',
      met: recent.length >= MASTERY_MIN_ATTEMPTS,
      have: scored.length,
      need: MASTERY_MIN_ATTEMPTS,
    },
    {
      req: 'accuracy',
      met: accuracy >= MASTERY_ACCURACY,
      have: Math.round(accuracy * 100),
      need: Math.round(MASTERY_ACCURACY * 100),
    },
    {
      req: 'days',
      met: practiceDays.size >= MASTERY_MIN_DAYS,
      have: practiceDays.size,
      need: MASTERY_MIN_DAYS,
    },
  ];
  if (node.vocabIds.length > 0) {
    gaps.push({ req: 'cards', met: reviewedCards > 0, have: reviewedCards, need: 1 });
  }
  return gaps;
}

/**
 * Auto tier from real activity (ignores the manual override):
 *  read      — article opened;
 *  practiced — ≥1 exercise/reading/pretest attempt;
 *  mastered  — every requirement in masteryGaps() met.
 */
export function topicTier(node: TopicRollup, ctx: TopicContext): Tier {
  const setIds = new Set(topicSetIds(node));
  const own = ctx.attempts.filter((a) => setIds.has(a.setId));

  if (own.length > 0) {
    return masteryGaps(node, ctx).every((g) => g.met) ? 'mastered' : 'practiced';
  }
  return ctx.topics[node.id]?.readAt ? 'read' : 'untouched';
}

/**
 * Apply the manual override: `reopened` caps the tier at practiced (capping
 * down is honest). `learned` is a self-rating rendered as a separate marker —
 * it never raises the measured tier.
 */
export function effectiveTier(auto: Tier, manual?: TopicManual): Tier {
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
// Next-topic suggestion (same measured tiers as the dashboard)
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

/**
 * Suggest the next topic: lowest level first; prefer topics already started
 * (read or practiced but not yet mastered), then untouched topics whose
 * prerequisites are all mastered, then any not-mastered topic.
 *
 * "Mastered" is the same measured tier the dashboard shows (topicCompletion —
 * after the self-assessment split a manual "learned" can never raise it), so
 * the suggestion and the Fortschritt topic list can never disagree.
 */
export function suggestNextTopic(nodes: TopicNode[], ctx: TopicContext): TopicNode | undefined {
  const tiers = new Map(nodes.map((n) => [n.id, topicCompletion(n, ctx).tier]));
  const sorted = [...nodes].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.id.localeCompare(b.id),
  );
  const started = sorted.find((n) => {
    const t = tiers.get(n.id);
    return t === 'read' || t === 'practiced';
  });
  if (started) return started;
  const ready = sorted.find(
    (n) =>
      tiers.get(n.id) === 'untouched' &&
      n.prerequisites.every((p) => !tiers.has(p) || tiers.get(p) === 'mastered'),
  );
  if (ready) return ready;
  return sorted.find((n) => tiers.get(n.id) !== 'mastered');
}
