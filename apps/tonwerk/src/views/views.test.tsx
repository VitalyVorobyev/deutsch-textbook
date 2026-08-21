import { describe, expect, test } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { charactersFixture, registryFixture, scenesFixture, stubApi } from '../test/fixtures';
import { Figuren } from './Figuren';
import { Szenen } from './Szenen';
import { Uebersicht } from './Uebersicht';
import type { Api } from '../api';
import type { ReactNode } from 'react';

/**
 * One render per screen against a stubbed API.
 *
 * These are not snapshot tests. Each one asserts the *finding* the screen exists to surface — the
 * two hole-lists on the Übersicht, the pipeline status of a row, the German label over the engine's
 * English status word — because those are what a refactor silently loses. A screen that renders and
 * shows the wrong thing passes a smoke test.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

describe('Übersicht', () => {
  test('surfaces both hole-lists as panels, not as a number in a summary', async () => {
    mount(<Uebersicht />, stubApi({ registry: async () => registryFixture as never }));

    await screen.findByText('Aufnahmen ohne Aufgabe');
    expect(screen.getByText('Aufgaben ohne Aufnahme')).toBeTruthy();
    // The recording nothing asks a question about, by name — a count alone tells the author that
    // something is unlinked and not what to open.
    expect(screen.getAllByText('ls-arbeit-02').length).toBeGreaterThan(0);
    // Both ways an exercise ends up on browser TTS, kept apart.
    expect(screen.getByText('keine genannt')).toBeTruthy();
    expect(screen.getByText('unbekannt')).toBeTruthy();
  });

  test('renders each row with a German status label over the engine’s English word', async () => {
    mount(<Uebersicht />, stubApi({ registry: async () => registryFixture as never }));

    await screen.findByText('Register');
    // Each label appears twice by design — once as a tick on the Pegel's legend, once as the row's
    // own lamp — so the assertion counts rather than demanding uniqueness.
    for (const label of ['überholt', 'veröffentlicht', 'geplant']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('the Pegel reads the whole set, with `stale` counted off the scale', async () => {
    mount(<Uebersicht />, stubApi({ registry: async () => registryFixture as never }));

    const pegel = await screen.findByRole('img', { name: /^Pegel:/ });
    expect(pegel.getAttribute('aria-label')).toContain('geplant 1');
    expect(pegel.getAttribute('aria-label')).toContain('veröffentlicht 1');
    expect(pegel.getAttribute('aria-label')).toContain('überholt 1');
  });

  test('a failed read says which of the four failures it was', async () => {
    const { OfflineError } = await import('../api');
    mount(<Uebersicht />, stubApi({ registry: () => Promise.reject(new OfflineError()) }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('atlas-listening serve');
  });
});

describe('Szenen', () => {
  test('lists dialogue and narration in one table, newest edit first', async () => {
    mount(<Szenen />, stubApi({ scenes: async () => scenesFixture as never }));

    await screen.findByText('ls-wohnen-01');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain('a1-erste-schritte');
    expect(screen.getByText('Narration')).toBeTruthy();
    expect(screen.getByText('Dialog')).toBeTruthy();
  });

  test('a scene links to its own address', async () => {
    mount(<Szenen />, stubApi({ scenes: async () => scenesFixture as never }));

    const link = await screen.findByRole('link', { name: 'ls-wohnen-01' });
    expect(link.getAttribute('href')).toBe('#/szene/ls-wohnen-01');
  });
});

describe('Figuren', () => {
  test('renders the roster with casting facts and a demo player per phrase', async () => {
    mount(<Figuren />, stubApi({ characters: async () => charactersFixture as never }));

    await screen.findByText('Lena');
    expect(screen.getByText('Erzählstimme')).toBeTruthy();
    expect(screen.getByText('Heute treffen wir uns um halb sechs am Bahnhof.')).toBeTruthy();
    // An incompatibility is a casting rule, so it must be on the card and not in a tooltip.
    expect(screen.getByText('klara')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByLabelText(/^Hörprobe/)).toHaveLength(2));
  });

  test('a character with no portrait and no demo shows both empty states', async () => {
    mount(<Figuren />, stubApi({ characters: async () => charactersFixture as never }));

    await screen.findByText('Jonas');
    expect(screen.getAllByText('kein Porträt').length).toBeGreaterThan(0);
    expect(screen.getByText('Noch keine Hörprobe erzeugt.')).toBeTruthy();
  });
});
