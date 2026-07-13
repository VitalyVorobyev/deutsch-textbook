/**
 * ItemView's one contract: `instanceKey` is what resets an item.
 *
 * Every surface that shows exercises leans on it — ExerciseSet (a new item, and the same
 * item again after "Ещё raz"), MixedTraining, ReadingText, ProbeStep — and the item
 * components themselves have no other reset path: the typed value and the checked flag
 * live in local state and only a remount clears them.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ItemView } from '../src/components/exercises/ExerciseSet';
import { translateItemSchema } from '../src/lib/schemas';

const item = translateItemSchema.parse({
  id: 'i1',
  type: 'translate',
  prompt_en: 'I am hungry.',
  prompt_ru: 'Я голоден.',
  answer: 'Ich habe Hunger.',
});

const view = (instanceKey: string) => (
  <ItemView
    instanceKey={instanceKey}
    item={item}
    lang="en"
    onResult={mock(() => {})}
    locked={false}
    onNext={mock(() => {})}
    nextLabel="Weiter →"
  />
);

const answerBox = () => screen.getByRole('textbox') as HTMLInputElement;

afterEach(cleanup);

describe('ItemView', () => {
  test('a new instanceKey clears the answer, even for the same item', () => {
    const { rerender } = render(view('round-0'));
    fireEvent.change(answerBox(), { target: { value: 'Ich bin Hunger.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(screen.getByText(/Leider falsch/)).toBeTruthy();

    rerender(view('round-1'));

    expect(answerBox().value).toBe('');
    expect(answerBox().disabled).toBe(false);
    expect(screen.queryByText(/Leider falsch|Richtig!/)).toBeNull();
  });

  test('an unchanged instanceKey keeps the answer — a re-render is not a reset', () => {
    const { rerender } = render(view('round-0'));
    fireEvent.change(answerBox(), { target: { value: 'Ich habe Hunger.' } });

    rerender(view('round-0'));

    expect(answerBox().value).toBe('Ich habe Hunger.');
  });
});
