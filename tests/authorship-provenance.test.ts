import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import {
  assetProvenanceManifestSchema,
  authorshipManifestSchema,
  authorshipProvenanceProblems,
  LEGACY_ASSET_PATHS,
  reviewedTopicAuthorshipProblems,
  simulatedInstructionalAssetPaths,
} from '../src/lib/authorship-provenance';
import { discoverySchema, visualDocumentSchema } from '../src/lib/schemas';

const root = resolve(import.meta.dir, '..');

describe('authorship provenance', () => {
  test('the current manifests cover every asset and have fresh hashes', () => {
    const statuses = new Map([
      ['erfahrungen-erzaehlen', 'reviewed'],
      ['leben-veraendern', 'reviewed'],
      ['gesundheit-wohlbefinden', 'reviewed'],
    ]);
    expect(
      authorshipProvenanceProblems(root, statuses, [
        'erfahrungen-erzaehlen',
        'leben-veraendern',
        'gesundheit-wohlbefinden',
      ]),
    ).toEqual([]);
    expect(simulatedInstructionalAssetPaths(root)).toEqual([...LEGACY_ASSET_PATHS].sort());
  });

  test('B1.4+ cannot become reviewed while human review is pending', () => {
    const manifest = authorshipManifestSchema.parse(
      YAML.parse(readFileSync(resolve(root, 'data/authorship-provenance.yaml'), 'utf8')),
    );
    expect(reviewedTopicAuthorshipProblems(manifest, new Map([['arbeit-bewerbung', 'reviewed']]))).toContain(
      'data/authorship-provenance.yaml: reviewed topic "arbeit-bewerbung" requires explicit completed human review',
    );
  });

  test('every future B1 topic needs a record even while it is a draft', () => {
    const manifest = authorshipManifestSchema.parse(
      YAML.parse(readFileSync(resolve(root, 'data/authorship-provenance.yaml'), 'utf8')),
    );
    expect(
      reviewedTopicAuthorshipProblems(
        manifest,
        new Map([['future-b1-topic', 'draft']]),
        ['future-b1-topic'],
      ),
    ).toContain(
      'data/authorship-provenance.yaml: B1.4+ topic "future-b1-topic" has no authorship record',
    );
  });

  test('legacy exemptions are a frozen path allowlist', () => {
    const manifest = assetProvenanceManifestSchema.parse(
      YAML.parse(readFileSync(resolve(root, 'data/asset-provenance.yaml'), 'utf8')),
    );
    expect(manifest.assets.filter((asset) => asset.legacy).map((asset) => asset.path).sort()).toEqual(
      [...LEGACY_ASSET_PATHS].sort(),
    );
  });

  test('simulated remains provenance, not an originality or copyright field', () => {
    const document = visualDocumentSchema.parse({
      topic: 'test',
      level: 'A2',
      title_de: 'Test',
      genre: 'form',
      sourceClass: 'simulated',
      asset: '/test.svg',
      description: { en: 'Test', ru: 'Тест' },
      transcript: ['Test'],
    });
    const discovery = discoverySchema.parse({
      id: 'test',
      level: 'A2',
      title_de: 'Test',
      title_en: 'Test',
      title_ru: 'Тест',
      topics: ['test'],
      summary: { en: 'Test', ru: 'Тест' },
      images: [{ src: '/test.svg', alt: 'Test', sourceClass: 'simulated' }],
      links: [],
      status: 'reviewed',
    });

    expect(document.sourceClass).toBe('simulated');
    expect(discovery.images[0]?.sourceClass).toBe('simulated');
    expect('original' in document || 'copyrighted' in document).toBe(false);
  });
});
