/**
 * `bun run characters:import` (ADR 0021): which original is the portrait, which a scene and which
 * is skipped, and that the provenance it writes is valid and written once.
 */
import { describe, expect, test } from 'bun:test';
import YAML from 'yaml';
import { assetProvenanceManifestSchema } from '@da/content/authorship-provenance';
import {
  classifyImages,
  promptNames,
  provenanceBlock,
  upsertProvenance,
  type ProvenanceEntry,
} from '../scripts/characters-import';

describe('naming', () => {
  test('the portrait and the scenes, scenes in number order', () => {
    expect(classifyImages('lena', ['lena-10.png', 'lena.png', 'lena-2.png', 'lena-1.png'])).toEqual(
      {
        portrait: 'lena.png',
        scenes: [
          { file: 'lena-1.png', stem: 'lena-1' },
          { file: 'lena-2.png', stem: 'lena-2' },
          { file: 'lena-10.png', stem: 'lena-10' },
        ],
        skipped: [],
      },
    );
  });

  test('a folder with scenes and no portrait yet', () => {
    const found = classifyImages('frau-kern', ['frau-kern-1.png']);
    expect(found.portrait).toBeUndefined();
    expect(found.scenes).toEqual([{ file: 'frau-kern-1.png', stem: 'frau-kern-1' }]);
  });

  test('anything off the naming is skipped with its reason, never guessed at', () => {
    const found = classifyImages('lena', [
      'Lena.png',
      'lena_1.png',
      'lena-0.png',
      'lena-01.png',
      'mira.png',
      'lena-1 copy.png',
      'notes.txt',
      '.DS_Store',
    ]);
    expect(found.portrait).toBeUndefined();
    expect(found.scenes).toEqual([]);
    expect(found.skipped.map((skip) => skip.file)).toEqual([
      'Lena.png',
      'lena-0.png',
      'lena-01.png',
      'lena-1 copy.png',
      'lena_1.png',
      'mira.png',
      'notes.txt',
    ]);
    expect(found.skipped.find((skip) => skip.file === 'notes.txt')!.reason).toContain('not a PNG');
  });

  test('a JPEG original is read, but two originals for one WebP are both skipped', () => {
    expect(classifyImages('timo', ['timo.jpg']).portrait).toBe('timo.jpg');
    const found = classifyImages('timo', ['timo-1.png', 'timo-1.jpg']);
    expect(found.scenes).toEqual([]);
    expect(found.skipped).toHaveLength(2);
    expect(found.skipped[0]!.reason).toContain('would both be timo-1.webp');
  });

  test('a character is imported only when the prompt file names it', () => {
    expect(promptNames('- `lena` — a woman of 24', 'lena')).toBe(true);
    expect(promptNames('- `lena` — a woman of 24', 'mira')).toBe(false);
    // `lena` must not stand in for an id that merely contains it
    expect(promptNames('- `lena` — a woman of 24', 'len')).toBe(false);
  });
});

describe('provenance', () => {
  const entry: ProvenanceEntry = {
    path: 'public/characters/lena/lena-1.webp',
    sha256: 'a'.repeat(64),
    id: 'lena',
    kind: 'scene',
    file: 'lena-1.png',
  };
  const manifest = 'version: 1\nassets:\n  - path: public/other.svg\n    sha256: ' + '0'.repeat(64);

  test('a new record satisfies the manifest schema', () => {
    const block = YAML.parse(`version: 1\nassets:\n${provenanceBlock(entry)}\n`);
    expect(assetProvenanceManifestSchema.safeParse(block).success).toBe(true);
  });

  test('importing twice writes the record once; a new hash replaces only the hash', () => {
    const once = upsertProvenance(manifest, [entry]);
    expect(upsertProvenance(once, [entry])).toBe(once);
    const changed = upsertProvenance(once, [{ ...entry, sha256: 'b'.repeat(64) }]);
    expect(changed).toBe(once.replace('a'.repeat(64), 'b'.repeat(64)));
    expect(changed.match(/lena-1\.webp/g)).toHaveLength(1);
  });

  test('a record the owner edited keeps his words when the image is re-imported', () => {
    const edited = upsertProvenance(manifest, [entry]).replace(
      /humanEdits:\n {6}- ".*"/,
      'humanEdits:\n      - "Vitaly cropped it himself."',
    );
    expect(upsertProvenance(edited, [{ ...entry, sha256: 'c'.repeat(64) }])).toContain(
      'Vitaly cropped it himself.',
    );
  });
});
