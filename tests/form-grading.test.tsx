import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormFill } from '../src/components/exercises/FormFill';
import { exerciseSetSchema, formItemSchema } from '@da/schema';

afterEach(cleanup);

const item = formItemSchema.parse({
  id: 'anmeldung',
  type: 'form',
  instruction: { en: 'Complete the form.', ru: 'Заполните формуляр.' },
  source: ['Marta Nowak kommt aus Polen.', 'Sie wohnt in Bonn.'],
  fields: [
    { id: 'vorname', label: 'Vorname', answer: 'Marta', given: true },
    { id: 'land', label: 'Land', answer: 'Polen', accept: ['polen'] },
    { id: 'ort', label: 'Wohnort', answer: 'Bonn' },
  ],
});

describe('form items', () => {
  test('grade each open field independently and retain stable field ids in the attempt', () => {
    const onResult = mock(() => {});
    render(<FormFill item={item} lang="en" onResult={onResult} locked={false}
      onNext={mock(() => {})} nextLabel="Weiter →" />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2); // the given field is displayed, never re-asked
    fireEvent.change(inputs[0]!, { target: { value: 'polen' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Berlin' } });
    fireEvent.click(screen.getByRole('button', { name: /prüfen|check/i }));

    expect(onResult).toHaveBeenCalledWith({
      correct: false,
      correctParts: 1,
      totalParts: 2,
      given: 'land=polen / ort=Berlin',
    });
    expect(screen.getByText(/Wohnort: Bonn/)).toBeTruthy();
  });

  test('schema preserves an item-scoped stimulus independently of the set stimulus', () => {
    const set = exerciseSetSchema.parse({
      topic: 'stadt-wege',
      role: 'exam-practice',
      stimulus: 'set-document',
      items: [{ ...item, stimulus: 'item-document' }],
    });
    expect(set.stimulus).toBe('set-document');
    expect(set.items[0]?.stimulus).toBe('item-document');
  });
});
