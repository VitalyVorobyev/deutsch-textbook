/**
 * The A1 lexical relocation renames 174 card ids, and a learner meets that rename in two
 * places: importing a snapshot, and simply opening the app. Snapshot import is covered in
 * snapshot.test.ts; this file covers the live path, which shipped unwired — the map was
 * imported only by `parseProgressSnapshot`, so on a real device `planReview` would have
 * missed every renamed id and dealt 174 known cards as new.
 *
 * Scope, stated rather than implied: `migrateStoredCardIds` is exercised directly with
 * in-memory read/write, because the test environment has no IndexedDB. That covers the
 * rename, the collision merge, the write-only-when-needed guard and idempotency. It does
 * not execute `getStore`'s call site; only `bun run dev` against a seeded profile does.
 */
import { describe, expect, test } from 'bun:test';
import {
  A1_CARD_ID_MIGRATION,
  migrateCardIds,
  needsCardIdMigration,
} from '../src/lib/a1-card-id-migration';
import { mergeCards } from '../src/lib/snapshot-merge';
import { migrateStoredCardIds, type CardStates, type StoredCard } from '../src/lib/store';

const card = (over: Partial<StoredCard> = {}): StoredCard => ({
  due: '2026-08-10T00:00:00.000Z',
  stability: 12,
  difficulty: 5,
  elapsed_days: 3,
  scheduled_days: 7,
  learning_steps: 0,
  reps: 4,
  lapses: 1,
  state: 2,
  ...over,
});

/** An in-memory stand-in for the profile's `cards` blob. */
function fakeStore(initial: CardStates) {
  let blob: CardStates | undefined = initial;
  let writes = 0;
  return {
    read: async () => blob,
    write: async (cards: CardStates) => {
      blob = cards;
      writes += 1;
    },
    get blob() {
      return blob!;
    },
    get writes() {
      return writes;
    },
  };
}

describe('live card-id migration', () => {
  test('renames a relocated card in the stored blob, keeping its FSRS record', async () => {
    const store = fakeStore({
      'trennbare-verben::anrufen::de-x': card({ reps: 9, stability: 31 }),
      'a1/untouched::Haus::de-x': card(),
    });

    expect(await migrateStoredCardIds(store.read, store.write)).toBe(true);
    expect(store.blob['trennbare-a1-verben::anrufen::de-x']).toMatchObject({
      reps: 9,
      stability: 31,
    });
    expect(store.blob['trennbare-verben::anrufen::de-x']).toBeUndefined();
    // Anything the map does not name is left exactly where it was.
    expect(store.blob['a1/untouched::Haus::de-x']).toBeDefined();
  });

  test('two ids that collapse into one keep the more advanced record', async () => {
    // `perfekt-verben::kommen` and `erste-schritte::kommen` are the same card after the move.
    const store = fakeStore({
      'perfekt-verben::kommen::de-x': card({ reps: 12, stability: 40 }),
      'erste-schritte::kommen::de-x': card({ reps: 2, stability: 3 }),
    });

    await migrateStoredCardIds(store.read, store.write);
    expect(Object.keys(store.blob)).toEqual(['erste-schritte::kommen::de-x']);
    expect(store.blob['erste-schritte::kommen::de-x']).toMatchObject({ reps: 12, stability: 40 });
  });

  test('writes nothing when no renamed id is present, on every later open', async () => {
    const store = fakeStore({ 'erste-schritte::Haus::de-x': card() });
    expect(await migrateStoredCardIds(store.read, store.write)).toBe(false);
    expect(store.writes).toBe(0);
  });

  test('is idempotent — a second pass finds nothing left to rename', async () => {
    const store = fakeStore({ 'dativ-verben::helfen::x-de': card() });
    expect(await migrateStoredCardIds(store.read, store.write)).toBe(true);
    expect(await migrateStoredCardIds(store.read, store.write)).toBe(false);
    expect(store.writes).toBe(1);
  });

  test('an empty or absent blob is not a write', async () => {
    let wrote = false;
    expect(await migrateStoredCardIds(async () => undefined, async () => { wrote = true; })).toBe(false);
    expect(await migrateStoredCardIds(async () => ({}), async () => { wrote = true; })).toBe(false);
    expect(wrote).toBe(false);
  });

  test('every mapped id actually moves, and no new id is itself a key', () => {
    // A map entry whose target is also a source would rename twice under a different
    // iteration order — the one way `migrateCardIds` could stop being idempotent.
    const targets = new Set(Object.values(A1_CARD_ID_MIGRATION));
    for (const source of Object.keys(A1_CARD_ID_MIGRATION))
      expect(targets.has(source)).toBe(false);

    const all = Object.fromEntries(Object.keys(A1_CARD_ID_MIGRATION).map((id) => [id, card()]));
    const once = migrateCardIds(all, mergeCards);
    expect(needsCardIdMigration(once)).toBe(false);
    expect(migrateCardIds(once, mergeCards)).toEqual(once);
  });
});
