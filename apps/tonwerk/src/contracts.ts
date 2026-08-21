/**
 * What the engine answers, as Zod schemas.
 *
 * **Two levels of strictness, and the difference is which document is a contract.**
 *
 * `Scene` is a published, versioned document with a committed JSON Schema, so it is parsed with
 * `@da/schema/audio-scene` — strictly, closed objects, drift-tested. Everything else on this page
 * is an *API envelope*: a dict the engine assembles per endpoint, with no schema file and no
 * version. Holding those closed would mean Tonwerk goes blank the day someone adds a field to a
 * response, which is the wrong failure for a read-only overview. So envelopes are `looseObject`s
 * that declare what the app reads and ignore the rest.
 *
 * The one place that shows through to the reader is `status`: it is the engine's seven-word
 * vocabulary, but parsed as "one of those, or any other string". An unknown status renders as an
 * unlit lamp under its own raw name rather than blanking a table of 130 rows — visible, not fatal.
 */
import { z } from 'zod';
import { sceneSchema } from '@da/schema/audio-scene';

/**
 * The pipeline, in order, as `listening_studio.api.registry.Status` defines it — and the order is
 * the whole point: it is what the Pegel is a scale of.
 *
 * `stale` is deliberately last and deliberately apart. The first six are positions on the way from
 * commissioned to published; `stale` is a *regression out of* published — audio shipped, and the
 * studio has since moved on — so it is drawn off the scale, where a level meter puts its over
 * indicator.
 */
export const PIPELINE_STATUSES = [
  'planned',
  'drafted',
  'qa_failed',
  'awaiting_approval',
  'approved',
  'published',
] as const;
export const OVER_STATUS = 'stale';
export const REGISTRY_STATUSES = [...PIPELINE_STATUSES, OVER_STATUS] as const;
export type RegistryStatus = (typeof REGISTRY_STATUSES)[number];

/** German for each status. The engine's vocabulary is English; the workbench is not. */
export const STATUS_LABEL: Record<RegistryStatus, string> = {
  planned: 'geplant',
  drafted: 'entworfen',
  qa_failed: 'Prüfung fehlgeschlagen',
  awaiting_approval: 'wartet auf Freigabe',
  approved: 'freigegeben',
  published: 'veröffentlicht',
  stale: 'überholt',
};

/** One line saying what the status *means*, for the Pegel's legend and the row title attribute. */
export const STATUS_MEANING: Record<RegistryStatus, string> = {
  planned: 'Im Plan, aber noch nichts erzeugt.',
  drafted: 'Es gibt ein Projekt oder einen Entwurf; gemessen wurde nichts.',
  qa_failed: 'Die automatische Prüfung hat die Aufnahme zurückgewiesen.',
  awaiting_approval: 'Die Maschine ist zufrieden. Jetzt ist ein Mensch dran.',
  approved: 'Ein Mensch hat die Aufnahme freigegeben, veröffentlicht ist sie noch nicht.',
  published: 'Im Kurs, mit Audio und Provenienz.',
  stale: 'Veröffentlicht — aber das Studio arbeitet inzwischen an anderen Bytes.',
};

export function isRegistryStatus(value: string): value is RegistryStatus {
  return (REGISTRY_STATUSES as readonly string[]).includes(value);
}

/**
 * The engine's *stage* vocabulary in German — a different axis from the registry status above.
 *
 * A status answers "where is this artifact in the course", joined across four sources. A stage
 * answers "where is this project in the studio's own machine", and only the studio has one. Three
 * views need the German for it, so it is written down once here rather than copied into each.
 */
export const STUFE_LABEL: Record<string, string> = {
  draft: 'Entwurf',
  validated: 'geprüft',
  audio_generated: 'gerendert',
  automatically_checked: 'automatisch geprüft',
  human_approved: 'freigegeben',
  exported: 'veröffentlicht',
  declined: 'abgelehnt',
};

/** The stage a scene sits at while it waits for a person. The only one Prüfung queues. */
export const STUFE_WARTET = 'automatically_checked';

/**
 * The registry status a scene project's own row would carry, from the two facts the list gives.
 *
 * The same split `api/registry._project_status` makes, and made here for the same reason: an
 * `automatically_checked` scene whose QA failed is not waiting for a signature, it is waiting for
 * a rewrite, and a queue that draws both with one lamp is telling the reviewer to open twenty
 * pages to find out which.
 */
export function stufeStatus(stage: string, qaPassed: boolean | null | undefined): RegistryStatus {
  if (stage === 'human_approved') return 'approved';
  if (stage === 'exported') return 'published';
  if (stage === STUFE_WARTET) {
    if (qaPassed === true) return 'awaiting_approval';
    if (qaPassed === false) return 'qa_failed';
  }
  return 'drafted';
}

/** The status as read: the vocabulary, or an unrecognised word the engine has started using. */
const statusSchema = z.string();

const registryProjectSchema = z.looseObject({
  kind: z.string(),
  id: z.number().optional(),
  stage: z.string(),
  revision: z.number().optional(),
  revision_sha256: z.string().nullable().optional(),
  qa_passed: z.boolean().nullable().optional(),
  has_exercise: z.boolean().optional(),
  updated: z.string().nullable().optional(),
});
export type RegistryProject = z.infer<typeof registryProjectSchema>;

/**
 * One planned audio artifact, joined across the plan, the published files, the studio database and
 * the exercises that use it.
 *
 * Listening rows and reading rows are one schema with two optional halves rather than a
 * discriminated union: the table shows them together, sorts them together and filters them
 * together, and a union would mean narrowing on `kind` in every cell.
 */
export const registryRowSchema = z.looseObject({
  kind: z.enum(['listening', 'reading']),
  id: z.string(),
  level: z.string(),
  status: statusSchema,
  artifact: z.boolean(),
  audio: z.boolean(),
  has_provenance: z.boolean(),
  project: registryProjectSchema.nullable().optional(),

  // Listening only.
  unit: z.union([z.string(), z.number()]).nullable().optional(),
  wave: z.union([z.string(), z.number()]).nullable().optional(),
  scenario: z.string().nullable().optional(),
  superseded_by_scene: z.boolean().optional(),
  exercise_items: z.number().optional(),

  // Readings only.
  topic: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  reading_kind: z.string().nullable().optional(),
  word_count: z.number().nullable().optional(),
  source_drift: z.boolean().optional(),
  source_sha256: z.string().nullable().optional(),
});
export type RegistryRow = z.infer<typeof registryRowSchema>;

/**
 * An `audio-comprehension` item with no usable recording behind it.
 *
 * `reason` keeps two different failures apart under one heading, because they look identical to a
 * learner — both play browser TTS — and need different fixes: `no-recording` names nothing at all,
 * `unknown-recording` names something the plan does not contain.
 */
export const unlinkedExerciseSchema = z.looseObject({
  set: z.string(),
  level: z.string(),
  item: z.string(),
  recording: z.string().nullable(),
  reason: z.enum(['no-recording', 'unknown-recording']).or(z.string()),
});
export type UnlinkedExercise = z.infer<typeof unlinkedExerciseSchema>;

export const registrySchema = z.looseObject({
  rows: z.array(registryRowSchema),
  recordings_without_exercises: z.array(z.string()),
  exercises_without_recordings: z.array(unlinkedExerciseSchema),
  summary: z.looseObject({
    listening: z.number(),
    readings: z.number(),
    by_status: z.record(z.string(), z.number()),
    audio_comprehension_items: z.number(),
  }),
});
export type Registry = z.infer<typeof registrySchema>;

const sceneTitleSchema = z.looseObject({
  en: z.string(),
  ru: z.string(),
  uk: z.string().nullable().optional(),
});

export const sceneRowSchema = z.looseObject({
  project_id: z.number(),
  slug: z.string(),
  kind: z.string(),
  stage: z.string(),
  revision: z.number(),
  scene_sha256: z.string(),
  has_exercise: z.boolean(),
  /** Three answers, not two: `null` means nothing has measured these bytes yet. */
  qa_passed: z.boolean().nullable().optional(),
  updated: z.string().nullable().optional(),
  title: sceneTitleSchema,
  level: z.string().nullable().optional(),
  /**
   * Which narration profile directed this scene, when one did.
   *
   * `null` for every dialogue and for any narration converted before the engine recorded it — the
   * honest answer in both cases, and a different one from "the default profile", which is what a
   * queue that guessed would print. Resolving a profile is lossy (the style string it composed
   * cannot be taken apart again), so this is the only way the answer exists at all.
   */
  narration: z
    .looseObject({ profile_id: z.string(), profile_version: z.number() })
    .nullable()
    .optional(),
  /**
   * Whether `DELETE /api/scenes/{slug}` would accept this row: draft, revision 1, never published.
   *
   * The engine's answer, not a rule re-derived here. Two of its three conditions are visible on
   * this row and the third — a provenance manifest in the course repository naming this slug — is
   * not, so a client that computed its own would offer the affordance on rows the engine refuses.
   */
  deletable: z.boolean().optional(),
});
export type SceneRow = z.infer<typeof sceneRowSchema>;

/** What a deletion answers with. Small on purpose: the useful part is that it happened. */
export const sceneDeletionSchema = z.looseObject({
  slug: z.string(),
  deleted: z.boolean(),
  project_id: z.number(),
});
export type SceneDeletion = z.infer<typeof sceneDeletionSchema>;

/** Where each utterance actually landed in the rendered master. Present only after a render. */
export const timingSchema = z.looseObject({
  utterance_id: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
});
export type Timing = z.infer<typeof timingSchema>;

/** Where any timeline entry landed in the finished mix — speech, bed and event alike. */
export const spanSchema = z.looseObject({
  entry_id: z.string(),
  type: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
});
export type Span = z.infer<typeof spanSchema>;

/** One file a render wrote: the master, the dry mix, the QA cut, a per-entry stem. */
export const artifactSchema = z.looseObject({
  path: z.string(),
  sha256: z.string(),
  kind: z.string(),
});
export type Artifact = z.infer<typeof artifactSchema>;

/**
 * Which of a scene's declared variants have a render of *these exact bytes*.
 *
 * `timing`, `timeline` and `artifacts` come from that render's own manifest and are its
 * **measurement**, not the scene's plan: `at_ms` in a document is a request, and only a render can
 * say where a turn actually fell. They are empty before a render, and the Mischung view draws
 * nothing rather than drawing the authored numbers as if they were times.
 */
export const renderRowSchema = z.looseObject({
  variant: z.string(),
  preset: z.string().nullable().optional(),
  rendered: z.boolean(),
  duration_ms: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  master_sha256: z.string().nullable().optional(),
  has_master: z.boolean().optional(),
  timing: z.array(timingSchema).default([]),
  timeline: z.array(spanSchema).default([]),
  artifacts: z.array(artifactSchema).default([]),
});
export type RenderRow = z.infer<typeof renderRowSchema>;

export const utteranceQaSchema = z.looseObject({
  line_id: z.string(),
  expected: z.string(),
  transcript: z.string(),
  wer: z.number(),
  passed: z.boolean(),
  missing_protected: z.array(z.string()).optional(),
});
export type UtteranceQa = z.infer<typeof utteranceQaSchema>;

/**
 * The speaker check, which has three outcomes and only one of them is a measurement.
 *
 * The engine writes a plain string — `not-requested`, or a marker naming what is missing — when
 * the check could not run. That is a state the reviewer must be able to tell apart from "measured
 * and fine", so it is kept as-is rather than flattened into a boolean.
 */
export const speakerQaSchema = z.union([
  z.string(),
  z.looseObject({
    model_id: z.string().optional(),
    threshold: z.number().nullable().optional(),
    threshold_status: z.string().optional(),
    lines: z
      .array(
        z.looseObject({
          line_id: z.string(),
          speaker: z.string(),
          similarity_to_character: z.number().nullable().optional(),
          manual_review: z.boolean().optional(),
          reason: z.string().nullable().optional(),
        }),
      )
      .optional(),
    characters: z
      .array(
        z.looseObject({
          speaker: z.string(),
          line_count: z.number(),
          measured_lines: z.number(),
          minimum_similarity: z.number().nullable().optional(),
        }),
      )
      .optional(),
    different_characters: z
      .array(z.looseObject({ speakers: z.array(z.string()), similarity: z.number() }))
      .optional(),
    warnings: z.array(z.string()).optional(),
  }),
]);
export type SpeakerQa = z.infer<typeof speakerQaSchema>;

export const soundscapeSchema = z.looseObject({
  bed_count: z.number(),
  event_count: z.number(),
  continuous_ambience: z.boolean(),
  configured_coverage_ratio: z.number(),
  configured_gain_min_db: z.number().nullable().optional(),
  configured_gain_max_db: z.number().nullable().optional(),
  measured_ambience_rms_dbfs: z.number().nullable().optional(),
  warnings: z.array(z.string()).optional(),
});
export type Soundscape = z.infer<typeof soundscapeSchema>;

export const qaReportSchema = z.looseObject({
  passed: z.boolean().optional(),
  scene_sha256: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  transcripts: z
    .looseObject({
      created_at: z.string().optional(),
      full_transcript: z.string().optional(),
      full_wer: z.number().optional(),
      lines: z.array(utteranceQaSchema).optional(),
      failures: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
      passed: z.boolean().optional(),
    })
    .optional(),
  speaker_qa: speakerQaSchema.optional(),
  soundscape: soundscapeSchema.optional(),
  timing: z.array(timingSchema).optional(),
});
export type QaReport = z.infer<typeof qaReportSchema>;

export const approvalSchema = z.looseObject({
  status: z.string().optional(),
  editor: z.string().optional(),
  reviewed_at: z.string().optional(),
  checklist: z.array(z.string()).optional(),
  audio_sha256: z.string().nullable().optional(),
  dry_audio_sha256: z.string().nullable().optional(),
  scene_sha256: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
});
export type Approval = z.infer<typeof approvalSchema>;

export const historyRowSchema = z.looseObject({
  number: z.number(),
  scene_sha256: z.string(),
  created_at: z.string().nullable().optional(),
  has_exercise: z.boolean().optional(),
  has_qa: z.boolean().optional(),
  has_approval: z.boolean().optional(),
});
export type HistoryRow = z.infer<typeof historyRowSchema>;

/**
 * The scene detail envelope.
 *
 * `scene` is `unknown` here and parsed separately by `sceneSchema`, because the two obligations are
 * different: the envelope must survive a field the engine adds, and the scene document must *not*
 * — it has a version number for exactly that. Keeping them in one schema would force one policy on
 * both. `readScene` in `api.ts` is where the strict parse happens, and where its failure becomes a
 * notice on the page instead of a blank one.
 */
export const sceneDetailSchema = z.looseObject({
  project_id: z.number(),
  slug: z.string(),
  kind: z.string(),
  stage: z.string(),
  revision: z.number(),
  scene_sha256: z.string(),
  scene: z.unknown(),
  exercise: z.unknown().nullable().optional(),
  qa: qaReportSchema.nullable().optional(),
  approval: approvalSchema.nullable().optional(),
  renders: z.array(renderRowSchema).default([]),
  history: z.array(historyRowSchema).default([]),
});
export type SceneDetail = z.infer<typeof sceneDetailSchema>;

/** The strict Scene v1 parse, re-exported so views import one module. */
export { sceneSchema };

export const characterSchema = z.looseObject({
  id: z.string(),
  version: z.number().optional(),
  display_name: z.string(),
  age_band: z.string().optional(),
  persona: z.string().optional(),
  registers: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  casting_tags: z.array(z.string()).default([]),
  narration_capable: z.boolean().optional(),
  incompatible_with: z.array(z.string()).default([]),
  status: z.string().optional(),
  demo_phrases: z.array(z.string()).default([]),
  voice_profile: z
    .looseObject({
      voice: z.string().optional(),
      seed: z.number().optional(),
      style: z.string().optional(),
      pace: z.number().optional(),
    })
    .optional(),
  usage_count: z.number().default(0),
  demo_urls: z.array(z.string()).default([]),
  portrait_candidate_urls: z.array(z.string()).default([]),
  selected_portrait_url: z.string().nullable().default(null),
});
export type Character = z.infer<typeof characterSchema>;

export const charactersSchema = z.looseObject({
  version: z.number().optional(),
  characters: z.array(characterSchema),
});
export type Characters = z.infer<typeof charactersSchema>;

/**
 * The acoustic vocabularies, read from the engine rather than held here.
 *
 * `room`, `device` and `preset` are free strings in the Scene contract and closed vocabularies at
 * render time — `data/acoustic-profiles.yaml` and `data/acoustic-difficulty.yaml` decide what
 * exists. A picker with its own copy of that list keeps offering a room after it is renamed, and
 * the render that refuses is the first anyone hears about it. So Tonwerk hardcodes no id.
 */
const acousticEntrySchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  note: z.string().default(''),
  version: z.number(),
});
export type AcousticEntry = z.infer<typeof acousticEntrySchema>;

export const acousticsSchema = z.looseObject({
  rooms: z.array(acousticEntrySchema.extend({ wet: z.number().optional() })),
  devices: z.array(acousticEntrySchema),
  presets: z.array(
    acousticEntrySchema.extend({ deltas: z.record(z.string(), z.number()).default({}) }),
  ),
  /** The keys a `DifficultyVariant.overrides` may name. The renderer refuses anything else. */
  override_keys: z.array(z.string()),
});
export type Acoustics = z.infer<typeof acousticsSchema>;

/**
 * One row of the sound library.
 *
 * Two origins under one loose schema and **not** a discriminated union: the list shows, filters
 * and plays them together, and the engine keeps them in two Python schemas precisely so neither
 * has to carry a field that means something else. `origin` is what a reader narrows on.
 */
export const soundRowSchema = z.looseObject({
  origin: z.string(),
  peaks: z.array(z.number()).default([]),

  // Imported originals.
  original_sha256: z.string().optional(),
  sound_id: z.number().optional(),
  title: z.string().optional(),
  uploader: z.string().optional(),
  page_url: z.string().optional(),
  license: z.string().optional(),
  license_url: z.string().optional(),
  description: z.string().optional(),
  duration_seconds: z.number().optional(),
  usage_count: z.number().optional(),
  editorial: z
    .looseObject({
      category: z.string().default('uncategorized'),
      scene_tags: z.array(z.string()).default([]),
      allowed_roles: z.array(z.string()).default([]),
      default_gain_db: z.number().optional(),
      loop_quality: z.string().optional(),
      review_status: z.string().optional(),
      notes: z.string().default(''),
    })
    .optional(),

  // Generated assets.
  asset_sha256: z.string().optional(),
  engine: z.string().optional(),
  model_id: z.string().optional(),
  model_revision: z.string().optional(),
  prompt: z.string().optional(),
  negative_prompt: z.string().nullable().optional(),
  seed: z.number().optional(),
  /** Only on the answer to a generation: whether the node was already in the cache. */
  cached: z.boolean().optional(),
});
export type SoundRow = z.infer<typeof soundRowSchema>;

/** The digest a row is played and referenced by, whichever origin it came from. */
export function klangSha(row: SoundRow): string {
  return row.original_sha256 ?? row.asset_sha256 ?? '';
}

/** What a revise answers: the new revision, and the stage it put the project back to. */
export const reviseResultSchema = z.looseObject({
  project_id: z.number(),
  slug: z.string(),
  revision: z.number(),
  scene_sha256: z.string(),
  has_exercise: z.boolean().optional(),
  stage: z.string(),
});
export type ReviseResult = z.infer<typeof reviseResultSchema>;

/** What a render answers. `nodes_evaluated`/`nodes_cached` is the incremental story, shown. */
export const renderResultSchema = z.looseObject({
  slug: z.string(),
  revision: z.number(),
  scene_sha256: z.string(),
  stage: z.string(),
  variant: z.string(),
  duration_ms: z.number(),
  nodes_evaluated: z.number(),
  nodes_cached: z.number(),
  artifacts: z.array(artifactSchema).default([]),
});
export type RenderResult = z.infer<typeof renderResultSchema>;

export const qaResultSchema = z.looseObject({
  slug: z.string(),
  stage: z.string(),
  variant: z.string(),
  passed: z.boolean(),
  qa: qaReportSchema,
});
export type QaResult = z.infer<typeof qaResultSchema>;

/** What an approval answers: the record the engine stored, verbatim. */
export const approvalResultSchema = z.looseObject({
  slug: z.string(),
  revision: z.number(),
  stage: z.string(),
  approval: approvalSchema,
});
export type ApprovalResult = z.infer<typeof approvalResultSchema>;

/** What a decline answers. `stage` is `draft` again; the QA report and the render stay. */
export const declineResultSchema = z.looseObject({
  slug: z.string(),
  revision: z.number(),
  stage: z.string(),
  decline: z.looseObject({
    status: z.string().optional(),
    editor: z.string().nullable().optional(),
    reviewed_at: z.string().optional(),
    reason: z.string().optional(),
    scene_sha256: z.string().nullable().optional(),
  }),
});
export type DeclineResult = z.infer<typeof declineResultSchema>;

/**
 * The narration profiles, read from the engine like every other vocabulary.
 *
 * `allowed_kinds` is the field that matters to a picker: a profile is not offered for a Lesetext
 * whose `kind` it refuses, because the engine would answer 409 and the reviewer would learn the
 * rule from a refusal. `label` and `description` are what a person chooses by; the id is what is
 * sent.
 */
export const narrationProfileSchema = z.looseObject({
  id: z.string(),
  version: z.number().optional(),
  character_id: z.string().optional(),
  label: z.string(),
  description: z.string().default(''),
  allowed_kinds: z.array(z.string()).default([]),
});
export type NarrationProfile = z.infer<typeof narrationProfileSchema>;

export const narrationProfilesSchema = z.looseObject({
  version: z.number().optional(),
  profiles: z.array(narrationProfileSchema),
});
export type NarrationProfiles = z.infer<typeof narrationProfilesSchema>;

/**
 * A consented voice reference, and the rules a new one is held to.
 *
 * **The rules come from the engine and are not re-implemented here.** That is the one design
 * decision in this whole surface worth stating twice: the wizard prints the requirements and the
 * engine decides whether a document meets them, so there is no second copy of a consent rule to
 * drift from the first. What the app does with `applies` and `minors_only` is *filter* — a rule
 * that cannot apply, printed as a requirement, is the fastest way to teach an editor that the list
 * is decoration.
 */
export const consentRuleSchema = z.looseObject({
  id: z.string(),
  applies: z.string(),
  minors_only: z.boolean().default(false),
  /** The engine's own English sentence, shown when this build has no German for a new rule id. */
  requirement: z.string().default(''),
});
export type ConsentRule = z.infer<typeof consentRuleSchema>;

export const voiceSchema = z.looseObject({
  id: z.string(),
  subject_display_name: z.string(),
  scope: z.string(),
  engine: z.string(),
  model_revision: z.string().default(''),
  reference_sha256: z.string(),
  consent_sha256: z.string(),
  guardian_consent: z.boolean().default(false),
  child_assent: z.boolean().default(false),
  retention: z.string().default(''),
  x_vector_only: z.boolean().default(false),
  created_at: z.string().default(''),
  /** A date, or null. Never a deletion: a withdrawal is a fact somebody has to be able to see. */
  revoked_at: z.string().nullable().default(null),
  /**
   * Measured on the engine, not inferred from `revoked_at`. A database that travelled without its
   * app-data has the row and not the recording, and reporting that as a withdrawal would invent
   * one that never happened.
   */
  reference_present: z.boolean().default(false),
  demo_urls: z.array(z.string()).default([]),
});
export type Voice = z.infer<typeof voiceSchema>;

export const voicesSchema = z.looseObject({
  voices: z.array(voiceSchema),
  rules: z.array(consentRuleSchema).default([]),
  engines: z.array(z.string()).default([]),
  demo_phrases: z.array(z.string()).default([]),
});
export type Voices = z.infer<typeof voicesSchema>;

export const voiceDemoSchema = voiceSchema.extend({
  phrases: z.array(z.string()).default([]),
});
export type VoiceDemo = z.infer<typeof voiceDemoSchema>;

export const revocationSchema = z.looseObject({
  id: z.string(),
  revoked_at: z.string(),
  reference_deleted: z.boolean().default(false),
  demos_deleted: z.number().default(0),
  note: z.string().default(''),
});
export type Revocation = z.infer<typeof revocationSchema>;
