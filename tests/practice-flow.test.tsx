/**
 * Write's minimal-ceremony flow: draft → one press → model beside the learner's
 * own, still-editable text → save. The app cannot verify free writing, so the
 * flow never charges steps for feedback it cannot give — no gated checklists,
 * no staged revision.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Write } from '../src/components/exercises/Write';
import { resetAssistForTests } from '../src/lib/assist';
import { getActiveProfileId } from '../src/lib/profile';

// These tests walk Write onto the compare screen, where the assist panel probes
// for a local Ollama — even with the pref off, since the probe gates the
// re-enable affordance. Unit tests must not touch the network (nor depend on
// whether this machine runs Ollama), so the probe gets a refused connection;
// tests/write-assist.test.tsx owns the panel, with fetch mocked properly.
const realFetch = globalThis.fetch;
beforeEach(() => {
  resetAssistForTests();
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  cleanup();
  localStorage.clear();
});

function renderWrite(onResult = mock(), minWords = 2) {
  render(<Write
    item={{
      id: 'message', revision: 1, outcomes: [], preview: false, type: 'write',
      prompt: { en: 'Write.', ru: 'Напишите.' },
      goal: { en: 'Give a reason.', ru: 'Назовите причину.' },
      requirements: [{ en: 'I gave a reason.', ru: 'Я назвал(а) причину.' }],
      min_words: minWords,
      model_answer: 'Ich komme später.',
      model_translation: { en: 'I am coming later.', ru: 'Я приду позже.' },
    }}
    lang="en"
    onResult={onResult}
    locked={false}
    onNext={() => {}}
    nextLabel="Next"
    storageKey="test:message"
  />);
  return onResult;
}

describe('minimal-ceremony writing flow', () => {
  test('min_words gates the comparison; one press reaches the model, and the text stays editable', () => {
    renderWrite();

    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Ich' } });
    const compare = screen.getByRole('button', { name: 'Compare with model' }) as HTMLButtonElement;
    expect(compare.disabled).toBe(true);
    expect(screen.queryByText('Ich komme später.')).toBeNull();

    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Ich komme.' } });
    fireEvent.click(compare);

    expect(screen.getByText('Ich komme später.')).toBeTruthy();
    expect((screen.getByLabelText('Your text') as HTMLTextAreaElement).disabled).toBe(false);
  });

  test('saving logs the submitted draft and the final text — an edit on the compare screen is the revision', () => {
    const onResult = renderWrite();

    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Ich komme.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare with model' }));
    expect(onResult).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'Ich komme später.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Exact equality: the payload is the whole contract — no checklist fields,
    // nothing unverified pretending to be assessment.
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]![0]).toEqual({
      correct: true,
      given: 'Ich komme später.',
      evidence: 'practice',
      responseMode: 'writing',
      practice: {
        kind: 'writing',
        draft: 'Ich komme.',
        revision: 'Ich komme später.',
      },
    });
  });

  test('a legacy staged record resumes on the compare screen with its revision text', () => {
    const draftKey = `da:write:${getActiveProfileId()}:test:message`;
    localStorage.setItem(draftKey, JSON.stringify({
      stage: 'reassess',
      draft: 'Ich komme.',
      revision: 'Ich komme später.',
      before: ['met'],
      after: [],
    }));
    const onResult = renderWrite();

    expect((screen.getByLabelText('Your text') as HTMLTextAreaElement).value).toBe('Ich komme später.');
    expect(screen.getByText('Ich komme später.', { selector: 'p' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect((onResult.mock.calls[0]![0] as { practice: { draft: string } }).practice.draft).toBe('Ich komme.');
  });
});
