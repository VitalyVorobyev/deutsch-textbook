import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { charactersFixture, sceneDetailFixture, stubApi } from '../test/fixtures';
import { Szene } from './Szene';
import type { Api } from '../api';
import type { ReactNode } from 'react';
import type { Scene } from '@da/schema/audio-scene';

/**
 * The editor, through the DOM — and only the things the DOM is the honest place to check.
 *
 * The document rules live in `scene-draft.test.ts`; what is asserted here is the *editor's*
 * contract: that an edit reaches the body of the `PUT` and nothing else does, that saving carries
 * the exercise it was given, that leaving with an unsaved draft asks first, and that a run says
 * how long it has been running rather than merely greying out.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

function editor(overrides: Partial<Api> = {}) {
  return stubApi({
    scene: async () => sceneDetailFixture as never,
    characters: async () => charactersFixture as never,
    ...overrides,
  });
}

afterEach(() => {
  window.location.hash = '';
});

describe('the draft is a copy, and Save is the only thing that writes', () => {
  test('an edit reaches the PUT body as exactly that field', async () => {
    const reviseScene = vi.fn(async () => ({
      project_id: 3,
      slug: 'ls-wohnen-01',
      revision: 5,
      scene_sha256: 'neue-bytes',
      has_exercise: true,
      stage: 'draft',
    }));
    mount(<Szene slug="ls-wohnen-01" />, editor({ reviseScene: reviseScene as never }));

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'Und wo ist das Bad?' } });

    fireEvent.click(screen.getByRole('button', { name: 'Als neue Revision speichern' }));

    await waitFor(() => expect(reviseScene).toHaveBeenCalledTimes(1));
    const [slug, gesendet, exercise] = reviseScene.mock.calls[0] as unknown as [
      string,
      Scene,
      unknown,
    ];
    expect(slug).toBe('ls-wohnen-01');
    expect(gesendet.script[1]?.display_text).toBe('Und wo ist das Bad?');
    expect(gesendet.script[0]?.display_text).toBe('Hier ist die Wohnung. Sie hat drei Zimmer.');
    // The exercise is a sibling of the scene in the store, and a PUT that omitted it would
    // delete it. The editor never builds one — it carries the envelope's own value back.
    expect(exercise).toEqual(sceneDetailFixture.exercise);
  });

  test('Save is refused while nothing has changed', async () => {
    mount(<Szene slug="ls-wohnen-01" />, editor());

    const knopf = await screen.findByRole('button', { name: 'Als neue Revision speichern' });
    expect(knopf.hasAttribute('disabled')).toBe(true);
  });

  test('an unsaved draft says that saving retires the QA report and the approval', async () => {
    mount(<Szene slug="ls-wohnen-01" />, editor());

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'Und wo ist das Bad?' } });

    expect(screen.getByText('ungespeichert')).toBeTruthy();
    const notiz = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(notiz.some((text) => text.includes('zurück auf Entwurf'))).toBe(true);
  });

  test('a refusal is shown inline and stays there, naming the field', async () => {
    const { EngineError } = await import('../api');
    mount(
      <Szene slug="ls-wohnen-01" />,
      editor({
        reviseScene: () =>
          Promise.reject(
            new EngineError(422, 'script.1.pace: Input should be less than or equal to 1.3'),
          ),
      }),
    );

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'Und wo ist das Bad?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Als neue Revision speichern' }));

    const alarm = await screen.findByText(/Nicht gespeichert/);
    expect(alarm.textContent).toContain('script.1.pace');
  });

  test('Verwerfen puts the draft back and clears the unsaved marker', async () => {
    mount(<Szene slug="ls-wohnen-01" />, editor());

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'anders' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));

    expect(screen.getByDisplayValue('Und wo ist die Küche?')).toBeTruthy();
    expect(screen.queryByText('ungespeichert')).toBeNull();
  });
});

describe('the dirty guard', () => {
  test('leaving with an unsaved draft asks, and a refusal puts the address back', async () => {
    window.location.hash = '#/szene/ls-wohnen-01';
    mount(<Szene slug="ls-wohnen-01" />, editor());

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'anders' } });

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.location.hash = '#/szenen';
    window.dispatchEvent(new Event('hashchange'));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(window.location.hash).toBe('#/szene/ls-wohnen-01');
  });

  test('an accepted confirmation lets the navigation stand', async () => {
    window.location.hash = '#/szene/ls-wohnen-01';
    mount(<Szene slug="ls-wohnen-01" />, editor());

    const feld = await screen.findByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'anders' } });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.location.hash = '#/szenen';
    window.dispatchEvent(new Event('hashchange'));

    await waitFor(() => expect(window.location.hash).toBe('#/szenen'));
  });
});

describe('the role rename reaches every line', () => {
  test('renaming in the cast panel renames the utterances that speak it', async () => {
    const reviseScene = vi.fn(async () => ({
      project_id: 3,
      slug: 'ls-wohnen-01',
      revision: 5,
      scene_sha256: 'neue-bytes',
      stage: 'draft',
    }));
    mount(<Szene slug="ls-wohnen-01" />, editor({ reviseScene: reviseScene as never }));

    // Two controls hold this value — the cast's name field and the utterance's role picker — so
    // the input is named explicitly rather than by its value.
    const rolle = (await screen.findAllByDisplayValue('Maklerin')).find(
      (node) => node.tagName === 'INPUT',
    );
    if (!rolle) throw new Error('kein Rollenfeld');
    fireEvent.change(rolle, { target: { value: 'Vermieterin' } });
    // Committed on blur, not per keystroke: an intermediate name is a name, and one that
    // collides would be refused and make the field look stuck.
    fireEvent.blur(rolle);

    fireEvent.click(screen.getByRole('button', { name: 'Als neue Revision speichern' }));

    await waitFor(() => expect(reviseScene).toHaveBeenCalledTimes(1));
    const gesendet = (reviseScene.mock.calls[0] as unknown as [string, Scene])[1];
    expect(gesendet.cast.map((member) => member.role)).toEqual(['Vermieterin', 'Mieter']);
    expect(gesendet.script.map((row) => row.role)).toEqual(['Vermieterin', 'Mieter']);
  });
});

describe('the Mischung run buttons', () => {
  function mischung(overrides: Partial<Api> = {}) {
    window.location.hash = '#/szene/ls-wohnen-01?modus=mischung';
    return mount(<Szene slug="ls-wohnen-01" />, editor(overrides));
  }

  test('a running render shows the elapsed second and refuses re-entry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let aufloesen: ((wert: unknown) => void) | undefined;
    const renderScene = vi.fn(
      () =>
        new Promise((resolve) => {
          aufloesen = resolve;
        }),
    );
    mischung({ renderScene: renderScene as never });

    const knopf = await screen.findByRole('button', { name: 'natural rendern' });
    fireEvent.click(knopf);

    const laufend = await screen.findByRole('button', { name: /Rendert/ });
    expect(laufend.hasAttribute('disabled')).toBe(true);
    fireEvent.click(laufend);
    expect(renderScene).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2100);
    expect((await screen.findByRole('button', { name: /Rendert/ })).textContent).toContain('2 s');

    aufloesen?.({
      slug: 'ls-wohnen-01',
      revision: 4,
      scene_sha256: 'abc1234def5678',
      stage: 'audio_generated',
      variant: 'natural',
      duration_ms: 31240,
      nodes_evaluated: 3,
      nodes_cached: 21,
      artifacts: [],
    });

    // The incremental story is the whole argument for the node graph, so it is on the answer.
    const meldung = await screen.findByText(/Knoten gerechnet/);
    expect(meldung.textContent).toContain('3');
    expect(meldung.textContent).toContain('21');
    vi.useRealTimers();
  });

  test('a refusal from the engine is shown as itself', async () => {
    const { EngineError } = await import('../api');
    mischung({
      renderScene: () =>
        Promise.reject(new EngineError(409, 'this scene is cast on unknown engine(s) qwen_tts')),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'natural rendern' }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('unknown engine');
    expect(alarm.textContent).toContain('409');
  });

  test('QA is refused until there is a master of these bytes', async () => {
    const ohneRender = {
      ...sceneDetailFixture,
      renders: [{ ...sceneDetailFixture.renders[0], rendered: false, has_master: false }],
    };
    window.location.hash = '#/szene/ls-wohnen-01?modus=mischung';
    mount(
      <Szene slug="ls-wohnen-01" />,
      editor({ scene: async () => ohneRender as never }),
    );

    const knopf = await screen.findByRole('button', { name: 'Automatisch prüfen' });
    expect(knopf.hasAttribute('disabled')).toBe(true);
  });

  test('the rendered timeline is drawn from the render’s own measurement', async () => {
    mischung();

    const bild = await screen.findByRole('img', { name: /Gerenderte Zeitleiste/ });
    expect(bild.getAttribute('aria-label')).toContain('3 Spuren');
    // A role with no measured turn keeps its lane; the bed and the roles are separate lanes.
    expect(screen.getByText('Umgebung')).toBeTruthy();
    expect(screen.getByText('Maklerin')).toBeTruthy();
  });
});

describe('a document that has drifted from the contract', () => {
  test('is readable and not editable, and says which of the two it is', async () => {
    const drift = {
      ...sceneDetailFixture,
      document: {
        valid: false,
        scene: sceneDetailFixture.scene,
        problem: 'scene: unrecognized key: "tempo_hinweis"',
      },
    };
    mount(<Szene slug="ls-wohnen-01" />, editor({ scene: async () => drift as never }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('Scene v1');
    // Still readable: a lenient parse is what lets the reviewer see the script at all.
    expect(screen.getByDisplayValue('Und wo ist die Küche?')).toBeTruthy();
    // And not writable: writing a lenient read back would delete whatever it did not recognise.
    const feld = screen.getByDisplayValue('Und wo ist die Küche?');
    fireEvent.change(feld, { target: { value: 'anders' } });
    expect(screen.queryByText('ungespeichert')).toBeNull();
  });
});
