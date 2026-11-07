/**
 * Exercise sets renamed to the one naming convention: `<topic>`, `<topic>-produktion`,
 * `<topic>-<point>[-transfer]`, `<topic>-hoeren`, `<topic>-diktat`, `drill-<focus>`
 * (ADR 0014), and items moved from one set to another (ADR 0019). A set id is half of every
 * attempt's identity, so both maps are permanent: an attempt logged under an old location, by an
 * older client or in an older snapshot, must keep counting for the set the item lives in now.
 *
 * They are applied wherever attempts enter, are compared or are read:
 * - `parseProgressSnapshot` on import and sync merge;
 * - `attemptKey`, so an old-location and a new-location copy of one attempt dedupe as one;
 * - `getAttempts`, so every reader sees the current location, whatever the stored blob holds;
 * - `progress:audit`, which reads snapshot files directly.
 *
 * Never remove an entry, and never give a new set an id that appears on the left:
 * its attempts would be filed under the set this map points to. `tests/set-id-migration.test.ts`
 * holds both rules against the corpus.
 */
export const SET_ID_MIGRATION: Readonly<Record<string, string>> = {
  'a1/akkusativ-anwenden': 'a1/akkusativ-produktion',
  'a1/alltag-zeit-trennbar': 'a1/alltag-zeit-produktion',
  'a1/artikel-demonstrativ': 'a1/artikel-genus-demonstrativ',
  'a1/artikel-demonstrativ-anwenden': 'a1/artikel-genus-demonstrativ-transfer',
  'a1/artikel-plural-kein': 'a1/artikel-genus-produktion',
  'a1/erste-schritte-sprechen': 'a1/erste-schritte-produktion',
  'a1/essen-einkaufen-service': 'a1/essen-trinken-produktion',
  'a1/freizeit-perfekt-a1': 'a1/freizeit-koennen-produktion',
  'a1/hoeren-alltag-zeit': 'a1/alltag-zeit-diktat',
  'a1/hoeren-essen-trinken': 'a1/essen-trinken-diktat',
  'a1/hoeren-freizeit': 'a1/freizeit-koennen-diktat',
  'a1/hoeren-stadt-wege': 'a1/stadt-wege-diktat',
  'a1/ls-akkusativ-01-hoeren': 'a1/akkusativ-hoeren',
  'a1/ls-alltag-zeit-01-hoeren': 'a1/alltag-zeit-hoeren',
  'a1/ls-artikel-genus-01-hoeren': 'a1/artikel-genus-hoeren',
  'a1/ls-erste-schritte-01-hoeren': 'a1/erste-schritte-hoeren',
  'a1/ls-essen-einkaufen-01-hoeren': 'a1/essen-trinken-hoeren',
  'a1/ls-freizeit-koennen-01-hoeren': 'a1/freizeit-koennen-hoeren',
  'a1/ls-menschen-familie-01-hoeren': 'a1/menschen-familie-hoeren',
  'a1/ls-praesens-wortstellung-01-hoeren': 'a1/praesens-wortstellung-hoeren',
  'a1/ls-stadt-wege-01-hoeren': 'a1/stadt-wege-hoeren',
  'a1/ls-wohnen-01-hoeren': 'a1/wohnen-hoeren',
  'a1/ort-richtung-praepositionen-anwenden': 'a1/ort-richtung-praepositionen-produktion',
  'a1/praesens-fragen-verneinung': 'a1/praesens-wortstellung-produktion',
  'a1/praesens-koordination': 'a1/praesens-wortstellung-koordination',
  'a1/praesens-koordination-anwenden': 'a1/praesens-wortstellung-koordination-transfer',
  'a1/praesens-koordination-ausblenden': 'a1/praesens-wortstellung-koordination-ausblenden',
  'a1/praesens-koordination-remediation': 'a1/praesens-wortstellung-koordination-remediation',
  'a1/stadt-wege-a1-grammatik': 'a1/stadt-wege-produktion',
  'a1/wortbildung-anwenden': 'a1/wortbildung-produktion',
  'a1/wortbildung-nomen': 'a1/wortbildung',
  'a2/adjektive-derselbe': 'a2/adjektive-deklination-derselbe',
  'a2/adjektive-derselbe-transfer': 'a2/adjektive-deklination-derselbe-transfer',
  'a2/alltag-produktion': 'a2/alltag-tagesablauf-produktion',
  'a2/alltag-ueber-dauer': 'a2/alltag-tagesablauf-ueber-dauer',
  'a2/einkaufen-interrogativartikel': 'a2/einkaufen-reklamation-interrogativartikel',
  'a2/einkaufen-interrogativartikel-anwenden':
    'a2/einkaufen-reklamation-interrogativartikel-transfer',
  'a2/einkaufen-kleine-mengen': 'a2/einkaufen-reklamation-kleine-mengen',
  'a2/einkaufen-kleine-mengen-transfer': 'a2/einkaufen-reklamation-kleine-mengen-transfer',
  'a2/freunde-feste-reziprok-anwenden': 'a2/freunde-feste-reziprok-transfer',
  'a2/hoeren-alltag': 'a2/alltag-tagesablauf-diktat',
  'a2/hoeren-dativ': 'a2/dativ-diktat',
  'a2/infinitiv-nicht-brauchen': 'a2/infinitiv-mit-zu-nicht-brauchen',
  'a2/infinitiv-nicht-brauchen-transfer': 'a2/infinitiv-mit-zu-nicht-brauchen-transfer',
  'a2/lernen-meinung-nach': 'a2/lernen-verstehen-meinung-nach',
  'a2/lernen-meinung-nach-transfer': 'a2/lernen-verstehen-meinung-nach-transfer',
  'a2/ls-adjektive-deklination-01-hoeren': 'a2/adjektive-deklination-hoeren',
  'a2/ls-aemter-dienstleistungen-01-hoeren': 'a2/aemter-dienstleistungen-hoeren',
  'a2/ls-alltag-tagesablauf-01-hoeren': 'a2/alltag-tagesablauf-hoeren',
  'a2/ls-arbeit-beruf-01-hoeren': 'a2/arbeit-beruf-hoeren',
  'a2/ls-biografie-erfahrungen-01-hoeren': 'a2/biografie-erfahrungen-hoeren',
  'a2/ls-dativ-01-hoeren': 'a2/dativ-hoeren',
  'a2/ls-einkaufen-reklamation-01-hoeren': 'a2/einkaufen-reklamation-hoeren',
  'a2/ls-freunde-feste-01-hoeren': 'a2/freunde-feste-hoeren',
  'a2/ls-gesundheit-arzttermin-01-hoeren': 'a2/gesundheit-arzttermin-hoeren',
  'a2/ls-infinitiv-mit-zu-01-hoeren': 'a2/infinitiv-mit-zu-hoeren',
  'a2/ls-lernen-verstehen-01-hoeren': 'a2/lernen-verstehen-hoeren',
  'a2/ls-man-und-besitz-01-hoeren': 'a2/man-und-besitz-hoeren',
  'a2/ls-modalverben-01-hoeren': 'a2/modalverben-hoeren',
  'a2/ls-nebensaetze-plaene-01-hoeren': 'a2/nebensaetze-plaene-hoeren',
  'a2/ls-perfekt-haben-sein-01-hoeren': 'a2/perfekt-haben-sein-hoeren',
  'a2/ls-reisen-verkehr-01-hoeren': 'a2/reisen-verkehr-hoeren',
  'a2/ls-relativsaetze-01-hoeren': 'a2/relativsaetze-hoeren',
  'a2/ls-termine-vereinbaren-01-hoeren': 'a2/termine-vereinbaren-hoeren',
  'a2/ls-trennbare-verben-01-hoeren': 'a2/trennbare-verben-hoeren',
  'a2/ls-verben-mit-praepositionen-01-hoeren': 'a2/verben-mit-praepositionen-hoeren',
  'a2/ls-verbindungen-folgen-01-hoeren': 'a2/verbindungen-folgen-hoeren',
  'a2/ls-wohnen-umzug-01-hoeren': 'a2/wohnen-umzug-hoeren',
  'a2/perfekt-produktion': 'a2/perfekt-haben-sein-produktion',
  'a2/termine-produktion': 'a2/termine-vereinbaren-produktion',
  'a2/verben-mit-kasus-anwenden': 'a2/verben-mit-kasus-produktion',
  'a2/verbindungen-darum-daher': 'a2/verbindungen-folgen-darum-daher',
  'a2/verbindungen-darum-daher-transfer': 'a2/verbindungen-folgen-darum-daher-transfer',
  'a2/wohnen-raumgrenzen': 'a2/wohnen-umzug-raumgrenzen',
  'a2/wohnen-raumgrenzen-transfer': 'a2/wohnen-umzug-raumgrenzen-transfer',
  'a2/wohnen-richtungsadverbien': 'a2/wohnen-umzug-richtungsadverbien',
  'a2/wohnen-richtungsadverbien-transfer': 'a2/wohnen-umzug-richtungsadverbien-transfer',
  'a2/zeit-praepositionen-anwenden': 'a2/zeit-praepositionen-produktion',
  'b1/ls-arbeit-bewerbung-01-hoeren': 'b1/arbeit-bewerbung-hoeren',
  'b1/ls-erfahrungen-erzaehlen-01-hoeren': 'b1/erfahrungen-erzaehlen-hoeren',
  'b1/ls-gesundheit-wohlbefinden-01-hoeren': 'b1/gesundheit-wohlbefinden-hoeren',
  'b1/ls-konsum-umwelt-01-hoeren': 'b1/konsum-umwelt-hoeren',
  'b1/ls-leben-veraendern-01-hoeren': 'b1/leben-veraendern-hoeren',
  'b1/ls-lernen-zukunft-01-hoeren': 'b1/lernen-zukunft-hoeren',
  'b1/ls-meinung-medien-01-hoeren': 'b1/meinung-medien-hoeren',
  'b1/ls-regeln-verantwortung-01-hoeren': 'b1/regeln-verantwortung-hoeren',
  'b1/ls-reisen-probleme-01-hoeren': 'b1/reisen-probleme-hoeren',
};

/**
 * Items moved between sets with their history (ADR 0019): `"<old-set-id>::<item-id>"` to the id of
 * the set that holds the item now. The item id and its revision travel unchanged; only the set
 * half of its location changes. A key names its set by the current id, so a lookup takes the set
 * map first; a moved item may move again, so the lookup follows the chain.
 *
 * `itemMoveProblems` holds every entry against the corpus (run by `bun run validate`): the new set
 * holds the item, the old location never holds it again, and every chain ends.
 */
export const ITEM_MOVES: Readonly<Record<string, string>> = {};

/** The current id of a set, for an id that may predate a rename. */
export function currentSetId(setId: string): string {
  return Object.hasOwn(SET_ID_MIGRATION, setId) ? SET_ID_MIGRATION[setId]! : setId;
}

/** Hops a chain of moves may take before it is treated as a cycle (`itemMoveProblems` fails one). */
const MAX_MOVE_HOPS = 32;

/** The set that holds an item now, for a location that may predate a rename or a move. */
export function currentItemSetId(setId: string, itemId: string): string {
  let current = currentSetId(setId);
  for (let hop = 0; hop < MAX_MOVE_HOPS; hop++) {
    const key = `${current}::${itemId}`;
    if (!Object.hasOwn(ITEM_MOVES, key)) return current;
    const next = ITEM_MOVES[key]!;
    current = currentSetId(next);
  }
  return current;
}

/**
 * Every earlier location an item at `setId` was moved from, as `<set-id>::<item-id>` — what a
 * reader of per-item local state (a write draft) looks up when the current key holds nothing.
 */
export function formerItemLocations(setId: string, itemId: string): string[] {
  return Object.keys(ITEM_MOVES).filter((key) => {
    const cut = key.lastIndexOf('::');
    return key.slice(cut + 2) === itemId && currentItemSetId(key.slice(0, cut), itemId) === setId;
  });
}

/**
 * Attempts with every location current. Returns the input array itself when nothing needed
 * renaming or moving, so the common case allocates nothing and an unchanged blob is not rewritten.
 */
export function migrateAttemptSetIds<T extends { setId: string; itemId: string }>(
  attempts: T[],
): T[] {
  const stale = (attempt: T) => currentItemSetId(attempt.setId, attempt.itemId) !== attempt.setId;
  if (!attempts.some(stale)) return attempts;
  return attempts.map((attempt) =>
    stale(attempt)
      ? { ...attempt, setId: currentItemSetId(attempt.setId, attempt.itemId) }
      : attempt,
  );
}

/**
 * What the corpus must keep true of a move map, as messages (empty when it holds):
 * - a key is `<set-id>::<item-id>`, names its set by the current id (never a renamed one), and
 *   names a different set than its target;
 * - the set a move ends in exists and holds the item;
 * - the location a key names holds no item of that id — a moved-out
 *   location is never reused, or its new item would inherit the moved item's history;
 * - every chain ends.
 *
 * `sets` maps each current set id to the item ids it holds. The map is a parameter so the tests
 * can watch each rule fail on a planted entry.
 */
export function itemMoveProblems(
  sets: ReadonlyMap<string, ReadonlySet<string>>,
  moves: Readonly<Record<string, string>> = ITEM_MOVES,
): string[] {
  const problems: string[] = [];
  const target = (setId: string, itemId: string): string | undefined => {
    const key = `${setId}::${itemId}`;
    return Object.hasOwn(moves, key) ? moves[key] : undefined;
  };
  for (const [key, to] of Object.entries(moves)) {
    const cut = key.lastIndexOf('::');
    const from = cut > 0 ? key.slice(0, cut) : '';
    const itemId = cut > 0 ? key.slice(cut + 2) : '';
    if (!from || !itemId || from.includes(':') || itemId.includes(':')) {
      problems.push(`item move "${key}" is not <set-id>::<item-id>`);
      continue;
    }
    if (currentSetId(from) !== from) {
      problems.push(
        `item move "${key}" names a renamed set — write it under the current id, "${currentSetId(from)}::${itemId}"`,
      );
      continue;
    }
    if (from === currentSetId(to)) {
      problems.push(`item move "${key}" points to its own set`);
      continue;
    }
    if (sets.get(from)?.has(itemId))
      problems.push(
        `item move "${key}": "${from}" still holds "${itemId}" — a moved-out location is never reused`,
      );
    let at = currentSetId(to);
    const seen = new Set([from]);
    let ended = false;
    for (let hop = 0; hop < MAX_MOVE_HOPS; hop++) {
      if (seen.has(at)) break;
      seen.add(at);
      const next = target(at, itemId);
      if (next === undefined) {
        ended = true;
        break;
      }
      at = currentSetId(next);
    }
    if (!ended) {
      problems.push(`item move "${key}" never ends — its chain returns to a set it left`);
      continue;
    }
    if (!sets.has(at)) problems.push(`item move "${key}" ends in "${at}", which is not a set`);
    else if (!sets.get(at)!.has(itemId))
      problems.push(`item move "${key}" ends in "${at}", which holds no item "${itemId}"`);
  }
  return problems;
}
