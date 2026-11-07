/**
 * A task set plays one recording for all its items: one player beside them, one play budget
 * across them, and the transcript only once every item is answered. It opens on its listening
 * questions, without their options, and keeps them in view while the items are answered. Its items
 * show their question and options and nothing else.
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

/** The same set with an item on the scene's language after its two listening questions. */
const withForm = exerciseSetSchema.parse({
  ...set,
  items: [
    ...set.items,
    {
      id: 'form',
      type: 'cloze',
      text: 'Frau Kern {{kommt}} auch.',
      explain: { en: 'Third person singular.', ru: 'Третье лицо единственного числа.' },
    },
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
const START = 'Zur ersten Aufgabe →';

const original = {
  bundle: process.env.PUBLIC_ATLAS_AUDIO_BUNDLE,
  fetch: globalThis.fetch,
  play: window.HTMLMediaElement.prototype.play,
  pause: window.HTMLMediaElement.prototype.pause,
};

beforeEach(() => {
  logAttemptDurably.mockClear();
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

/** The listening questions as the panel lists them, in order. */
function listedQuestions(): string[] {
  const list = screen.getByRole('list', { name: 'The listening questions' });
  return Array.from(list.querySelectorAll('li [lang="de"]')).map((node) => node.textContent ?? '');
}

describe('a task set', () => {
  test('opens on the listening questions, without their options or the later items', () => {
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={withForm} recording={script} />);

    expect(screen.getByText('Lesen Sie zuerst die Aufgaben.')).toBeTruthy();
    expect(listedQuestions()).toEqual(['Worum geht es?', 'Wer kommt auch?']);
    for (const option of ['Einen Besuch', 'Eine Reise', 'Frau Kern', 'Jonas'])
      expect(screen.queryByText(option)).toBeNull();
    expect(document.querySelector('input')).toBeNull();
    expect(screen.getByText('Then 1 task on the language of the scene.')).toBeTruthy();
  });

  test('reading the questions spends no play, and starting does not interrupt one', () => {
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={set} recording={script} />);

    expect(screen.getByText('0 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: START }));
    expect(screen.getByText('0 / 2')).toBeTruthy();

    cleanup();
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={set} recording={script} />);
    fireEvent.click(screen.getByRole('button', { name: PLAY }));
    expect(screen.getByText('1 / 2')).toBeTruthy();
    const audio = document.querySelector('audio');
    fireEvent.click(screen.getByRole('button', { name: START }));
    // The same player, still playing: the item mounted beside it, not in place of it.
    expect(document.querySelector('audio')).toBe(audio);
    expect(screen.getByRole('button', { name: '…' })).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  test('the questions stay in view while the items are answered', () => {
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={withForm} recording={script} />);
    fireEvent.click(screen.getByRole('button', { name: START }));

    expect(listedQuestions()).toEqual(['Worum geht es?', 'Wer kommt auch?']);
    const current = () =>
      screen
        .getByRole('list', { name: 'The listening questions' })
        .querySelector('[aria-current="step"] [lang="de"]')?.textContent;
    expect(current()).toBe('Worum geht es?');

    fireEvent.click(screen.getByRole('button', { name: 'Einen Besuch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    expect(listedQuestions()).toEqual(['Worum geht es?', 'Wer kommt auch?']);
    expect(current()).toBe('Wer kommt auch?');
    expect(screen.getByText('✓')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Jonas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    // On the language item the list is still there, with nothing current and both answers marked.
    expect(listedQuestions()).toEqual(['Worum geht es?', 'Wer kommt auch?']);
    expect(current()).toBeUndefined();
    expect(screen.getByText('✗')).toBeTruthy();
  });

  test('one player and one budget for every item; the transcript once all are answered', () => {
    render(<ExerciseSet setId="a2/wohnen-aufgabe" set={set} recording={script} />);
    fireEvent.click(screen.getByRole('button', { name: START }));

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
