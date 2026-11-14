/**
 * The topic page shows its exercise sets as one path: a step at a time, a set at a time. This
 * module answers the two questions the path asks of the attempt log — which sets are worked
 * through, and which one to open on. Navigation only: the topic's completion and its measured
 * tier stay in `src/lib/mastery.ts`, and nothing here feeds them.
 */

export interface PathSet {
  id: string;
  /** the ids of the items the set serves today */
  itemIds: readonly string[];
}

/**
 * The sets every item of which has an attempt — the rule `lessonCompleted` applies to the
 * Grundübung, applied to each set. A set with no items is never worked through.
 */
export function workedSets(
  sets: readonly PathSet[],
  attempts: readonly { setId: string; itemId: string }[],
): Set<string> {
  const attempted = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    let items = attempted.get(attempt.setId);
    if (!items) attempted.set(attempt.setId, (items = new Set()));
    items.add(attempt.itemId);
  }
  return new Set(
    sets
      .filter((set) => {
        const items = attempted.get(set.id);
        return set.itemIds.length > 0 && !!items && set.itemIds.every((id) => items.has(id));
      })
      .map((set) => set.id),
  );
}

/**
 * The set the path opens on: the first one, in path order, that is not worked through; the first
 * set when all are. `sets` is the path proper — the folded drills are offered, never opened on.
 */
export function openingSet(
  sets: readonly PathSet[],
  worked: ReadonlySet<string>,
): string | undefined {
  return (sets.find((set) => !worked.has(set.id)) ?? sets[0])?.id;
}
