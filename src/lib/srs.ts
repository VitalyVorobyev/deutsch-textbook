/** FSRS scheduling and deck building. */
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import type { VocabEntry, WordField, Wortnetz } from './schemas';
import { shuffle } from './shuffle';
import { localDateString, type StoredCard } from './store';

export { Rating } from 'ts-fsrs';
export type { Grade };

export const scheduler = fsrs({ enable_fuzz: true });

// ---------------------------------------------------------------------------
// Card identity & deck building
// ---------------------------------------------------------------------------

export type Direction = 'de-x' | 'x-de';

/** Stable card id: vocab file id + German headword + direction.
    Renaming a headword resets that card's history — see CLAUDE.md. */
export function cardId(deckId: string, de: string, dir: Direction): string {
  return `${deckId}::${de}::${dir}`;
}

/** Everything a flashcard needs at review time, serializable as island props. */
export interface CardDef {
  id: string;
  deckId: string;
  dir: Direction;
  de: string;
  en: string;
  ru: string;
  /** Optional Ukrainian gloss (translation waves) — display-only, like en/ru.
      Never part of card identity: cardId() keys on deckId + de + dir alone,
      and stored state (StoredCard) holds FSRS fields only. */
  uk?: string;
  /** Lautschrift of the headword alone, bare — the UI adds the brackets */
  ipa?: string;
  /** display form with article/plural for nouns, aux+partizip for verbs */
  deDetail?: string;
  exampleDe: string;
  exampleEn: string;
  exampleRu: string;
  exampleUk?: string;
  pos: string;
  /** nouns only — the typed answer must include the matching article */
  gender?: 'm' | 'f' | 'n';
  /** other correct typed answers (reflexive `sich …`, an adjectival noun's other
      article forms) — see `accept` in schemas.ts */
  accept?: string[];
  /**
   * The entry's usage note, rendered on the ANSWER side only.
   *
   * It lives here because it had nowhere else to go: before this field a note
   * was visible in the Wortschatz table and nowhere on a card, so authors who
   * wanted a construction hint on a card inlined it into the `en`/`ru` gloss —
   * which is the question side of the x-de card. Eight entries ended up
   * printing their own answer in their own prompt (`gern` → "gladly; (verb +
   * gern) to like doing something"), and the learner typed `lieber`, reasoning
   * that a prompt showing `gern` could not be asking for `gern`. Giving the
   * note a home on the back removes the pressure that produced that.
   */
  note?: { en: string; ru: string; uk?: string; de?: string };
  /** Optional answer-side context; never changes the scheduled lexical target. */
  context?: LexicalContext[];
}

export interface LexicalContext {
  type: 'collocation' | 'contrast' | 'meaning-contrast' | 'family' | 'formation' | 'register';
  /** the related German word/phrase — content, not an explanation half */
  de: string;
  en: string;
  ru: string;
  uk?: string;
  /** the explanation's German-medium half (bilingualSchema `de`) — it cannot
      live on the `de` key, which the phrase above already occupies */
  explanationDe?: string;
  exampleDe?: string;
  exampleEn?: string;
  exampleRu?: string;
  exampleUk?: string;
}

export type LexicalContextMap = Record<string, LexicalContext[]>;
const lexicalKey = (deck: string, de: string) => `${deck}::${de}`;

export function wordFieldContexts(fields: WordField[]): LexicalContextMap {
  const contexts: LexicalContextMap = {};
  for (const field of fields) {
    for (const member of field.members) {
      if (member.kind !== 'card' || member.relations.length === 0) continue;
      contexts[lexicalKey(member.ref.deck, member.ref.de)] = member.relations.map((relation) => ({
        type: relation.type,
        de: relation.de,
        en: relation.explanation.en,
        ru: relation.explanation.ru,
        uk: relation.explanation.uk,
        explanationDe: relation.explanation.de,
        exampleDe: relation.example_de,
        exampleEn: relation.example?.en,
        exampleRu: relation.example?.ru,
        exampleUk: relation.example?.uk,
      }));
    }
  }
  return contexts;
}

/** Cross-topic network relations shown on an existing card's answer side.
    Receptive members remain context only: this function never builds cards. */
export function wortnetzContexts(networks: Wortnetz[]): LexicalContextMap {
  const contexts: LexicalContextMap = {};
  for (const network of networks) {
    const members = new Map(network.members.map((member) => [member.id, member]));
    for (const relation of network.relations) {
      const source = members.get(relation.from);
      const target = members.get(relation.to);
      if (!source || source.kind !== 'card' || !target) continue;
      const key = lexicalKey(source.ref.deck, source.ref.de);
      const targetDe = target.kind === 'card' ? target.ref.de : target.de;
      const entry: LexicalContext = {
        type: relation.type,
        de: targetDe,
        en: relation.explanation.en,
        ru: relation.explanation.ru,
        uk: relation.explanation.uk,
        explanationDe: relation.explanation.de,
        exampleDe: target.example.de,
        exampleEn: target.example.en,
        exampleRu: target.example.ru,
        exampleUk: target.example.uk,
      };
      (contexts[key] ??= []).push(entry);
    }
  }
  return contexts;
}

export function mergeLexicalContexts(...maps: LexicalContextMap[]): LexicalContextMap {
  const merged: LexicalContextMap = {};
  for (const map of maps) {
    for (const [key, entries] of Object.entries(map)) {
      (merged[key] ??= []).push(...entries);
    }
  }
  return merged;
}

function deDetail(e: VocabEntry): string | undefined {
  if (e.pos === 'noun' && e.plural) return `Plural: ${e.plural}`;
  if (e.pos === 'verb') {
    const parts: string[] = [];
    if (e.praesens_3sg) parts.push(`er/sie ${e.praesens_3sg}`);
    if (e.partizip2) parts.push(`${e.aux === 'sein' ? 'ist' : 'hat'} ${e.partizip2}`);
    if (e.valence) parts.push(e.valence);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (e.valence) return e.valence;
  return undefined;
}

export function buildDeck(
  deckId: string,
  entries: VocabEntry[],
  contexts: LexicalContextMap = {},
): CardDef[] {
  const cards: CardDef[] = [];
  for (const e of entries) {
    const base = {
      deckId,
      de: e.de,
      en: e.en,
      ru: e.ru,
      uk: e.uk,
      ipa: e.ipa,
      deDetail: deDetail(e),
      exampleDe: e.example_de,
      exampleEn: e.example_en,
      exampleRu: e.example_ru,
      exampleUk: e.example_uk,
      pos: e.pos,
      gender: e.pos === 'noun' ? e.gender : undefined,
      accept: e.accept?.length ? e.accept : undefined,
      note: e.note,
      context: contexts[lexicalKey(deckId, e.de)],
    };
    cards.push({ ...base, id: cardId(deckId, e.de, 'de-x'), dir: 'de-x' });
    // `cards: recognition` yields the DE→meaning card alone. Defaulted to `both` in the
    // schema, so every entry authored so far is untouched and no card id moves — see the
    // field's comment there for why retrofitting one would destroy SRS history.
    if (e.cards !== 'recognition') {
      cards.push({ ...base, id: cardId(deckId, e.de, 'x-de'), dir: 'x-de' });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// FSRS state (de)serialization
// ---------------------------------------------------------------------------

export function serializeCard(card: Card): StoredCard {
  // ts-fsrs v5 still requires this compatibility field while deprecating its
  // public property ahead of v6. Isolate the adapter read from app code.
  const elapsedDays = (card as unknown as { elapsed_days: number }).elapsed_days;
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

export function deserializeCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as Card['state'],
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

/**
 * Grade a card (existing state or fresh) and return its next stored state.
 *
 * `introducedAt` is stamped on the very first grade and never touched again — it
 * is what `introducedToday` counts, and it is the one thing about a card that FSRS
 * does not already tell us. It is stored rather than derived, which is against the
 * grain here (probe state is derived precisely so that `mergeSnapshot` has nothing
 * to merge), because the obvious derivations are all wrong:
 *   - `reps === 1 && last_review is today` misses a new card the learner failed —
 *     FlashcardSession re-queues an "Again" card inside the same session, so it
 *     reaches reps 2 on the day it was introduced. It undercounts, which lets *more*
 *     new cards through: exactly the wrong direction for a flood guard.
 *   - `elapsed_days === 0 && last_review is today` catches an *old* card that lapsed
 *     today, because ts-fsrs zeroes elapsed_days for any same-day regrade.
 * The cost of storing it is near nil: it lives inside the `cards` record that
 * `mergeSnapshot` already merges whole (`moreAdvancedCard` picks one card object),
 * so it adds no snapshot key and no merge rule. Absent on pre-existing cards, which
 * is correct — they were not introduced today.
 */
export function gradeCard(stored: StoredCard | undefined, grade: Grade, now = new Date()): StoredCard {
  const card = stored ? deserializeCard(stored) : createEmptyCard(now);
  const next = scheduler.next(card, now, grade);
  const out = serializeCard(next.card);

  // Only a card with no state at all is being introduced *now*. An existing card
  // whose `introducedAt` is absent predates the field, and must keep it absent:
  // stamping it would charge today's new-card budget for a card the learner first
  // met months ago, so a returning learner's first fifteen ordinary reviews would
  // silently eat the whole day's allowance. `stored?.introducedAt ?? today` reads
  // right and is exactly this bug.
  if (stored === undefined) out.introducedAt = localDateString(now);
  else if (stored.introducedAt !== undefined) out.introducedAt = stored.introducedAt;
  return out;
}

/**
 * How many never-seen cards the learner has already been dealt today, across every
 * surface. `newLimit` alone cannot answer this: it caps a single *queue build*, and
 * `planReview` re-runs on every mount, so reloading the review page five times used
 * to introduce 75 new cards — a review debt FSRS would then faithfully deliver for
 * months. With the A2 Wortliste closed the fresh pool triples, which is what turns
 * that from a quirk into a trap.
 */
export function introducedToday(states: Record<string, StoredCard>, now = new Date()): number {
  const today = localDateString(now);
  let n = 0;
  for (const s of Object.values(states)) if (s.introducedAt === today) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Session queue
// ---------------------------------------------------------------------------

export interface QueueSplit {
  due: CardDef[];
  fresh: CardDef[];
}

/** Split a deck into due cards (have state, due <= now) and new cards (no state). */
export function splitQueue(
  cards: CardDef[],
  states: Record<string, StoredCard>,
  now = new Date(),
): QueueSplit {
  const due: CardDef[] = [];
  const fresh: CardDef[] = [];
  for (const c of cards) {
    const s = states[c.id];
    if (!s) fresh.push(c);
    else if (new Date(s.due) <= now) due.push(c);
  }
  return { due, fresh };
}

/**
 * Due ordering: most overdue first, then fragile/lapsed cards.
 *
 * Genuine ties are broken at random, not by card id. Sorting ties by id made
 * every session deal the same cards in the same sequence — and, because a
 * word's two card ids differ only in their direction suffix, it dealt both
 * directions of a word back to back. The learner then recognised an order
 * instead of recalling words. Array.sort is stable, so shuffling first is what
 * randomizes the ties while the overdue ranking above them stays exact.
 */
export function rankDueCards(cards: CardDef[], states: Record<string, StoredCard>): CardDef[] {
  return shuffle(cards).sort((a, b) => {
    const sa = states[a.id];
    const sb = states[b.id];
    const due = Date.parse(sa.due) - Date.parse(sb.due);
    if (due) return due;
    if (sa.stability !== sb.stability) return sa.stability - sb.stability;
    return sb.lapses - sa.lapses;
  });
}

/** The word a card asks about — its two directions share one. */
const wordKey = (card: CardDef): string => `${card.deckId}::${card.de}`;

/**
 * Pull the two directions of the same word apart.
 *
 * "Brot → bread" immediately followed by "bread → Brot" is not two retrievals:
 * the first card hands the learner the answer to the second, and the typed
 * production — the whole point of the x-de direction — becomes copying. Walk
 * the queue and take the first card whose word has not come up in the last
 * `gap` cards, keeping the ordering above it otherwise intact. A queue too
 * small to separate them (a two-card deck) takes the card anyway rather than
 * dropping it.
 */
export function spaceSiblings(cards: CardDef[], gap = 4): CardDef[] {
  const pool = [...cards];
  const waiting = new Map<string, number>();
  for (const card of pool) waiting.set(wordKey(card), (waiting.get(wordKey(card)) ?? 0) + 1);

  const out: CardDef[] = [];
  while (pool.length > 0) {
    const recent = new Set(out.slice(-gap).map(wordKey));
    const free = pool.filter((card) => !recent.has(wordKey(card)));
    // Among the cards clear of the window, take the one whose word still has the
    // most cards waiting. Plain first-fit strands a word's last two cards at the
    // tail with nothing left to separate them; spending the doubled words early
    // is what keeps the queue solvable. Counts tie for every ordinary word, and
    // the reduce keeps the first — so the overdue/curriculum order above survives.
    const pick = free.length > 0
      ? free.reduce((best, card) =>
        (waiting.get(wordKey(card)) ?? 0) > (waiting.get(wordKey(best)) ?? 0) ? card : best)
      : pool[0]!; // a deck too small to separate: keep the card rather than drop it

    waiting.set(wordKey(pick), (waiting.get(wordKey(pick)) ?? 1) - 1);
    pool.splice(pool.indexOf(pick), 1);
    out.push(pick);
  }
  return out;
}
