import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bundlesAudio, listeningAudioUrl } from '../src/lib/audio';
import { reviewedRecordings } from '../src/integrations/audio-bundle';
import { listeningAudioPath } from '@da/schema';

/**
 * The build split is the only reason the same content tree can serve a 40 MB desktop bundle
 * and a public demo that ships no audio at all. Both halves are asserted here, because the
 * failure mode of each is silent: a Pages build that quietly carries every recording, or a desktop
 * build whose items quietly fall back to TTS.
 */

function artifact(root: string, id: string, level: string, withAudio: boolean) {
  const dir = join(root, 'content', 'listening', level.toLowerCase());
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.yaml`),
    [
      `id: ${id}`,
      `level: ${level}`,
      'title: { en: At the station, ru: На вокзале }',
      'scenario: Bahnhof',
      'duration_seconds: 20',
      'speakers: [Lea]',
      'transcript:',
      '  - { speaker: Lea, text: Der Zug fährt um neun. }',
      `provenance: data/audio-provenance/${level.toLowerCase()}/${id}.json`,
      '',
    ].join('\n'),
  );
  if (withAudio) writeFileSync(join(root, listeningAudioPath(level, id)), 'ID3-not-really-audio');
}

describe('which build ships the reviewed recordings', () => {
  test('the flag is opt-in and only 1/true turn it on', () => {
    expect(bundlesAudio('1')).toBe(true);
    expect(bundlesAudio('true')).toBe(true);
    // Anything else is off — an unset variable must never accidentally ship 40 MB of audio,
    // and a stray "0" or "false" must not read as truthy the way a bare presence check would.
    for (const off of [undefined, '', '0', 'false', 'yes', 'no']) expect(bundlesAudio(off)).toBe(false);
  });

  test('a recording counts only when its audio is actually on disk beside the record', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-audio-'));
    artifact(root, 'ls-with-wav-01', 'A1', true);
    artifact(root, 'ls-record-only-01', 'A2', false);

    const found = reviewedRecordings(root);
    expect(found.map((r) => r.id)).toEqual(['ls-with-wav-01']);
    expect(found[0]!.source).toBe('content/listening/a1/ls-with-wav-01.mp3');
    expect(found[0]!.bytes).toBeGreaterThan(0);
  });

  test('a malformed record is left to the validator rather than failing the build', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-audio-'));
    const dir = join(root, 'content', 'listening', 'a1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'broken.yaml'), 'id: broken\nlevel: NOPE\n');
    expect(reviewedRecordings(root)).toEqual([]);
  });

  test('no content/listening directory is not an error', () => {
    expect(reviewedRecordings(mkdtempSync(join(tmpdir(), 'atlas-audio-')))).toEqual([]);
  });

  test('the served URL is flat and needs no level', () => {
    // The item carries no level, so a level-scoped URL could not be built at runtime.
    // Artifact ids are globally unique by validated construction — see lib/audio.ts.
    expect(listeningAudioUrl('ls-erste-schritte-01')).toBe('/audio/ls-erste-schritte-01.mp3');
  });
});
