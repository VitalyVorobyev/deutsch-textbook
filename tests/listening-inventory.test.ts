import { describe, expect, test } from 'bun:test';
import { deriveStatus, inventory } from '../scripts/listening-inventory';

describe('listening production inventory', () => {
  // The count moves with the spine, in the commit that ships the unit — same rule as the
  // grammar ratchet. B1.10 (gesellschaft-zusammenleben, 2026-08-03) took it 41 → 42. Its
  // artifact is planned, not recorded: the plan entry is what `validate` requires of a live
  // unit, and the recording follows through the Studio, so the wave-1 count does not move.
  test('covers every live Atlas unit exactly once', () => {
    const rows = inventory(import.meta.dir + '/..');
    expect(rows).toHaveLength(42);
    expect(new Set(rows.map((row) => row.unit)).size).toBe(42);
    expect(rows.filter((row) => row.wave === 1)).toHaveLength(12);
  });

  test('derives editorial state without a second mutable status field', () => {
    expect(deriveStatus({ brief: false, artifact: false, audio: false })).toBe('planned');
    expect(deriveStatus({ brief: true, artifact: false, audio: false })).toBe('drafted');
    expect(deriveStatus({ brief: true, manifest: { qa: { passed: false } }, artifact: false, audio: false })).toBe('qa_failed');
    expect(deriveStatus({ brief: true, manifest: { qa: { passed: true } }, artifact: false, audio: false })).toBe('awaiting_approval');
    expect(deriveStatus({ brief: true, manifest: { approval: { status: 'complete' } }, artifact: false, audio: false })).toBe('approved');
    expect(deriveStatus({ brief: true, manifest: { approval: { status: 'complete' } }, artifact: true, audio: true })).toBe('published');
  });
});
