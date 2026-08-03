/**
 * `bun run progress:pull` — the half that decides what lands on disk.
 *
 * The refuse-to-shrink rule is the same one the dev writer applies
 * (src/integrations/progress-writer.ts) and exists for the same reason: a
 * profile's attempt log only grows within a day, so a *smaller* snapshot
 * arriving under the same name is a different learner state, not a save. The
 * failure it prevents is silent — a blind write flattens a real day of work and
 * the audit then reports the smaller number as fact.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, writeSnapshot } from '../scripts/progress-pull';

const dirs: string[] = [];

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'da-pull-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A snapshot fixture states every field the assertion depends on — attempts is the one that matters. */
function snapshot(attempts: number): string {
  return JSON.stringify({
    version: 7,
    exportedAt: '2026-08-03T10:00:00.000Z',
    attempts: Array.from({ length: attempts }, (_, index) => ({
      setId: 'a1/artikel',
      itemId: `item-${index}`,
      itemType: 'cloze',
      correct: true,
      given: 'der',
      ts: 1_000 + index,
    })),
    cards: {},
    sessions: [],
    topics: {},
    feedback: {},
  });
}

describe('writeSnapshot', () => {
  test('writes when the target does not exist', () => {
    const dir = workDir();
    const target = join(dir, '2026-08-03.json');
    expect(writeSnapshot(target, snapshot(3), 3)).toBe('written');
    expect(JSON.parse(readFileSync(target, 'utf8')).attempts).toHaveLength(3);
  });

  test('overwrites when the pulled snapshot has grown', () => {
    const dir = workDir();
    const target = join(dir, '2026-08-03.json');
    writeFileSync(target, snapshot(3));
    expect(writeSnapshot(target, snapshot(5), 5)).toBe('written');
    expect(JSON.parse(readFileSync(target, 'utf8')).attempts).toHaveLength(5);
  });

  test('overwrites when the count is equal — an unchanged day is still a save', () => {
    const dir = workDir();
    const target = join(dir, '2026-08-03.json');
    writeFileSync(target, snapshot(4));
    expect(writeSnapshot(target, snapshot(4), 4)).toBe('written');
  });

  test('refuses to shrink, and parks the incoming state beside the file rather than dropping it', () => {
    const dir = workDir();
    const target = join(dir, '2026-08-03.json');
    writeFileSync(target, snapshot(9));

    const result = writeSnapshot(target, snapshot(2), 2);
    expect(result).not.toBe('written');

    // The file on disk is untouched…
    expect(JSON.parse(readFileSync(target, 'utf8')).attempts).toHaveLength(9);
    // …and nothing was lost: the smaller state is beside it, under a conflict name.
    const parked = readdirSync(dir).filter((name) => name.includes('.conflict-'));
    expect(parked).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, parked[0]!), 'utf8')).attempts).toHaveLength(2);
  });
});

describe('parseArgs', () => {
  test('requires a profile', () => {
    expect(() => parseArgs([])).toThrow('--profile');
  });

  test('a profile must be a slug — it becomes a directory name', () => {
    expect(() => parseArgs(['--profile', '../etc'])).toThrow('slug');
  });

  test('a date must be ISO', () => {
    expect(() => parseArgs(['--profile', 'vitaly', '--date', '03.08.2026'])).toThrow('YYYY-MM-DD');
  });

  test('reads the whole flag set', () => {
    expect(parseArgs(['--profile', 'vitaly', '--account', 'abc', '--date', '2026-08-01'])).toEqual({
      profile: 'vitaly',
      account: 'abc',
      date: '2026-08-01',
      list: false,
    });
  });

  test('--list needs no profile', () => {
    expect(parseArgs(['--list']).list).toBe(true);
  });
});
