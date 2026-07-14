import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Write } from '../src/components/exercises/Write';

afterEach(() => {
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

describe('honest open-production review', () => {
  test('needs-work is valid, but revision and reassessment remain required', () => {
    const onResult = renderWrite();

    fireEvent.change(screen.getByLabelText('First draft'), { target: { value: 'Ich komme.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare and check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Needs work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revise draft' }));
    expect(onResult).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Ich komme später.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Needs work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save revised draft' }));

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      evidence: 'practice',
      given: 'Ich komme später.',
      practice: {
        kind: 'writing',
        draft: 'Ich komme.',
        revision: 'Ich komme später.',
        before: ['needs-work'],
        after: ['needs-work'],
      },
    }));
  });

  // An after-rating is a rating *of a particular text*. The revision therefore freezes once the
  // checklist is up: otherwise a learner could rate the text, then edit or gut it below min_words,
  // and the logged `practice.revision` would no longer be the text the checklist describes.
  test('the revision is frozen while it is being assessed', () => {
    renderWrite();

    fireEvent.change(screen.getByLabelText('First draft'), { target: { value: 'Ich komme.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare and check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revise draft' }));
    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Ich komme später.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check revision' }));

    expect((screen.getByLabelText('Revised draft') as HTMLTextAreaElement).disabled).toBe(true);
  });

  test('editing again clears the rating that described the old text', () => {
    const onResult = renderWrite();

    fireEvent.change(screen.getByLabelText('First draft'), { target: { value: 'Ich komme.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare and check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revise draft' }));
    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Ich komme später.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check revision' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));

    // rated and ready to save — now go back and change the very text that was rated
    fireEvent.click(screen.getByRole('button', { name: 'Edit the text again' }));
    fireEvent.change(screen.getByLabelText('Revised draft'), {
      target: { value: 'Ich komme viel später.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check revision' }));

    // the rating is gone, so it cannot be inherited by a text it never described
    fireEvent.click(screen.getByRole('button', { name: 'Save revised draft' }));
    expect(onResult).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Needs work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save revised draft' }));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      practice: expect.objectContaining({
        revision: 'Ich komme viel später.',
        after: ['needs-work'],
      }),
    }));
  });
});
