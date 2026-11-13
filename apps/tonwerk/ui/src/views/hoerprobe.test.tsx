import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { hoerprobeFixture, stubApi } from '../test/fixtures';
import { umschalten, urteilFuerTaste } from '../hoerprobe';
import { Hoerprobe } from './Hoerprobe';
import type { Api } from '../api';

/**
 * The Hörprobe: one key per verdict, more than one problem at once, a note, and a pass that
 * resumes where the queue and the remembered *gut*s say it stopped. The payload handed to the
 * engine is asserted whole, because it is what becomes the queue entry.
 */

const GUT_KEY = 'tonwerk:hoerprobe-gut';

function mount(api: Api) {
  return render(
    <ApiContext.Provider value={api}>
      <Hoerprobe />
    </ApiContext.Provider>,
  );
}

let play: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  window.localStorage.clear();
  // `ls-gut-02` was heard as gut on its current bytes; `ls-neu-04` on bytes since re-recorded.
  window.localStorage.setItem(
    GUT_KEY,
    JSON.stringify({ 'ls-gut-02': 'b'.repeat(64), 'ls-neu-04': 'e'.repeat(64) }),
  );
  window.location.hash = '#/hoerprobe';
  play = vi.fn(async () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

describe('the verdicts', () => {
  test('one key each; problems combine, gut is exclusive', () => {
    expect(['1', '2', '3', '4', '5', '6'].map(urteilFuerTaste)).toEqual([
      'gut',
      'Tempo',
      'Pausen',
      'Stimme',
      'Aussprache',
      'Text',
    ]);
    expect(urteilFuerTaste('7')).toBeUndefined();
    expect(umschalten(umschalten([], 'Text'), 'Tempo')).toEqual(['Tempo', 'Text']);
    expect(umschalten(['Tempo', 'Text'], 'gut')).toEqual(['gut']);
    expect(umschalten(['gut'], 'Stimme')).toEqual(['Stimme']);
    expect(umschalten(['Stimme'], 'Stimme')).toEqual([]);
  });
});

describe('the pass', () => {
  test('resumes at the first recording nobody has judged, and shows what the queue holds', async () => {
    mount(stubApi({ hoerprobe: async () => hoerprobeFixture as never }));

    const tabelle = await screen.findByRole('grid', { name: 'Aufnahmen der Hörprobe' });
    // gefunden-01 carries a queue verdict and gut-02 a gut on these bytes; offen-03 is first owed.
    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-offen-03'),
    );
    const gefunden = within(tabelle).getByText('ls-gefunden-01').closest('tr')!;
    expect(gefunden.textContent).toContain('Stimme');
    expect(gefunden.textContent).toContain('q-0007');
    expect(within(tabelle).getByText('ls-gut-02').closest('tr')!.textContent).toContain('gut');
    // A gut heard on other bytes does not count: the recording was re-recorded since.
    expect(within(tabelle).getByText('ls-neu-04').closest('tr')!.textContent).not.toContain('gut');
    expect(screen.getByText('2 von 4 beurteilt')).toBeTruthy();
    expect(screen.getByText('lena-berger')).toBeTruthy();
    expect(screen.getByText('Preset Serena')).toBeTruthy();
  });

  test('two problems and a note are filed whole, and the next open recording plays', async () => {
    const hoerprobeVerdict = vi.fn(async (_file: string, verdicts: string[], note: string) => ({
      entry: {
        id: 'q-0050',
        type: 'finding',
        waiting: 'claude',
        from: 'owner',
        at: '2026-11-13',
        text: `Hörprobe: ${verdicts.join(', ')}. ${note}`,
        verdicts,
      },
    }));
    mount(stubApi({ hoerprobe: async () => hoerprobeFixture as never, hoerprobeVerdict }));

    const tabelle = await screen.findByRole('grid', { name: 'Aufnahmen der Hörprobe' });
    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-offen-03'),
    );
    for (const key of ['6', '1', '4', '3', '3', '6']) fireEvent.keyDown(tabelle, { key });
    const schalter = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}`) });
    expect(schalter('Stimme').getAttribute('aria-checked')).toBe('true');
    expect(schalter('Text').getAttribute('aria-checked')).toBe('true');
    expect(schalter('Pausen').getAttribute('aria-checked')).toBe('false');
    expect(schalter('gut').getAttribute('aria-checked')).toBe('false');

    fireEvent.keyDown(tabelle, { key: 'n' });
    const notiz = screen.getByRole('textbox', { name: /Notiz/ });
    expect(document.activeElement).toBe(notiz);
    // A digit typed into the note is the note's, not a verdict.
    fireEvent.keyDown(notiz, { key: '2' });
    expect(schalter('Tempo').getAttribute('aria-checked')).toBe('false');
    fireEvent.change(notiz, { target: { value: 'Lena und Frau Kern klingen gleich' } });
    fireEvent.keyDown(notiz, { key: 'Escape' });
    expect(document.activeElement).toBe(tabelle);

    fireEvent.keyDown(tabelle, { key: 'Enter' });
    await waitFor(() => expect(hoerprobeVerdict).toHaveBeenCalledTimes(1));
    expect(hoerprobeVerdict).toHaveBeenCalledWith(
      'content/listening/b1/ls-offen-03.yaml',
      ['Stimme', 'Text'],
      'Lena und Frau Kern klingen gleich',
    );
    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-neu-04'),
    );
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(within(tabelle).getByText('ls-offen-03').closest('tr')!.textContent).toContain('q-0050');
    expect(screen.getByText('3 von 4 beurteilt')).toBeTruthy();
  });

  test('gut files nothing and is remembered against the bytes that were heard', async () => {
    const hoerprobeVerdict = vi.fn();
    mount(stubApi({ hoerprobe: async () => hoerprobeFixture as never, hoerprobeVerdict }));

    const tabelle = await screen.findByRole('grid', { name: 'Aufnahmen der Hörprobe' });
    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-offen-03'),
    );
    fireEvent.keyDown(tabelle, { key: '1' });
    fireEvent.keyDown(tabelle, { key: 'Enter' });

    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-neu-04'),
    );
    expect(hoerprobeVerdict).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(GUT_KEY) ?? '{}')).toEqual({
      'ls-gut-02': 'b'.repeat(64),
      'ls-neu-04': 'e'.repeat(64),
      'ls-offen-03': 'c'.repeat(64),
    });
  });

  test('Enter with no verdict files nothing and stays on the recording', async () => {
    const hoerprobeVerdict = vi.fn();
    mount(stubApi({ hoerprobe: async () => hoerprobeFixture as never, hoerprobeVerdict }));

    const tabelle = await screen.findByRole('grid', { name: 'Aufnahmen der Hörprobe' });
    await waitFor(() =>
      expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-offen-03'),
    );
    fireEvent.keyDown(tabelle, { key: 'Enter' });

    expect(hoerprobeVerdict).not.toHaveBeenCalled();
    expect(tabelle.getAttribute('aria-activedescendant')).toBe('zeile-ls-offen-03');
  });
});
