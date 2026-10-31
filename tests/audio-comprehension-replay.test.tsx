/**
 * After an answer, a recorded listening item becomes something to study rather than to solve:
 * the transcript, each line replayable alone, the whole take as often as wanted, and slower.
 * Before the answer nothing changes — the task still measures listening, so the replay cap and
 * the hidden transcript stand (ADR 0003: replays are evidence-free either way).
 *
 * Fixtures are inline and state every field the assertions read.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { audioComprehensionItemSchema } from '@da/schema';
import {
  AudioComprehension,
  SLOW_RATE,
  turnAt,
} from '../src/components/exercises/AudioComprehension';

const item = audioComprehensionItemSchema.parse({
  id: 'replay-fixture',
  type: 'audio-comprehension',
  instruction: { en: 'Listen and answer.', ru: 'Послушайте и ответьте.' },
  source: {
    kind: 'tts',
    turns: [
      { speaker: 'Kellner', text: 'Was möchten Sie trinken?' },
      { speaker: 'Gast', text: 'Einen Kaffee, bitte.' },
    ],
  },
  question: 'Was bestellt der Gast?',
  options: ['Einen Kaffee', 'Einen Tee'],
  correct: 0,
  max_replays: 2,
  recording: 'ls-replay-fixture-01',
  explain: { en: 'He says Kaffee.', ru: 'Он говорит «Kaffee».' },
});

const CUES = [
  { start_ms: 0, end_ms: 2100 },
  { start_ms: 2100, end_ms: 4000 },
];

let played: { currentTime: number; playbackRate: number }[];

// `bun test` runs every file in one process, so each global patched here is put back after.
const original = {
  bundle: process.env.PUBLIC_ATLAS_AUDIO_BUNDLE,
  fetch: globalThis.fetch,
  play: window.HTMLMediaElement.prototype.play,
  pause: window.HTMLMediaElement.prototype.pause,
};

beforeEach(() => {
  process.env.PUBLIC_ATLAS_AUDIO_BUNDLE = '1';
  played = [];
  window.HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    played.push({ currentTime: this.currentTime, playbackRate: this.playbackRate });
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = () => {};
  globalThis.fetch = mock(async (url: string) =>
    String(url).endsWith('.mp3')
      ? new Response(new Blob(['ID3'], { type: 'audio/mpeg' }))
      : new Response(JSON.stringify({ cues: CUES })),
  ) as never;
});

afterEach(() => {
  cleanup();
  if (original.bundle === undefined) delete process.env.PUBLIC_ATLAS_AUDIO_BUNDLE;
  else process.env.PUBLIC_ATLAS_AUDIO_BUNDLE = original.bundle;
  globalThis.fetch = original.fetch;
  window.HTMLMediaElement.prototype.play = original.play;
  window.HTMLMediaElement.prototype.pause = original.pause;
});

function mount() {
  render(
    <AudioComprehension
      item={item}
      lang="en"
      onResult={mock(() => {})}
      locked={false}
      onNext={mock(() => {})}
      nextLabel="Weiter →"
    />,
  );
}

describe('a recorded listening item, before and after the answer', () => {
  test('before the answer the transcript is hidden and no line can be replayed', () => {
    mount();
    expect(screen.queryByText(/Einen Kaffee, bitte\./)).toBeNull();
    expect(screen.queryByText('Slower')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('after the answer one line replays alone, from its own cue, at the slower rate', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Einen Kaffee' }));

    const line = await screen.findByRole('button', { name: /Gast: Einen Kaffee, bitte\./ });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/audio/ls-replay-fixture-01.cues.json'),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slower' }));
    await waitFor(() => expect(line.hasAttribute('disabled')).toBe(false));
    fireEvent.click(line);

    expect(played.at(-1)).toEqual({ currentTime: 2.1, playbackRate: SLOW_RATE });
    // The replay plays from a blob of the take, which every engine can seek in.
    expect(document.querySelector('audio')!.getAttribute('src')).toStartWith('blob:');
    expect(line.getAttribute('aria-current')).toBe('true');
  });

  test('a cue file for other turns is not used', async () => {
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({ cues: CUES.slice(1) })),
    ) as never;
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Einen Tee' }));
    await screen.findByText(/Einen Kaffee, bitte\./);
    expect(screen.queryByRole('button', { name: /Gast: Einen Kaffee, bitte\./ })).toBeNull();
  });
});

describe('which turn a moment belongs to', () => {
  test('the last cue started, and nothing before the first', () => {
    const cues = [
      { start_ms: 400, end_ms: 2100 },
      { start_ms: 2100, end_ms: 4000 },
    ];
    expect(turnAt(cues, 100)).toBeNull();
    expect(turnAt(cues, 2099)).toBe(0);
    expect(turnAt(cues, 2100)).toBe(1);
    expect(turnAt(cues, 4000)).toBeNull();
  });
});
