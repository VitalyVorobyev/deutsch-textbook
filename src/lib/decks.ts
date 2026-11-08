/** Which decks may feed never-graded flashcards into review (client-side — "opened" lives in IndexedDB). */
import { LEVELS, type Level } from '@da/schema';
import type { TopicContext, TopicNode } from './mastery';
import {
  introducedToday,
  rankDueCards,
  spaceSiblings,
  splitQueue,
  type CardDef,
  type CardRef,
} from './srs';
import { goalRoute, pathDone, recommendedForGoal, recommendedNext } from './mastery';
import { shuffle } from './shuffle';
import type { LearningGoal } from './store';

/**
 * Due cards are always reviewed, whatever their deck — this gates only fresh
 * (never-graded) cards. A deck's fresh cards are eligible when:
 *  - any owning topic (frontmatter `vocab`) is **opened**;
 *  - no topic owns the deck (kernwortschatz): ≥1 topic at the deck's level
 *    has been opened;
 *  - the learner already has ≥1 graded card in the deck — a deck in active
 *    use must not freeze because readAt tracking is newer than the profile.
 * The per-deck page stays ungated: studying a deck directly is an opt-in.
 *
 * "Opened" means read **or placed**. A learner who passes the A1 entry test has `readAt`
 * on nothing, so under a readAt-only gate `openedLevels` came out empty and they were
 * dealt no fresh cards at any level — a placed-out learner would have had an empty review
 * queue forever. Widened identically on both branches, so no deck changes owner: this is
 * not the trap CLAUDE.md warns about, which is about listing an unowned Wortliste deck in
 * a topic's `vocab:` and thereby flipping *that deck's* gate.
 */
export function eligibleFreshCards<C extends CardRef>(
  fresh: readonly C[],
  spine: string[],
  nodes: TopicNode[],
  deckLevels: Record<string, string>,
  ctx: TopicContext,
): C[] {
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
  const opened = (n: TopicNode) => {
    const state = ctx.topics[n.id];
    return !!state?.readAt || !!state?.placement;
  };
  const openedLevels = new Set(nodes.filter(opened).map((n) => n.level));

  const eligible = new Set<string>();
  for (const deckId of new Set(fresh.map((c) => c.deckId))) {
    const own = owners.get(deckId);
    const ok = own ? own.some(opened) : openedLevels.has(deckLevels[deckId] ?? '');
    if (ok || graded.has(deckId)) eligible.add(deckId);
  }
  return fresh.filter((c) => eligible.has(c.deckId));
}

/**
 * Goal route first, then the next lesson, then what is left of the levels below the current one
 * (lowest first), then the current level's lesson decks, its completion decks, and anything above.
 */
export function prioritizeFreshCards<C extends CardRef>(
  cards: readonly C[],
  spine: string[],
  nodes: TopicNode[],
  deckLevels: Record<string, string>,
  ctx: TopicContext,
  goal?: LearningGoal,
): C[] {
  const routeDecks = new Set(
    (goal?.topicId ? goalRoute(goal.topicId, spine, nodes) : [])
      .filter((node) => !pathDone(node, ctx))
      .flatMap((node) => node.vocabIds),
  );
  const next = goal?.topicId
    ? (recommendedForGoal(goal.topicId, spine, nodes, ctx) ?? recommendedNext(spine, nodes, ctx))
    : recommendedNext(spine, nodes, ctx);
  const nextDecks = new Set(next?.vocabIds ?? []);
  // A learner who placed out of every topic has no next lesson, so `next.level` is
  // undefined and the level bands below can never match — every deck would fall to the last band and
  // the level structure would dissolve into one shuffle. Fall back to the highest level
  // they have actually reached, which is where their vocabulary work belongs.
  const currentLevel =
    next?.level ??
    nodes
      .filter((n) => ctx.topics[n.id]?.placement || ctx.topics[n.id]?.readAt)
      .map((n) => n.level)
      .sort()
      .pop();
  // A deck no topic lists in `vocab:` is a Wortliste completion deck. It teaches
  // the level's lexis, not any lesson's, so it belongs behind the decks that do.
  const owned = new Set(nodes.flatMap((n) => n.vocabIds));
  const rank = (level: string | undefined) => (level ? LEVELS.indexOf(level as Level) : -1);
  const current = rank(currentLevel);
  function priority(card: CardRef) {
    if (routeDecks.has(card.deckId)) return 0;
    if (nextDecks.has(card.deckId)) return 1;
    const level = rank(deckLevels[card.deckId]);
    // A word a lower level left unlearned comes before the current level's: a B1 text
    // assumes the A2 words, and they are the more frequent ones. Below the current level a
    // learner's decks are all opened, so with ~3400 B1 words and 15 new cards a day, a band
    // behind the current level would never be reached. Lowest level first: A1, then A2.
    if (level >= 0 && current >= 0 && level < current) return 2 + level / LEVELS.length;
    // The current level's lesson decks come before its Wortliste completion decks: closing
    // the A2 Wortliste put ~680 completion words beside ~250 lesson words, and a learner who
    // finished their unit's deck would otherwise meet `Volleyball` shuffled in with the
    // vocabulary of the unit they are about to study.
    if (level === current) return owned.has(card.deckId) ? 3 : 4;
    return 5;
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

/**
 * How many never-seen cards a learner may be dealt in one day, across every gated
 * surface together. `newLimit` caps a single queue *build* and `planReview` re-runs
 * on every mount, so without this a reload of /ueben/wiederholen simply dealt the
 * next 15 — five reloads, 75 new cards, and a review debt FSRS delivers for months.
 */
export const DAILY_NEW_CARDS = 15;

export interface ReviewPlanOpts {
  /** cap on never-graded cards mixed into this one queue (default 15) */
  newLimit?: number;
  /**
   * Cap on never-graded cards introduced *today*, counted across surfaces from the
   * card states themselves. Defaults to DAILY_NEW_CARDS whenever a `gate` is given,
   * and to no cap without one — the same carve-out eligibility already makes: the
   * per-deck page is ungated because studying one deck directly is an explicit
   * opt-in, and it should not be rationed like the daily flow.
   */
  dailyNewCap?: number;
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

export interface ReviewPlanResult<C extends CardRef = CardDef> {
  /** ranked due cards (capped) followed by prioritized fresh cards (capped) */
  queue: C[];
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
export function planReview<C extends CardRef>(
  cards: readonly C[],
  gate: ReviewGate | undefined,
  ctx: ReviewContext,
  opts: ReviewPlanOpts = {},
): ReviewPlanResult<C> {
  const {
    newLimit = 15,
    dailyNewCap = gate ? DAILY_NEW_CARDS : Infinity,
    maxDue = Infinity,
    maxTotal = Infinity,
    freshPolicy = { kind: 'always' },
    now,
  } = opts;
  const { due, fresh } = splitQueue(cards, ctx.cards, now);
  const dueQueue = rankDueCards(due, ctx.cards).slice(0, Math.min(maxDue, maxTotal));

  // Today's remaining budget. Spent budget shrinks every later queue this day,
  // which is the whole point: the cap has to survive a page reload to mean anything.
  const budget = Math.max(0, dailyNewCap - introducedToday(ctx.cards, now));

  const wantFresh =
    freshPolicy.kind === 'always' || (due.length > 0 && due.length < freshPolicy.minDue);
  let freshQueue: C[] = [];
  if (wantFresh) {
    const pool = gate
      ? eligibleFreshCards(fresh, gate.spine, gate.nodes, gate.deckLevels, ctx)
      : fresh;
    const ordered = gate
      ? prioritizeFreshCards(pool, gate.spine, gate.nodes, gate.deckLevels, ctx, ctx.goal)
      : shuffle(pool);
    freshQueue = ordered.slice(
      0,
      Math.max(0, Math.min(newLimit, budget, maxTotal - dueQueue.length)),
    );
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
