/**
 * Renamed exercise sets keep their history. A set id is half of an attempt's identity, so a
 * learner meets the rename wherever attempts enter or are compared: importing or syncing a
 * snapshot, merging two logs, and reading the live blob, which keeps old ids on disk until the
 * next merge rewrites it. Each path is held here, along with the two rules the map itself must
 * keep against the corpus.
 *
 * Scope: `getAttempts` needs IndexedDB, which the test environment lacks; it calls the same
 * `migrateAttemptSetIds` exercised below.
 */
import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { SET_ID_MIGRATION, currentSetId, migrateAttemptSetIds } from '../src/lib/set-id-migration';
import { attemptKey, mergeAttempts } from '../src/lib/snapshot-merge';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import type { Attempt } from '../src/lib/store';

const OLD = 'a2/hoeren-dativ';
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
