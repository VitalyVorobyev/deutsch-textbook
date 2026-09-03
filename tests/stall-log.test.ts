/**
 * The stall log (src/lib/stall-log.ts) is the evidence the failure behind ADR 0018 did not
 * leave. The learner saw "Fortschritt konnte nicht geladen werden"; every fact that said
 * what was *not* wrong — a 1.7 MB backup two hours old, an empty write journal, an intact
 * profile registry, a sync API answering in 41 ms — had to be dug out of the machine
 * afterwards, and nothing at all said which read stalled, how long it waited, or whether it
 * ever came back.
 *
 * The two properties that make it safe to ship are pinned here beside the behaviour: it is
 * **bounded** (a diagnostic may not be the reason a quota is hit) and it carries **no
 * learner content** (a diagnostic that does is a second copy of the data it diagnoses).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  STALL_LOG_CAP,
  clearStallLog,
  readStallLog,
  recentStalls,
  recordRecovery,
  recordStall,
} from '../src/lib/stall-log';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
});
afterEach(() => {
  localStorage.clear();
});

describe('stall log', () => {
  test('records a stall and returns an id that finds it again', () => {
    const id = recordStall({ surface: 'themen', waitedMs: 10_004, attempts: 3 });
    const log = readStallLog();
    expect(log).toEqual([
      { id, surface: 'themen', waitedMs: 10_004, attempts: 3, at: log[0].at },
    ]);
    expect(log[0].at).toBeGreaterThan(0);
  });

  test('a caller that names no surface still produces a readable row', () => {
    recordStall({ waitedMs: 1, attempts: 1 });
    expect(readStallLog()[0].surface).toBe('read');
  });

  test('recovery is recorded on the right row, and only once', () => {
    const first = recordStall({ surface: 'heute', waitedMs: 10_000, attempts: 3 });
    const second = recordStall({ surface: 'karten', waitedMs: 10_000, attempts: 3 });
    recordRecovery(first, 12_500);
    // A second recovery for the same row must not overwrite the first measurement.
    recordRecovery(first, 99_000);
    recordRecovery('no-such-id', 1);

    const byId = new Map(readStallLog().map((e) => [e.id, e]));
    expect(byId.get(first)!.recoveredAfterMs).toBe(12_500);
    expect(byId.get(second)!.recoveredAfterMs).toBeUndefined();
  });

  test('the log is bounded, keeping the newest entries', () => {
    const ids = Array.from({ length: STALL_LOG_CAP + 7 }, (_, i) =>
      recordStall({ surface: `s${i}`, waitedMs: i, attempts: 1 }),
    );
    const log = readStallLog();
    expect(log).toHaveLength(STALL_LOG_CAP);
    expect(log.map((e) => e.id)).toEqual(ids.slice(-STALL_LOG_CAP));
  });

  test('nothing but counters and timestamps is ever stored', () => {
    recordStall({ surface: 'themen', waitedMs: 10_000, attempts: 3 });
    recordRecovery(readStallLog()[0].id, 11_000);
    const stored = Object.keys(readStallLog()[0]).sort();
    // Extending this list is a deliberate act: every field here goes to disk on a machine
    // whose learner is not expecting a diagnostic to hold their answers.
    expect(stored).toEqual(['at', 'attempts', 'id', 'recoveredAfterMs', 'surface', 'waitedMs']);
  });

  test('recentStalls windows by age and returns newest first', () => {
    const now = Date.parse('2026-09-03T18:00:00.000Z');
    recordStall({ surface: 'old', waitedMs: 1, attempts: 1 });
    recordStall({ surface: 'new', waitedMs: 1, attempts: 1 });
    // Backdate the first row past the window; the second stays inside it.
    const raw = readStallLog();
    raw[0].at = now - 9 * 24 * 60 * 60 * 1000;
    raw[1].at = now - 60 * 1000;
    localStorage.setItem('da:stall-log:test', JSON.stringify(raw));

    expect(recentStalls(7, now).map((e) => e.surface)).toEqual(['new']);
    expect(recentStalls(30, now).map((e) => e.surface)).toEqual(['new', 'old']);
  });

  test('a corrupt or absent value reads as an empty log, never as a throw', () => {
    expect(readStallLog()).toEqual([]);
    localStorage.setItem('da:stall-log:test', 'not json');
    expect(readStallLog()).toEqual([]);
    localStorage.setItem('da:stall-log:test', '{"not":"an array"}');
    expect(readStallLog()).toEqual([]);
    // A well-formed array with a malformed member keeps the members that parse.
    localStorage.setItem(
      'da:stall-log:test',
      JSON.stringify([{ nope: true }, { id: 'a', surface: 'x', waitedMs: 1, attempts: 1, at: 5 }]),
    );
    expect(readStallLog().map((e) => e.id)).toEqual(['a']);
  });

  test('clearStallLog empties it', () => {
    recordStall({ surface: 'themen', waitedMs: 1, attempts: 1 });
    clearStallLog();
    expect(readStallLog()).toEqual([]);
  });
});
