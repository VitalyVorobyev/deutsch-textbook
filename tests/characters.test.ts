/**
 * The recurring cast (ADR 0016): each of the four checks fails on the break it exists for, a
 * clean fixture passes, and the registry's debt lists cannot grow.
 */
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { characterProblems, loadSpeakerRegistry, voiceShare } from '@da/content/characters';
import { repoRoot } from '@da/content/repo-root';

type Files = Record<string, string>;

const LENA = `id: lena
name: Lena
voice: lena
age_band: young-adult
facts:
  - de: Lena kommt aus Polen.
    source: reading:a1/lena-1
relations: []
appearances:
  - reading:a1/lena-1
  - listening:ls-x-01
`;

const REGISTRY = `version: 1
roles: [Durchsage]
legacy_names: [Ben]
continuity_pending: []
recast_pending: []
`;

/** A corpus in which every check passes: one cast member, one role, one legacy name. */
const CLEAN: Files = {
  'data/listening-characters.yaml': 'characters:\n  - id: lena\n  - id: jonas\n',
  'content/characters/lena.yaml': LENA,
  'data/speaker-registry.yaml': REGISTRY,
  'content/reading/a1/lena-1.yaml': 'text:\n  - Lena kommt aus Polen.\n',
  'content/listening/a1/ls-x-01.yaml': `speakers: [Lena, Ben, Durchsage]
transcript:
  - speaker: Durchsage
    text: Achtung.
  - speaker: Lena
    text: Hallo.
  - speaker: Ben
    text: Hallo, Lena.
cues:
  - {start_ms: 0, end_ms: 1000}
  - {start_ms: 1000, end_ms: 3000}
  - {start_ms: 3000, end_ms: 4000}
`,
  'data/audio-provenance/a1/ls-x-01.json': JSON.stringify({
    voices: [
      { character: 'lena', role: 'Lena' },
      { character: 'jonas', role: 'Ben' },
      { character: 'jonas', role: 'Durchsage' },
    ],
  }),
};

function checkout(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'characters-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const problems = (overrides: Files) => characterProblems(checkout({ ...CLEAN, ...overrides }));

describe('a clean cast', () => {
  test('passes every check', () => {
    expect(problems({})).toEqual([]);
  });

  test('voice share counts each turn by its voice', () => {
    const [a1] = voiceShare(checkout(CLEAN));
    expect(a1).toEqual({ level: 'A1', castMs: 2000, walkOnMs: 2000, uncounted: 0 });
  });
});

describe('1. a record resolves', () => {
  test('a voice not on the roster', () => {
    expect(
      problems({ 'content/characters/lena.yaml': LENA.replace('voice: lena', 'voice: x') }),
    ).toContainEqual(expect.stringContaining('is not on the roster'));
  });

  test('two people in one voice', () => {
    const mira = LENA.replace('id: lena', 'id: mira').replace('name: Lena', 'name: Mira');
    expect(problems({ 'content/characters/mira.yaml': mira })).toContainEqual(
      expect.stringContaining('already speaks Lena'),
    );
  });

  test('a ref to a file that does not exist', () => {
    const record = LENA.replace('source: reading:a1/lena-1', 'source: reading:a1/gibt-es-nicht');
    expect(problems({ 'content/characters/lena.yaml': record })).toContainEqual(
      expect.stringContaining('reading:a1/gibt-es-nicht names no shipped file'),
    );
  });

  test('a relation to nobody', () => {
    const record = LENA.replace(
      'relations: []',
      'relations:\n  - with: timo\n    de: Freund\n    source: reading:a1/lena-1',
    );
    expect(problems({ 'content/characters/lena.yaml': record })).toContainEqual(
      expect.stringContaining('names no character record'),
    );
  });
});

describe('2. every speaker is known', () => {
  test('a new named speaker', () => {
    expect(
      problems({ 'data/speaker-registry.yaml': REGISTRY.replace('[Ben]', '[]') }),
    ).toContainEqual(
      expect.stringContaining('speaker "Ben" is no cast member, role or legacy name'),
    );
  });

  test('a registry name nobody speaks any more', () => {
    expect(
      problems({ 'data/speaker-registry.yaml': REGISTRY.replace('[Ben]', '[Ben, Tom]') }),
    ).toContainEqual(expect.stringContaining('"Tom" is no longer a speaker'));
  });

  test('a scripted exercise turn counts as a speaker', () => {
    const set =
      'items:\n  - source:\n      turns:\n        - speaker: Kata\n          text: Hallo.\n';
    expect(problems({ 'content/exercises/a1/set.yaml': set })).toContainEqual(
      expect.stringContaining('exercise:a1/set: speaker "Kata"'),
    );
  });
});

describe('3. a cast name is checked against its record', () => {
  test('a reading naming the cast member that nobody checked', () => {
    expect(
      problems({ 'content/reading/a1/other.yaml': 'text:\n  - Lenas Freundin wohnt hier.\n' }),
    ).toContainEqual(expect.stringContaining('reading:a1/other: "Lena" is not checked'));
  });

  test('waiting in continuity_pending is allowed', () => {
    const registry = REGISTRY.replace(
      'continuity_pending: []',
      'continuity_pending:\n  - name: Lena\n    refs: [reading:a1/other]',
    );
    expect(
      problems({
        'content/reading/a1/other.yaml': 'text:\n  - Lena wohnt hier.\n',
        'data/speaker-registry.yaml': registry,
      }),
    ).toEqual([]);
  });

  test('an appearance that no longer names the person', () => {
    expect(
      problems({ 'content/reading/a1/lena-1.yaml': 'text:\n  - Eine Frau kommt.\n' }),
    ).toContainEqual(expect.stringContaining('reading:a1/lena-1 no longer names Lena'));
  });
});

describe("4. a cast member's voice speaks nobody else", () => {
  const casting = (voices: { character: string; role: string }[]) => ({
    'data/audio-provenance/a1/ls-x-01.json': JSON.stringify({ voices }),
  });

  test("the cast member's voice speaks another role", () => {
    expect(
      problems(
        casting([
          { character: 'lena', role: 'Lena' },
          { character: 'lena', role: 'Ben' },
          { character: 'jonas', role: 'Durchsage' },
        ]),
      ),
    ).toContainEqual(
      expect.stringContaining("listening:ls-x-01: its casting breaks a cast member's voice"),
    );
  });

  test('the cast member speaks in another voice', () => {
    expect(
      problems(
        casting([
          { character: 'jonas', role: 'Lena' },
          { character: 'jonas', role: 'Ben' },
          { character: 'jonas', role: 'Durchsage' },
        ]),
      ),
    ).toContainEqual(expect.stringContaining('its casting breaks'));
  });

  test('a recording in recast_pending whose casting is clean', () => {
    expect(
      problems({
        'data/speaker-registry.yaml': REGISTRY.replace(
          'recast_pending: []',
          'recast_pending: [ls-x-01]',
        ),
      }),
    ).toContainEqual(expect.stringContaining('whose casting is clean'));
  });
});

describe('the registry only shrinks', () => {
  // Each ceiling is today's count. Fixing a case lowers it. Only giving a cast member a voice
  // raises the recast ceiling, in the change that gives it.
  const registry = loadSpeakerRegistry(repoRoot());

  test('legacy names', () => {
    expect(registry.legacy_names.length).toBeLessThanOrEqual(104);
  });

  test('places waiting for a continuity check', () => {
    const refs = registry.continuity_pending.reduce((sum, entry) => sum + entry.refs.length, 0);
    expect(refs).toBeLessThanOrEqual(35);
  });

  test('recordings waiting for a recast', () => {
    expect(registry.recast_pending.length).toBeLessThanOrEqual(52);
  });
});
