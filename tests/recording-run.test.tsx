/**
 * Several listening questions on one recording are one listening task: the plays carry from one
 * question to the next, and the transcript — which answers every question on it — is shown only
 * once the last of them in the run is answered, below that question's verdict and feedback. A
 * run is what the learner is served in order: a set on the topic page, or a mixed-training
 * session that dealt some of a recording's questions.
 *
 * Fixtures are inline and state every field the assertions read: two questions on one recording
 * and one on another, each with its own `source` and `recording`, as a `-hoeren` set carries them.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { audioComprehensionItemSchema, exerciseSetSchema } from '@da/schema';
import { isLastOnRecording, recordingKeyOf } from '../src/lib/recording-run';
import type { TrainingSet } from '../src/lib/training';
import type { TopicNode } from '../src/lib/mastery';
import * as store from '../src/lib/store';
import * as journal from '../src/lib/write-journal';

// Captured before mock.module patches the registry: the namespaces are live-bound. mock.module
// is process-global, so the real implementations are restored once this suite is done.
const realGetAttempts = store.getAttempts;
const realGetCardStates = store.getCardStates;
const realGetTopicsState = store.getTopicsState;
const realLogAttemptDurably = journal.logAttemptDurably;
const getAttempts = mock(() => Promise.resolve([]));
const getCardStates = mock(() => Promise.resolve({}));
const getTopicsState = mock(() => Promise.resolve({ t: { readAt: 1 } }));
const logAttemptDurably = mock(() => Promise.resolve());
mock.module('../src/lib/store', () => ({ ...store, getAttempts, getCardStates, getTopicsState }));
mock.module('../src/lib/write-journal', () => ({ ...journal, logAttemptDurably }));
afterAll(() => {
  getAttempts.mockImplementation(realGetAttempts as never);
  getCardStates.mockImplementation(realGetCardStates as never);
  getTopicsState.mockImplementation(realGetTopicsState as never);
  logAttemptDurably.mockImplementation(realLogAttemptDurably as never);
});

const MARKT = [
  { speaker: 'Verkäuferin', text: 'Die Äpfel kosten drei Euro.' },
  { speaker: 'Kunde', text: 'Dann nehme ich ein Kilo.' },
];
const BAHN = [
  { speaker: 'Ansage', text: 'Der Zug fährt heute von Gleis vier.' },
  { speaker: 'Reisende', text: 'Gleis vier, danke.' },
];

const question = (
  id: string,
  recording: string,
  turns: typeof MARKT,
  text: string,
  options: [string, string],
) =>
  audioComprehensionItemSchema.parse({
    id,
    type: 'audio-comprehension',
    instruction: { en: 'Listen and choose.', ru: 'Послушайте и выберите.' },
    source: { kind: 'tts', turns },
    recording,
    question: text,
    options,
    correct: 0,
    max_replays: 3,
    explain: { en: 'As said.', ru: 'Как сказано.' },
  });

const preis = question('preis', 'ls-markt-01', MARKT, 'Was kosten die Äpfel?', [
  'Drei Euro',
  'Zwei Euro',
]);
const menge = question('menge', 'ls-markt-01', MARKT, 'Wie viel nimmt der Kunde?', [
  'Ein Kilo',
  'Zwei Kilo',
]);
const gleis = question('gleis', 'ls-bahn-01', BAHN, 'Von welchem Gleis?', ['Vier', 'Acht']);

const set = exerciseSetSchema.parse({
  topic: 'essen-trinken',
  role: 'practice',
  stage: 'transfer',
  activity: 'task',
  skill: 'hoeren',
  title_de: 'Hören — Am Markt',
  items: [preis, menge, gleis],
});

const PLAY = '▶ Anhören';
const transcriptLine = (text: string) => screen.queryByText(text);
const playThrough = () => {
  fireEvent.click(screen.getByRole('button', { name: PLAY }));
  fireEvent.ended(document.querySelector('audio')!);
};
/** True when `a` comes before `b` in document order. */
const precedes = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

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
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'rec-test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'rec-test');
});

afterEach(() => {
  cleanup();
  logAttemptDurably.mockClear();
  localStorage.clear();
  if (original.bundle === undefined) delete process.env.PUBLIC_ATLAS_AUDIO_BUNDLE;
  else process.env.PUBLIC_ATLAS_AUDIO_BUNDLE = original.bundle;
  globalThis.fetch = original.fetch;
  window.HTMLMediaElement.prototype.play = original.play;
  window.HTMLMediaElement.prototype.pause = original.pause;
});

describe('the recording a question is answered from', () => {
  test('is its recording id, its script when it has none, and nothing for other items', () => {
    expect(recordingKeyOf(preis)).toBe('ls-markt-01');
    expect(recordingKeyOf(menge)).toBe(recordingKeyOf(preis));
    const ttsOnly = audioComprehensionItemSchema.parse({ ...preis, recording: undefined });
    expect(recordingKeyOf(ttsOnly)).toStartWith('tts:');
    expect(recordingKeyOf(ttsOnly)).not.toBe(
      recordingKeyOf(audioComprehensionItemSchema.parse({ ...gleis, recording: undefined })),
    );
    const inTaskSet = audioComprehensionItemSchema.parse({
      ...preis,
      source: undefined,
      recording: undefined,
    });
    expect(recordingKeyOf(inTaskSet, { id: 'ls-task-01', turns: MARKT })).toBe('ls-task-01');
    expect(recordingKeyOf(inTaskSet)).toBeNull();
  });

  test('reveals only at the run’s last question on it, wherever the others stand', () => {
    const keys = ['m', 'm', 'b', null, 'm'];
    expect(keys.map((_, i) => isLastOnRecording(keys, i))).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });
});

describe('a set with two questions on one recording', () => {
  let ExerciseSet: ComponentType<{ setId: string; set: typeof set }>;
  beforeAll(async () => {
    ({ default: ExerciseSet } = await import('../src/components/exercises/ExerciseSet'));
  });

  test('keeps the transcript back after the first and carries the plays to the second', () => {
    render(<ExerciseSet setId="a1/markt-hoeren" set={set} />);
    expect(screen.getByText('0 / 3')).toBeTruthy();
    playThrough();
    playThrough();
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Drei Euro' }));
    expect(transcriptLine('Dann nehme ich ein Kilo.')).toBeNull();
    // the recording stays a recording: its plays are still counted
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));

    expect(screen.getByText('Wie viel nimmt der Kunde?')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    playThrough();
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: PLAY }).hasAttribute('disabled')).toBe(true);
  });

  test('reveals the transcript after the last question on it, below the verdict', () => {
    render(<ExerciseSet setId="a1/markt-hoeren" set={set} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drei Euro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zwei Kilo' }));

    const line = screen.getByText('Dann nehme ich ein Kilo.');
    const verdict = screen.getByText('As said.');
    expect(precedes(verdict, line)).toBe(true);
    expect(precedes(screen.getByRole('button', { name: 'Zwei Kilo' }), line)).toBe(true);
  });

  test('a recording with one question in the set reveals after it, on a fresh budget', () => {
    render(<ExerciseSet setId="a1/markt-hoeren" set={set} />);
    playThrough();
    fireEvent.click(screen.getByRole('button', { name: 'Drei Euro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ein Kilo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));

    expect(screen.getByText('0 / 3')).toBeTruthy();
    expect(transcriptLine('Gleis vier, danke.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vier' }));
    expect(transcriptLine('Gleis vier, danke.')).toBeTruthy();
  });

  test('trying the set again starts every recording’s budget afresh', () => {
    render(<ExerciseSet setId="a1/markt-hoeren" set={set} />);
    playThrough();
    for (const answer of ['Drei Euro', 'Ein Kilo', 'Vier']) {
      fireEvent.click(screen.getByRole('button', { name: answer }));
      fireEvent.click(screen.getByRole('button', { name: /Weiter →|Results/ }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('0 / 3')).toBeTruthy();
  });
});

describe('mixed training that deals two questions on one recording', () => {
  let MixedTraining: ComponentType<{
    sets: TrainingSet[];
    spine: string[];
    nodes: TopicNode[];
    count?: number;
  }>;
  beforeAll(async () => {
    ({ default: MixedTraining } = await import('../src/components/training/MixedTraining'));
  });

  const sets: TrainingSet[] = [
    {
      setId: 'a1/markt-hoeren',
      topicId: 't',
      title_de: 'Thema',
      level: 'A1',
      role: 'practice',
      items: [preis, menge],
    },
  ];
  const nodes = [
    { id: 't', exerciseSets: ['a1/markt-hoeren'], readingIds: [] },
  ] as unknown as TopicNode[];

  test('shares the plays and reveals the transcript after the session’s last of them', async () => {
    render(<MixedTraining sets={sets} spine={['t']} nodes={nodes} count={2} />);
    await waitFor(() => expect(screen.getByRole('button', { name: PLAY })).toBeTruthy());

    playThrough();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    // whichever was dealt first, its first option is right
    const first = screen.getByText(/Was kosten die Äpfel\?|Wie viel nimmt der Kunde\?/);
    fireEvent.click(screen.getByRole('button', { name: /^(Drei Euro|Ein Kilo)$/ }));
    expect(transcriptLine('Dann nehme ich ein Kilo.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));

    expect(screen.queryByText(first.textContent!)).toBeNull();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^(Drei Euro|Ein Kilo)$/ }));
    expect(transcriptLine('Dann nehme ich ein Kilo.')).toBeTruthy();
    expect(logAttemptDurably).toHaveBeenCalledTimes(2);
  });
});
