import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { stubApi, voicesFixture } from '../test/fixtures';
import { Figuren } from './Figuren';
import type { Api } from '../api';
import type { ReactNode } from 'react';
import type { Scene } from '@da/schema/audio-scene';

/**
 * What the voices surface owes its reader.
 *
 * Three things, and each one is a way the page could lie:
 *
 * * **The rules it prints are the ones that apply**, and they change with the scope and the minor
 *   toggle — from the engine's own `applies`/`minors_only`, never from a rule re-implemented here.
 * * **A refusal lands on the rule that caused it**, in the engine's own words.
 * * **A withdrawal is visible.** A revoked voice stays listed, struck through, with its date; it
 *   does not quietly leave the roster it is still cast from.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

const CHARACTERS = {
  version: 1,
  characters: [
    {
      id: 'mira',
      version: 1,
      display_name: 'Mira',
      registers: ['informal'],
      roles: [],
      casting_tags: [],
      incompatible_with: [],
      demo_phrases: ['Heute treffen wir uns um halb sechs am Bahnhof.'],
      usage_count: 0,
      demo_urls: [],
      portrait_candidate_urls: [],
      selected_portrait_url: null,
    },
  ],
};

function stub(overrides: Partial<Api> = {}): Api {
  return stubApi({ characters: async () => CHARACTERS as never, ...overrides });
}

// The editor's mode lives in the hash; one spec's address is the next spec's starting state.
afterEach(() => {
  window.location.hash = '';
});

/**
 * The cast panel's clone button, once the voice list has arrived.
 *
 * The scene and the voices are two independent reads, and the panel renders as soon as the *scene*
 * is there — so a click that did not wait would land on a button still disabled because this studio
 * appeared to hold no consented voice. It passed alone and failed in a full run, which is the
 * signature of exactly that.
 */
async function klonKnopf(): Promise<HTMLButtonElement> {
  const knopf = () => screen.getAllByRole('button', { name: 'Geklonte Stimme' })[0] as HTMLButtonElement;
  await waitFor(() => expect(knopf().disabled).toBe(false));
  return knopf();
}

/** Fill only what makes a request: the file, the id and the person. The rest is the engine's. */
async function fuelleGrundangaben(): Promise<void> {
  const datei = new File(['reference bytes'], 'mara.wav', { type: 'audio/wav' });
  const auswahl = screen.getByLabelText(/Referenzaufnahme/) as HTMLInputElement;
  fireEvent.change(auswahl, { target: { files: [datei] } });
  await screen.findByText(/mara\.wav/);
  fireEvent.change(screen.getByLabelText(/^Kennung/), { target: { value: 'mara-h' } });
  fireEvent.change(screen.getByLabelText(/^Person/), { target: { value: 'Mara H.' } });
}

describe('die Liste der geklonten Stimmen', () => {
  test('shows the scope, both digests and whether the recording is on this machine', async () => {
    mount(<Figuren />, stub());

    await screen.findByText('Mara H.');
    expect(screen.getAllByText('Veröffentlichung').length).toBeGreaterThan(0);
    // Both hashes are printed: the recording and the document that permitted it.
    expect(screen.getByText(/aaaaaaa/)).toBeTruthy();
    expect(screen.getByText(/bbbbbbb/)).toBeTruthy();
  });

  test('a revoked voice stays listed, with its date and what it means for published audio', async () => {
    mount(<Figuren />, stub());

    const jo = await screen.findByText('Jo R.');
    const zeile = jo.closest('.stimme') as HTMLElement;
    expect(zeile.dataset.widerrufen).toBe('ja');
    expect(within(zeile).getByText(/Widerrufen am 2026-08-21/)).toBeTruthy();
    expect(within(zeile).getByText(/Provenienz/)).toBeTruthy();
    // Nothing more may be made with it.
    expect((within(zeile).getByText('Hörprobe erzeugen') as HTMLButtonElement).disabled).toBe(true);
    // And the recording is gone from this machine.
    expect(within(zeile).getByText(/nicht auf diesem Rechner/)).toBeTruthy();
  });

  test('withdrawing consent asks the engine and re-reads the list', async () => {
    const revokeVoice = vi.fn(async () => ({
      id: 'mara-h',
      revoked_at: '2026-08-21T12:00:00+00:00',
      reference_deleted: true,
      demos_deleted: 1,
      note: 'Future synthesis refused.',
    }));
    const voices = vi.fn(async () => voicesFixture as never);
    mount(<Figuren />, stub({ revokeVoice: revokeVoice as never, voices }));

    const mara = await screen.findByText('Mara H.');
    const zeile = mara.closest('.stimme') as HTMLElement;
    fireEvent.click(within(zeile).getByText('Einwilligung widerrufen'));

    await waitFor(() => expect(revokeVoice).toHaveBeenCalledWith('mara-h'));
    // Two reads: the mount, and the one the withdrawal asked for. A page that changed the row
    // locally would be showing a withdrawal the engine has not confirmed.
    await waitFor(() => expect(voices.mock.calls.length).toBe(2));
  });
});

describe('der Klon-Assistent', () => {
  test('prints the rules of the chosen scope, and no others', async () => {
    mount(<Figuren />, stub());
    await screen.findByText('Der Klon-Assistent');

    expect(screen.getByText(/erlaubt ausdrücklich die Veröffentlichung in diesem Kurs/)).toBeTruthy();
    expect(screen.queryByText(/schließt Upload, Veröffentlichung und Git/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Evaluation' }));

    expect(screen.getByText(/schließt Upload, Veröffentlichung und Git/)).toBeTruthy();
    expect(screen.queryByText(/erlaubt ausdrücklich die Veröffentlichung in diesem Kurs/)).toBeNull();
  });

  test('the minor toggle adds the two rules it is about', async () => {
    mount(<Figuren />, stub());
    await screen.findByText('Der Klon-Assistent');

    expect(screen.queryByText(/willigt die erziehungsberechtigte Person ein/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Die Person ist minderjährig/));
    expect(screen.getByText(/willigt die erziehungsberechtigte Person ein/)).toBeTruthy();
    expect(screen.getByText(/Zustimmung des Kindes bestätigt/)).toBeTruthy();
  });

  test('walks the chain as the inputs arrive', async () => {
    mount(<Figuren />, stub());
    await screen.findByText('Der Klon-Assistent');

    const stufe = () => screen.getByLabelText('Ablauf des Klon-Assistenten').querySelector('[aria-current="step"]')?.textContent;
    expect(stufe()).toBe('Aufnahme');

    const datei = new File(['reference bytes'], 'mara.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText(/Referenzaufnahme/), { target: { files: [datei] } });
    await waitFor(() => expect(stufe()).toBe('Text'));

    fireEvent.change(screen.getByRole('textbox', { name: /Referenztext/ }), {
      target: { value: 'Guten Tag, ich lese diesen Satz.' },
    });
    await waitFor(() => expect(stufe()).toBe('Einwilligung'));
  });

  test('the document it will send is readable before it is sent, and carries the file digest', async () => {
    mount(<Figuren />, stub());
    await screen.findByText('Der Klon-Assistent');
    await fuelleGrundangaben();

    const dokument = screen.getByText(/Dokument ansehen/).parentElement as HTMLElement;
    const text = within(dokument).getByText(/"scope": "publication"/).textContent ?? '';
    const gelesen = JSON.parse(text) as { subject: { display_name: string }; reference: { sha256: string } };
    expect(gelesen.subject.display_name).toBe('Mara H.');
    expect(gelesen.reference.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test('a refusal names its rule on the rule’s own row', async () => {
    const { EngineError } = await import('../api');
    const createVoice = vi.fn(async () => {
      throw new EngineError(400, 'publication-permits-course: a publication consent must name a permitted use');
    });
    mount(<Figuren />, stub({ createVoice: createVoice as never }));
    await screen.findByText('Der Klon-Assistent');
    await fuelleGrundangaben();

    fireEvent.click(screen.getByRole('button', { name: 'Stimme anlegen' }));
    await waitFor(() => expect(createVoice).toHaveBeenCalled());

    const zeile = await screen.findByText('publication-permits-course');
    expect((zeile.closest('.regel') as HTMLElement).dataset.verletzt).toBe('ja');
    // And the engine's own sentence is shown, not a paraphrase of it.
    expect(screen.getByText(/a publication consent must name a permitted use/)).toBeTruthy();
  });

  test('a created voice moves the chain to Hörprobe and offers the next one', async () => {
    const createVoice = vi.fn(async () => voicesFixture.voices[0] as never);
    mount(<Figuren />, stub({ createVoice: createVoice as never }));
    await screen.findByText('Der Klon-Assistent');
    await fuelleGrundangaben();

    fireEvent.click(screen.getByRole('button', { name: 'Stimme anlegen' }));

    await screen.findByText('4 · Hörprobe');
    expect(screen.getByText('Nächste Stimme')).toBeTruthy();
  });

  test('the button waits for the three things a request is made of', async () => {
    mount(<Figuren />, stub());
    await screen.findByText('Der Klon-Assistent');

    const knopf = () => screen.getByRole('button', { name: 'Stimme anlegen' }) as HTMLButtonElement;
    expect(knopf().disabled).toBe(true);
    await fuelleGrundangaben();
    expect(knopf().disabled).toBe(false);

    // An id the engine's pattern refuses closes it again — the one rule the form does hold, because
    // it is about the *request* rather than about the document.
    fireEvent.change(screen.getByLabelText(/^Kennung/), { target: { value: 'Mara H' } });
    expect(knopf().disabled).toBe(true);
  });
});

describe('die Besetzung einer geklonten Stimme', () => {
  test('casting a clone sets the reference, the display name and the engine together', async () => {
    const { charactersFixture, sceneDetailFixture } = await import('../test/fixtures');
    const { Szene } = await import('./Szene');
    const reviseScene = vi.fn(async () => ({
      project_id: 3,
      slug: 'ls-wohnen-01',
      revision: 5,
      scene_sha256: 'neue-bytes',
      has_exercise: true,
      stage: 'draft',
    }));
    mount(
      <Szene slug="ls-wohnen-01" />,
      stubApi({
        scene: async () => sceneDetailFixture as never,
        characters: async () => charactersFixture as never,
        reviseScene: reviseScene as never,
      }),
    );

    await screen.findByText('Besetzung');
    fireEvent.click(await klonKnopf());

    fireEvent.click(screen.getByRole('button', { name: 'Als neue Revision speichern' }));
    await waitFor(() => expect(reviseScene).toHaveBeenCalled());

    const [, scene] = reviseScene.mock.calls[0] as unknown as [string, Scene];
    // All three move together. A cast row naming a preset voice over a cloned reference would be a
    // published transcript that credits the wrong speaker.
    expect(scene.cast[0]!.voice.voice_ref).toBe('mara-h');
    expect(scene.cast[0]!.voice.voice).toBe('Mara H.');
    expect(scene.cast[0]!.voice.engine).toBe('qwen_tts_base');
  });

  test('a revoked voice is not offered, and switching back clears the reference', async () => {
    const { charactersFixture, sceneDetailFixture } = await import('../test/fixtures');
    const { Szene } = await import('./Szene');
    const reviseScene = vi.fn(async () => ({
      project_id: 3,
      slug: 'ls-wohnen-01',
      revision: 5,
      scene_sha256: 'neue-bytes',
      has_exercise: true,
      stage: 'draft',
    }));
    mount(
      <Szene slug="ls-wohnen-01" />,
      stubApi({
        scene: async () => sceneDetailFixture as never,
        characters: async () => charactersFixture as never,
        reviseScene: reviseScene as never,
      }),
    );

    await screen.findByText('Besetzung');
    fireEvent.click(await klonKnopf());

    const picker = screen.getAllByRole('combobox', {
      name: /Eingewilligte Stimme/,
    })[0] as HTMLSelectElement;
    const angeboten = Array.from(picker.options).map((option) => option.value);
    expect(angeboten).toContain('mara-h');
    // `jo-r` is revoked: it may not be newly cast, only kept visible where it already is.
    expect(angeboten).not.toContain('jo-r');

    fireEvent.click(screen.getAllByRole('button', { name: 'Preset-Stimme' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Als neue Revision speichern' }));
    await waitFor(() => expect(reviseScene).toHaveBeenCalled());
    const [, scene] = reviseScene.mock.calls[0] as unknown as [string, Scene];
    expect(scene.cast[0]!.voice.voice_ref).toBeNull();
  });
});
