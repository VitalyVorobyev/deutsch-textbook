import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bundlesAudio, listeningAudioUrl, listeningCuesUrl } from '../src/lib/audio';
import { reviewedRecordings, sendAudio } from '../src/integrations/audio-bundle';
import { listeningAudioPath } from '@da/schema';

/**
 * The build split is the only reason the same content tree can serve a 40 MB desktop bundle
 * and a public demo that ships no audio at all. Both halves are asserted here, because the
 * failure mode of each is silent: a Pages build that quietly carries every recording, or a desktop
 * build whose items quietly fall back to TTS.
 */

function artifact(root: string, id: string, level: string, withAudio: boolean, cues = '') {
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
      cues,
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
    for (const off of [undefined, '', '0', 'false', 'yes', 'no'])
      expect(bundlesAudio(off)).toBe(false);
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

  test('a recording carries the cues its record states, and none when it states none', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-audio-'));
    artifact(
      root,
      'ls-cued-01',
      'A1',
      true,
      'cue_source: whisper-aligned\ncues:\n- start_ms: 0\n  end_ms: 1800\n',
    );
    artifact(root, 'ls-uncued-01', 'A1', true);

    const [cued, uncued] = reviewedRecordings(root);
    expect(cued!.cues).toEqual([{ start_ms: 0, end_ms: 1800 }]);
    expect(uncued!.cues).toBeUndefined();
    expect(listeningCuesUrl('ls-cued-01')).toBe('/audio/ls-cued-01.cues.json');
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

describe('the dev server serves audio in byte ranges', () => {
  function respond(range: string | undefined) {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      body: undefined as Buffer | undefined,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end(body?: Buffer) {
        this.body = body;
      },
    };
    sendAudio(range, Buffer.from('0123456789'), res);
    return { status: res.statusCode, body: res.body?.toString(), headers };
  }

  test('a ranged request gets exactly those bytes, which is what makes a seek possible', () => {
    expect(respond('bytes=2-5')).toMatchObject({
      status: 206,
      body: '2345',
      headers: { 'Content-Range': 'bytes 2-5/10', 'Accept-Ranges': 'bytes' },
    });
    expect(respond('bytes=7-').body).toBe('789');
    expect(respond('bytes=-3').body).toBe('789');
  });

  test('a whole request still says ranges are accepted, and a range past the end is refused', () => {
    expect(respond(undefined)).toMatchObject({ status: 200, body: '0123456789' });
    expect(respond(undefined).headers['Accept-Ranges']).toBe('bytes');
    expect(respond('bytes=20-30').status).toBe(416);
  });
});
