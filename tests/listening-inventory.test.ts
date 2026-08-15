import { describe, expect, test } from 'bun:test';
import { deriveStatus, inventory } from '../scripts/listening-inventory';

describe('listening production inventory', () => {
  // The count moves with the spine, in the commit that ships the unit — same rule as the
  // grammar ratchet. B1.10 (gesellschaft-zusammenleben, 2026-08-03) took it 41 → 42, and
  // B1.11 (digitales-leben, 2026-08-04) 42 → 43, B1.12 (kultur-freizeit, 2026-08-04)
  // 43 → 44, B1.13 (geld-vertraege, 2026-08-04) 44 → 45 and B1.14
  // (informationen-vermitteln, 2026-08-04) 45 → 46, which closes the B1 spine. All five
  // artifacts are planned, not recorded: the plan entry is what `validate` requires of a
  // live unit, and the recording follows through the Studio, so the wave-1 count does not
  // move. The four are additionally `purpose: model-input` — none of those units owns a
  // listening outcome, so their artifacts carry the genre's spoken form and claim no
  // listening evidence. The prepositions unit ort-richtung-praepositionen (2026-08-12;
  // relocated to A1 by the level-completeness audit later the same day) then took it 46 → 47
  // — appended to the A2 spine at the time, and `model-input` for the same reason: its
  // outcomes are one reading and three writing. Part two of the same strand
  // (verben-mit-kasus, 2026-08-12) took it 47 → 48, `model-input` again and for the
  // same reason, and part three (zeit-praepositionen, 2026-08-12) took it 48 → 49 on the
  // same argument — one reading outcome, three writing ones. The full A1 Wortbildung slice took
  // it 49 → 50 with a model-input plan tied to its compound-reading outcome.
  test('covers every live Atlas unit exactly once', () => {
    const rows = inventory(import.meta.dir + '/..');
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((row) => row.unit)).size).toBe(50);
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
