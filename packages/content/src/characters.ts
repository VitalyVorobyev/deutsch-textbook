/**
 * The recurring cast (ADR 0016): a person is content, a voice is casting.
 *
 * A character record (`content/characters/<id>.yaml`) holds the facts about one person, each
 * pinned to the text that states it, and the one roster voice that speaks that person. The
 * speaker registry (`data/speaker-registry.yaml`) holds every other speaker name and the cast's
 * open debts. Four checks hold the two together:
 *
 * 1. a record resolves: its voice is on the roster and belongs to nobody else, its relations name
 *    other records, and every ref names a shipped file;
 * 2. every speaker in a recording or a scripted exercise turn is a cast member, an unnamed role
 *    or a legacy name;
 * 3. every place a cast member's name occurs has been checked against the record, or waits in
 *    `continuity_pending`;
 * 4. a cast member's voice speaks only that person, and that person speaks only in that voice,
 *    or the recording waits in `recast_pending`.
 *
 * Every registry list may only shrink: an entry that matches nothing is itself an error.
 *
 * Name occurrences are read from listening transcripts, scripted exercise turns and the running
 * text of readings. A name inside an exercise prompt or answer is not read: those are sentences
 * about someone, rarely a scene, and matching them would need a grammar the check does not have.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import YAML from 'yaml';
import {
  characterSchema,
  speakerRegistrySchema,
  type Character,
  type SpeakerRegistry,
} from '@da/schema';

export const CHARACTERS_DIR = join('content', 'characters');
export const SPEAKER_REGISTRY_FILE = join('data', 'speaker-registry.yaml');
const ROSTER_FILE = join('data', 'listening-characters.yaml');
const LEVELS = ['a1', 'a2', 'b1', 'b2'] as const;

export interface CastRecord {
  file: string;
  data: Character;
}

const yamlFiles = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.yaml')) : [];

const parseYaml = (path: string): unknown => YAML.parse(readFileSync(path, 'utf8'));

/** Every character record, or the problems that kept one from loading. */
export function loadCast(root: string): { cast: CastRecord[]; problems: string[] } {
  const cast: CastRecord[] = [];
  const problems: string[] = [];
  for (const name of yamlFiles(join(root, CHARACTERS_DIR)).sort()) {
    const file = join(CHARACTERS_DIR, name);
    const parsed = characterSchema.safeParse(parseYaml(join(root, file)));
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        problems.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      continue;
    }
    if (parsed.data.id !== basename(name, '.yaml'))
      problems.push(`${file}: id "${parsed.data.id}" must match the file name`);
    cast.push({ file, data: parsed.data });
  }
  return { cast, problems };
}

export function loadSpeakerRegistry(root: string): SpeakerRegistry {
  const path = join(root, SPEAKER_REGISTRY_FILE);
  if (!existsSync(path))
    return { version: 1, roles: [], legacy_names: [], continuity_pending: [], recast_pending: [] };
  return speakerRegistrySchema.parse(parseYaml(path));
}

/** Does a ref name a file that exists? */
export function refExists(root: string, ref: string): boolean {
  const [kind, rest] = ref.split(':', 2) as [string, string];
  if (kind === 'reading') return existsSync(join(root, 'content/reading', `${rest}.yaml`));
  if (kind === 'exercise') return existsSync(join(root, 'content/exercises', `${rest}.yaml`));
  return LEVELS.some((level) => existsSync(join(root, 'content/listening', level, `${rest}.yaml`)));
}

/** The names a speaker field holds, with the refs of every file that holds each. */
export type Occurrences = Map<string, Set<string>>;

const note = (into: Occurrences, name: string, ref: string) => {
  let refs = into.get(name);
  if (!refs) into.set(name, (refs = new Set()));
  refs.add(ref);
};

function collectTurns(value: unknown, ref: string, into: Occurrences): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectTurns(entry, ref, into);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const turns = (value as { turns?: unknown }).turns;
  if (Array.isArray(turns))
    for (const turn of turns) {
      const speaker = (turn as { speaker?: unknown } | null)?.speaker;
      if (typeof speaker === 'string') note(into, speaker, ref);
    }
  for (const child of Object.values(value)) collectTurns(child, ref, into);
}

/** Every speaker name in a recording's transcript or a scripted exercise turn. */
export function speakerOccurrences(root: string): Occurrences {
  const into: Occurrences = new Map();
  for (const level of LEVELS) {
    const dir = join(root, 'content/listening', level);
    for (const name of yamlFiles(dir)) {
      const data = parseYaml(join(dir, name)) as {
        speakers?: string[];
        transcript?: { speaker?: string }[];
      };
      const ref = `listening:${basename(name, '.yaml')}`;
      for (const speaker of data.speakers ?? []) note(into, speaker, ref);
      for (const turn of data.transcript ?? []) if (turn.speaker) note(into, turn.speaker, ref);
    }
    const exercises = join(root, 'content/exercises', level);
    for (const name of yamlFiles(exercises))
      collectTurns(
        parseYaml(join(exercises, name)),
        `exercise:${level}/${basename(name, '.yaml')}`,
        into,
      );
  }
  return into;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The name as a whole word, allowing the genitive *-s* (`Lenas Kollegin`). */
const nameWord = (name: string) =>
  new RegExp(`(?<![\\p{L}])${escapeRegex(name)}s?(?![\\p{L}])`, 'u');

/** The readings whose running text uses each name. */
export function readingOccurrences(root: string, names: readonly string[]): Occurrences {
  const into: Occurrences = new Map();
  const patterns = names.map((name) => [name, nameWord(name)] as const);
  for (const level of LEVELS) {
    const dir = join(root, 'content/reading', level);
    for (const file of yamlFiles(dir)) {
      const data = parseYaml(join(dir, file)) as { text?: unknown };
      const text = Array.isArray(data.text) ? data.text.join('\n') : String(data.text ?? '');
      for (const [name, pattern] of patterns)
        if (pattern.test(text)) note(into, name, `reading:${level}/${basename(file, '.yaml')}`);
    }
  }
  return into;
}

/** Which roster voice speaks which role, per published recording that records its casting. */
export function recordingCasts(root: string): Map<string, { character: string; role: string }[]> {
  const casts = new Map<string, { character: string; role: string }[]>();
  for (const level of LEVELS) {
    const dir = join(root, 'data/audio-provenance', level);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((file) => file.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8')) as {
        voices?: { character?: string; role?: string }[];
      };
      const voices = (data.voices ?? []).flatMap((voice) =>
        voice.character && voice.role ? [{ character: voice.character, role: voice.role }] : [],
      );
      if (voices.length) casts.set(basename(name, '.json'), voices);
    }
  }
  return casts;
}

function rosterVoices(root: string): Set<string> {
  const path = join(root, ROSTER_FILE);
  if (!existsSync(path)) return new Set();
  const data = parseYaml(path) as { characters?: { id: string }[] };
  return new Set((data.characters ?? []).map((character) => character.id));
}

/** Everything the four checks find wrong, one line each. */
export function characterProblems(root: string): string[] {
  const { cast, problems } = loadCast(root);
  const registry = loadSpeakerRegistry(root);
  const roster = rosterVoices(root);
  const registryFile = SPEAKER_REGISTRY_FILE;

  // 1. Each record resolves.
  const ids = new Set(cast.map((record) => record.data.id));
  const byName = new Map<string, CastRecord>();
  const byVoice = new Map<string, CastRecord>();
  for (const record of cast) {
    const { file, data } = record;
    if (byName.has(data.name)) problems.push(`${file}: the name "${data.name}" is already cast`);
    byName.set(data.name, record);
    if (data.voice) {
      if (!roster.has(data.voice))
        problems.push(`${file}: voice "${data.voice}" is not on the roster (${ROSTER_FILE})`);
      const owner = byVoice.get(data.voice);
      if (owner) problems.push(`${file}: voice "${data.voice}" already speaks ${owner.data.name}`);
      else byVoice.set(data.voice, record);
    }
    for (const relation of data.relations) {
      if (relation.with === data.id) problems.push(`${file}: a relation names the record itself`);
      else if (!ids.has(relation.with))
        problems.push(`${file}: relation with "${relation.with}" names no character record`);
    }
    const refs = [
      ...data.facts.map((fact) => fact.source),
      ...data.relations.map((relation) => relation.source),
      ...data.appearances,
    ];
    for (const ref of new Set(refs))
      if (!refExists(root, ref)) problems.push(`${file}: ${ref} names no shipped file`);
  }

  // 2. Every speaker is known.
  const speakers = speakerOccurrences(root);
  const roles = new Set(registry.roles);
  const legacy = new Set(registry.legacy_names);
  for (const name of registry.roles)
    if (legacy.has(name))
      problems.push(`${registryFile}: "${name}" is both a role and a legacy name`);
  for (const name of [...registry.roles, ...registry.legacy_names]) {
    if (byName.has(name)) problems.push(`${registryFile}: "${name}" is a cast member`);
    if (!speakers.has(name)) problems.push(`${registryFile}: "${name}" is no longer a speaker`);
  }
  for (const [name, refs] of speakers)
    if (!byName.has(name) && !roles.has(name) && !legacy.has(name))
      problems.push(
        `${[...refs][0]}: speaker "${name}" is no cast member, role or legacy name (${registryFile})`,
      );

  // 3. Every occurrence of a cast name is checked against its record, or waits.
  const castNames = [...byName.keys()];
  const reading = readingOccurrences(root, castNames);
  const pending = new Map<string, Set<string>>();
  for (const entry of registry.continuity_pending) {
    if (!byName.has(entry.name))
      problems.push(`${registryFile}: continuity_pending names "${entry.name}", who is not cast`);
    pending.set(entry.name, new Set(entry.refs));
  }
  for (const [name, record] of byName) {
    const found = new Set([...(speakers.get(name) ?? []), ...(reading.get(name) ?? [])]);
    const vetted = new Set(record.data.appearances);
    const waiting = pending.get(name) ?? new Set<string>();
    for (const ref of found)
      if (!vetted.has(ref) && !waiting.has(ref))
        problems.push(`${ref}: "${name}" is not checked against ${record.file}`);
    for (const ref of vetted)
      if (!found.has(ref)) problems.push(`${record.file}: ${ref} no longer names ${name}`);
    for (const ref of waiting) {
      if (vetted.has(ref))
        problems.push(`${registryFile}: ${ref} is both vetted and pending for ${name}`);
      else if (!found.has(ref)) problems.push(`${registryFile}: ${ref} no longer names ${name}`);
    }
  }

  // 4. A cast member's voice speaks only that person, and that person only in that voice.
  const recast = new Set(registry.recast_pending);
  const breaking = new Set<string>();
  for (const [recording, voices] of recordingCasts(root))
    for (const { character, role } of voices) {
      const voiceOwner = byVoice.get(character);
      const person = byName.get(role);
      if (
        (voiceOwner && voiceOwner.data.name !== role) ||
        (person && person.data.voice !== character)
      )
        breaking.add(recording);
    }
  for (const recording of breaking)
    if (!recast.has(recording))
      problems.push(
        `listening:${recording}: its casting breaks a cast member's voice; recast it or list it in recast_pending`,
      );
  for (const recording of recast)
    if (!breaking.has(recording))
      problems.push(`${registryFile}: recast_pending lists ${recording}, whose casting is clean`);

  return problems;
}

export interface VoiceShare {
  level: string;
  /** Voiced milliseconds spoken by a cast member's voice. */
  castMs: number;
  /** Voiced milliseconds spoken by any other voice. */
  walkOnMs: number;
  /** Recordings whose casting is not recorded (the preset voices), left out of both sums. */
  uncounted: number;
}

/**
 * Each level's recorded listening time, split by who speaks it: a cast member's voice or a
 * walk-on voice (ADR 0016 keeps at least a third with walk-on voices). A turn's time is its cue;
 * a recording without cues or without recorded casting is counted as `uncounted`.
 */
export function voiceShare(root: string): VoiceShare[] {
  const castVoices = new Set(
    loadCast(root).cast.flatMap((record) => (record.data.voice ? [record.data.voice] : [])),
  );
  const casts = recordingCasts(root);
  return LEVELS.flatMap((level) => {
    const dir = join(root, 'content/listening', level);
    const names = yamlFiles(dir);
    if (!names.length) return [];
    const share: VoiceShare = { level: level.toUpperCase(), castMs: 0, walkOnMs: 0, uncounted: 0 };
    for (const name of names) {
      const id = basename(name, '.yaml');
      const data = parseYaml(join(dir, name)) as {
        transcript?: { speaker: string }[];
        cues?: { start_ms: number; end_ms: number }[];
      };
      const voices = casts.get(id);
      const transcript = data.transcript ?? [];
      if (!voices || !data.cues || data.cues.length !== transcript.length) {
        share.uncounted += 1;
        continue;
      }
      const voiceOf = new Map(voices.map((voice) => [voice.role, voice.character]));
      transcript.forEach((turn, index) => {
        const cue = data.cues![index]!;
        const ms = cue.end_ms - cue.start_ms;
        if (castVoices.has(voiceOf.get(turn.speaker) ?? '')) share.castMs += ms;
        else share.walkOnMs += ms;
      });
    }
    return [share];
  });
}
