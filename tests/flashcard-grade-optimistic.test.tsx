/**
 * FlashcardSession's `grade()` used to `await setCardState(...)` before touching any visible
 * state (`setStates`, `setStats`, `setQueue`, `setRevealed`, `setTyped`, `setVerdict`) — so a
 * stalled IndexedDB write (a backgrounded tab; WebKit is documented to stall IDB transactions
 * there) made "Nochmal"/"Gut" a dead button: nothing on screen moved until the write settled,
 * which could be never. `grade()` is now optimistic — every UI update lands synchronously, and
 * the write happens after, its rejection logged rather than silently lost. This test mocks
 * `setCardState` to never resolve and proves the click still advances the session.
 */
import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { CardDef } from '../src/lib/srs';
import * as store from '../src/lib/store';

// setCardState never resolves — the exact fault the P24-ish investigation injected against a
// real IndexedDB write. getCardStates resolves immediately: FlashcardSession loads states even
// on a preset queue, and this test is about the write path, not the read path (CurriculumPath's
// read-path fix has its own test).
const setCardState = mock(() => new Promise<void>(() => {}));
const getCardStates = mock(() => Promise.resolve({}));
mock.module('../src/lib/store', () => ({ ...store, setCardState, getCardStates }));

let FlashcardSession: ComponentType<{ cards: CardDef[]; queue?: CardDef[] }>;

beforeAll(async () => {
  ({ default: FlashcardSession } = await import('../src/components/srs/FlashcardSession'));
});

afterEach(() => {
  cleanup();
  setCardState.mockClear();
  getCardStates.mockClear();
});

const card = (de: string, en: string): CardDef => ({
  id: `deck::${de}::x-de`,
  deckId: 'deck',
  dir: 'x-de',
  de,
  en,
  ru: en,
  exampleDe: `${de.charAt(0).toUpperCase()}${de.slice(1)}.`,
  exampleEn: `${en}.`,
  exampleRu: `${en}.`,
  pos: 'verb',
});

const CARD_A = card('gehen', 'to go');
const CARD_B = card('kommen', 'to come');

describe('grade() with a never-resolving store write', () => {
  test('still advances the queue and clears the input state', async () => {
    render(<FlashcardSession cards={[CARD_A, CARD_B]} queue={[CARD_A, CARD_B]} />);

    // Card A loads (queue resolves via the mocked, fast getCardStates) and offers its input.
    const firstInput = await screen.findByRole('textbox') as HTMLInputElement;
    expect(screen.getByText(/Remaining: 2/)).toBeTruthy();

    fireEvent.change(firstInput, { target: { value: 'gehen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(await screen.findByText('✓ Richtig!')).toBeTruthy();

    // Grade it — setCardState is stalled forever underneath this click.
    fireEvent.click(screen.getByRole('button', { name: 'Gut' }));

    // The click is not dead: card B's input appears, freshly blank, and the counter dropped.
    const secondInput = await screen.findByRole('textbox') as HTMLInputElement;
    expect(secondInput).not.toBe(firstInput);
    expect(secondInput.value).toBe('');
    expect(screen.getByText(/Remaining: 1/)).toBeTruthy();

    // The write was still attempted — it is just not on the critical path anymore.
    expect(setCardState).toHaveBeenCalledTimes(1);
    expect(setCardState.mock.calls[0]![0]).toBe(CARD_A.id);
  });
});
