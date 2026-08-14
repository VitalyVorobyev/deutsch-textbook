/**
 * One way to name an item.
 *
 * The same reference — a particular item inside a particular set — is written two different ways
 * in this repo, and both are load-bearing:
 *
 *   `<set-id>::<item-id>`   probe `arming:` lists, and the `setId`/`itemId` pair in the attempt log
 *   `<set-id>:<item-id>`    `data/grading-decisions.yaml`, and `progress:audit --item`
 *
 * Both parse, because a set id contains slashes but never a colon, so the *last* colon is always
 * the separator. Nothing has ever gone wrong. But two spellings of one identity means every new
 * reader has to pick one and every writer has to remember which, and the editorial app is about to
 * link items from both directions at once. So: one parser, one formatter, both spellings accepted
 * on the way in, the double colon written on the way out.
 *
 * The double colon is the canonical form because it is the one the attempt log already stores, and
 * snapshots are the only side of this that cannot be rewritten.
 */

export interface ItemRef {
  /** Path-id of the owning set, e.g. `a2/perfekt-haben-sein`. */
  setId: string;
  /** Item id, unique within the set. */
  itemId: string;
}

/** The canonical rendering: `<set-id>::<item-id>`. */
export const formatItemRef = (ref: ItemRef): string => `${ref.setId}::${ref.itemId}`;

/**
 * Accepts either spelling. Splits on the LAST colon run, because set ids carry slashes
 * (`a2/perfekt-haben-sein`) but never colons, while item ids carry neither.
 */
export function parseItemRef(raw: string): ItemRef | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const double = text.lastIndexOf('::');
  const cut = double > 0 ? double : text.lastIndexOf(':');
  if (cut <= 0) return undefined;
  const setId = text.slice(0, cut);
  const itemId = text.slice(cut + (double > 0 ? 2 : 1));
  // Neither half may carry a colon of its own. Without this the last-colon rule accepts
  // `a::b::c` as `{setId: "a::b", itemId: "c"}` — a malformed string parsed into a plausible
  // reference, which is worse than a rejection because nothing downstream would notice.
  if (!setId || !itemId || setId.includes(':') || itemId.includes(':')) return undefined;
  return { setId, itemId };
}

/** True when two references name the same item, whichever spelling each arrived in. */
export function sameItem(a: string, b: string): boolean {
  const left = parseItemRef(a);
  const right = parseItemRef(b);
  return !!left && !!right && left.setId === right.setId && left.itemId === right.itemId;
}
