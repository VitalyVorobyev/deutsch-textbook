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

const berlin = translateItemSchema.parse({
  id: 'berlin',
  type: 'translate',
  prompt_en: 'On Saturday I am travelling to Berlin with my friends.',
  prompt_ru: 'В субботу я еду в Берлин с друзьями.',
  answer: 'Ich fahre am Samstag mit meinen Freunden nach Berlin.',
  accept: [
    'Am Samstag fahre ich mit meinen Freunden nach Berlin.',
    'Mit meinen Freunden fahre ich am Samstag nach Berlin.',
  ],
  key_tokens: ['meinen', 'Freunden'],
  focus: 'dativ-artikel',
});

const berlinView = () => (
  <ItemView
    instanceKey="berlin-0"
    item={berlin}
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

  test('an item with one authored rendering shows no alternatives section', () => {
    render(view('single-answer'));
    fireEvent.change(answerBox(), { target: { value: 'Ich habe Hunger.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));

    expect(screen.getByText(/Richtig!/)).toBeTruthy();
    expect(screen.queryByText('Also possible:')).toBeNull();
  });

  test('a wrong translation is corrected against the closest authored rendering', () => {
    const { container } = render(berlinView());
    fireEvent.change(answerBox(), {
      target: { value: 'Am Samstag fahre ich mit meine Freunde nach Berlin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));

    expect(container.textContent).toContain(
      'Correction: Am Samstag fahre ich mit meinen Freunden nach Berlin.',
    );
    expect(container.textContent).not.toContain(
      'Correction: Ich fahre am Samstag mit meinen Freunden nach Berlin.',
    );
    expect(screen.getByText('Also possible:')).toBeTruthy();
    expect(screen.getByText('Ich fahre am Samstag mit meinen Freunden nach Berlin.')).toBeTruthy();
  });

  test('an accepted rendering reveals the other authored answers after retrieval', () => {
    render(berlinView());
    fireEvent.change(answerBox(), {
      target: { value: 'Am Samstag fahre ich mit meinen Freunden nach Berlin.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));

    expect(screen.getByText(/Richtig!/)).toBeTruthy();
    expect(screen.getByText('Also possible:')).toBeTruthy();
    const alternatives = screen.getAllByRole('listitem').map((node) => node.textContent);
    expect(alternatives).toEqual([
      'Ich fahre am Samstag mit meinen Freunden nach Berlin.',
      'Mit meinen Freunden fahre ich am Samstag nach Berlin.',
    ]);
  });
});
