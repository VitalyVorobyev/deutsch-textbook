/**
 * The headword a learner READS, as distinct from the headword the corpus KEYS on.
 *
 * A vocab entry's `de` is three things at once (docs/authoring/item-authoring.md, `accept`):
 * the Wortliste key, the answer shown and the answer typed. For a reflexive verb whose Wortliste
 * key is bare — `gewöhnen` in the Goethe B1 list — the key must stay bare, and
 * `accept: ["sich gewöhnen"]` already settles the typed answer. The shown answer was the one left
 * over: the card for "to get used to" printed `gewöhnen`, which is not what the learner has to
 * produce. So the shown form is derived here, never authored: `sich ${de}` whenever reflexivity
 * is declared and `de` does not already carry it.
 *
 * Display only. Card identity (`<deck>::<de>::<direction>`), Wortliste coverage, the manifest,
 * `accept`, grading and every authoring tool keep reading the raw `de`.
 *
 * Pure and dependency-free: React islands and the build both import it.
 */

/** The fields the rule reads — a `VocabEntry` satisfies it, and so does a fixture. */
export interface HeadwordFields {
  pos: string;
  de: string;
  valence?: string;
}

const SICH_HEAD = /^sich\s/;

/**
 * A verb declares its reflexivity when the headword starts with `sich ` or `valence` leads with
 * `sich`. A valence that offers both readings (`+ Akk / sich`, as for `anziehen` = to put a
 * garment on) does not lead with it: that verb is genuinely dual and stays undeclared.
 *
 * `scripts/validate.ts` reads this same function for its reflexive-forms rule, so what the
 * validator calls reflexive and what the learner is shown cannot disagree.
 */
export function reflexivityDeclared(e: HeadwordFields): boolean {
  return e.pos === 'verb' && (SICH_HEAD.test(e.de) || /^sich\b/.test(e.valence ?? ''));
}

/** The headword as printed and spoken: `sich gewöhnen` for `de: gewöhnen` with a valence that
    leads with `sich`; never `sich sich …`; every other entry unchanged. No article — nouns get
    theirs from `gender` where they are rendered (`articledForm`). */
export function shownHeadword(e: HeadwordFields): string {
  return reflexivityDeclared(e) && !SICH_HEAD.test(e.de) ? `sich ${e.de}` : e.de;
}

/**
 * `deck::de` → shown headword, for a surface that prints a card REFERENCE (a Wortfeld or
 * Wortnetz member names its card by deck and raw `de`) and so never holds the entry itself.
 * Lists only the entries whose shown form differs; look up with `?? ref.de`.
 */
export function shownHeadwordIndex(
  decks: Iterable<{ id: string; entries: readonly HeadwordFields[] }>,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const deck of decks) {
    for (const e of deck.entries) {
      const shown = shownHeadword(e);
      if (shown !== e.de) index.set(`${deck.id}::${e.de}`, shown);
    }
  }
  return index;
}
