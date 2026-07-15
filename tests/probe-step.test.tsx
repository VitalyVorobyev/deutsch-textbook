/**
 * The probe step advances between items of the *same* type, from different families.
 * Item components keep their answer in local state and only reset on remount, so an
 * ItemView rendered without a fresh key kept the previous answer in the input, re-graded
 * it against the next item's key, and — being already `checked` — could not be answered
 * or logged at all. That shipped, and no pure-logic suite could have seen it.
 */
import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { translateItemSchema } from '../src/lib/schemas';
import type { DueProbe } from '../src/lib/probes';
import type { TrainingSet } from '../src/lib/training';
import * as store from '../src/lib/store';

// Only logAttempt is stubbed — the rest of the store module stays real, or every
// module that imports another of its exports would fail to resolve.
const logAttempt = mock(() => Promise.resolve());
mock.module('../src/lib/store', () => ({ ...store, logAttempt }));

/** SWAP_GUARD_MS in shared.tsx swallows a Weiter click within 500ms of Prüfen. */
const PAST_SWAP_GUARD = 550;

function probeItem(id: string, prompt: string, answer: string) {
  return translateItemSchema.parse({
    id,
    type: 'translate',
    outcomes: ['a1-o1'],
    prompt_en: prompt,
    prompt_ru: prompt,
    answer,
  });
}

const ITEM_A = probeItem('v1', 'On Saturday my friend brings her children.', 'Am Samstag bringt meine Freundin ihre Kinder mit.');
const ITEM_B = probeItem('v1', 'I do sport at six.', 'Um sechs Uhr mache ich Sport.');

// Same item id in both families on purpose: probe variant ids are unique only inside
// their own set, so a key built from the item id alone would still collide.
function setFor(setId: string, item: ReturnType<typeof probeItem>): TrainingSet {
  return { setId, topicId: setId, title_de: setId, level: 'A1', role: 'probe', items: [item] };
}

function dueFor(setId: string, item: ReturnType<typeof probeItem>): DueProbe {
  return {
    family: { setId, topicId: setId, outcomes: item.outcomes, armingSetIds: [], items: [item] },
    stage: 0,
    itemId: item.id,
    dueAt: 0,
    overdueDays: 0,
  };
}

const due = [dueFor('a1/probe-one', ITEM_A), dueFor('a1/probe-two', ITEM_B)];
const sets = [setFor('a1/probe-one', ITEM_A), setFor('a1/probe-two', ITEM_B)];

let ProbeStep: ComponentType<{
  due: DueProbe[];
  sets: TrainingSet[];
  cap?: number;
  onFinished: (r: { answered: number; correct: number }) => void;
}>;

beforeAll(async () => {
  ({ default: ProbeStep } = await import('../src/components/session/ProbeStep'));
});

afterEach(() => {
  cleanup();
  logAttempt.mockClear();
});

const answerBox = () => screen.getByRole('textbox') as HTMLInputElement;
const verdict = () => screen.queryByText(/Leider falsch|Richtig!/);

async function answerCurrent(text: string) {
  fireEvent.change(answerBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
  await Bun.sleep(PAST_SWAP_GUARD);
}

describe('ProbeStep', () => {
  test('the next probe starts blank and ungraded', async () => {
    render(<ProbeStep due={due} sets={sets} onFinished={() => {}} />);

    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    await answerCurrent('Am Donnerstag um sechs Uhr mache ich Sport');
    expect(verdict()).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));

    expect(screen.getByText(/2 \/ 2/)).toBeTruthy();
    expect(screen.getByText(ITEM_B.prompt_en)).toBeTruthy();
    // The regression: the previous answer used to still be sitting here, graded red.
    expect(answerBox().value).toBe('');
    expect(answerBox().disabled).toBe(false);
    expect(verdict()).toBeNull();
    expect(screen.getByRole('button', { name: 'Prüfen' })).toBeTruthy();
  });

  test('every probe answered is logged, under its own set', async () => {
    render(<ProbeStep due={due} sets={sets} onFinished={() => {}} />);

    await answerCurrent('Am Samstag bringt meine Freundin ihre Kinder mit.');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    await answerCurrent('Um sechs Uhr mache ich Sport.');

    // Probe 2 used to be unanswerable, so it was never logged, never advanced its
    // family's stage, and came due again every single session.
    expect(logAttempt).toHaveBeenCalledTimes(2);
    const logged = logAttempt.mock.calls.map(([a]: [{ setId: string; correct: boolean }]) => a);
    expect(logged.map((a) => a.setId)).toEqual(['a1/probe-one', 'a1/probe-two']);
    expect(logged.every((a) => a.correct)).toBe(true);
  });

  test('serves at most the visit cap — the session default, or the catch-up cap when passed', () => {
    // four due probes from four families; the ordinary session must still open with 3
    const names = ['one', 'two', 'three', 'four'];
    const manyDue = names.map((n) => dueFor(`a1/probe-${n}`, ITEM_A));
    const manySets = names.map((n) => setFor(`a1/probe-${n}`, ITEM_A));

    render(<ProbeStep due={manyDue} sets={manySets} onFinished={() => {}} />);
    expect(screen.getByText(/1 \/ 3/)).toBeTruthy();
    cleanup();

    // the probes-only catch-up run passes a higher cap and gets the rest of the queue
    render(<ProbeStep due={manyDue} sets={manySets} cap={5} onFinished={() => {}} />);
    expect(screen.getByText(/1 \/ 4/)).toBeTruthy();
  });

  test('the summary counts every answer, and finishes', async () => {
    const finished = mock(() => {});
    render(<ProbeStep due={due} sets={sets} onFinished={finished} />);

    await answerCurrent('Am Samstag bringt meine Freundin ihre Kinder mit.');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    await answerCurrent('falsch');
    fireEvent.click(screen.getByRole('button', { name: 'Fertig →' }));

    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter →' }));
    expect(finished).toHaveBeenCalledWith({ answered: 2, correct: 1 });
  });
});
