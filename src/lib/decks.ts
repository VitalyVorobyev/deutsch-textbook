/** Which decks may feed never-graded flashcards into review (client-side — "opened" lives in IndexedDB). */
import { suggestNextTopic, type TopicContext, type TopicNode } from './mastery';
import type { CardDef } from './srs';

/**
 * Due cards are always reviewed, whatever their deck — this gates only fresh
 * (never-graded) cards. A deck's fresh cards are eligible when:
 *  - any owning topic (frontmatter `vocab`) is opened (readAt) or the
 *    suggested next topic;
 *  - no topic owns the deck (kernwortschatz): ≥1 topic at the deck's level
 *    has been opened;
 *  - the learner already has ≥1 graded card in the deck — a deck in active
 *    use must not freeze because readAt tracking is newer than the profile.
 * The per-deck page stays ungated: studying a deck directly is an opt-in.
 */
export function eligibleFreshCards(
  fresh: CardDef[],
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
  const next = suggestNextTopic(nodes, ctx)?.id;
  const openedLevels = new Set(
    nodes.filter((n) => ctx.topics[n.id]?.readAt).map((n) => n.level),
  );

  const eligible = new Set<string>();
  for (const deckId of new Set(fresh.map((c) => c.deckId))) {
    const own = owners.get(deckId);
    const ok = own
      ? own.some((n) => ctx.topics[n.id]?.readAt || n.id === next)
      : openedLevels.has(deckLevels[deckId] ?? '');
    if (ok || graded.has(deckId)) eligible.add(deckId);
  }
  return fresh.filter((c) => eligible.has(c.deckId));
}
