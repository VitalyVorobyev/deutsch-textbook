/**
 * FlashcardSession's `grade()` used to `await setCardState(...)` before touching any visible
 * state (`setStates`, `setStats`, `setQueue`, `setRevealed`, `setTyped`, `setVerdict`) — so a
 * stalled IndexedDB write (a backgrounded tab; WebKit is documented to stall IDB transactions
 * there) made "Nochmal"/"Gut" a dead button: nothing on screen moved until the write settled,
 * which could be never. `grade()` is optimistic — every UI update lands synchronously — and the
 * write is now DURABLE (docs/adrs/0016-durable-progress-writes.md): journaled to localStorage
 * before the IndexedDB attempt starts, so a write that never settles is never silently lost.
 * This test stalls the store write and proves the click still advances the session AND the
 * journal is holding the op for replay.
 */
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { CardDef } from '../src/lib/srs';
import * as store from '../src/lib/store';

// updateCardState (the grading write) never resolves — the exact fault the desktop
// investigation established against a real IndexedDB write. getCardStates resolves
// immediately: FlashcardSession loads states even on a preset queue, and this test is about
// the write path, not the read path (the read path has its own deadline + plausibility gate).
// Captured BEFORE mock.module patches the registry: the `store` namespace is live-bound,
// so reading these off `store` after the mock would return the mocks themselves and the
// afterAll delegation below would recurse forever.
const realUpdateCardState = store.updateCardState;
const realGetCardStates = store.getCardStates;
const updateCardState = mock(() => new Promise<never>(() => {}));
const getCardStates = mock(() => Promise.resolve({}));
mock.module('../src/lib/store', () => ({ ...store, updateCardState, getCardStates }));

let FlashcardSession: ComponentType<{ cards: CardDef[]; queue?: CardDef[] }>;
let journalPending: typeof import('../src/lib/write-journal').journalPending;

beforeAll(async () => {
  ({ default: FlashcardSession } = await import('../src/components/srs/FlashcardSession'));
  ({ journalPending } = await import('../src/lib/write-journal'));
});

afterEach(() => {
  cleanup();
  updateCardState.mockClear();
  getCardStates.mockClear();
  localStorage.clear();
});

// `mock.module` outlives this file in a full-suite run (bun keeps the patched module in
// the registry), so later test files importing store would silently get the stalling
// mocks. Delegate back to the real implementations once this suite is done.
afterAll(() => {
  updateCardState.mockImplementation(realUpdateCardState as never);
  getCardStates.mockImplementation(realGetCardStates as never);
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
  test('still advances the queue, and the journal holds the stalled grade', async () => {
    render(<FlashcardSession cards={[CARD_A, CARD_B]} queue={[CARD_A, CARD_B]} />);

    // Card A loads (queue resolves via the mocked, fast getCardStates) and offers its input.
    const firstInput = await screen.findByRole('textbox') as HTMLInputElement;
    expect(screen.getByText(/Remaining: 2/)).toBeTruthy();

    fireEvent.change(firstInput, { target: { value: 'gehen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(await screen.findByText('✓ Richtig!')).toBeTruthy();

    // Grade it — updateCardState is stalled forever underneath this click.
    fireEvent.click(screen.getByRole('button', { name: 'Gut' }));

    // The click is not dead: card B's input appears, freshly blank, and the counter dropped.
    const secondInput = await screen.findByRole('textbox') as HTMLInputElement;
    expect(secondInput).not.toBe(firstInput);
    expect(secondInput.value).toBe('');
    expect(screen.getByText(/Remaining: 1/)).toBeTruthy();

    // The write was attempted — off the critical path — and the journal is holding the op,
    // so a quit right now would replay it on the next launch instead of losing the answer.
    expect(updateCardState).toHaveBeenCalledTimes(1);
    expect(updateCardState.mock.calls[0]![0]).toBe(CARD_A.id);
    const pending = journalPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ kind: 'grade', cardId: CARD_A.id });
  });
});
