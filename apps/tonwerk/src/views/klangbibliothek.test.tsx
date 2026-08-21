import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { soundsFixture, stubApi } from '../test/fixtures';
import { Klangbibliothek } from './Klangbibliothek';
import type { Api } from '../api';
import type { ReactNode } from 'react';

/**
 * What the library page owes its reader is that the two origins stay apart.
 *
 * An import is somebody else's recording and needs its licence and its uploader before it can go
 * into a course; a generated sound has neither and needs its prompt, its seed and its model. A
 * page that showed one set of columns for both would either invent a licence or hide one, and the
 * assertions below are exactly that: each row shows what its origin actually knows.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

// The filters live in the hash, which is the point of them — and which means one spec's filter is
// the next spec's starting state unless it is cleared.
afterEach(() => {
  window.location.hash = '';
});

describe('both origins in one list', () => {
  test('an import shows its licence and its uploader; a generated sound shows its prompt', async () => {
    mount(<Klangbibliothek />, stubApi({ sounds: async () => soundsFixture as never }));

    await screen.findByText('Cafe room tone');
    expect(screen.getByText('mikrofonist')).toBeTruthy();
    expect(screen.getByText('CC0-1.0')).toBeTruthy();

    expect(screen.getByText('a cup set down on a saucer')).toBeTruthy();
    expect(screen.getByText('stable_audio_sfx')).toBeTruthy();
    expect(screen.getByText('Stability AI Community License')).toBeTruthy();
  });

  test('the origin filter narrows the list without losing the count it narrowed from', async () => {
    mount(<Klangbibliothek />, stubApi({ sounds: async () => soundsFixture as never }));

    await screen.findByText('Cafe room tone');
    fireEvent.change(screen.getByLabelText(/Herkunft/), { target: { value: 'generated' } });

    await waitFor(() => expect(screen.queryByText('Cafe room tone')).toBeNull());
    expect(screen.getByText('a cup set down on a saucer')).toBeTruthy();
    expect(screen.getByText('1 von 2')).toBeTruthy();
  });

  test('an empty library invites rather than shrugging', async () => {
    mount(<Klangbibliothek />, stubApi({ sounds: async () => [] as never }));

    expect(
      await screen.findByText(/Importiere eine Aufnahme oder erzeuge einen Klang/),
    ).toBeTruthy();
  });
});

describe('the transport', () => {
  test('a row fetches no audio until its play button is pressed', async () => {
    // `preload="none"` cannot help: the blob URL only exists after a full fetch, so an eager
    // player on a hundred-row page downloads a hundred WAVs over the socket that is also running
    // the synthesis model.
    const objectUrl = vi.fn(async () => 'blob:tonwerk/klang');
    mount(
      <Klangbibliothek />,
      stubApi({ sounds: async () => soundsFixture as never, objectUrl }),
    );

    await screen.findByText('Cafe room tone');
    expect(objectUrl).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /abspielen$/ })[0] as HTMLElement);

    await waitFor(() => expect(objectUrl).toHaveBeenCalledTimes(1));
    const [pfad] = objectUrl.mock.calls[0] as unknown as [string];
    expect(pfad).toContain('/api/sounds/');
  });

  test('Space inside the list works the transport, and leaves a text field alone', async () => {
    const play = vi.fn(async () => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    mount(<Klangbibliothek />, stubApi({ sounds: async () => soundsFixture as never }));

    await screen.findByText('Cafe room tone');
    fireEvent.click(screen.getAllByRole('button', { name: /abspielen$/ })[0] as HTMLElement);
    // Once loaded, the player plays by itself: the press that fetched it was a press of play.
    await waitFor(() => expect(play).toHaveBeenCalled());

    const anzahl = play.mock.calls.length;
    const bereich = document.querySelector('.spielbereich');
    if (!bereich) throw new Error('kein Spielbereich');

    // A control that means something by Space keeps it — a shortcut that overrides a text field
    // is worse than no shortcut.
    fireEvent.keyDown(screen.getByLabelText(/Beschreibung/), { key: ' ' });
    expect(play.mock.calls.length).toBe(anzahl);
  });
});

describe('Erzeugen', () => {
  test('sends the four fields a SoundSpec holds, and shows the row it got back', async () => {
    const generateSound = vi.fn(async () => soundsFixture[1] as never);
    const sounds = vi.fn(async () => [] as never);
    mount(<Klangbibliothek />, stubApi({ sounds, generateSound }));

    await screen.findByText('Erzeugen');
    const knopf = screen.getByRole('button', { name: 'Klang erzeugen' });
    // Nothing to ask for: the button refuses before it reaches the engine.
    expect(knopf.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Beschreibung/), {
      target: { value: 'a cup set down on a saucer' },
    });
    fireEvent.change(screen.getByLabelText(/Seed/), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Länge/), { target: { value: '1.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Klang erzeugen' }));

    await waitFor(() => expect(generateSound).toHaveBeenCalledTimes(1));
    const [gesendet] = generateSound.mock.calls[0] as unknown as [unknown];
    expect(gesendet).toEqual({
      prompt: 'a cup set down on a saucer',
      negative_prompt: null,
      seed: 7,
      duration_seconds: 1.2,
      engine: 'stable_audio_sfx',
    });
    // The list is re-read, so the new row appears where it will always live from now on.
    await waitFor(() => expect(sounds).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/neu erzeugt/)).toBeTruthy();
  });

  test('a cached node says so rather than looking like a second generation', async () => {
    mount(
      <Klangbibliothek />,
      stubApi({
        sounds: async () => [] as never,
        generateSound: async () => ({ ...soundsFixture[1], cached: true }) as never,
      }),
    );

    await screen.findByText('Erzeugen');
    fireEvent.change(screen.getByLabelText(/Beschreibung/), { target: { value: 'ein Ton' } });
    fireEvent.click(screen.getByRole('button', { name: 'Klang erzeugen' }));

    expect(await screen.findByText(/lag schon im Cache/)).toBeTruthy();
  });

  test('absent weights are reported as the engine’s own refusal', async () => {
    const { EngineError } = await import('../api');
    mount(
      <Klangbibliothek />,
      stubApi({
        sounds: async () => [] as never,
        generateSound: () =>
          Promise.reject(
            new EngineError(
              409,
              'stabilityai/stable-audio-3-optimized@2204d50 is not downloaded; run tools/listening-studio/install-stable-audio.sh',
            ),
          ),
      }),
    );

    await screen.findByText('Erzeugen');
    fireEvent.change(screen.getByLabelText(/Beschreibung/), { target: { value: 'ein Ton' } });
    fireEvent.click(screen.getByRole('button', { name: 'Klang erzeugen' }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('install-stable-audio.sh');
  });
});
