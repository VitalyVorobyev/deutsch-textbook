import { describe, expect, test } from 'bun:test';
import { listeningItemSchema } from '../src/lib/schemas';

const base = {
  id: 'hoeren-1',
  type: 'listening' as const,
  listening: 'a2/am-bahnhof',
  audio: '/audio/a2/am-bahnhof.wav',
  transcript: [{ id: 'line-1', speaker: 'Lea', text: 'Der Zug fährt um neun.' }],
};

describe('listening response contract', () => {
  test('accepts all six independently scored response forms', () => {
    const responses = [
      { kind: 'single-choice', prompt: 'Wann?', options: ['neun', 'zehn'], correct: 0 },
      { kind: 'multi-select', prompt: 'Was?', options: ['Zug', 'Bus'], correct: [0] },
      { kind: 'true-false', statement: 'Der Zug fährt.', correct: true },
      { kind: 'ordering', prompt: 'Ordnen.', units: ['zuerst', 'danach'] },
      { kind: 'short-answer', prompt: 'Wann?', answers: ['um neun'] },
      { kind: 'dictation', line_id: 'line-1', accept: [] },
    ];
    for (const response of responses) {
      expect(listeningItemSchema.parse({ ...base, response }).response.kind).toBe(response.kind);
    }
  });

  test('requires an exact transcript snapshot', () => {
    expect(() =>
      listeningItemSchema.parse({
        ...base,
        transcript: [],
        response: { kind: 'single-choice', prompt: 'Wann?', options: ['neun', 'zehn'], correct: 0 },
      }),
    ).toThrow();
  });
});
