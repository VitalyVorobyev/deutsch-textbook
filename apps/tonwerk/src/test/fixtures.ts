/**
 * The shapes the engine answers, small enough to read and complete enough to render.
 *
 * Every fixture states **every field its assertions depend on**, including the ones a default would
 * otherwise supply. A fixture that leans on a default turns a later change to that default into a
 * red test that has nothing to do with the change — and, worse, a fixture that omits a field the
 * component reads passes for the wrong reason.
 */
import type { Api } from '../api';

export const registryFixture = {
  rows: [
    {
      kind: 'listening' as const,
      id: 'ls-wohnen-01',
      level: 'A1',
      unit: 'A1.4',
      wave: 1,
      scenario: 'Kurze Wohnungsbesichtigung',
      status: 'published',
      artifact: true,
      audio: true,
      has_provenance: true,
      superseded_by_scene: false,
      exercise_items: 2,
      project: {
        kind: 'scene',
        id: 3,
        stage: 'exported',
        revision: 4,
        revision_sha256: 'aaaaaaaabbbbbbbbccccccccdddddddd',
        qa_passed: true,
        has_exercise: true,
        updated: '2026-08-14T09:12:00+00:00',
      },
    },
    {
      kind: 'listening' as const,
      id: 'ls-arbeit-02',
      level: 'A2',
      unit: 'A2.1',
      wave: 2,
      scenario: 'Krankmeldung im Betrieb',
      status: 'stale',
      artifact: true,
      audio: true,
      has_provenance: true,
      superseded_by_scene: true,
      exercise_items: 0,
      project: {
        kind: 'scene',
        id: 7,
        stage: 'draft',
        revision: 9,
        revision_sha256: '1111111122222222333333334444444',
        qa_passed: null,
        has_exercise: false,
        updated: '2026-08-18T17:40:00+00:00',
      },
    },
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
      source_sha256: 'ffffffff00000000',
      project: null,
    },
  ],
  recordings_without_exercises: ['ls-arbeit-02'],
  exercises_without_recordings: [
    { set: 'wohnen-uebung', level: 'A1', item: 'hoeren-1', recording: null, reason: 'no-recording' },
    { set: 'arbeit-drill', level: 'A2', item: 'hoeren-3', recording: 'ls-nicht-geplant', reason: 'unknown-recording' },
  ],
  summary: {
    listening: 2,
    readings: 1,
    by_status: { planned: 1, published: 1, stale: 1 },
    audio_comprehension_items: 4,
  },
};

export const scenesFixture = [
  {
    project_id: 3,
    slug: 'ls-wohnen-01',
    kind: 'dialogue',
    stage: 'human_approved',
    revision: 4,
    scene_sha256: 'abc1234def5678',
    has_exercise: true,
    updated: '2026-08-14T09:12:00+00:00',
    title: { en: 'A short flat viewing', ru: 'Короткий осмотр квартиры', uk: null },
    level: 'A1',
  },
  {
    project_id: 7,
    slug: 'a1-erste-schritte',
    kind: 'narration',
    stage: 'draft',
    revision: 1,
    scene_sha256: '99887766554433',
    has_exercise: false,
    updated: '2026-08-19T11:05:00+00:00',
    title: { en: 'In the German course', ru: 'На курсе немецкого', uk: null },
    level: 'A1',
  },
];

export const charactersFixture = {
  version: 1,
  characters: [
    {
      id: 'lena',
      version: 1,
      display_name: 'Lena',
      age_band: 'young-adult',
      persona: 'Warm, aufmerksam und direkt; glaubwürdig in informellen Alltagsszenen.',
      registers: ['informal', 'neutral'],
      roles: ['friend', 'neighbour'],
      casting_tags: ['warm', 'everyday'],
      narration_capable: true,
      incompatible_with: ['klara'],
      status: 'draft-profile',
      demo_phrases: ['Heute treffen wir uns um halb sechs am Bahnhof.', 'Hast du alles verstanden?'],
      voice_profile: { voice: 'Vivian', seed: 100, style: 'Sprich warm.', pace: 0.96 },
      usage_count: 3,
      demo_urls: ['/api/characters/lena/demos/0', '/api/characters/lena/demos/1'],
      portrait_candidate_urls: [],
      selected_portrait_url: '/api/characters/lena/portrait',
    },
    {
      id: 'jonas',
      version: 1,
      display_name: 'Jonas',
      age_band: 'young-adult',
      persona: 'Entspannt und nachdenklich.',
      registers: ['informal'],
      roles: ['friend'],
      casting_tags: ['relaxed'],
      narration_capable: false,
      incompatible_with: [],
      status: 'draft-profile',
      demo_phrases: [],
      voice_profile: { voice: 'Uncle_Fu', seed: 120, style: 'Sprich entspannt.', pace: 1 },
      usage_count: 0,
      demo_urls: [],
      portrait_candidate_urls: [],
      selected_portrait_url: null,
    },
  ],
};

/** A stub `Api`: no network, and every method fails loudly if a view calls one it should not. */
export function stubApi(overrides: Partial<Api> = {}): Api {
  const refuse = (name: string) => () => Promise.reject(new Error(`stubApi: ${name} was not stubbed`));
  return {
    registry: refuse('registry'),
    scenes: refuse('scenes'),
    scene: refuse('scene'),
    characters: refuse('characters'),
    objectUrl: () => Promise.resolve('blob:tonwerk/stub'),
    ...overrides,
  } as Api;
}
