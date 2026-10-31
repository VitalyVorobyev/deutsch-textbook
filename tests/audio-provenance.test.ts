import { describe, expect, test } from 'bun:test';
import { audioProvenanceProblems } from '@da/schema/audio-provenance';

/** The validator's rule for a listening recording's provenance manifest, versions 1 and 2. */

const HEX = (char: string) => char.repeat(64);

const MODELS = {
  qwen_tts_designed: {
    license: 'Apache-2.0',
    revision: 'fd4b254389122332181a7c3db7f27e918eec64e3',
    training_data_provenance: 'vendor-documented; not independently verified',
  },
};

const APPROVAL = {
  status: 'complete',
  editor: 'Vitaly Vorobyev',
  checklist: ['accent', 'naturalness', 'intelligibility', 'identity', 'speakers', 'pace'],
};

const common = {
  id: 'ls-fixture-01',
  master_audio_sha256: HEX('a'),
  dry_audio_sha256: HEX('b'),
  dependency_lock_sha256: HEX('c'),
  model_lock_sha256: HEX('d'),
  models: MODELS,
};

const v1 = (overrides: Record<string, unknown> = {}) => ({
  ...common,
  version: 1,
  approval: APPROVAL,
  claims: {
    model_license_is_training_data_provenance: false,
    voice_cloning_used: false,
    reference_audio_used: false,
  },
  ...overrides,
});

const DESIGNED = {
  role: 'Mara',
  character: 'lena',
  version: 2,
  reference_sha256: HEX('e'),
  instruct: 'Eine erfundene junge Frau, warm und aufmerksam.',
  seed: 100,
  design_model: { id: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', revision: 'r1' },
  clone_model: { id: 'Qwen/Qwen3-TTS-12Hz-1.7B-Base', revision: 'r2' },
  synthetic: true,
};

const CONSENTED = {
  role: 'Jonas',
  id: 'testperson',
  engine: 'qwen_tts_base',
  model_revision: 'r3',
  reference_sha256: HEX('f'),
  consent_sha256: HEX('1'),
  synthetic: false,
};

const v2 = (overrides: Record<string, unknown> = {}) => ({
  ...common,
  version: 2,
  scene_sha256: HEX('9'),
  cleared_by: 'automatic-qa',
  qa: { passed: true },
  voices: [DESIGNED],
  claims: {
    model_license_is_training_data_provenance: false,
    voice_cloning_used: false,
    reference_audio_used: true,
    consent_sha256: [],
  },
  ...overrides,
});

const problems = (manifest: unknown) => audioProvenanceProblems(manifest, 'ls-fixture-01');

describe('audio provenance', () => {
  test('a version-1 manifest keeps its rules: a person approved it and nothing was cloned', () => {
    expect(problems(v1())).toEqual([]);
    expect(problems(v1({ approval: { status: 'declined' } }))).toEqual([
      'committed listening audio requires completed human approval',
    ]);
    expect(problems(v1({ approval: { ...APPROVAL, checklist: ['accent'] } }))).toHaveLength(1);
    expect(problems(v1({ claims: { ...v1().claims, reference_audio_used: true } }))).toHaveLength(
      1,
    );
  });

  test('a version-2 manifest cleared by automatic QA needs a passing report and no approval', () => {
    expect(problems(v2())).toEqual([]);
    expect(problems(v2({ qa: { passed: false } }))).toEqual([
      'a manifest cleared by automatic QA carries a QA report that passed',
    ]);
    expect(problems(v2({ approval: APPROVAL }))).toEqual([
      'a manifest cleared by automatic QA carries no approval',
    ]);
    expect(problems(v2({ cleared_by: undefined }))).toEqual([
      'a version-2 manifest says what cleared it: automatic-qa or human-approval',
    ]);
  });

  test('a version-2 manifest cleared by a person carries the approval', () => {
    expect(problems(v2({ cleared_by: 'human-approval', approval: APPROVAL }))).toEqual([]);
    expect(problems(v2({ cleared_by: 'human-approval' }))).toEqual([
      'committed listening audio requires completed human approval',
    ]);
  });

  test('a version-2 manifest names its scene by a 64-hex digest', () => {
    expect(problems(v2({ scene_sha256: 'abc' }))).toEqual([
      'a version-2 manifest names the 64-hex scene_sha256 it was rendered from',
    ]);
    expect(problems(v2({ version: 3 }))).toEqual(['unknown provenance version 3']);
  });

  test('a designed voice is synthetic, names its reference digest and its description', () => {
    expect(problems(v2({ voices: [{ ...DESIGNED, instruct: ' ' }] }))).toEqual([
      'voice 1 (Mara) is a designed voice with no description (instruct)',
    ]);
    expect(problems(v2({ voices: [{ ...DESIGNED, reference_sha256: 'e' }] }))).toEqual([
      'voice 1 (Mara) needs a 64-hex reference_sha256',
    ]);
    expect(problems(v2({ voices: [{ ...DESIGNED, synthetic: undefined }] }))).toEqual([
      'voice 1 (Mara) must say whether it is synthetic',
    ]);
    expect(problems(v2({ voices: [{ ...DESIGNED, clone_model: { id: 'x' } }] }))).toEqual([
      'voice 1 (Mara) must pin its design and clone models by id and revision',
    ]);
  });

  test('a consented clone is claimed, with exactly the consents its voices name', () => {
    const cloned = {
      model_license_is_training_data_provenance: false,
      voice_cloning_used: true,
      reference_audio_used: true,
      consent_sha256: [HEX('1')],
    };
    expect(problems(v2({ voices: [DESIGNED, CONSENTED], claims: cloned }))).toEqual([]);
    expect(
      problems(v2({ voices: [DESIGNED, CONSENTED], claims: { ...cloned, consent_sha256: [] } })),
    ).toEqual([
      'a manifest that used voice cloning names the consent it was published under',
      'claims.consent_sha256 must be exactly the consents its cloned voices name',
    ]);
    expect(problems(v2({ voices: [DESIGNED, CONSENTED] }))).toEqual([
      'voice_cloning_used must say whether a consented clone is among the voices',
      'claims.consent_sha256 must be exactly the consents its cloned voices name',
    ]);
    expect(
      problems(v2({ voices: [{ ...CONSENTED, consent_sha256: undefined }], claims: cloned })),
    ).toContain('voice 1 (Jonas) is a consented clone with no 64-hex consent_sha256');
  });

  test('a preset-only scene claims no reference audio', () => {
    const preset = {
      model_license_is_training_data_provenance: false,
      voice_cloning_used: false,
      reference_audio_used: false,
      consent_sha256: [],
    };
    expect(problems(v2({ voices: [], claims: preset }))).toEqual([]);
    expect(problems(v2({ voices: [] }))).toEqual([
      'reference_audio_used must say whether any voice was cloned from a reference',
    ]);
  });
});
