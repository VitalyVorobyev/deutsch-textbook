/**
 * /ueben/wortschatz draws every deck's mastery bar from ONE island (`DeckMasterySummaries`),
 * portalled into each static deck card's `[data-deck-summary]` slot. It replaced one island per
 * deck, each handed its deck's full built cards — 11.1 MB of HTML for the page (backlog P23-1).
 * Three things here are silent when broken:
 *
 *  - **Every slot gets its own deck's bar**, read from card ids the island rebuilds from
 *    headwords. A wrong id reads no state, and a learned word would show as new.
 *  - **Still reading is not confirmed empty** (ADR 0018): each slot shows a placeholder until
 *    the read resolves, never a confident all-new bar.
 *  - **A failed read is one error, not 129**: the error renders once, in the island's own
 *    place above the list, and the slots stay empty.
 *
 * Only `getCardStates` is stubbed, and it delegates back to the real store in afterAll:
 * `mock.module` is process-global in bun (see curriculum-path-loading.test.tsx).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { State } from 'ts-fsrs';
import * as store from '../src/lib/store';
import type { DeckWords } from '../src/lib/vocab-mastery';

const real = { getCardStates: store.getCardStates };
const getCardStates = mock(() => new Promise<store.CardStates>(() => {}));
mock.module('../src/lib/store', () => ({ ...store, getCardStates }));
afterAll(() => {
  getCardStates.mockImplementation(real.getCardStates as never);
});

let DeckMasterySummaries: ComponentType<{ decks: DeckWords[] }>;
beforeAll(async () => {
  ({ DeckMasterySummaries } = await import('../src/components/vocab/VocabMastery'));
});

const DECKS: DeckWords[] = [
  { id: 'essen', words: ['Brot', 'Käse'], recognitionOnly: [] },
  { id: 'reste', words: ['Zuschlag'], recognitionOnly: ['Zuschlag'] },
];

/** The static deck cards as wortschatz.astro renders them, before the island mounts. */
function staticSlots() {
  document.body.innerHTML = DECKS.map(
    (d) => `<a><p>${d.id}</p><div data-deck-summary="${d.id}"></div></a>`,
  ).join('');
}
const slot = (id: string) => document.querySelector<HTMLElement>(`[data-deck-summary="${id}"]`)!;
const bar = (id: string) => slot(id).querySelector('[role="img"]')?.getAttribute('aria-label');

const learning = (): store.StoredCard => ({
  due: '2099-01-01T00:00:00.000Z',
  stability: 1,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 1,
  learning_steps: 0,
  reps: 1,
  lapses: 0,
  state: State.Learning,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'test');
  document.documentElement.dataset.explainLang = 'en';
  getCardStates.mockImplementation(() => new Promise<store.CardStates>(() => {}));
  staticSlots();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('DeckMasterySummaries', () => {
  test("each slot gets its own deck's bar, read through the rebuilt card ids", async () => {
    getCardStates.mockImplementation(() => Promise.resolve({ 'essen::Käse::x-de': learning() }));
    render(<DeckMasterySummaries decks={DECKS} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    await waitFor(() => expect(bar('essen')).toBeTruthy());
    expect(bar('essen')).toBe('New 1, Learning 1, Established 0, Strong 0');
    expect(bar('reste')).toBe('New 1, Learning 0, Established 0, Strong 0');
  });

  test('while the read is in flight every slot shows a placeholder, never a bar', () => {
    render(<DeckMasterySummaries decks={DECKS} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    for (const id of ['essen', 'reste']) {
      expect(bar(id)).toBeUndefined();
      expect(slot(id).querySelector('.h-2')).toBeTruthy();
    }
  });

  test('a failed read renders one error above the list and leaves the slots empty', async () => {
    getCardStates.mockImplementation(() => Promise.reject(new Error('NotFoundError')));
    render(<DeckMasterySummaries decks={DECKS} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(slot('essen').childElementCount).toBe(0);
    expect(slot('reste').childElementCount).toBe(0);
  });
});
