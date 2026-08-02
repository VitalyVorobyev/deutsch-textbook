import { describe, expect, test } from 'bun:test';
import { deriveStatus, inventory } from '../scripts/listening-inventory';

describe('listening production inventory', () => {
  test('covers every live Atlas unit exactly once', () => {
    const rows = inventory(import.meta.dir + '/..');
    expect(rows).toHaveLength(41);
    expect(new Set(rows.map((row) => row.unit)).size).toBe(41);
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
