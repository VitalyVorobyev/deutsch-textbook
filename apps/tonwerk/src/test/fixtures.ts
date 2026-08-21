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
    qa_passed: true,
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
    qa_passed: null,
    updated: '2026-08-19T11:05:00+00:00',
    title: { en: 'In the German course', ru: 'На курсе немецкого', uk: null },
    level: 'A1',
  },
];

/**
 * Three scenes at `automatically_checked`, which is the only stage Prüfung queues.
 *
 * Stated as its own fixture rather than derived from `scenesFixture`: the queue's two rules are
 * *oldest first* and *a failed check is drawn as itself*, and both need rows that differ in
 * exactly one field. `qa_passed` is `false` on one of them for that reason, and `null` on none of
 * them — nothing reaches this stage unmeasured.
 */
export const warteschlangeFixture = [
  {
    project_id: 11,
    slug: 'ls-spaet-01',
    kind: 'dialogue',
    stage: 'automatically_checked',
    revision: 2,
    scene_sha256: 'cccc111122223333',
    has_exercise: true,
    qa_passed: true,
    updated: '2026-08-20T15:00:00+00:00',
    title: { en: 'The late one', ru: 'Поздняя', uk: null },
    level: 'A2',
  },
  {
    project_id: 12,
    slug: 'ls-frueh-02',
    kind: 'dialogue',
    stage: 'automatically_checked',
    revision: 5,
    scene_sha256: 'dddd444455556666',
    has_exercise: false,
    qa_passed: true,
    updated: '2026-08-12T08:30:00+00:00',
    title: { en: 'The early one', ru: 'Ранняя', uk: null },
    level: 'A1',
  },
  {
    project_id: 13,
    slug: 'ls-durchgefallen-03',
    kind: 'narration',
    stage: 'automatically_checked',
    revision: 1,
    scene_sha256: 'eeee777788889999',
    has_exercise: false,
    qa_passed: false,
    updated: '2026-08-18T12:00:00+00:00',
    title: { en: 'The failed one', ru: 'Провалившаяся', uk: null },
    level: 'B1',
  },
];

/** The narration profiles, with `allowed_kinds` differing so the picker's filter is testable. */
export const narrationProfilesFixture = {
  version: 1,
  profiles: [
    {
      id: 'warm-narrative',
      version: 1,
      character_id: 'lena',
      label: 'Warm erzählend',
      description: 'Nah und freundlich, für Erzähltexte.',
      allowed_kinds: ['intensive', 'extensive'],
    },
    {
      id: 'formal-informational',
      version: 1,
      character_id: 'klara',
      label: 'Sachlich informierend',
      description: 'Für Bescheide, Regeln und Aushänge.',
      allowed_kinds: ['extensive'],
    },
  ],
};

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

/**
 * One scene document and the envelope around it.
 *
 * Stated in full — including the fields a Zod default would otherwise supply — because the editor
 * reads the *stub's* objects, not a parsed copy: a fixture that omitted `renders[].timeline` would
 * not fall back to an empty array, it would throw, and a fixture that omitted `pace` would make a
 * round-trip assertion pass for the wrong reason.
 */
export const sceneDocumentFixture = {
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
    {
      role: 'Maklerin',
      character: { id: 'lena', version: 1 },
      // `voice_ref` is stated rather than left to the schema's default: the cast panel branches on
      // it, and a fixture that omitted it would be testing what `undefined` does instead of what a
      // preset-voice cast member does.
      voice: { engine: 'qwen_tts', voice: 'Vivian', seed: 100, style: 'Sprich freundlich.', voice_ref: null },
    },
    {
      role: 'Mieter',
      character: null,
      voice: { engine: 'qwen_tts', voice: 'Eric', seed: 120, style: null, voice_ref: null },
    },
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
    {
      id: 'line-2',
      role: 'Mieter',
      display_text: 'Und wo ist die Küche?',
      synthesis_text: null,
      pace: 1,
      pause_after_ms: 600,
      pronunciation_overrides: [],
      seed_override: null,
    },
  ],
  timeline: [
    { type: 'speech' as const, utterance_id: 'line-1', at_ms: null, placement: null },
    { type: 'speech' as const, utterance_id: 'line-2', at_ms: null, placement: null },
    {
      type: 'ambience' as const,
      sound: {
        prompt: 'ruhige Wohnung, leiser Verkehr draußen',
        seed: 4,
        params: {},
        duration_seconds: null,
        negative_prompt: null,
      },
      start_ms: 0,
      end_ms: null,
      fade_in_ms: 350,
      fade_out_ms: 450,
      gain_db: -26,
    },
  ],
};

export const sceneDetailFixture = {
  project_id: 3,
  slug: 'ls-wohnen-01',
  kind: 'dialogue',
  stage: 'human_approved',
  revision: 4,
  scene_sha256: 'abc1234def5678',
  scene: sceneDocumentFixture,
  exercise: { questions: [{ id: 'frage-1' }] },
  renders: [
    {
      variant: 'natural',
      preset: 'natural',
      rendered: true,
      duration_ms: 31240,
      created_at: '2026-08-14T09:10:00+00:00',
      master_sha256: 'deadbeef1234',
      has_master: true,
      timing: [
        { utterance_id: 'line-1', start_ms: 0, end_ms: 3120 },
        { utterance_id: 'line-2', start_ms: 3570, end_ms: 5400 },
      ],
      timeline: [
        { entry_id: 'line-1', type: 'speech', start_ms: 0, end_ms: 3120 },
        { entry_id: 'line-2', type: 'speech', start_ms: 3570, end_ms: 5400 },
        { entry_id: 'ambience-1', type: 'ambience', start_ms: 0, end_ms: 5400 },
      ],
      artifacts: [
        { path: 'master.wav', sha256: 'deadbeef1234', kind: 'master' },
        { path: 'stems/line-1.wav', sha256: 'c0ffee5678', kind: 'stem' },
      ],
    },
  ],
  history: [
    { number: 4, scene_sha256: 'abc1234def5678', created_at: '2026-08-14T09:00:00+00:00', has_qa: true, has_approval: true, has_exercise: true },
  ],
  qa: {
    passed: true,
    scene_sha256: 'abc1234def5678',
    variant: 'natural',
    transcripts: {
      full_wer: 0.021,
      full_transcript: 'Hier ist die Wohnung.',
      lines: [
        {
          line_id: 'line-1',
          expected: 'Hier ist die Wohnung. Sie hat drei Zimmer.',
          transcript: 'Hier ist die Wohnung. Sie hat drei Zimmer.',
          wer: 0,
          passed: true,
          missing_protected: [],
        },
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
    checklist: ['accent', 'naturalness'],
    audio_sha256: 'deadbeef1234',
    dry_audio_sha256: null,
    scene_sha256: 'abc1234def5678',
    variant: 'natural',
  },
  document: { valid: true, scene: sceneDocumentFixture },
};

export const acousticsFixture = {
  profiles_version: 1,
  difficulty_version: 1,
  rooms: [
    { id: 'studio', label: 'Aufnahmestudio', note: 'Fast trocken.', version: 1, wet: 0.04 },
    { id: 'cafe', label: 'Café', note: 'Hart und voll.', version: 2, wet: 0.18 },
  ],
  devices: [
    { id: 'telephone', label: 'Telefon', note: '300–3400 Hz.', version: 1 },
    { id: 'pa', label: 'Lautsprecherdurchsage', note: 'Ein Horn an der Wand.', version: 1 },
  ],
  presets: [
    {
      id: 'natural',
      label: 'Natürlich',
      note: 'Die Identität.',
      version: 1,
      deltas: { ambience_gain_db: 0, wet: 0, distance: 1, pace: 1, overlap_ms: 0 },
    },
    {
      id: 'challenging',
      label: 'Anspruchsvoll',
      note: 'Alles, was echtes Hören schwer macht.',
      version: 1,
      deltas: { ambience_gain_db: 6, wet: 0.15, distance: 1.25, pace: 1.05, overlap_ms: 220 },
    },
  ],
  override_keys: ['ambience_gain_db', 'wet', 'distance', 'pace', 'overlap_ms'],
};

export const soundsFixture = [
  {
    origin: 'freesound',
    original_sha256: 'a'.repeat(64),
    sound_id: 4711,
    page_url: 'https://freesound.org/s/4711',
    title: 'Cafe room tone',
    uploader: 'mikrofonist',
    license: 'CC0-1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    description: 'Ruhiges Café am Vormittag.',
    duration_seconds: 42.5,
    usage_count: 2,
    peaks: [0.2, 0.5, 0.9, 0.4],
    editorial: {
      category: 'room-tone',
      scene_tags: ['cafe'],
      allowed_roles: ['bed'],
      default_gain_db: -24,
      loop_quality: 'good',
      review_status: 'reviewed',
      notes: '',
    },
  },
  {
    origin: 'generated',
    asset_sha256: 'b'.repeat(64),
    engine: 'stable_audio_sfx',
    model_id: 'stabilityai/stable-audio-3-optimized',
    model_revision: '2204d50',
    adapter_code_revision: 'Stability-AI/stable-audio-3@a0b57f5',
    license: 'Stability AI Community License',
    prompt: 'a cup set down on a saucer',
    negative_prompt: null,
    seed: 7,
    duration_seconds: 1.2,
    params: {},
    peaks: [0.9, 0.3, 0.1],
  },
];

/** A stub `Api`: no network, and every method fails loudly if a view calls one it should not. */
/**
 * The consent rule vocabulary as the engine serves it, and one stored voice.
 *
 * The rules are the engine's own nine, verbatim including `applies` and `minors_only` — the wizard
 * filters on exactly those two fields, so a fixture that simplified them would be testing a
 * simplification. `requirement` carries the English the form falls back to for an id this build has
 * no German for, which is what one of the specs is about.
 */
export const voicesFixture = {
  voices: [
    {
      id: 'mara-h',
      subject_display_name: 'Mara H.',
      scope: 'publication',
      engine: 'qwen_tts_base',
      model_revision: '5d83992436eae1d760afd27aff78a71d676296fc',
      reference_sha256: 'a'.repeat(64),
      consent_sha256: 'b'.repeat(64),
      guardian_consent: false,
      child_assent: false,
      retention: 'Referenzaufnahme bleibt bis zum Widerruf und wird dann gelöscht.',
      x_vector_only: false,
      created_at: '2026-08-20T09:00:00+00:00',
      revoked_at: null,
      reference_present: true,
      demo_urls: ['/api/voices/mara-h/demo/0'],
    },
    {
      id: 'jo-r',
      subject_display_name: 'Jo R.',
      scope: 'evaluation',
      engine: 'qwen_tts_base',
      model_revision: '5d83992436eae1d760afd27aff78a71d676296fc',
      reference_sha256: 'c'.repeat(64),
      consent_sha256: 'd'.repeat(64),
      guardian_consent: true,
      child_assent: true,
      retention: 'Wird nach der Bewertung automatisch gelöscht.',
      x_vector_only: true,
      created_at: '2026-08-18T09:00:00+00:00',
      revoked_at: '2026-08-21T11:00:00+00:00',
      reference_present: false,
      demo_urls: [],
    },
  ],
  rules: [
    { id: 'subject-named', applies: 'always', minors_only: false, requirement: 'The consent names the person whose voice was recorded.' },
    { id: 'purpose-stated', applies: 'always', minors_only: false, requirement: 'The authorised purpose is written out, not implied.' },
    { id: 'retention-stated', applies: 'always', minors_only: false, requirement: 'The consent states how long the reference recording is kept.' },
    { id: 'reference-sha-binding', applies: 'always', minors_only: false, requirement: 'The consent names the SHA-256 of exactly this recording.' },
    { id: 'minor-guardian', applies: 'always', minors_only: true, requirement: "A minor's guardian has given consent and attested it." },
    { id: 'minor-assent', applies: 'always', minors_only: true, requirement: "A minor's own assent is confirmed and attested by the guardian." },
    { id: 'evaluation-bars-publication', applies: 'evaluation', minors_only: false, requirement: 'Evaluation scope: the consent explicitly prohibits upload, publication and git.' },
    { id: 'publication-permits-course', applies: 'publication', minors_only: false, requirement: 'Publication scope: a permitted use explicitly allows publishing in this course.' },
    { id: 'publication-bars-redistribution', applies: 'publication', minors_only: false, requirement: 'Publication scope: redistribution outside the course is still prohibited.' },
  ],
  engines: ['qwen_tts_base'],
  demo_phrases: [
    'Heute treffen wir uns um halb sechs am Bahnhof.',
    'Hast du alles verstanden?',
    'Haben Sie alles verstanden?',
  ],
};

export function stubApi(overrides: Partial<Api> = {}): Api {
  const refuse = (name: string) => () => Promise.reject(new Error(`stubApi: ${name} was not stubbed`));
  return {
    registry: refuse('registry'),
    scenes: refuse('scenes'),
    scene: refuse('scene'),
    characters: refuse('characters'),
    // The editor reads three catalogs on mount and survives any of them failing, so these are
    // stubbed with data rather than refusals: a spec about the script must not fail on a picker.
    acoustics: () => Promise.resolve(acousticsFixture as never),
    sounds: () => Promise.resolve(soundsFixture as never),
    reviseScene: refuse('reviseScene'),
    renderScene: refuse('renderScene'),
    runQa: refuse('runQa'),
    generateSound: refuse('generateSound'),
    narrationProfiles: refuse('narrationProfiles'),
    approveScene: refuse('approveScene'),
    declineScene: refuse('declineScene'),
    sceneFromReading: refuse('sceneFromReading'),
    deleteScene: refuse('deleteScene'),
    objectUrl: () => Promise.resolve('blob:tonwerk/stub'),
    // Read on mount by both Figuren and the scene editor's cast panel, so it is stubbed with data
    // rather than a refusal — for the same reason the three catalogs above are.
    voices: () => Promise.resolve(voicesFixture as never),
    createVoice: refuse('createVoice'),
    renderVoiceDemo: refuse('renderVoiceDemo'),
    revokeVoice: refuse('revokeVoice'),
    ...overrides,
  } as Api;
}
