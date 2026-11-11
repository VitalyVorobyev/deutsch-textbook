/**
 * A translation answered wrong in mixed training comes back once, later in the same run, and
 * marked as a second try. The second try is never logged: the first answer is the attempt, so
 * the item stays last-answered-wrong for tomorrow's session and no evidence reader sees it. A
 * run saved with a second try in its queue resumes with it rather than being thrown away.
 *
 * Fixtures are inline and state every field the assertions read: one opened topic, one set of
 * translate items, an empty attempt log.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { translateItemSchema } from '@da/schema';
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

/** SWAP_GUARD_MS in shared.tsx swallows a Weiter click within 500ms of Prüfen. */
const PAST_SWAP_GUARD = 550;
const PROFILE = 'retry-test';

const item = (id: string) =>
  translateItemSchema.parse({
    id,
    type: 'translate',
    outcomes: [],
    prompt_en: `Prompt ${id}`,
    prompt_ru: `Prompt ${id}`,
    answer: 'Ich wohne in Berlin.',
    key_tokens: ['wohne'],
  });

const sets: TrainingSet[] = [
  {
    setId: 'a2/s',
    topicId: 't',
    title_de: 'Thema',
    level: 'A2',
    role: 'practice',
    items: [item('a'), item('b')],
  },
];
const nodes = [{ id: 't', exerciseSets: ['a2/s'], readingIds: [] }] as unknown as TopicNode[];

let MixedTraining: ComponentType<{
  sets: TrainingSet[];
  spine: string[];
  nodes: TopicNode[];
  count?: number;
  resumeKey?: string;
  onFinished?: (r: { answered: number; correct: number }) => void;
}>;

beforeAll(async () => {
  ({ default: MixedTraining } = await import('../src/components/training/MixedTraining'));
});

beforeEach(() => {
  localStorage.setItem('da:profiles', JSON.stringify([{ id: PROFILE, label: 'Test' }]));
  localStorage.setItem('da:profile', PROFILE);
});

afterEach(() => {
  cleanup();
  logAttemptDurably.mockClear();
  localStorage.clear();
});

const shownPrompt = () => screen.getByText(/^Prompt [ab]$/).textContent!;
const secondTry = () => screen.queryByText('Zweiter Versuch');

async function answerWrongAndContinue() {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'falsch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
  await Bun.sleep(PAST_SWAP_GUARD);
  fireEvent.click(screen.getByRole('button', { name: /Weiter →|Results/ }));
}

describe('a failed translate in mixed training', () => {
  test('comes back once, marked, and is not logged the second time', async () => {
    let finished: { answered: number } | undefined;
    render(
      <MixedTraining
        sets={sets}
        spine={['t']}
        nodes={nodes}
        count={2}
        onFinished={(r) => (finished = r)}
      />,
    );
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());

    const first = shownPrompt();
    expect(secondTry()).toBeNull();
    await answerWrongAndContinue();
    const second = shownPrompt();
    expect(second).not.toBe(first);
    await answerWrongAndContinue();

    // both retries, after both first answers, in the order they failed
    expect(shownPrompt()).toBe(first);
    expect(secondTry()).toBeTruthy();
    await answerWrongAndContinue();
    expect(shownPrompt()).toBe(second);
    expect(secondTry()).toBeTruthy();
    await answerWrongAndContinue();

    // four answers, two logged attempts, no retry of a retry, and a trained count of two
    expect(logAttemptDurably).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    expect(finished).toEqual({ answered: 2, correct: 0 });
  });

  test('a saved run with a retry in its queue resumes on the retry', async () => {
    const { saveResume } = await import('../src/lib/resume');
    saveResume('training:retry', {
      uids: ['a2/s::a', 'a2/s::b', 'a2/s::a#retry'],
      answered: [
        { uid: 'a2/s::a', correct: false, score: 0 },
        { uid: 'a2/s::b', correct: true, score: 1 },
      ],
    });
    render(<MixedTraining sets={sets} spine={['t']} nodes={nodes} count={2} resumeKey="retry" />);
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());

    expect(shownPrompt()).toBe('Prompt a');
    expect(secondTry()).toBeTruthy();
    await answerWrongAndContinue();
    expect(logAttemptDurably).toHaveBeenCalledTimes(0);
  });
});
