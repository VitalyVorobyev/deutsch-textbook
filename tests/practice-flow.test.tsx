import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Write } from '../src/components/exercises/Write';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('honest open-production review', () => {
  test('needs-work is valid, but revision and reassessment remain required', () => {
    const onResult = mock();
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
      storageKey="test:message"
    />);

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
});
