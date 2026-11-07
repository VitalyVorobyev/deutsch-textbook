/**
 * A task set plays one recording for all its items: one player beside them, one play budget
 * across them, and the transcript only once every item is answered. Its items show their question
 * and options and nothing else.
 *
 * Fixtures are inline and state every field the assertions read.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { exerciseSetSchema } from '@da/schema';
import * as journal from '../src/lib/write-journal';

// Captured before mock.module patches the registry: the namespace is live-bound. mock.module is
// process-global, so the real implementation is restored once this suite is done.
const realLogAttemptDurably = journal.logAttemptDurably;
const logAttemptDurably = mock(() => Promise.resolve());
mock.module('../src/lib/write-journal', () => ({ ...journal, logAttemptDurably }));
afterAll(() => {
  logAttemptDurably.mockImplementation(realLogAttemptDurably as never);
});

const { default: ExerciseSet } = await import('../src/components/exercises/ExerciseSet');

const question = (id: string, text: string, options: string[]) => ({
  id,
  type: 'audio-comprehension',
  question: text,
  options,
  correct: 0,
});

const set = exerciseSetSchema.parse({
  topic: 'wohnen',
  role: 'practice',
  stage: 'transfer',
  activity: 'application',
  title_de: 'Aufgabe: An der Tür',
  recording: 'ls-panel-fixture-01',
  max_replays: 2,
  items: [
    question('gist', 'Worum geht es?', ['Einen Besuch', 'Eine Reise']),
    question('who', 'Wer kommt auch?', ['Frau Kern', 'Jonas']),
  ],
});

const script = {
  id: 'ls-panel-fixture-01',
  turns: [
    { speaker: 'Lena', text: 'Hallo, Jonas!' },
    { speaker: 'Jonas', text: 'Frau Kern kommt auch.' },
  ],
};

const PLAY = '▶ Anhören';

const original = {
  bundle: process.env.PUBLIC_ATLAS_AUDIO_BUNDLE,
  fetch: globalThis.fetch,
  play: window.HTMLMediaElement.prototype.play,
  pause: window.HTMLMediaElement.prototype.pause,
};

beforeEach(() => {
  process.env.PUBLIC_ATLAS_AUDIO_BUNDLE = '1';
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  globalThis.fetch = mock(async () => new Response(JSON.stringify({ cues: [] }))) as never;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (original.bundle === undefined) delete process.env.PUBLIC_ATLAS_AUDIO_BUNDLE;
  else process.env.PUBLIC_ATLAS_AUDIO_BUNDLE = original.bundle;
  globalThis.fetch = original.fetch;
  window.HTMLMediaElement.prototype.play = original.play;
  window.HTMLMediaElement.prototype.pause = original.pause;
});

/** Play the whole take once and let it end. */
function playThrough() {
  fireEvent.click(screen.getByRole('button', { name: PLAY }));
  fireEvent.ended(document.querySelector('audio')!);
}

describe('a task set', () => {
  test('one player and one budget for every item; the transcript once all are answered', () => {
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={set} recording={script} />);

    expect(screen.getAllByRole('button', { name: PLAY })).toHaveLength(1);
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.getByText('0 / 2')).toBeTruthy();
    playThrough();
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Einen Besuch' }));
    expect(screen.queryByText(/Frau Kern kommt auch\./)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));

    // The second item mounts no player of its own, and the budget carried over.
    expect(screen.getAllByRole('button', { name: PLAY })).toHaveLength(1);
    expect(screen.getByText('1 / 2')).toBeTruthy();
    playThrough();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: PLAY }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/Frau Kern kommt auch\./)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Frau Kern' }));
    expect(screen.getByText(/Frau Kern kommt auch\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: PLAY }).hasAttribute('disabled')).toBe(false);
    expect(logAttemptDurably).toHaveBeenCalledTimes(2);
    expect(logAttemptDurably.mock.calls.map((call) => (call as unknown[])[0])).toMatchObject([
      { setId: 'a2/wohnen-aufgabe', itemId: 'gist' },
      { setId: 'a2/wohnen-aufgabe', itemId: 'who' },
    ]);
  });
});
