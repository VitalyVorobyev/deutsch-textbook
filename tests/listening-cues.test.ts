import { describe, expect, test } from 'bun:test';
import { listeningCueProblems } from '@da/schema';

/** The validator's rule for a recording's turn cues: one per turn, ordered, inside the file. */

const record = (cues?: { start_ms: number; end_ms: number }[], source?: string) => ({
  transcript: [{}, {}, {}],
  duration_seconds: 10,
  ...(cues ? { cues } : {}),
  ...(source ? { cue_source: source } : {}),
});

const GOOD = [
  { start_ms: 0, end_ms: 3000 },
  { start_ms: 3000, end_ms: 6000 },
  { start_ms: 6000, end_ms: 10_400 },
];

describe('listening cues', () => {
  test('a record without cues, and one with a cue per turn, are both fine', () => {
    expect(listeningCueProblems(record())).toEqual([]);
    expect(listeningCueProblems(record(GOOD, 'whisper-aligned'))).toEqual([]);
  });

  test('cues and their source come together', () => {
    expect(listeningCueProblems(record(GOOD))).toHaveLength(1);
    expect(listeningCueProblems(record(undefined, 'render'))).toHaveLength(1);
  });

  test('one cue per turn, non-empty, in order, inside the recording', () => {
    expect(listeningCueProblems(record(GOOD.slice(0, 2), 'render'))).toEqual([
      '2 cues for 3 transcript turns',
    ]);
    const broken = [
      { start_ms: 0, end_ms: 3000 },
      { start_ms: 2500, end_ms: 2500 },
      { start_ms: 2000, end_ms: 11_500 },
    ];
    expect(listeningCueProblems(record(broken, 'render'))).toEqual([
      'cue 2 ends before it starts',
      'cue 3 ends at 11500 ms, past the 10 s recording',
      'cue 3 starts before cue 2',
    ]);
  });
});
