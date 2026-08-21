import { describe, expect, test } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiContext } from '../useEngine';
import { charactersFixture, registryFixture, scenesFixture, stubApi } from '../test/fixtures';
import { Figuren } from './Figuren';
import { Szene } from './Szene';
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

const sceneDocument = {
  slug: 'ls-wohnen-01',
  kind: 'dialogue' as const,
  schema_version: 1 as const,
  authoring: 'manual' as const,
  generation_prompt: null,
  brief: {
    scenario: 'Kurze Wohnungsbesichtigung',
    level: 'A1' as const,
    topic: 'wohnen',
    grammar_target: null,
    outcomes: ['wohnen-beschreiben'],
    vocabulary: [],
    duration_seconds: null,
  },
  acoustics: { lead_in_ms: 0, room: 'cafe' },
  variants: [{ id: 'natural', preset: 'natural', overrides: {} }],
  title: { en: 'A short flat viewing', ru: 'Короткий осмотр квартиры', uk: null },
  cast: [
    { role: 'Maklerin', character: { id: 'lena', version: 1 }, voice: { engine: 'qwen_tts', voice: 'Vivian', seed: 100, style: 'Sprich freundlich.' } },
  ],
  script: [
    {
      id: 'line-1',
      role: 'Maklerin',
      display_text: 'Hier ist die Wohnung. Sie hat drei Zimmer.',
      synthesis_text: null,
      pace: 0.9,
      pause_after_ms: 450,
      pronunciation_overrides: [],
      seed_override: null,
    },
  ],
  timeline: [
    { type: 'speech' as const, utterance_id: 'line-1', at_ms: null, placement: null },
    {
      type: 'ambience' as const,
      sound: { prompt: 'ruhige Wohnung, leiser Verkehr draußen', seed: 4, params: {}, duration_seconds: null, negative_prompt: null },
      start_ms: 0,
      end_ms: null,
      fade_in_ms: 350,
      fade_out_ms: 450,
      gain_db: -26,
    },
  ],
};

const sceneDetail = {
  project_id: 3,
  slug: 'ls-wohnen-01',
  kind: 'dialogue',
  stage: 'human_approved',
  revision: 4,
  scene_sha256: 'abc1234def5678',
  scene: sceneDocument,
  exercise: null,
  renders: [
    {
      variant: 'natural',
      preset: 'natural',
      rendered: true,
      duration_ms: 31240,
      created_at: '2026-08-14T09:10:00+00:00',
      master_sha256: 'deadbeef1234',
      has_master: true,
    },
  ],
  history: [],
  qa: {
    passed: true,
    scene_sha256: 'abc1234def5678',
    variant: 'natural',
    transcripts: {
      full_wer: 0.021,
      full_transcript: 'Hier ist die Wohnung.',
      lines: [
        { line_id: 'line-1', expected: 'Hier ist die Wohnung. Sie hat drei Zimmer.', transcript: 'Hier ist die Wohnung. Sie hat drei Zimmer.', wer: 0, passed: true, missing_protected: [] },
      ],
      failures: [],
      warnings: [],
      passed: true,
    },
    speaker_qa: 'weights-missing',
    soundscape: {
      bed_count: 1,
      event_count: 0,
      continuous_ambience: true,
      configured_coverage_ratio: 1,
      configured_gain_min_db: -26,
      configured_gain_max_db: -26,
      measured_ambience_rms_dbfs: -31.4,
      warnings: [],
    },
    timing: [{ utterance_id: 'line-1', start_ms: 0, end_ms: 3120 }],
  },
  approval: {
    status: 'complete',
    editor: 'Vitaly',
    reviewed_at: '2026-08-14T09:12:00+00:00',
    checklist: ['transcript', 'soundscape'],
    audio_sha256: 'deadbeef1234',
    dry_audio_sha256: null,
    scene_sha256: 'abc1234def5678',
    variant: 'natural',
  },
  document: { valid: true, scene: sceneDocument },
};

describe('Szene', () => {
  test('shows the script in the script face with measured timing when a render exists', async () => {
    mount(<Szene slug="ls-wohnen-01" />, stubApi({ scene: async () => sceneDetail as never }));

    // Twice on purpose: once as the script, once as `Erwartet` in the QA table beside what the
    // transcriber heard. The script copy is the one in the `skript` face.
    const treffer = await screen.findAllByText('Hier ist die Wohnung. Sie hat drei Zimmer.');
    expect(treffer.some((node) => node.className.includes('skript'))).toBe(true);
    // Timing is the render manifest's own measurement; before a render there is nothing to show and
    // the view must not fall back to the authored pace as if it were a time.
    // `0:00.000` is also where the ambience bed starts, so count rather than demand uniqueness; the
    // length is what only the render can have told us.
    expect(screen.getAllByText('0:00.000').length).toBeGreaterThan(0);
    expect(screen.getByText('3,1 s')).toBeTruthy();
  });

  test('shows cast, timeline, QA and approval as separate readings', async () => {
    mount(<Szene slug="ls-wohnen-01" />, stubApi({ scene: async () => sceneDetail as never }));

    await screen.findByText('Besetzung');
    expect(screen.getByText('Zeitleiste')).toBeTruthy();
    expect(screen.getByText('ruhige Wohnung, leiser Verkehr draußen')).toBeTruthy();
    expect(screen.getByText('−26,0 dB'.replace('−', '-'))).toBeTruthy();
    expect(screen.getByText('bestanden')).toBeTruthy();
    // A speaker check that could not run must never look like one that passed.
    expect(screen.getByText('weights-missing')).toBeTruthy();
    expect(screen.getByText('Vitaly')).toBeTruthy();
    expect(screen.getByText('gilt für diese Bytes')).toBeTruthy();
  });

  test('an approval naming other bytes is called out rather than shown as a green tick', async () => {
    const abgewichen = {
      ...sceneDetail,
      approval: { ...sceneDetail.approval, scene_sha256: 'ein-anderer-sha' },
    };
    mount(<Szene slug="ls-wohnen-01" />, stubApi({ scene: async () => abgewichen as never }));

    expect(await screen.findByText('gilt für andere Bytes')).toBeTruthy();
  });

  test('a document that has drifted from the contract still renders, with a notice', async () => {
    const drift = {
      ...sceneDetail,
      document: { valid: false, scene: sceneDocument, problem: 'scene: unrecognized key: "tempo_hinweis"' },
    };
    mount(<Szene slug="ls-wohnen-01" />, stubApi({ scene: async () => drift as never }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Scene v1');
    expect(screen.getAllByText('Hier ist die Wohnung. Sie hat drei Zimmer.').length).toBeGreaterThan(0);
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
