/** Topic completion tiers derived from the attempt/card log + persisted read/manual state. */
import type { Attempt, CardStates, TopicsState, TopicManual } from './store';
import { localDateString } from './store';
import { scoreTotal, verifiedOnly } from './scoring';

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

/** Sets that represent actual study; a pretest is diagnostic generation, not practice. */
export function topicPracticeSetIds(node: TopicRollup): string[] {
  return [...node.exerciseSets, ...node.readingIds.map((id) => `reading:${id}`)];
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
  const setIds = new Set(topicPracticeSetIds(node));
  const scored = verifiedOnly(ctx.attempts.filter((a) => setIds.has(a.setId)));
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
 *  practiced — ≥1 non-pretest exercise/reading attempt;
 *  mastered  — every requirement in masteryGaps() met.
 */
export function topicTier(node: TopicRollup, ctx: TopicContext): Tier {
  const setIds = new Set(topicPracticeSetIds(node));
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
// Recommended next topic (spine order × the dashboard's measured tiers)
// ---------------------------------------------------------------------------

/**
 * The recommended next topic: the first topic in spine order whose measured
 * tier is below mastered. The spine (content/atlas.yaml `units`, flattened by
 * getCurriculum) is validated to respect prerequisites, and the tier is the
 * dashboard's own (topicCompletion — a manual "learned" can never raise it),
 * so the suggestion, the path and the Fortschritt list can never disagree.
 */
export function recommendedNext(
  spineTopicIds: string[],
  nodes: TopicNode[],
  ctx: TopicContext,
): TopicNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of spineTopicIds) {
    const node = byId.get(id);
    if (node && topicCompletion(node, ctx).tier !== 'mastered') return node;
  }
  return undefined;
}
