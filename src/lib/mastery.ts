/** Topic completion tiers derived from the attempt/card log + persisted read/manual state. */
import type { Attempt, CardStates, TopicsState, TopicManual } from './store';
import type { CurriculumStrand } from './schemas';
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
  strand?: CurriculumStrand;
  group?: string;
  /** First authored practice-role set; completing every item advances the lesson. */
  primaryPractice?: { setId: string; itemIds: string[] };
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

/** What the learner has actually done on a topic — the chips behind the badge. */
export interface TopicEvidence {
  /** the article was opened */
  read: boolean;
  /** ≥1 non-pretest attempt on an exercise set or reading */
  practiced: boolean;
  /** practice spans ≥2 days (the masteryGaps 'days' requirement) */
  spaced: boolean;
  /** the topic owns a vocab deck at all — no deck, no chip */
  hasVocab: boolean;
  /** ≥1 card of that deck has been reviewed */
  vocab: boolean;
}

/**
 * The evidence behind the tier, shared by the Fortschritt list and the Themen
 * overview so the two can never disagree about what "Geübt" means.
 *
 * Practice deliberately counts topicPracticeSetIds, not topicSetIds: a pretest
 * is diagnostic generation, not study. Counting it would put a ✓ Geübt chip
 * next to a "Neu" badge, since topicTier() excludes it.
 */
export function topicEvidence(node: TopicRollup, ctx: TopicContext): TopicEvidence {
  const setIds = new Set(topicPracticeSetIds(node));
  const reviewed = topicCardIds(node, ctx.cards).filter((id) => (ctx.cards[id]?.reps ?? 0) > 0);
  return {
    read: !!ctx.topics[node.id]?.readAt,
    practiced: ctx.attempts.some((a) => setIds.has(a.setId)),
    spaced: masteryGaps(node, ctx).find((g) => g.req === 'days')?.met ?? false,
    hasVocab: node.vocabIds.length > 0,
    vocab: reviewed.length > 0,
  };
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

/**
 * First-pass lesson completion is separate from delayed, evidence-based mastery.
 * Completing the primary practice is the evidence; readAt is not required —
 * live flows set it before practice anyway, but imported/legacy snapshots can
 * carry the attempts without topic state, and the recommended path must not
 * wedge on those.
 *
 * `since` only counts attempts from that moment on, which is how a reopened
 * topic asks to be worked through again (see pathDone).
 */
export function lessonCompleted(node: TopicNode, ctx: TopicContext, since = 0): boolean {
  if (!node.primaryPractice?.itemIds.length) return false;
  const attempted = new Set(
    ctx.attempts
      .filter((attempt) => attempt.setId === node.primaryPractice!.setId && attempt.ts >= since)
      .map((attempt) => attempt.itemId),
  );
  return node.primaryPractice.itemIds.every((id) => attempted.has(id));
}

/**
 * Is this topic behind the learner? The one predicate every path surface asks —
 * the recommendation, the goal route, the level checkpoint gate and fresh-card
 * priority. Navigation only: never render a badge from this. Badges stay
 * measured (topicCompletion), and a self-rating must not fake evidence.
 *
 * Deliberately wider than lessonCompleted(): authored practice sets grow as the
 * course is deepened, and a topic the learner already mastered must not fall
 * back onto the path merely because items were added to its set afterwards.
 * That is what made a "Gemeistert" topic keep surfacing as the next lesson —
 * and, through the same gate, kept the level checkpoint hidden.
 *
 *  - `learned`  → done. The learner's explicit "I know this, move on". It still
 *    never raises the measured tier; the path is advisory, the badge is evidence.
 *  - `reopened` → done only once the lesson has been worked through AGAIN, i.e.
 *    the practice set is complete in attempts made after the flag was set.
 *    Blocking outright would wedge the path forever: reopening caps the tier at
 *    `practiced`, so the topic could never clear itself and would hide every
 *    later topic — and the checkpoint — behind it.
 */
export function pathDone(node: TopicNode, ctx: TopicContext): boolean {
  const state = ctx.topics[node.id];
  if (state?.manual === 'learned') return true;
  // topicCompletion, not topicTier: `reopened` caps the tier at practiced, so
  // this branch correctly does not fire for a topic the learner just reopened.
  if (topicCompletion(node, ctx).tier === 'mastered') return true;
  const since = state?.manual === 'reopened' ? state.manualAt ?? 0 : 0;
  return lessonCompleted(node, ctx, since);
}

/** Every lesson of a level is behind the learner — its checkpoint may be offered. */
export function levelPathDone(level: string, nodes: TopicNode[], ctx: TopicContext): boolean {
  const own = nodes.filter((node) => node.level === level);
  return own.length > 0 && own.every((node) => pathDone(node, ctx));
}

/** Lessons still to do before the level's checkpoint. */
export function levelRemaining(level: string, nodes: TopicNode[], ctx: TopicContext): number {
  return nodes.filter((node) => node.level === level && !pathDone(node, ctx)).length;
}

// ---------------------------------------------------------------------------
// Recommended next topic (spine order × what the learner has behind them)
// ---------------------------------------------------------------------------

/**
 * The recommended next topic: the first topic in spine order the learner has
 * not put behind them (pathDone). The spine (content/atlas.yaml `units`,
 * flattened by getCurriculum) is validated to respect prerequisites, so the
 * first such topic is always reachable.
 */
export function recommendedNext(
  spineTopicIds: string[],
  nodes: TopicNode[],
  ctx: TopicContext,
): TopicNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of spineTopicIds) {
    const node = byId.get(id);
    if (node && !pathDone(node, ctx)) return node;
  }
  return undefined;
}

/** Goal plus every transitive prerequisite, in curriculum order. */
export function goalRoute(topicId: string, spine: string[], nodes: TopicNode[]): TopicNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const included = new Set<string>();
  function visit(id: string) {
    if (included.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    for (const prerequisite of node.prerequisites) visit(prerequisite);
    included.add(id);
  }
  visit(topicId);
  return spine.flatMap((id) => {
    const node = byId.get(id);
    return node && included.has(id) ? [node] : [];
  });
}

export function recommendedForGoal(
  topicId: string,
  spine: string[],
  nodes: TopicNode[],
  ctx: TopicContext,
): TopicNode | undefined {
  return goalRoute(topicId, spine, nodes).find((node) => !pathDone(node, ctx));
}
