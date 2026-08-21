/**
 * A queue you work through with the keyboard, and the two rules that make it one.
 *
 * PR 12's narration wave is 85 Lesetexte reviewed in a row. A list you drive with a mouse is a
 * list you review 85 times *slowly*, and — more to the point — a list where the pointer is the
 * only record of where you are, so a reload starts you at the top again. Both are fixed by the
 * same two decisions:
 *
 * **The position is a value, not a focus ring.** One selected id, kept in the hash by the caller,
 * so a queue survives a reload and can be linked *into* at the row somebody stopped at.
 *
 * **The keys move the value.** `j`/`k` and the arrows step it; `Enter` opens what the row points
 * at. Pure, so a test can hold the wrap-around and the empty cases without a DOM.
 */

/** The commands a queue understands. Anything else belongs to whatever has focus. */
export type Befehl = 'weiter' | 'zurueck' | 'oeffnen';

/** Elements that already own these keys. A queue never takes a key a control means by itself. */
const EIGENE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'AUDIO', 'SUMMARY']);

/**
 * The command a key press means, or `null` when the queue must keep out of it.
 *
 * `j`/`k` beside the arrows because both hands are already on the keyboard and neither is worth
 * making the reviewer choose. A modifier means the browser's own thing — ⌘↓ is "end of page" and
 * a queue that stole it would be a queue you cannot leave — so any modifier hands the key back.
 */
export function befehlFuer(event: {
  key: string;
  target?: unknown;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): Befehl | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const ziel = event.target;
  if (ziel && typeof ziel === 'object' && 'tagName' in ziel) {
    if (EIGENE.has(String((ziel as { tagName: unknown }).tagName))) return null;
  }
  if (event.key === 'j' || event.key === 'ArrowDown') return 'weiter';
  if (event.key === 'k' || event.key === 'ArrowUp') return 'zurueck';
  if (event.key === 'Enter') return 'oeffnen';
  return null;
}

/**
 * The next id in the given direction.
 *
 * **It stops at the ends rather than wrapping.** A queue is worked through, and a `j` at the last
 * row that lands on the first is a reviewer who has silently started again — the one mistake a
 * batch surface must not make. Nothing selected yet means the first row for `weiter` and the last
 * for `zurueck`, so a fresh queue answers the first key press with something.
 */
export function naechste(
  ids: readonly string[],
  aktuell: string | undefined,
  richtung: 1 | -1,
): string | undefined {
  if (ids.length === 0) return undefined;
  const stelle = aktuell === undefined ? -1 : ids.indexOf(aktuell);
  if (stelle === -1) return richtung === 1 ? ids[0] : ids[ids.length - 1];
  const ziel = stelle + richtung;
  if (ziel < 0 || ziel >= ids.length) return aktuell;
  return ids[ziel];
}

/**
 * The selected id, corrected against the rows actually on screen.
 *
 * A hash can name a row a filter has since removed — that is not an error, it is what happens when
 * a status filter is narrowed with a position held. Falling back to the first row keeps the keys
 * working; returning the stale id would leave every press a no-op with nothing to say why.
 */
export function gewaehlt(ids: readonly string[], aus_hash: string): string | undefined {
  if (ids.length === 0) return undefined;
  return ids.includes(aus_hash) ? aus_hash : ids[0];
}
