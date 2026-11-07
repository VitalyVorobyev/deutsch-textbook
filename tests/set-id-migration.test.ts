/**
 * Renamed exercise sets keep their history. A set id is half of an attempt's identity, so a
 * learner meets the rename wherever attempts enter or are compared: importing or syncing a
 * snapshot, merging two logs, and reading the live blob, which keeps old ids on disk until the
 * next merge rewrites it. Each path is held here, along with the two rules the map itself must
 * keep against the corpus.
 *
 * Scope: `getAttempts` needs IndexedDB, which the test environment lacks; it calls the same
 * `migrateAttemptSetIds` exercised below, which applies the item move map too.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import {
  ITEM_MOVES,
  SET_ID_MIGRATION,
  currentItemSetId,
  currentSetId,
  formerItemLocations,
  itemMoveProblems,
  migrateAttemptSetIds,
} from '../src/lib/set-id-migration';
import { attemptKey, mergeAttempts } from '../src/lib/snapshot-merge';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import type { Attempt } from '../src/lib/store';

const OLD = 'a2/hoeren-dativ';
/** The map as shipped, copied before the item-move block plants its fixture entry. */
const SHIPPED_MOVES = { ...ITEM_MOVES };
const NEW = 'a2/dativ-diktat';

const attempt = (setId: string, ts = 1): Attempt => ({
  setId,
  itemId: 'hoeren-mit-dem-bus',
  itemType: 'listen',
  correct: true,
  given: 'Ich fahre mit dem Bus.',
  ts,
});

describe('the map against the corpus', () => {
  const exists = (id: string) => existsSync(`content/exercises/${id}.yaml`);

  test('every new id is a set that exists, and no old id does', () => {
    for (const [from, to] of Object.entries(SET_ID_MIGRATION)) {
      expect({ from, exists: exists(from) }).toEqual({ from, exists: false });
      expect({ to, exists: exists(to) }).toEqual({ to, exists: true });
    }
  });

  test('the map is flat: no new id is renamed again', () => {
    for (const to of Object.values(SET_ID_MIGRATION))
      expect(Object.hasOwn(SET_ID_MIGRATION, to)).toBe(false);
  });

  test('the fixture pair is a real entry', () => {
    expect(SET_ID_MIGRATION[OLD]).toBe(NEW);
  });
});

describe('migrateAttemptSetIds', () => {
  test('renames old ids and leaves current ones', () => {
    const out = migrateAttemptSetIds([attempt(OLD), attempt('a2/dativ', 2)]);
    expect(out.map((a) => a.setId)).toEqual([NEW, 'a2/dativ']);
  });

  test('returns the same array when nothing is old, and is idempotent', () => {
    const current = [attempt(NEW)];
    expect(migrateAttemptSetIds(current)).toBe(current);
    const once = migrateAttemptSetIds([attempt(OLD)]);
    expect(migrateAttemptSetIds(once)).toBe(once);
  });

  test('ignores inherited keys', () => {
    expect(currentSetId('constructor')).toBe('constructor');
  });
});

describe('merging and dedupe', () => {
  test('an old-id and a new-id copy of one attempt are the same attempt', () => {
    expect(attemptKey(attempt(OLD))).toBe(attemptKey(attempt(NEW)));
  });

  test('merging a synced log into a stored one keeps one copy, under the new id', () => {
    const stored = [attempt(OLD, 1), attempt(OLD, 2)];
    const synced = [attempt(NEW, 1), attempt(NEW, 3)];
    const merged = mergeAttempts(stored, synced);
    expect(merged.map((a) => [a.setId, a.ts])).toEqual([
      [NEW, 1],
      [NEW, 2],
      [NEW, 3],
    ]);
  });
});

describe('snapshot import', () => {
  test('a snapshot written before the rename imports with current ids', () => {
    const migrated = parseProgressSnapshot({
      version: 8,
      exportedAt: '2026-10-28T12:00:00.000Z',
      attempts: [attempt(OLD)],
      cards: {},
      sessions: [],
      topics: {},
      feedback: {},
      lid: { cards: {}, answers: [], exams: [] },
    });
    expect(migrated.attempts.map((a) => a.setId)).toEqual([NEW]);
  });
});

/**
 * Item moves (ADR 0019). The shipped map starts empty, so the mechanism is held on a fixture
 * entry planted for this block and removed after it; the rules are held on fixture corpora.
 */
describe('item moves', () => {
  const FROM = 'a2/fixture-mixed';
  const TO = 'a2/fixture-task';
  const ITEM = 'speak-fixture';
  const moves = ITEM_MOVES as Record<string, string>;
  const moved = (setId: string, ts = 1): Attempt => ({
    setId,
    itemId: ITEM,
    itemType: 'speak',
    correct: true,
    given: '',
    ts,
  });

  beforeAll(() => {
    moves[`${FROM}::${ITEM}`] = TO;
  });
  afterAll(() => {
    delete moves[`${FROM}::${ITEM}`];
  });

  test('the shipped map is flat data: <set-id>::<item-id> to a set id', () => {
    // Its corpus rules run in `bun run validate`, through `itemMoveProblems` held below.
    for (const [key, to] of Object.entries(SHIPPED_MOVES)) {
      expect(key).toMatch(/^[a-z0-9]+\/[a-z0-9-]+::[a-z0-9-]+$/);
      expect(to).toMatch(/^[a-z0-9]+\/[a-z0-9-]+$/);
    }
  });

  test('an attempt logged in the old set reads back under the new one', () => {
    expect(currentItemSetId(FROM, ITEM)).toBe(TO);
    expect(currentItemSetId(FROM, 'another-item')).toBe(FROM);
    expect(migrateAttemptSetIds([moved(FROM)]).map((a) => a.setId)).toEqual([TO]);
    const other = { ...moved(FROM), itemId: 'another-item' };
    expect(migrateAttemptSetIds([other])[0]!.setId).toBe(FROM);
  });

  test('an old-location and a new-location copy of one attempt dedupe as one', () => {
    expect(attemptKey(moved(FROM))).toBe(attemptKey(moved(TO)));
    const merged = mergeAttempts([moved(FROM, 1), moved(FROM, 2)], [moved(TO, 1), moved(TO, 3)]);
    expect(merged.map((a) => [a.setId, a.ts])).toEqual([
      [TO, 1],
      [TO, 2],
      [TO, 3],
    ]);
  });

  test('a snapshot written before the move imports at the current location', () => {
    const migrated = parseProgressSnapshot({
      version: 8,
      exportedAt: '2026-11-07T12:00:00.000Z',
      attempts: [moved(FROM)],
      cards: {},
      sessions: [],
      topics: {},
      feedback: {},
      lid: { cards: {}, answers: [], exams: [] },
    });
    expect(migrated.attempts.map((a) => a.setId)).toEqual([TO]);
  });

  test('an attempt logged before a set rename moves with the renamed set', () => {
    moves[`${NEW}::hoeren-fixture`] = TO;
    try {
      expect(currentItemSetId(OLD, 'hoeren-fixture')).toBe(TO);
      expect(currentItemSetId(NEW, 'hoeren-fixture')).toBe(TO);
    } finally {
      delete moves[`${NEW}::hoeren-fixture`];
    }
  });

  test('a write draft is found under the location the item moved from', () => {
    expect(formerItemLocations(TO, ITEM)).toEqual([`${FROM}::${ITEM}`]);
    expect(formerItemLocations(FROM, ITEM)).toEqual([]);
  });

  describe('the rules a move must keep', () => {
    const corpus = (entries: Record<string, string[]>) =>
      new Map(Object.entries(entries).map(([set, items]) => [set, new Set(items)]));

    test('a clean move passes, and so does a chain that ends where the item is', () => {
      expect(
        itemMoveProblems(corpus({ [FROM]: [], [TO]: [ITEM] }), { [`${FROM}::${ITEM}`]: TO }),
      ).toEqual([]);
      expect(
        itemMoveProblems(corpus({ [FROM]: [], [TO]: [], 'a2/third': [ITEM] }), {
          [`${FROM}::${ITEM}`]: TO,
          [`${TO}::${ITEM}`]: 'a2/third',
        }),
      ).toEqual([]);
    });

    test('the new set must exist and hold the item', () => {
      expect(itemMoveProblems(corpus({ [FROM]: [] }), { [`${FROM}::${ITEM}`]: TO })[0]).toContain(
        'which is not a set',
      );
      expect(
        itemMoveProblems(corpus({ [FROM]: [], [TO]: [] }), { [`${FROM}::${ITEM}`]: TO })[0],
      ).toContain(`holds no item "${ITEM}"`);
    });

    test('the old location never holds the item again', () => {
      expect(
        itemMoveProblems(corpus({ [FROM]: [ITEM], [TO]: [ITEM] }), { [`${FROM}::${ITEM}`]: TO })[0],
      ).toContain('never reused');
    });

    test('a key names its set by the current id', () => {
      expect(
        itemMoveProblems(corpus({ [NEW]: [], [TO]: [ITEM] }), { [`${OLD}::${ITEM}`]: TO })[0],
      ).toContain('names a renamed set');
    });

    test('a chain must end, and a key must leave its set', () => {
      expect(
        itemMoveProblems(corpus({ [FROM]: [], [TO]: [] }), {
          [`${FROM}::${ITEM}`]: TO,
          [`${TO}::${ITEM}`]: FROM,
        }).some((problem) => problem.includes('never ends')),
      ).toBe(true);
      expect(
        itemMoveProblems(corpus({ [FROM]: [ITEM] }), { [`${FROM}::${ITEM}`]: FROM })[0],
      ).toContain('its own set');
      expect(itemMoveProblems(corpus({}), { 'no-separator': TO })[0]).toContain('is not <set-id>');
    });
  });
});
