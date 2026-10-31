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

/**
 * Per-scene changes to the device a placement names. Only the numbers an editor turns; a deeper
 * change is a different device in `data/acoustic-profiles.yaml`.
 */
export const deviceOverridesSchema = z.strictObject({
  gain_db: z.number().min(-40).max(12).nullable().default(null),
  highpass_hz: z.number().positive().max(24000).nullable().default(null),
  lowpass_hz: z.number().positive().max(24000).nullable().default(null),
  room_send_db: z.number().min(-12).max(12).nullable().default(null),
});
export type DeviceOverrides = z.infer<typeof deviceOverridesSchema>;

/**
 * Where a sound sits in the stereo field and how far away it is.
 *
 * `device_overrides` is **optional rather than defaulted**, like every mixing field added after
 * scenes were stored: the engine leaves it out of a scene's canonical form while it is unset, so
 * that the scene's hash, and the approval bound to it, did not move when the field arrived. Absent
 * means "no override", and a reader must not write the field back as `null`.
 */
export const placementSchema = z.strictObject({
  device: z.string().nullable().default(null),
  device_overrides: deviceOverridesSchema.optional(),
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

/**
 * The engine, voice, seed and style one cast member is synthesised with.
 *
 * `voice_ref` names a **consented voice reference** the studio holds, and when it is set `voice` is
 * the display identity — the subject's name as it reads in a cast list — rather than an engine
 * preset. Neither is validated against a catalogue here or in the JSON Schema: a voice reference
 * lives in one machine's app-data by design, so a document held to a store it cannot ship with
 * would be invalid on every other checkout. The engine refuses an unknown or revoked one at render
 * time, which is where the answer can be true.
 */
export const voiceSpecSchema = z.strictObject({
  engine: z.string().min(1),
  seed: z.number().int().min(0),
  style: z.string().nullable().default(null),
  voice: z.string().min(1),
  voice_ref: kebab.nullable().default(null),
});
export type VoiceSpec = z.infer<typeof voiceSpecSchema>;

/** One voice in the scene, and the name the script calls it by. */
export const castMemberSchema = z.strictObject({
  character: characterRefSchema.nullable().default(null),
  role: z.string().min(1),
  voice: voiceSpecSchema,
});
export type CastMember = z.infer<typeof castMemberSchema>;

/** One band edge; `sections` cascades 2-pole biquads, so 3 is 36 dB per octave. */
export const bandFilterSchema = z.strictObject({
  hz: z.number().positive().max(24000),
  sections: z.number().int().min(1).max(6).default(1),
});
export type BandFilter = z.infer<typeof bandFilterSchema>;

/** Levelling, in dB and milliseconds; the engine converts to `acompressor`'s linear units. */
export const compressionSchema = z.strictObject({
  attack_ms: z.number().min(0.01).max(2000),
  makeup_db: z.number().min(0).max(36),
  ratio: z.number().min(1).max(20),
  release_ms: z.number().min(0.01).max(9000),
  threshold_db: z.number().min(-60).max(0),
});
export type Compression = z.infer<typeof compressionSchema>;

/** Bit reduction for a codec-ish edge; `mix` keeps it a hint. */
export const crushSchema = z.strictObject({
  bits: z.number().min(1).max(64),
  mix: z.number().min(0).max(1),
});
export type Crush = z.infer<typeof crushSchema>;

/** Three fixed bands, in dB: a low shelf at 200 Hz, a bell at 1.5 kHz, a high shelf at 5 kHz. */
export const equalizerSchema = z.strictObject({
  high_db: z.number().min(-12).max(12).default(0),
  low_db: z.number().min(-12).max(12).default(0),
  mid_db: z.number().min(-12).max(12).default(0),
});
export type Equalizer = z.infer<typeof equalizerSchema>;

/**
 * An insert chain on one stem, after its distance and device: band limits, equalizer, crush,
 * compressor, in that fixed order. `room_send_db` moves the stem's send into the scene's room.
 */
export const effectsSchema = z.strictObject({
  compression: compressionSchema.nullable().default(null),
  crush: crushSchema.nullable().default(null),
  eq: equalizerSchema.nullable().default(null),
  highpass: bandFilterSchema.nullable().default(null),
  lowpass: bandFilterSchema.nullable().default(null),
  room_send_db: z.number().min(-12).max(12).default(0),
});
export type Effects = z.infer<typeof effectsSchema>;

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

/**
 * A script line placed on the timeline. `at_ms: null` means "after the previous one".
 *
 * `gain_db` (absent: 0) moves the line against the other lines before the master is
 * loudness-normalised; `effects` (absent: none) is its insert chain. Both optional for the reason
 * `placementSchema` gives.
 */
export const speechEntrySchema = z.strictObject({
  at_ms: z.number().int().min(0).nullable().default(null),
  effects: effectsSchema.optional(),
  gain_db: z.number().min(-24).max(6).optional(),
  placement: placementSchema.nullable().default(null),
  type: z.literal('speech').default('speech'),
  utterance_id: z.string().min(1),
});
export type SpeechEntry = z.infer<typeof speechEntrySchema>;

/** A one-off event: a door, a announcement chime. May be the loudest thing in the room. */
export const sfxEntrySchema = z.strictObject({
  at_ms: z.number().int().min(0),
  effects: effectsSchema.optional(),
  gain_db: z.number().min(-40).max(0).default(-18),
  placement: placementSchema.nullable().default(null),
  sound: soundSchema,
  type: z.literal('sfx').default('sfx'),
});
export type SfxEntry = z.infer<typeof sfxEntrySchema>;

/**
 * A continuous bed under some or all of the scene. Capped at -6 dB: a bed at speech level is not a
 * bed. `duck_db` (absent: 0) lowers it by exactly that much while anyone speaks.
 */
export const ambienceEntrySchema = z.strictObject({
  duck_db: z.number().min(-30).max(0).optional(),
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

/**
 * Per-scene changes to the room: `wet` replaces the profile's level, the other three the impulse
 * response's own parameters.
 */
export const roomOverridesSchema = z.strictObject({
  decay_s: z.number().positive().max(10).nullable().default(null),
  lowpass_hz: z.number().min(500).max(20000).nullable().default(null),
  pre_delay_ms: z.number().int().min(0).max(200).nullable().default(null),
  wet: z.number().min(0).max(1).nullable().default(null),
});
export type RoomOverrides = z.infer<typeof roomOverridesSchema>;

/** Scene-wide acoustic treatment; `room` is resolved against the repo's catalog at render time. */
export const sceneAcousticsSchema = z.strictObject({
  lead_in_ms: z.number().int().min(0).max(5000).default(0),
  room: z.string().nullable().default(null),
  room_overrides: roomOverridesSchema.optional(),
});
export type SceneAcoustics = z.infer<typeof sceneAcousticsSchema>;

/** One rendering of the same script at a different listening difficulty. */
export const difficultyVariantSchema = z.strictObject({
  id: kebab,
  overrides: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  preset: z.string().nullable().default(null),
});
export type DifficultyVariant = z.infer<typeof difficultyVariantSchema>;

/**
 * Which narration profile directed this reading, pinned to the version that directed it.
 *
 * A narration profile resolves into a cast member and a per-utterance pace, and the resolution is
 * lossy — the composed `style` string cannot be taken apart again and the pace is a number several
 * profiles could produce. So the id is recorded, and the Lesetexte queue can show what is in use
 * instead of only offering a picker.
 */
export const narrationRefSchema = z.strictObject({
  profile_id: kebab,
  profile_version: z.number().int().min(1),
});
export type NarrationRef = z.infer<typeof narrationRefSchema>;

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
  narration: narrationRefSchema.nullable().default(null),
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
  BandFilter: bandFilterSchema,
  Bilingual: sceneBilingualSchema,
  CastMember: castMemberSchema,
  CharacterRef: characterRefSchema,
  Compression: compressionSchema,
  Crush: crushSchema,
  DeviceOverrides: deviceOverridesSchema,
  DifficultyVariant: difficultyVariantSchema,
  Effects: effectsSchema,
  Equalizer: equalizerSchema,
  NarrationRef: narrationRefSchema,
  Placement: placementSchema,
  PronunciationOverride: pronunciationOverrideSchema,
  RoomOverrides: roomOverridesSchema,
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
export const AUDIO_SCENE_SCHEMA_ID =
  'https://deutsch-atlas.local/schemas/audio-scene.v1.schema.json';

/** True when the sound is a library reference rather than something still to be generated. */
export function isAssetRef(sound: Sound): sound is AssetRef {
  return 'ref' in sound;
}

/** The text actually handed to the synthesiser: the override when there is one, else what is shown. */
export function spokenText(utterance: Utterance): string {
  return utterance.synthesis_text ?? utterance.display_text;
}
