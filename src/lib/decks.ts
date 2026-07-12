/** Which decks may feed never-graded flashcards into review (client-side — "opened" lives in IndexedDB). */
import type { TopicContext, TopicNode } from './mastery';
import type { CardDef } from './srs';
import { goalRoute, recommendedForGoal, recommendedNext, topicCompletion } from './mastery';
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
      .filter((node) => topicCompletion(node, ctx).tier !== 'mastered')
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
  return [...cards].sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
}
