import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { lesetextSlug, lesetextZeilen, ziel } from '../lesetexte';
import { narrationProfilesFixture, stubApi } from '../test/fixtures';
import { Lesetexte } from './Lesetexte';
import type { Api } from '../api';
import type { ReactNode } from 'react';

/**
 * The surface PR 12's 85-text wave runs on.
 *
 * Two of these specs are about the join and one is about a key. All three are the same kind of
 * defect: silent. A scene looked up under the wrong slug simply never matches, so every converted
 * narration keeps reporting as unconverted; a `Enter` that created rather than opened would make
 * 85 irreversible projects out of one held key.
 */

function mount(node: ReactNode, api: Api) {
  return render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>);
}

const registryFixture = {
  rows: [
    {
      kind: 'reading' as const,
      id: 'a1/erste-schritte',
      level: 'A1',
      topic: 'erste-schritte',
      title: 'Im Deutschkurs',
      reading_kind: 'intensive',
      word_count: 118,
      status: 'planned',
      artifact: false,
      audio: false,
      has_provenance: false,
      source_drift: false,
      source_sha256: 'ffff0000',
      project: null,
    },
    {
      kind: 'reading' as const,
      id: 'a2/aemter-formulare',
      level: 'A2',
      topic: 'aemter',
      title: 'Beim Bürgeramt',
      reading_kind: 'extensive',
      word_count: 143,
      status: 'drafted',
      artifact: false,
      audio: false,
      has_provenance: false,
      source_drift: true,
      source_sha256: 'eeee1111',
      project: { kind: 'scene', id: 4, stage: 'automatically_checked', revision: 2 },
    },
    {
      kind: 'listening' as const,
      id: 'ls-wohnen-01',
      level: 'A1',
      unit: 'A1.4',
      status: 'published',
      artifact: true,
      audio: true,
      has_provenance: true,
      project: null,
    },
  ],
  recordings_without_exercises: [],
  exercises_without_recordings: [],
  summary: { listening: 1, readings: 2, by_status: {}, audio_comprehension_items: 0 },
};

const szenenFixture = [
  {
    project_id: 4,
    slug: 'a2-aemter-formulare',
    kind: 'narration',
    stage: 'automatically_checked',
    revision: 2,
    scene_sha256: 'abcd1234',
    has_exercise: false,
    qa_passed: true,
    updated: '2026-08-19T10:00:00+00:00',
    title: { en: 'At the registration office', ru: 'В ведомстве', uk: null },
    level: 'A2',
  },
];

function api(overrides: Partial<Api> = {}): Api {
  return stubApi({
    registry: async () => registryFixture as never,
    scenes: async () => szenenFixture as never,
    narrationProfiles: async () => narrationProfilesFixture as never,
    ...overrides,
  });
}

beforeEach(() => {
  window.location.hash = '#/lesetexte';
});

describe('the join', () => {
  test('a scene is found by the flattened reading id, level included', () => {
    // Not `Path(id).name`: the published file is named after the last segment and the scene slug
    // is the whole id, which is what keeps `a1/akkusativ` and `a2/akkusativ` two scenes.
    expect(lesetextSlug('a2/aemter-formulare')).toBe('a2-aemter-formulare');
    expect(lesetextSlug('a1/akkusativ')).not.toBe(lesetextSlug('a2/akkusativ'));
  });

  test('listening rows are not Lesetexte, and the studio stage refines the course status', () => {
    const zeilen = lesetextZeilen(registryFixture.rows as never, szenenFixture as never);
    expect(zeilen.map((zeile) => zeile.id)).toEqual(['a1/erste-schritte', 'a2/aemter-formulare']);
    // The registry could only say `drafted`; the scene knows the machine has already measured it.
    expect(zeilen[1]?.status).toBe('awaiting_approval');
    expect(zeilen[1]?.stufe).toBe('automatisch geprüft');
    // And a text with no scene keeps the registry's word and has no stage at all.
    expect(zeilen[0]?.status).toBe('planned');
    expect(zeilen[0]?.stufe).toBeNull();
  });

  test('a row with no scene points at nothing to open', () => {
    const [ohne, mit] = lesetextZeilen(registryFixture.rows as never, szenenFixture as never);
    expect(ziel(ohne!)).toEqual({ art: 'anlegen' });
    expect(ziel(mit!)).toEqual({ art: 'freigabe', slug: 'a2-aemter-formulare' });
  });
});

describe('the queue', () => {
  test('shows both axes and the one next step per row', async () => {
    mount(<Lesetexte />, api());

    await screen.findByText('Im Deutschkurs');
    expect(screen.getByText('Beim Bürgeramt')).toBeTruthy();
    // No listening row leaked in.
    expect(screen.queryByText('ls-wohnen-01')).toBeNull();

    // One next step each: create for the unconverted, the review for the one waiting.
    expect(screen.getByRole('button', { name: 'Szene anlegen' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Freigabe öffnen' }).getAttribute('href')).toBe(
      '#/pruefung/a2-aemter-formulare',
    );
    // A drifted source is a fact about the row, not a tooltip.
    expect(screen.getByText('Quelle abgewichen')).toBeTruthy();
  });

  test('the profile picker offers only what this Lesetext’s kind may use', async () => {
    mount(<Lesetexte />, api());

    const picker = await screen.findByRole('combobox', {
      name: 'Narrationsprofil für a1/erste-schritte',
    });
    const werte = [...picker.querySelectorAll('option')].map((option) => option.textContent);
    // `formal-informational` is `extensive` only, and this Lesetext is `intensive`. Offering it
    // would mean learning the rule from a 409 after choosing.
    expect(werte).toEqual(['Vorschlag der Engine', 'Warm erzählend']);
  });

  test('creating with no profile chosen sends none, so the engine’s own default applies', async () => {
    const sceneFromReading = vi.fn(async () => szenenFixture[0] as never);
    mount(<Lesetexte />, api({ sceneFromReading: sceneFromReading as never }));

    fireEvent.click(await screen.findByRole('button', { name: 'Szene anlegen' }));

    await waitFor(() => expect(sceneFromReading).toHaveBeenCalledTimes(1));
    expect(sceneFromReading.mock.calls[0]).toEqual(['a1/erste-schritte', undefined]);
  });

  test('an explicitly chosen profile is sent as itself', async () => {
    const sceneFromReading = vi.fn(async () => szenenFixture[0] as never);
    mount(<Lesetexte />, api({ sceneFromReading: sceneFromReading as never }));

    fireEvent.change(
      await screen.findByRole('combobox', { name: 'Narrationsprofil für a1/erste-schritte' }),
      { target: { value: 'warm-narrative' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Szene anlegen' }));

    await waitFor(() => expect(sceneFromReading).toHaveBeenCalledTimes(1));
    expect(sceneFromReading.mock.calls[0]).toEqual(['a1/erste-schritte', 'warm-narrative']);
  });

  test('a refused creation says so on the row it was refused for', async () => {
    const { EngineError } = await import('../api');
    mount(
      <Lesetexte />,
      api({
        sceneFromReading: () =>
          Promise.reject(new EngineError(409, 'scene project a1-erste-schritte already exists')),
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Szene anlegen' }));

    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('already exists');
  });

  test('j and k walk the queue and the position lands in the address', async () => {
    mount(<Lesetexte />, api());

    const bereich = await screen.findByRole('grid', { name: 'Lesetexte des Kurses' });
    await waitFor(() =>
      expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-a1/erste-schritte'),
    );

    fireEvent.keyDown(bereich, { key: 'j' });
    await waitFor(() => expect(window.location.hash).toContain('zeile=a2%2Faemter-formulare'));
    // The end of the queue holds rather than starting it again.
    fireEvent.keyDown(bereich, { key: 'j' });
    await waitFor(() =>
      expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-a2/aemter-formulare'),
    );
  });

  test('Enter opens a review, and on an unconverted row it points at the button instead', async () => {
    const sceneFromReading = vi.fn(async () => szenenFixture[0] as never);
    mount(<Lesetexte />, api({ sceneFromReading: sceneFromReading as never }));

    const bereich = await screen.findByRole('grid', { name: 'Lesetexte des Kurses' });
    // The first row has no scene. Enter must not create one: nothing can delete a scene project,
    // so a repeat in an 85-row queue would be 85 irreversible mistakes.
    fireEvent.keyDown(bereich, { key: 'Enter' });
    expect(sceneFromReading).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Szene anlegen' }));
    expect(window.location.hash).toContain('#/lesetexte');

    fireEvent.keyDown(bereich, { key: 'j' });
    // Awaited: the selection is a value the hash owns, so the next key press must see the render
    // that read it back. Firing both in one tick asserts nothing about the second.
    await waitFor(() =>
      expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-a2/aemter-formulare'),
    );
    fireEvent.keyDown(bereich, { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe('#/pruefung/a2-aemter-formulare'));
  });

  test('a filter that removes the selected row does not break the keys', async () => {
    window.location.hash = '#/lesetexte?zeile=a2%2Faemter-formulare';
    mount(<Lesetexte />, api());

    fireEvent.change(await screen.findByRole('combobox', { name: /Ebene/ }), {
      target: { value: 'A1' },
    });

    const bereich = await screen.findByRole('grid', { name: 'Lesetexte des Kurses' });
    await waitFor(() =>
      expect(bereich.getAttribute('aria-activedescendant')).toBe('zeile-a1/erste-schritte'),
    );
  });
});
