/**
 * The advisory panel's boundary (docs/assist-design.md): revise stage only, on
 * demand, gated on the probe and the da:assist pref — and **nothing the
 * assistant produces enters the submitted payload**. The last test locks that
 * with exact equality: hints on screen, byte-identical onResult.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Write } from '../src/components/exercises/Write';
import { resetAssistForTests } from '../src/lib/assist';
import { ASSIST_KEY } from '../src/lib/prefs';
import { getActiveProfileId } from '../src/lib/profile';

const realFetch = globalThis.fetch;

// Before as well as after: any earlier test file that mounted Write's revise
// stage may have primed the module-level probe cache with its own fetch.
beforeEach(resetAssistForTests);

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  resetAssistForTests();
  localStorage.clear();
});

const ASSIST_BUTTON = 'Hinweise vom lokalen Assistenten';
const PRAISE = 'A clear, friendly message!';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Ollama with one gemma model that returns a fixed review. */
function mockOllama(review: unknown = {
  praise: PRAISE,
  hints: [{ quote: 'Ich komme', category: 'grammar', nudge: 'Check the verb form.' }],
}) {
  const fetchMock = mock(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) return jsonResponse({ models: [{ name: 'gemma4:e4b' }] });
    if (url.endsWith('/api/chat')) return jsonResponse({ message: { content: JSON.stringify(review) } });
    throw new Error(`unexpected fetch: ${url}`);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderWrite(onResult = mock()) {
  render(<Write
    item={{
      id: 'message', revision: 1, outcomes: [], preview: false, type: 'write',
      prompt: { en: 'Write.', ru: 'Напишите.' },
      goal: { en: 'Give a reason.', ru: 'Назовите причину.' },
      requirements: [{ en: 'I gave a reason.', ru: 'Я назвал(а) причину.' }],
      min_words: 2,
      model_answer: 'Ich komme später.',
      model_translation: { en: 'I am coming later.', ru: 'Я приду позже.' },
    }}
    lang="en"
    onResult={onResult}
    locked={false}
    onNext={() => {}}
    nextLabel="Next"
    storageKey="a2/test-produktion::message"
  />);
  return onResult;
}

function walkToRevise() {
  fireEvent.change(screen.getByLabelText('First draft'), { target: { value: 'Ich komme heute.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Compare and check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Met' }));
  fireEvent.click(screen.getByRole('button', { name: 'Revise draft' }));
}

describe('Write assist panel', () => {
  test('the button exists only in the revise stage — never before the before-assessment', async () => {
    mockOllama();
    renderWrite();

    // draft stage: no assistant
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
    fireEvent.change(screen.getByLabelText('First draft'), { target: { value: 'Ich komme heute.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare and check' }));

    // reflect stage (before-assessment in progress): still no assistant
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Revise draft' }));

    // revise stage, probe resolved: the on-demand button appears
    expect(await screen.findByRole('button', { name: ASSIST_BUTTON })).toBeTruthy();
  });

  test('da:assist off with Ollama unreachable renders nothing — not even the re-enable line', async () => {
    localStorage.setItem(ASSIST_KEY, 'off');
    const fetchMock = mock(async () => {
      throw new TypeError('fetch failed');
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    renderWrite();
    walkToRevise();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
    expect(screen.queryByRole('button', { name: /Assistent ist aus/ })).toBeNull();
  });

  test('da:assist off with Ollama reachable: a quiet re-enable line, and one click restores the panel', async () => {
    // The gear's off switch is the only writer of the pref — without this
    // affordance an accidental click would strand the learner in localStorage.
    localStorage.setItem(ASSIST_KEY, 'off');
    mockOllama();
    renderWrite();
    walkToRevise();

    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Assistent ist aus — einschalten' }));

    expect(await screen.findByRole('button', { name: ASSIST_BUTTON })).toBeTruthy();
    expect(localStorage.getItem(ASSIST_KEY)).toBe('on');
    expect(screen.queryByRole('button', { name: /Assistent ist aus/ })).toBeNull();
  });

  test('an unreachable Ollama hides the panel silently', async () => {
    const fetchMock = mock(async () => {
      throw new TypeError('fetch failed');
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    renderWrite();
    walkToRevise();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
  });

  test('unusable output twice: one-line apology, and the feature stays hidden this session', async () => {
    // every quote hallucinated — reviewDraft retries once internally, then null
    mockOllama({ praise: 'Gut!', hints: [{ quote: 'nie geschrieben', category: 'task', nudge: 'x' }] });
    renderWrite();
    walkToRevise();

    fireEvent.click(await screen.findByRole('button', { name: ASSIST_BUTTON }));

    expect(await screen.findByText(/cannot produce useful hints/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: ASSIST_BUTTON })).toBeNull();
  });

  test('hints render as advisory — and submitRevision\'s payload is byte-identical to a run without them', async () => {
    mockOllama();
    const onResult = renderWrite();
    walkToRevise();

    fireEvent.click(await screen.findByRole('button', { name: ASSIST_BUTTON }));

    // praise line, category label, the learner's quoted words, the nudge, the disclaimer
    expect(await screen.findByText(PRAISE)).toBeTruthy();
    expect(screen.getByText('Grammatik')).toBeTruthy();
    expect(screen.getByText('Ich komme')).toBeTruthy();
    expect(screen.getByText('Check the verb form.')).toBeTruthy();
    expect(screen.getByText(/keine Bewertung/)).toBeTruthy();

    // finish the item with the hints on screen
    fireEvent.click(screen.getByRole('button', { name: 'Check revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save revised draft' }));

    // Exact equality, not objectContaining: the payload of an assist-enabled run
    // carries no assist field, no hints, nothing — advisory output never becomes
    // evidence, so nothing may reach the attempt log or the snapshot.
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]![0]).toEqual({
      correct: true,
      given: 'Ich komme heute.',
      evidence: 'practice',
      responseMode: 'writing',
      practice: {
        kind: 'writing',
        draft: 'Ich komme heute.',
        revision: 'Ich komme heute.',
        before: ['met'],
        after: ['met'],
      },
    });
  });

  test('fixing the quoted words retires the hint live — and full retirement is celebrated, praise kept', async () => {
    mockOllama();
    renderWrite();
    walkToRevise();
    fireEvent.click(await screen.findByRole('button', { name: ASSIST_BUTTON }));
    expect(await screen.findByText('Check the verb form.')).toBeTruthy();

    // the learner's edit removes the quoted words — the hint must not outlive them
    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Wir gehen morgen zusammen los.' },
    });

    expect(screen.queryByText('Check the verb form.')).toBeNull();
    expect(screen.queryByText('Ich komme')).toBeNull();
    expect(screen.getByText(/Alle Hinweise erledigt/)).toBeTruthy();
    expect(screen.getByText(PRAISE)).toBeTruthy();

    // undoing the edit brings the quoted words — and the hint — back
    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Ich komme heute.' },
    });
    expect(screen.getByText('Check the verb form.')).toBeTruthy();
    expect(screen.queryByText(/Alle Hinweise erledigt/)).toBeNull();
  });

  test('a restore discards hints whose forText is not the saved revision', async () => {
    // A record whose hints were generated for a different text than the one
    // being restored — e.g. written by a pre-forText session or a racing tab.
    const draftKey = `da:write:${getActiveProfileId()}:a2/test-produktion::message`;
    localStorage.setItem(draftKey, JSON.stringify({
      stage: 'revise',
      draft: 'Ich komme heute.',
      revision: 'Ich komme heute.',
      before: ['met'],
      after: [],
      assist: {
        forText: 'Ich komme morgen zu dir.',
        praise: PRAISE,
        hints: [{ quote: 'Ich komme', category: 'grammar', nudge: 'Check the verb form.' }],
      },
    }));
    mockOllama();
    renderWrite();

    // stale hints are gone; the panel offers a fresh request instead
    expect(await screen.findByRole('button', { name: ASSIST_BUTTON })).toBeTruthy();
    expect(screen.queryByText(PRAISE)).toBeNull();
    expect(screen.queryByText('Check the verb form.')).toBeNull();
  });

  test('a same-day reload keeps the fetched hints without re-billing the generation', async () => {
    mockOllama();
    const onResult = mock();
    renderWrite(onResult);
    walkToRevise();
    fireEvent.click(await screen.findByRole('button', { name: ASSIST_BUTTON }));
    await screen.findByText(PRAISE);

    // reload: a fresh mount restores the SavedWriting record — hints included,
    // shown without any new /api/chat call
    cleanup();
    const fetchMock = mockOllama();
    renderWrite(onResult);

    expect(await screen.findByText(PRAISE)).toBeTruthy();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain(
      'http://localhost:11434/api/chat',
    );
  });
});
