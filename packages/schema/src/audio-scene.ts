/**
 * Scene v1 — the TypeScript mirror of `packages/schema/schemas/audio-scene.v1.schema.json`.
 *
 * **Three mirrors, one document.** A scene is written by the Python engine
 * (`listening_studio.scene.model.Scene`, a Pydantic model), published as a JSON Schema next to
 * this file, and read by Tonwerk. The JSON Schema is the committed contract; this module is what
 * a TypeScript reader parses with. Two mirrors of one shape drift silently — the app keeps
 * rendering, just without the field nobody remembered to add — so `tests/audio-scene-schema.test.ts`
 * holds this module against the JSON Schema **and** against both committed fixtures, per
 * definition, in both directions. That is why `AUDIO_SCENE_SHAPES` is exported: the test needs
 * every `$defs` entry by name, not just the top-level object.
 *
 * **Strict on purpose.** Every object here is a `strictObject`, exactly as the JSON Schema says
 * `additionalProperties: false`. A scene document carries its own `schema_version`, so a field the
 * engine adds is a version bump and not something to absorb quietly. Tonwerk's scene view parses
 * strictly, and falls back to a lenient read *with a visible notice* when that fails — the reader
 * has to learn that the document and the contract disagree, and still see the scene.
 *
 * Nothing here reads the filesystem; like the rest of `@da/schema` it is importable from a React
 * app, a Bun script and a test alike.
 */
import { z } from 'zod';

/** `^[a-z0-9]+(?:-[a-z0-9]+)*$` — the id shape the engine uses for slugs, variants and characters. */
const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case id');

/**
 * A scene title, in the two learner languages.
 *
 * Deliberately *not* `bilingualSchema` from `./index.ts`: that one carries an optional `de` half
 * for German-medium explanations, and a scene's title has no such field. Reusing it would accept
 * a document the contract rejects.
 */
export const sceneBilingualSchema = z.object({
  en: z.string(),
  ru: z.string(),
  uk: z.string().nullable().default(null),
});
export type SceneBilingual = z.infer<typeof sceneBilingualSchema>;

/** A content-addressed sound already in the library, plus the excerpt of it that is used. */
export const assetRefSchema = z.strictObject({
  ref: z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest'),
  source_duration_ms: z.number().int().positive().nullable().default(null),
  source_start_ms: z.number().int().min(0).default(0),
});
export type AssetRef = z.infer<typeof assetRefSchema>;

/** A sound that does not exist yet: the prompt, the seed and the generator parameters. */
export const soundSpecSchema = z.strictObject({
  duration_seconds: z.number().positive().nullable().default(null),
  negative_prompt: z.string().nullable().default(null),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  prompt: z.string().min(1),
  seed: z.number().int().min(0).default(0),
});
export type SoundSpec = z.infer<typeof soundSpecSchema>;

/**
 * Either sound reference form.
 *
 * Union order matters for the error message and not for the outcome: the two are told apart by
 * `ref` versus `prompt`, and neither accepts the other's keys.
 */
export const soundSchema = z.union([assetRefSchema, soundSpecSchema]);
export type Sound = z.infer<typeof soundSchema>;

/** Where a sound sits in the stereo field and how far away it is. */
export const placementSchema = z.strictObject({
  device: z.string().nullable().default(null),
  distance: z.number().min(0).default(1),
  pan: z.number().min(-1).max(1).default(0),
});
export type Placement = z.infer<typeof placementSchema>;

/** A display spelling and what the engine should be given instead. */
export const pronunciationOverrideSchema = z.strictObject({
  display: z.string().min(1),
  synthesis: z.string().min(1),
});
export type PronunciationOverride = z.infer<typeof pronunciationOverrideSchema>;

/** A row of `data/listening-characters.yaml`, pinned to the version that was cast. */
export const characterRefSchema = z.strictObject({
  id: kebab,
  version: z.number().int().min(1),
});
export type CharacterRef = z.infer<typeof characterRefSchema>;

/** The engine, voice, seed and style one cast member is synthesised with. */
export const voiceSpecSchema = z.strictObject({
  engine: z.string().min(1),
  seed: z.number().int().min(0),
  style: z.string().nullable().default(null),
  voice: z.string().min(1),
});
export type VoiceSpec = z.infer<typeof voiceSpecSchema>;

/** One voice in the scene, and the name the script calls it by. */
export const castMemberSchema = z.strictObject({
  character: characterRefSchema.nullable().default(null),
  role: z.string().min(1),
  voice: voiceSpecSchema,
});
export type CastMember = z.infer<typeof castMemberSchema>;

/** One spoken unit: what is shown, what is synthesised, and how it is paced. */
export const utteranceSchema = z.strictObject({
  display_text: z.string().min(1),
  id: z.string().min(1),
  pace: z.number().min(0.7).max(1.3).default(1),
  pause_after_ms: z.number().int().min(0).max(5000).default(600),
  pronunciation_overrides: z.array(pronunciationOverrideSchema).default([]),
  role: z.string().min(1),
  seed_override: z.number().int().min(0).nullable().default(null),
  synthesis_text: z.string().nullable().default(null),
});
export type Utterance = z.infer<typeof utteranceSchema>;

/** A script line placed on the timeline. `at_ms: null` means "after the previous one". */
export const speechEntrySchema = z.strictObject({
  at_ms: z.number().int().min(0).nullable().default(null),
  placement: placementSchema.nullable().default(null),
  type: z.literal('speech').default('speech'),
  utterance_id: z.string().min(1),
});
export type SpeechEntry = z.infer<typeof speechEntrySchema>;

/** A one-off event: a door, a announcement chime. May be the loudest thing in the room. */
export const sfxEntrySchema = z.strictObject({
  at_ms: z.number().int().min(0),
  gain_db: z.number().min(-40).max(0).default(-18),
  placement: placementSchema.nullable().default(null),
  sound: soundSchema,
  type: z.literal('sfx').default('sfx'),
});
export type SfxEntry = z.infer<typeof sfxEntrySchema>;

/** A continuous bed under some or all of the scene. Capped at -6 dB: a bed at speech level is not a bed. */
export const ambienceEntrySchema = z.strictObject({
  end_ms: z.number().int().min(0).nullable().default(null),
  fade_in_ms: z.number().int().min(0).max(10000).default(350),
  fade_out_ms: z.number().int().min(0).max(10000).default(450),
  gain_db: z.number().min(-40).max(-6).default(-24),
  sound: soundSchema,
  start_ms: z.number().int().min(0).default(0),
  type: z.literal('ambience').default('ambience'),
});
export type AmbienceEntry = z.infer<typeof ambienceEntrySchema>;

/**
 * The three timeline arms, discriminated by `type`.
 *
 * `type` carries a **default** in the contract, and Zod's `discriminatedUnion` reads the
 * discriminator before any default is applied — so an entry that legitimately omits it matches no
 * arm at all. Rather than making Tonwerk stricter than the document it reads, the discriminator is
 * filled in first, from the same evidence the contract already uses to tell the arms apart:
 * `SpeechEntry` is the only one requiring `utterance_id`, `SfxEntry` the only one requiring both
 * `sound` and `at_ms`, and `AmbienceEntry` requires `sound` alone. Nothing is guessed that the
 * `required` sets do not already determine.
 */
function withEntryType(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || 'type' in value) return value;
  const entry = value as Record<string, unknown>;
  if ('utterance_id' in entry) return { ...entry, type: 'speech' };
  if ('sound' in entry && 'at_ms' in entry) return { ...entry, type: 'sfx' };
  if ('sound' in entry) return { ...entry, type: 'ambience' };
  return value;
}

export const timelineEntrySchema = z.preprocess(
  withEntryType,
  z.discriminatedUnion('type', [speechEntrySchema, sfxEntrySchema, ambienceEntrySchema]),
);
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

/** Scene-wide acoustic treatment; `room` is resolved against the repo's catalog at render time. */
export const sceneAcousticsSchema = z.strictObject({
  lead_in_ms: z.number().int().min(0).max(5000).default(0),
  room: z.string().nullable().default(null),
});
export type SceneAcoustics = z.infer<typeof sceneAcousticsSchema>;

/** One rendering of the same script at a different listening difficulty. */
export const difficultyVariantSchema = z.strictObject({
  id: kebab,
  overrides: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  preset: z.string().nullable().default(null),
});
export type DifficultyVariant = z.infer<typeof difficultyVariantSchema>;

/** What the scene is *for*: the pedagogical brief it was commissioned against. */
export const sceneBriefSchema = z.strictObject({
  duration_seconds: z.tuple([z.number().int(), z.number().int()]).nullable().default(null),
  grammar_target: z.string().nullable().default(null),
  level: z.enum(['A1', 'A2', 'B1', 'B2']).default('A2'),
  outcomes: z.array(z.string()).default([]),
  scenario: z.string().min(1),
  topic: z.string().nullable().default(null),
  vocabulary: z.array(z.string()).default([]),
});
export type SceneBrief = z.infer<typeof sceneBriefSchema>;

/** The scene document itself. */
export const sceneSchema = z.strictObject({
  acoustics: sceneAcousticsSchema.default({ lead_in_ms: 0, room: null }),
  authoring: z.enum(['manual', 'generated']).default('manual'),
  brief: sceneBriefSchema.nullable().default(null),
  cast: z.array(castMemberSchema).min(1),
  generation_prompt: z.string().nullable().default(null),
  kind: z.enum(['dialogue', 'narration', 'custom']),
  schema_version: z.literal(1).default(1),
  script: z.array(utteranceSchema).min(1),
  slug: kebab,
  timeline: z.array(timelineEntrySchema).min(1),
  title: sceneBilingualSchema,
  variants: z.array(difficultyVariantSchema).default([]),
});
export type Scene = z.infer<typeof sceneSchema>;

/**
 * Every `$defs` entry of the JSON Schema, by the name it carries there, plus `Scene` itself.
 *
 * The drift test walks this map rather than the top-level object alone: a field added to
 * `Utterance` is exactly as invisible as one added to `Scene`, and only a per-definition
 * comparison catches it.
 */
export const AUDIO_SCENE_SHAPES = {
  AmbienceEntry: ambienceEntrySchema,
  AssetRef: assetRefSchema,
  Bilingual: sceneBilingualSchema,
  CastMember: castMemberSchema,
  CharacterRef: characterRefSchema,
  DifficultyVariant: difficultyVariantSchema,
  Placement: placementSchema,
  PronunciationOverride: pronunciationOverrideSchema,
  SceneAcoustics: sceneAcousticsSchema,
  SceneBrief: sceneBriefSchema,
  SfxEntry: sfxEntrySchema,
  SoundSpec: soundSpecSchema,
  SpeechEntry: speechEntrySchema,
  Utterance: utteranceSchema,
  VoiceSpec: voiceSpecSchema,
  Scene: sceneSchema,
} as const;

/** The `$id` the published JSON Schema carries. Held equal by the drift test. */
export const AUDIO_SCENE_SCHEMA_ID = 'https://deutsch-atlas.local/schemas/audio-scene.v1.schema.json';

/** True when the sound is a library reference rather than something still to be generated. */
export function isAssetRef(sound: Sound): sound is AssetRef {
  return 'ref' in sound;
}

/** The text actually handed to the synthesiser: the override when there is one, else what is shown. */
export function spokenText(utterance: Utterance): string {
  return utterance.synthesis_text ?? utterance.display_text;
}
