/**
 * `snapshotWouldShrink` (src/lib/syncdir.ts) is the pure half of the desktop
 * snapshot writer's shrink guard. All three snapshot writers hold the same
 * invariant — attempts only ever grow, so an incoming snapshot with fewer of
 * them is a staler state about to flatten a real day of work: `progress:pull`
 * refuses and parks, the dev middleware answers 409 `would-shrink`
 * (src/integrations/progress-writer.ts), and the desktop writer parks a
 * sibling conflict file. The Tauri fs half is exercised manually (it needs a
 * webview); the decision itself is pinned here.
 */
import { describe, expect, test } from 'bun:test';
import { snapshotWouldShrink } from '../src/lib/syncdir';

const snap = (attempts: number) =>
  JSON.stringify({ version: 7, attempts: Array.from({ length: attempts }, (_, i) => ({ i })) });

describe('snapshotWouldShrink', () => {
  test('fewer attempts than the existing file → shrink', () => {
    expect(snapshotWouldShrink(snap(10), snap(9))).toBe(true);
  });

  test('equal or more attempts → not a shrink', () => {
    expect(snapshotWouldShrink(snap(10), snap(10))).toBe(false);
    expect(snapshotWouldShrink(snap(10), snap(11))).toBe(false);
  });

  test('an existing file that does not parse is park-worthy, never overwritten', () => {
    // progress:pull's stance: investigate rather than delete — a corrupt daily
    // file may still be mostly recoverable, and a blind overwrite destroys it.
    expect(snapshotWouldShrink('{corrupt', snap(0))).toBe(true);
  });

  test('an incoming body that does not parse is a shrink (never replaces a good file)', () => {
    expect(snapshotWouldShrink(snap(0), '{corrupt')).toBe(true);
  });

  test('an existing file without attempts is safely overwritable', () => {
    expect(snapshotWouldShrink(JSON.stringify({ version: 7 }), snap(0))).toBe(false);
  });
});
