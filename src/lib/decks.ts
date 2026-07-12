/** Which decks may feed never-graded flashcards into review (client-side — "opened" lives in IndexedDB). */
import type { TopicContext, TopicNode } from './mastery';
import { rankDueCards, spaceSiblings, splitQueue, type CardDef } from './srs';
import { goalRoute, pathDone, recommendedForGoal, recommendedNext } from './mastery';
import { shuffle } from './shuffle';
import type { LearningGoal } from './store';

/**
 * Due cards are always reviewed, whatever their deck — this gates only fresh
 * (never-graded) cards. A deck's fresh cards are eligible when:
 *  - any owning topic (frontmatter `vocab`) is opened (readAt);
 *  - no topic owns the deck (kernwortschatz): ≥1 topic at the deck's level
 *    has been opened;
 *  - the learner already has ≥1 graded card in the deck — a deck in active
 *    use must not freeze because readAt tracking is newer than the profile.
 * The per-deck page stays ungated: studying a deck directly is an opt-in.
 */
export function eligibleFreshCards(
  fresh: CardDef[],
  spine: string[],
  nodes: TopicNode[],
  deckLevels: Record<string, string>,
  ctx: TopicContext,
): CardDef[] {
  const owners = new Map<string, TopicNode[]>();
  for (const n of nodes) {
    for (const v of n.vocabIds) owners.set(v, [...(owners.get(v) ?? []), n]);
  }
  // cardId is `<deckId>::<de>::<dir>`, so the deck is recoverable from the key
  const graded = new Set<string>();
  for (const [id, s] of Object.entries(ctx.cards)) {
    if (s.reps > 0) graded.add(id.slice(0, id.indexOf('::')));
  }
  void spine;
  const openedLevels = new Set(
    nodes.filter((n) => ctx.topics[n.id]?.readAt).map((n) => n.level),
  );

  const eligible = new Set<string>();
  for (const deckId of new Set(fresh.map((c) => c.deckId))) {
    const own = owners.get(deckId);
    const ok = own
      ? own.some((n) => ctx.topics[n.id]?.readAt)
      : openedLevels.has(deckLevels[deckId] ?? '');
    if (ok || graded.has(deckId)) eligible.add(deckId);
  }
  return fresh.filter((c) => eligible.has(c.deckId));
}

/** Goal route first, then the current topic, level-core decks, and everything else. */
export function prioritizeFreshCards(
  cards: CardDef[],
  spine: string[],
  nodes: TopicNode[],
  deckLevels: Record<string, string>,
  ctx: TopicContext,
  goal?: LearningGoal,
): CardDef[] {
  const routeDecks = new Set(
    (goal?.topicId ? goalRoute(goal.topicId, spine, nodes) : [])
      .filter((node) => !pathDone(node, ctx))
      .flatMap((node) => node.vocabIds),
  );
  const next = goal?.topicId
    ? recommendedForGoal(goal.topicId, spine, nodes, ctx) ?? recommendedNext(spine, nodes, ctx)
    : recommendedNext(spine, nodes, ctx);
  const nextDecks = new Set(next?.vocabIds ?? []);
  const currentLevel = next?.level;
  function priority(card: CardDef) {
    if (routeDecks.has(card.deckId)) return 0;
    if (nextDecks.has(card.deckId)) return 1;
    if (deckLevels[card.deckId] === currentLevel) return 2;
    return 3;
  }
  // Shuffle, then stable-sort by priority: curriculum order decides which decks
  // come first, chance decides the order inside a deck. Sorting by card id
  // instead served the same words in the same sequence every single session.
  return shuffle(cards).sort((a, b) => priority(a) - priority(b));
}

// ---------------------------------------------------------------------------
// Review planning — the ONE rule for "what does a review queue contain"
// ---------------------------------------------------------------------------

/** Fresh-card gating context, exactly as the pages pass it to the islands. */
export interface ReviewGate {
  /** topic ids in recommended-path order (getCurriculum().spine) */
  spine: string[];
  nodes: TopicNode[];
  /** deck id → CEFR level, for gating fresh cards of decks no topic owns */
  deckLevels: Record<string, string>;
}

/** Everything planReview reads from the store — callers load it and pass it in. */
export interface ReviewContext extends TopicContext {
  goal?: LearningGoal;
}

export interface ReviewPlanOpts {
  /** cap on never-graded cards mixed into the queue (default 15) */
  newLimit?: number;
  /** cap on due cards in the queue (default unlimited) */
  maxDue?: number;
  /** cap on the whole queue (default unlimited) */
  maxTotal?: number;
  /**
   * When fresh cards join the queue. `always` (default): whenever the caps
   * leave room. `top-up`: only when 0 < total due < minDue — a session with
   * nothing due at all adds no fresh cards either (the daily session skips
   * straight to training then; this preserves SessionFlow's historical rule).
   */
  freshPolicy?: { kind: 'always' } | { kind: 'top-up'; minDue: number };
  now?: Date;
}

export interface ReviewPlanResult {
  /** ranked due cards (capped) followed by prioritized fresh cards (capped) */
  queue: CardDef[];
  /** due cards actually in the queue */
  dueCount: number;
  /** fresh cards actually in the queue */
  freshCount: number;
  /** queue.length — always dueCount + freshCount */
  total: number;
  /** due cards cut off by the caps (offered as an optional extra round) */
  dueRemaining: number;
}

/**
 * Build a review queue: most-overdue due cards first (capped), then fresh
 * cards from eligible decks in curriculum-priority order (capped). Pure and
 * synchronous — every surface that shows or runs a review (Heute tile,
 * /ueben/wiederholen, the daily session) plans through here, so their
 * numbers can never disagree. Without a gate the fresh pool is ungated and
 * shuffled (the per-deck page: studying a deck directly is an opt-in).
 */
export function planReview(
  cards: CardDef[],
  gate: ReviewGate | undefined,
  ctx: ReviewContext,
  opts: ReviewPlanOpts = {},
): ReviewPlanResult {
  const {
    newLimit = 15,
    maxDue = Infinity,
    maxTotal = Infinity,
    freshPolicy = { kind: 'always' },
    now,
  } = opts;
  const { due, fresh } = splitQueue(cards, ctx.cards, now);
  const dueQueue = rankDueCards(due, ctx.cards).slice(0, Math.min(maxDue, maxTotal));

  const wantFresh =
    freshPolicy.kind === 'always' || (due.length > 0 && due.length < freshPolicy.minDue);
  let freshQueue: CardDef[] = [];
  if (wantFresh) {
    const pool = gate
      ? eligibleFreshCards(fresh, gate.spine, gate.nodes, gate.deckLevels, ctx)
      : fresh;
    const ordered = gate
      ? prioritizeFreshCards(pool, gate.spine, gate.nodes, gate.deckLevels, ctx, ctx.goal)
      : shuffle(pool);
    freshQueue = ordered.slice(0, Math.max(0, Math.min(newLimit, maxTotal - dueQueue.length)));
  }

  return {
    // Spacing runs over the assembled queue, so a due card and a fresh card of
    // the same word cannot meet at the seam either. It only moves a card when
    // its word just came up, so due-before-fresh survives everywhere else.
    queue: spaceSiblings([...dueQueue, ...freshQueue]),
    dueCount: dueQueue.length,
    freshCount: freshQueue.length,
    total: dueQueue.length + freshQueue.length,
    dueRemaining: due.length - dueQueue.length,
  };
}
