import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { charactersFixture, sceneDetailFixture, stubApi } from '../test/fixtures';
import { Szene } from './Szene';
import { aufloesung, umriss } from './szene/Zeitleiste';
import type { Api } from '../api';
import type { RenderPeaks } from '../contracts';
import type { Scene } from '@da/schema/audio-scene';

/**
 * The Zeitleiste: the render's own spans, its stems' waveforms over them, and a transport that
 * plays the master from a point or one stem alone.
 */

const peaksFixture: RenderPeaks = {
  resolution_ms: 40,
  floor_dbfs: -60,
  levels: 255,
  duration_ms: 31240,
  master: [10, 200, 180],
  tracks: [
    {
      entry_id: 'line-1',
      type: 'speech',
      start_ms: 0,
      end_ms: 3120,
      path: 'stems/line-1.wav',
      peaks: [0, 255, 128],
    },
    {
      entry_id: 'line-2',
      type: 'speech',
      start_ms: 3570,
      end_ms: 5400,
      path: 'stems/line-2.wav',
      peaks: [64, 64],
    },
    {
      entry_id: 'ambience-1',
      type: 'ambience',
      start_ms: 0,
      end_ms: 5400,
      path: 'stems/ambience-1.wav',
      peaks: [30, 30, 30],
    },
  ],
};

function mischung(overrides: Partial<Api> = {}) {
  window.location.hash = '#/szene/ls-wohnen-01?modus=mischung';
  const api = stubApi({
    scene: async () => sceneDetailFixture as never,
    characters: async () => charactersFixture as never,
    ...overrides,
  });
  return render(
    <ApiContext.Provider value={api}>
      <Szene slug="ls-wohnen-01" />
    </ApiContext.Provider>,
  );
}

afterEach(() => {
  window.location.hash = '';
});

describe('the waveform geometry', () => {
  test('the window is about one level per drawn unit, in 5 ms steps, inside the engine’s bounds', () => {
    expect(aufloesung(31240)).toBe(40);
    expect(aufloesung(100)).toBe(5);
    expect(aufloesung(60 * 60 * 1000)).toBe(1000);
  });

  test('an envelope closes on itself and a silent window keeps a hairline', () => {
    const path = umriss([0, 255], 255, 100, 200, 50, 10);
    expect(path.startsWith('M100.0,50.0L125.0,49.5L175.0,40.0L200.0,50.0')).toBe(true);
    expect(path.endsWith('L175.0,60.0L125.0,50.5Z')).toBe(true);
    expect(umriss([], 255, 0, 10, 5, 5)).toBe('');
  });
});

describe('the Zeitleiste in Mischung', () => {
  test('each span carries its own stem’s waveform, fetched at the scene’s resolution', async () => {
    const peaks = vi.fn(async () => peaksFixture);
    mischung({ peaks: peaks as never });

    const bild = await screen.findByRole('img', { name: /Gerenderte Zeitleiste/ });
    await waitFor(() => expect(bild.querySelectorAll('path')).toHaveLength(3));
    expect(peaks).toHaveBeenCalledWith('ls-wohnen-01', 'natural', 40, expect.anything());
  });

  test('without peaks the lanes are still drawn, as bars', async () => {
    mischung();

    const bild = await screen.findByRole('img', { name: /Gerenderte Zeitleiste/ });
    expect(bild.querySelectorAll('path')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'line-2 einzeln hören' })).toBeTruthy();
  });

  test('a piece plays its own stem alone', async () => {
    const objectUrl = vi.fn(async () => 'blob:tonwerk/stub');
    mischung({ peaks: async () => peaksFixture, objectUrl: objectUrl as never });

    fireEvent.click(await screen.findByRole('button', { name: 'line-2 einzeln hören' }));
    await waitFor(() =>
      expect(objectUrl).toHaveBeenCalledWith(
        '/api/scenes/ls-wohnen-01/renders/natural/artifact/stems/line-2.wav',
        expect.anything(),
      ),
    );
    expect(await screen.findByText('spielt: line-2')).toBeTruthy();
  });

  test('the transport plays the master from where the playhead stands', async () => {
    const objectUrl = vi.fn(async () => 'blob:tonwerk/stub');
    mischung({ peaks: async () => peaksFixture, objectUrl: objectUrl as never });

    fireEvent.click(await screen.findByRole('button', { name: 'Zeitleiste abspielen' }));
    await waitFor(() =>
      expect(objectUrl).toHaveBeenCalledWith(
        '/api/scenes/ls-wohnen-01/renders/natural/master',
        expect.anything(),
      ),
    );
  });
});

describe('editing timing on the Zeitleiste', () => {
  const planFuer = (scene: Scene) => {
    // What the engine would answer for this fixture: line-2 where its pin puts it, line-1 and the
    // bed as rendered. The view draws what the plan says and never computes a time itself.
    const zeile = scene.timeline[1] as { at_ms: number | null };
    const start = zeile.at_ms ?? 3570;
    return {
      slug: 'ls-wohnen-01',
      variant: 'natural',
      complete: true,
      missing: [],
      duration_ms: Math.max(5400, start + 1830),
      timeline: [
        { entry_id: 'line-1', type: 'speech', start_ms: 0, end_ms: 3120 },
        { entry_id: 'line-2', type: 'speech', start_ms: start, end_ms: start + 1830 },
        { entry_id: 'ambience-1', type: 'ambience', start_ms: 0, end_ms: 5400 },
      ],
    };
  };

  test('an arrow key pins the turn, the engine plans the draft, and undo takes it back', async () => {
    const planScene = vi.fn(async (_slug: string, scene: Scene, _variante: string) =>
      planFuer(scene),
    );
    mischung({ planScene: planScene as never });

    const stueck = await screen.findByRole('button', { name: 'line-2 einzeln hören' });
    fireEvent.keyDown(stueck, { key: 'ArrowLeft', shiftKey: true });

    expect(await screen.findByText('ungespeichert')).toBeTruthy();
    const feld = screen.getByRole('spinbutton', { name: /Beginn nach Sprechstart/ });
    expect((feld as HTMLInputElement).value).toBe('3470');
    await waitFor(() => expect(planScene).toHaveBeenCalled());
    const [, entwurf, variante] = planScene.mock.calls.at(-1)!;
    expect(variante).toBe('natural');
    expect(entwurf.timeline[1]).toMatchObject({ utterance_id: 'line-2', at_ms: 3470 });
    expect(await screen.findByText(/So läge die Szene nach dem nächsten Render/)).toBeTruthy();
    // The rendered place stays visible as an outline beside the planned one.
    expect(document.querySelector('.zeitleiste-gerendert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(screen.queryByText('ungespeichert')).toBeNull());
    expect(
      (screen.getByRole('spinbutton', { name: /Beginn nach Sprechstart/ }) as HTMLInputElement)
        .value,
    ).toBe('');
  });

  test('a drag moves the turn by the distance on the plate, and a release is one step', async () => {
    const planScene = vi.fn(async (_slug: string, scene: Scene, _variante: string) =>
      planFuer(scene),
    );
    mischung({ planScene: planScene as never });
    const bild = await screen.findByRole('img', { name: /Gerenderte Zeitleiste/ });
    // The plate drawn 1000 px wide is the viewBox one to one: 842 units for the fixture render's
    // 31 240 ms.
    vi.spyOn(bild, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 100,
      right: 1000,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const stueck = screen.getByRole('button', { name: 'line-2 einzeln hören' });
    fireEvent.pointerDown(stueck, { button: 0, clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 616 });
    fireEvent.pointerMove(window, { clientX: 642 });
    fireEvent.pointerUp(window, { clientX: 642 });

    // 42 px × 31 240 / 842 ms per px = 1558 ms, on the 10 ms grid: 1560 ms after 3570.
    const feld = await screen.findByRole('spinbutton', { name: /Beginn nach Sprechstart/ });
    expect((feld as HTMLInputElement).value).toBe('5130');
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(screen.queryByText('ungespeichert')).toBeNull());
  });

  test('a plan that lacks a take says which, and offers no preview', async () => {
    const planScene = vi.fn(async () => ({
      slug: 'ls-wohnen-01',
      variant: 'natural',
      complete: false,
      missing: ['line-2'],
      duration_ms: null,
      timeline: [],
    }));
    mischung({ planScene: planScene as never });
    fireEvent.keyDown(await screen.findByRole('button', { name: 'line-2 einzeln hören' }), {
      key: 'ArrowRight',
    });
    expect(await screen.findByText(/Für line-2 gibt es noch keine Aufnahme/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Entwurf hören/ })).toBeNull();
  });
});
