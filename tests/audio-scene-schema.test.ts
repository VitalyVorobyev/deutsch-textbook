import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  AUDIO_SCENE_SCHEMA_ID,
  AUDIO_SCENE_SHAPES,
  sceneSchema,
  spokenText,
  isAssetRef,
} from '@da/schema/audio-scene';

/**
 * Scene v1 has **three** mirrors and this file is the only thing holding them equal.
 *
 * 1. `listening_studio.scene.model.Scene` — the Pydantic model the engine writes with.
 * 2. `packages/schema/schemas/audio-scene.v1.schema.json` — the published contract, generated
 *    from (1) and committed, so a reader outside Python has something to hold.
 * 3. `packages/schema/src/audio-scene.ts` — what a TypeScript reader (Tonwerk) parses with.
 *
 * (1)→(2) is generated. (2)→(3) is hand-written, which is where drift lives: a field added to the
 * Python model reaches the JSON Schema on the next regeneration and reaches the Zod mirror only
 * if someone remembers. Nothing else fails when they disagree — Tonwerk keeps rendering, minus
 * the field — so the comparison is made **per definition and in both directions**, not on the
 * top-level object alone. A field added to `Utterance` is exactly as invisible as one added to
 * `Scene`.
 *
 * The comparison is shape-level: property names and the required set. Ranges, patterns and
 * defaults are checked where they are load-bearing (the fixtures exercise them) rather than
 * transcribed a second time — a test that restates every `minimum` is a fourth mirror.
 */

const SCHEMA_PATH = join(process.cwd(), 'packages', 'schema', 'schemas', 'audio-scene.v1.schema.json');
const FIXTURE_DIR = join(process.cwd(), 'packages', 'schema', 'schemas', 'fixtures');

interface JsonSchemaObject {
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

const published = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as JsonSchemaObject & {
  $id: string;
  $defs: Record<string, JsonSchemaObject>;
};

/** The definitions of the published schema, plus its root under the name the mirror uses. */
const publishedDefinitions: Record<string, JsonSchemaObject> = { ...published.$defs, Scene: published };

/**
 * The property names a Zod object accepts, and the ones it requires.
 *
 * `.def.shape` is Zod v4's internal shape record; a field with `.default()` or `.optional()` is
 * not required, which is the same distinction the JSON Schema's `required` array draws.
 */
function zodShape(schema: z.ZodObject): { properties: string[]; required: string[] } {
  const shape = schema.def.shape as Record<string, z.ZodType>;
  const properties = Object.keys(shape).sort();
  const required = properties.filter((key) => !shape[key]!.safeParse(undefined).success).sort();
  return { properties, required };
}

function jsonShape(definition: JsonSchemaObject): { properties: string[]; required: string[] } {
  return {
    properties: Object.keys(definition.properties ?? {}).sort(),
    required: [...(definition.required ?? [])].sort(),
  };
}

describe('Scene v1: the Zod mirror against the published JSON Schema', () => {
  test('the mirror names the schema it mirrors', () => {
    expect(AUDIO_SCENE_SCHEMA_ID).toBe(published.$id);
  });

  test('both mirrors define the same set of types', () => {
    expect(Object.keys(AUDIO_SCENE_SHAPES).sort()).toEqual(Object.keys(publishedDefinitions).sort());
  });

  for (const [name, definition] of Object.entries(publishedDefinitions)) {
    test(`${name}: same properties, same required set`, () => {
      const mirror = AUDIO_SCENE_SHAPES[name as keyof typeof AUDIO_SCENE_SHAPES];
      expect(mirror, `${name} has no Zod mirror`).toBeDefined();
      expect(zodShape(mirror as unknown as z.ZodObject)).toEqual(jsonShape(definition));
    });
  }

  test('every definition the contract closes is closed in the mirror too', () => {
    // `additionalProperties: false` is the reason a drift test can work at all: an open object
    // would accept the field it is missing and this file would pass while the app dropped it.
    // `Bilingual` is the one definition the contract leaves open, and the mirror follows it.
    const closedInJson = Object.entries(publishedDefinitions)
      .filter(([, definition]) => definition.additionalProperties === false)
      .map(([name]) => name)
      .sort();
    const closedInMirror = Object.entries(AUDIO_SCENE_SHAPES)
      .filter(([, schema]) => (schema as unknown as z.ZodObject).def.catchall instanceof z.ZodNever)
      .map(([name]) => name)
      .sort();
    expect(closedInMirror).toEqual(closedInJson);
    expect(closedInJson).not.toContain('Bilingual');
  });

  test('a closed object refuses a field neither mirror declares', () => {
    // The rule this file exists to defend, exercised rather than assumed: if `strictObject` were
    // `object`, every comparison above would still pass and this would be the only failure.
    const extended = { ...loadFixture('dialogue-ls-wohnen-01'), tempo_hint: 'schnell' };
    expect(sceneSchema.safeParse(extended).success).toBe(false);
  });
});

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.scene.json`), 'utf8'));
}

describe('Scene v1: the Zod mirror against the committed fixtures', () => {
  for (const name of ['dialogue-ls-wohnen-01', 'narration-a1-erste-schritte']) {
    test(`${name} parses, and parses back to itself`, () => {
      const raw = loadFixture(name);
      const parsed = sceneSchema.parse(raw);
      // Round-trip, not just "it parsed": a mirror that silently drops a field it does not know
      // would parse every fixture and lose data on the way through.
      expect(parsed).toEqual(raw as typeof parsed);
    });
  }

  test('the dialogue fixture reads as two voices, a script and all three timeline arms', () => {
    const scene = sceneSchema.parse(loadFixture('dialogue-ls-wohnen-01'));
    expect(scene.kind).toBe('dialogue');
    expect(scene.cast.map((member) => member.role)).toEqual(['Maklerin', 'Interessent']);
    expect(scene.script).toHaveLength(8);
    // The one fixture that exercises every arm of the discriminated union. A mirror that got the
    // union wrong would still parse the narration fixture, which is speech and nothing else.
    expect([...new Set(scene.timeline.map((entry) => entry.type))].sort()).toEqual([
      'ambience',
      'sfx',
      'speech',
    ]);
  });

  test('a timeline entry that leans on the contract default for `type` still parses', () => {
    // `type` is defaulted in the contract, so a hand-written scene may omit it. Zod discriminates
    // before defaults apply, which is why `timelineEntrySchema` fills it first — this is that
    // branch, and without it every such entry would fail with "no matching discriminator".
    const scene = loadFixture('narration-a1-erste-schritte') as { timeline: Record<string, unknown>[] };
    const stripped = {
      ...scene,
      timeline: scene.timeline.map(({ type: _type, ...rest }) => rest),
    };
    const parsed = sceneSchema.parse(stripped);
    expect(parsed.timeline.every((entry) => entry.type === 'speech')).toBe(true);
  });

  test('the narration fixture pins its narrator to a catalog character version', () => {
    const scene = sceneSchema.parse(loadFixture('narration-a1-erste-schritte'));
    expect(scene.kind).toBe('narration');
    expect(scene.cast[0]?.character).toEqual({ id: 'so-yeon-park', version: 1 });
    expect(spokenText(scene.script[0]!)).toBe(scene.script[0]!.display_text);
  });
});

describe('Scene v1: the helpers a reader needs', () => {
  test('synthesis_text wins over display_text when it is set', () => {
    expect(spokenText({ ...utterance(), synthesis_text: 'null eins sieben' })).toBe('null eins sieben');
  });

  test('a library reference and a generation prompt are told apart by shape', () => {
    expect(isAssetRef({ ref: 'a'.repeat(64), source_start_ms: 0, source_duration_ms: null })).toBe(true);
    expect(isAssetRef({ prompt: 'Bahnhofshalle', seed: 0, params: {}, duration_seconds: null, negative_prompt: null })).toBe(false);
  });
});

function utterance() {
  return utteranceFixture;
}

const utteranceFixture = {
  display_text: 'Die Nummer ist 0176.',
  id: 'line-1',
  pace: 1,
  pause_after_ms: 600,
  pronunciation_overrides: [],
  role: 'Maklerin',
  seed_override: null,
  synthesis_text: null,
};
