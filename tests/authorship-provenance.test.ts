import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import {
  assetSha256,
  archivedPromptPathProblem,
  assetProvenanceManifestSchema,
  authorshipManifestSchema,
  authorshipProvenanceProblems,
  isLearningFigureComponent,
  LEGACY_ASSET_PATHS,
  LEGACY_ASSET_BASELINE_SHA256,
  LEGACY_TOPIC_IDS,
  legacyAssetChangeProblems,
  reviewedTopicAuthorshipProblems,
  simulatedInstructionalAssetPaths,
} from '../src/lib/authorship-provenance';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverySchema, visualDocumentSchema } from '../src/lib/schemas';

const root = resolve(import.meta.dir, '..');

describe('authorship provenance', () => {
  test('text asset hashes are stable across LF and CRLF checkouts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-provenance-'));
    const lf = join(dir, 'figure-lf.svg');
    const crlf = join(dir, 'figure-crlf.svg');
    try {
      writeFileSync(lf, '<svg>\n  <text>Deutsch</text>\n</svg>\n');
      writeFileSync(crlf, '<svg>\r\n  <text>Deutsch</text>\r\n</svg>\r\n');
      expect(assetSha256(lf)).toBe(assetSha256(crlf));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every file format in the illustrations directory enters the provenance boundary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-illustrations-'));
    try {
      const illustrations = join(dir, 'src/assets/illustrations/a2');
      mkdirSync(illustrations, { recursive: true });
      writeFileSync(join(illustrations, 'diagram.svg'), '<svg />');
      writeFileSync(join(illustrations, 'scene.avif'), 'fixture');
      expect(simulatedInstructionalAssetPaths(dir)).toEqual([
        'src/assets/illustrations/a2/diagram.svg',
        'src/assets/illustrations/a2/scene.avif',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('asset prompts and briefs must be real files inside the prompt archive', () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-prompts-'));
    try {
      const archive = join(dir, 'data/prompts');
      mkdirSync(archive, { recursive: true });
      writeFileSync(join(archive, 'brief.md'), '# Brief\n');
      writeFileSync(join(dir, 'README.md'), '# Not a prompt\n');
      symlinkSync(join(dir, 'README.md'), join(archive, 'escaped.md'));
      expect(archivedPromptPathProblem(dir, 'data/prompts/brief.md')).toBeUndefined();
      expect(archivedPromptPathProblem(dir, 'README.md')).toContain(
        'must stay under data/prompts/',
      );
      expect(archivedPromptPathProblem(dir, 'data/prompts/escaped.md')).toContain(
        'resolves outside data/prompts/',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  test('completed non-legacy review requires the actual drafting tool', () => {
    const raw = YAML.parse(
      readFileSync(resolve(root, 'data/authorship-provenance.yaml'), 'utf8'),
    ) as { topics: Array<Record<string, unknown>> };
    const b14 = raw.topics.find((topic) => topic.topic === 'arbeit-bewerbung');
    if (!b14) throw new Error('missing B1.4 record');
    b14.humanReview = {
      status: 'complete',
      substantiveContributions: ['Vitaly selected and rewrote the final scenario sequence.'],
      reviewedAt: '2026-07-26',
    };

    const result = authorshipManifestSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path.includes('tools'))).toBe(true);
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

  test('only the frozen B1.1–B1.3 records can use the legacy exemption', () => {
    const manifest = authorshipManifestSchema.parse(
      YAML.parse(readFileSync(resolve(root, 'data/authorship-provenance.yaml'), 'utf8')),
    );
    expect(manifest.topics.filter((topic) => topic.legacy).map((topic) => topic.topic).sort()).toEqual(
      [...LEGACY_TOPIC_IDS].sort(),
    );

    const forged = structuredClone(manifest);
    const b14 = forged.topics.find((topic) => topic.topic === 'arbeit-bewerbung');
    if (!b14) throw new Error('missing B1.4 record');
    Object.assign(b14, {
      legacy: true,
      historyUnavailable: true,
      humanReview: { status: 'pending', substantiveContributions: [], reviewedAt: null },
    });
    const parsed = authorshipManifestSchema.parse(forged);
    expect(
      reviewedTopicAuthorshipProblems(parsed, new Map([['arbeit-bewerbung', 'reviewed']])),
    ).toEqual(
      expect.arrayContaining([
        'data/authorship-provenance.yaml: "arbeit-bewerbung" legacy flag disagrees with the frozen B1.1–B1.3 allowlist',
        'data/authorship-provenance.yaml: reviewed topic "arbeit-bewerbung" requires explicit completed human review',
      ]),
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

  test('a changed legacy asset needs provenance for its current hash', () => {
    const manifest = assetProvenanceManifestSchema.parse(
      YAML.parse(readFileSync(resolve(root, 'data/asset-provenance.yaml'), 'utf8')),
    );
    const participant = manifest.assets.find(
      (asset) => asset.path === 'src/components/visuals/ParticipantRoleFigure.astro',
    );
    if (!participant) throw new Error('missing participant-role provenance');
    expect(participant.sha256).not.toBe(LEGACY_ASSET_BASELINE_SHA256[participant.path]);
    expect(legacyAssetChangeProblems(participant)).toEqual([]);
    expect(
      legacyAssetChangeProblems({
        ...participant,
        sha256: 'b'.repeat(64),
      }),
    ).toContain(
      `data/asset-provenance.yaml: changed legacy asset "${participant.path}" needs a change record for SHA-256 ${'b'.repeat(64)}`,
    );
  });

  test('new AI-assisted assets retain their tool, brief and human edits', () => {
    const incomplete = {
      version: 1,
      assets: [
        {
          path: 'src/components/visuals/FutureFigure.astro',
          sha256: 'a'.repeat(64),
          creationMode: 'ai-assisted',
          generationTool: null,
          prompt: null,
          candidateCount: null,
          humanSelectionReason: null,
          humanEdits: [],
          licenseReview: 'Reviewed for CC BY-SA course distribution.',
          legacy: false,
          promptUnavailable: false,
        },
      ],
    };
    expect(assetProvenanceManifestSchema.safeParse(incomplete).success).toBe(false);
    expect(
      assetProvenanceManifestSchema.safeParse({
        ...incomplete,
        assets: [
          {
            ...incomplete.assets[0],
            generationTool: 'Anthropic Claude',
            prompt: 'data/prompts/2026-07-26-future-figure.md',
            humanEdits: ['Vitaly chose the final relation and rewrote every instructional label.'],
          },
        ],
      }).success,
    ).toBe(true);
  });

  test('visual discovery does not depend on sourceClass prop serialization', () => {
    expect(isLearningFigureComponent('<LearningFigure sourceClass="simulated">')).toBe(true);
    expect(isLearningFigureComponent("<LearningFigure sourceClass={'simulated'}>")).toBe(true);
    expect(isLearningFigureComponent('<LearningFigure sourceClass={sourceClass}>')).toBe(true);
    expect(isLearningFigureComponent('<figure sourceClass="simulated">')).toBe(false);
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
