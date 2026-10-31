/**
 * What is wrong with a listening recording's provenance manifest, as sentences; empty when nothing
 * is. The shape checks only: `scripts/validate.ts` adds the ones that read files (the audio hash,
 * the generation brief, the Freesound originals).
 *
 * Two manifest versions are in the corpus. **Version 1** is the dialogue publisher's: a person
 * approved the take, and no voice was cloned and no reference audio used. **Version 2** is a
 * scene's (`apps/tonwerk/engine/src/listening_studio/scene/publish.py`): it names the
 * `scene_sha256` it was rendered from, says what cleared it — `automatic-qa` with a passing QA
 * report, or `human-approval` with the approval — and lists every voice that is not a preset
 * speaker. A designed voice is synthetic and names its reference digest and description; a
 * consented clone is a person and names the consent it was published under. The claims have to
 * agree with that list, because they are computed from it.
 */

const SHA256 = /^[0-9a-f]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPin = (value: unknown): boolean =>
  isRecord(value) && nonEmpty(value.id) && nonEmpty(value.revision);

function approvalProblems(approval: unknown): string[] {
  if (!isRecord(approval) || approval.status !== 'complete')
    return ['committed listening audio requires completed human approval'];
  const checklist = Array.isArray(approval.checklist) ? approval.checklist : [];
  if (!nonEmpty(approval.editor) || checklist.length < 6)
    return ['human approval identity and full listening checklist are required'];
  return [];
}

function voiceProblems(voice: unknown, index: number): string[] {
  const where = `voice ${index + 1}`;
  if (!isRecord(voice)) return [`${where} is not a record`];
  if (!nonEmpty(voice.role)) return [`${where} names no cast role`];
  const label = `${where} (${voice.role})`;
  if (typeof voice.reference_sha256 !== 'string' || !SHA256.test(voice.reference_sha256))
    return [`${label} needs a 64-hex reference_sha256`];
  if (voice.synthetic === true) {
    const problems: string[] = [];
    if (!nonEmpty(voice.character)) problems.push(`${label} is a designed voice with no character`);
    if (!nonEmpty(voice.instruct))
      problems.push(`${label} is a designed voice with no description (instruct)`);
    if (!isPin(voice.design_model) || !isPin(voice.clone_model))
      problems.push(`${label} must pin its design and clone models by id and revision`);
    return problems;
  }
  if (voice.synthetic === false) {
    if (typeof voice.consent_sha256 !== 'string' || !SHA256.test(voice.consent_sha256))
      return [`${label} is a consented clone with no 64-hex consent_sha256`];
    return [];
  }
  return [`${label} must say whether it is synthetic`];
}

export function audioProvenanceProblems(manifest: unknown, artifactId: string): string[] {
  if (!isRecord(manifest)) return ['provenance is not a JSON object'];
  const problems: string[] = [];
  if (manifest.id !== artifactId)
    problems.push('provenance id does not match the listening artifact');
  if (!nonEmpty(manifest.master_audio_sha256)) problems.push('approved master hash is required');
  if (!nonEmpty(manifest.dry_audio_sha256)) problems.push('dry speech hash is required');
  if (!nonEmpty(manifest.dependency_lock_sha256) || !nonEmpty(manifest.model_lock_sha256))
    problems.push('dependency and model lock hashes are required');
  const models = manifest.models;
  if (
    !isRecord(models) ||
    Object.values(models).some(
      (model) =>
        !isRecord(model) ||
        !nonEmpty(model.license) ||
        !nonEmpty(model.revision) ||
        !nonEmpty(model.training_data_provenance),
    )
  )
    problems.push('every model requires an immutable revision, licence, and training-data note');
  const claims = isRecord(manifest.claims) ? manifest.claims : {};
  if (claims.model_license_is_training_data_provenance !== false)
    problems.push('provenance must keep licence evidence apart from training-data provenance');

  if (manifest.version === 1) {
    problems.push(...approvalProblems(manifest.approval));
    if (claims.voice_cloning_used !== false || claims.reference_audio_used !== false)
      problems.push(
        'a version-1 manifest predates cloning and must claim neither cloning nor reference audio',
      );
    return problems;
  }
  if (manifest.version !== 2)
    return [...problems, `unknown provenance version ${String(manifest.version)}`];

  if (typeof manifest.scene_sha256 !== 'string' || !SHA256.test(manifest.scene_sha256))
    problems.push('a version-2 manifest names the 64-hex scene_sha256 it was rendered from');
  if (manifest.cleared_by === 'human-approval')
    problems.push(...approvalProblems(manifest.approval));
  else if (manifest.cleared_by === 'automatic-qa') {
    if (!isRecord(manifest.qa) || manifest.qa.passed !== true)
      problems.push('a manifest cleared by automatic QA carries a QA report that passed');
    if (manifest.approval !== undefined)
      problems.push('a manifest cleared by automatic QA carries no approval');
  } else problems.push('a version-2 manifest says what cleared it: automatic-qa or human-approval');

  const voices: unknown[] = Array.isArray(manifest.voices) ? manifest.voices : [];
  if (!Array.isArray(manifest.voices)) problems.push('a version-2 manifest lists its voices');
  voices.forEach((voice, index) => problems.push(...voiceProblems(voice, index)));
  const consented = voices.filter((voice) => isRecord(voice) && voice.synthetic === false);
  const consent = Array.isArray(claims.consent_sha256) ? claims.consent_sha256 : null;
  if (claims.voice_cloning_used !== consented.length > 0)
    problems.push('voice_cloning_used must say whether a consented clone is among the voices');
  if (claims.reference_audio_used !== voices.length > 0)
    problems.push('reference_audio_used must say whether any voice was cloned from a reference');
  if (consent === null) problems.push('claims.consent_sha256 is a list');
  else {
    const named = new Set(
      consented.map((voice) => (voice as Record<string, unknown>).consent_sha256),
    );
    if (claims.voice_cloning_used === true && consent.length === 0)
      problems.push('a manifest that used voice cloning names the consent it was published under');
    if (consent.length !== named.size || consent.some((digest) => !named.has(digest)))
      problems.push('claims.consent_sha256 must be exactly the consents its cloned voices name');
  }
  return problems;
}
