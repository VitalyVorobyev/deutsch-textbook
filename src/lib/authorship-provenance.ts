import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmpty = z.string().min(1);

const reviewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    substantiveContributions: z.array(nonEmpty),
    reviewedAt: z.null(),
  }),
  z.object({
    status: z.literal('complete'),
    substantiveContributions: z.array(nonEmpty).min(1),
    reviewedAt: z.iso.date(),
  }),
]);

const aiAssistanceSchema = z.object({
  tools: z.array(nonEmpty),
  role: z.literal('drafting'),
  toolHistoryUnavailable: z.boolean().optional(),
});

const legacyTopicRecordSchema = z.object({
  topic: nonEmpty,
  humanEditor: z.literal('Vitaly Vorobyev'),
  legacy: z.literal(true),
  historyUnavailable: z.literal(true),
  aiAssistance: aiAssistanceSchema,
  humanReview: reviewSchema,
});

const currentTopicRecordSchema = z.object({
  topic: nonEmpty,
  humanEditor: z.literal('Vitaly Vorobyev'),
  legacy: z.literal(false),
  approvedBrief: z.object({
    curriculumSection: nonEmpty,
    approvedBy: z.literal('Vitaly Vorobyev'),
    approvedAt: z.iso.date(),
    creativeChoices: z.array(nonEmpty).min(3),
  }),
  aiAssistance: aiAssistanceSchema,
  humanReview: reviewSchema,
});

export const authorshipManifestSchema = z.object({
  version: z.literal(1),
  topics: z.array(z.union([legacyTopicRecordSchema, currentTopicRecordSchema])),
});
export type AuthorshipManifest = z.infer<typeof authorshipManifestSchema>;

export function reviewedTopicAuthorshipProblems(
  manifest: AuthorshipManifest,
  topicStatuses: ReadonlyMap<string, string>,
  b1TopicIds: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const record of manifest.topics) {
    if (seen.has(record.topic)) problems.push(`data/authorship-provenance.yaml: duplicate topic "${record.topic}"`);
    seen.add(record.topic);
    if (
      !record.legacy &&
      topicStatuses.get(record.topic) === 'reviewed' &&
      record.humanReview.status !== 'complete'
    ) {
      problems.push(
        `data/authorship-provenance.yaml: reviewed topic "${record.topic}" requires explicit completed human review`,
      );
    }
  }
  for (const topic of ['erfahrungen-erzaehlen', 'leben-veraendern', 'gesundheit-wohlbefinden', 'arbeit-bewerbung', 'meinung-medien']) {
    if (!seen.has(topic)) problems.push(`data/authorship-provenance.yaml: missing B1 record "${topic}"`);
  }
  for (const topic of b1TopicIds) {
    if (!seen.has(topic))
      problems.push(`data/authorship-provenance.yaml: B1.4+ topic "${topic}" has no authorship record`);
  }
  return problems;
}

const assetRecordSchema = z
  .object({
    path: nonEmpty,
    sha256,
    creationMode: z.enum(['human-authored', 'ai-assisted', 'ai-generated-base']),
    generationTool: nonEmpty.nullable(),
    prompt: nonEmpty.nullable(),
    candidateCount: z.number().int().positive().nullable(),
    humanSelectionReason: nonEmpty.nullable(),
    humanEdits: z.array(nonEmpty),
    licenseReview: nonEmpty,
    legacy: z.boolean(),
    promptUnavailable: z.boolean(),
  })
  .superRefine((asset, ctx) => {
    if (!asset.legacy && asset.promptUnavailable) {
      ctx.addIssue({ code: 'custom', message: 'new assets cannot use promptUnavailable' });
    }
    if (!asset.legacy && asset.creationMode === 'ai-generated-base') {
      if (!asset.generationTool)
        ctx.addIssue({ code: 'custom', path: ['generationTool'], message: 'is required for a new generated base' });
      if (!asset.prompt)
        ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'is required for a new generated base' });
      if (!asset.candidateCount)
        ctx.addIssue({ code: 'custom', path: ['candidateCount'], message: 'is required for a new generated base' });
      if (!asset.humanSelectionReason)
        ctx.addIssue({ code: 'custom', path: ['humanSelectionReason'], message: 'is required for a new generated base' });
      if (asset.humanEdits.length === 0)
        ctx.addIssue({ code: 'custom', path: ['humanEdits'], message: 'must record subsequent composition or editing for a new generated base' });
    }
  });

export const assetProvenanceManifestSchema = z.object({
  version: z.literal(1),
  assets: z.array(assetRecordSchema),
});
export type AssetProvenanceManifest = z.infer<typeof assetProvenanceManifestSchema>;

// Frozen on 2026-07-26. A new path must preserve its prompt/brief and may not be added here.
export const LEGACY_ASSET_PATHS = new Set([
  'public/discovery/berlin-ubahn-karte.svg',
  'public/discovery/schrebergaerten.webp',
  'public/documents/a2/aemter-anmeldung-formular.svg',
  'public/documents/a2/einkaufen-kassenbon-vergleich.svg',
  'public/documents/a2/reisen-zugausfall.svg',
  'public/documents/a2/wohnen-wohnungsanzeige.svg',
  'src/assets/illustrations/a2/wohnen-position-carpet.webp',
  'src/assets/illustrations/a2/wohnen-position-lamp.webp',
  'src/assets/illustrations/a2/wohnen-position-picture.webp',
  'src/assets/illustrations/a2/wohnen-position-verbs.webp',
  'src/assets/illustrations/a2/wohnen-wo-wohin-action.webp',
  'src/assets/illustrations/a2/wohnen-wo-wohin-state.webp',
  'src/assets/illustrations/a2/wohnen-wo-wohin.webp',
  'src/components/visuals/AdministrativeLetterFigure.astro',
  'src/components/visuals/ParticipantRoleFigure.astro',
  'src/components/visuals/RouteMovementFigure.astro',
  'src/components/visuals/SentenceRail.astro',
  'src/components/visuals/TimeRelationFigure.astro',
  'src/components/visuals/WohnenWoWohin.astro',
]);

function filesRecursively(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((file) => join(dir, file));
}

function parseFrontmatter(file: string): Record<string, unknown> | undefined {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? (YAML.parse(match[1]!) as Record<string, unknown>) : undefined;
}

export function simulatedInstructionalAssetPaths(root: string): string[] {
  const paths = new Set<string>();
  const addPublic = (asset: string) => paths.add(`public/${asset.replace(/^\/+/, '')}`);

  for (const file of filesRecursively(join(root, 'src/assets/illustrations'))) {
    if (/\.(?:webp|png|jpe?g)$/i.test(file)) paths.add(relative(root, file).split(sep).join('/'));
  }

  for (const file of filesRecursively(join(root, 'content/documents')).filter((f) => f.endsWith('.yaml'))) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as { sourceClass?: string; asset?: string };
    if (data.sourceClass === 'simulated' && data.asset) addPublic(data.asset);
  }

  for (const file of filesRecursively(join(root, 'content/discovery')).filter((f) => f.endsWith('.mdx'))) {
    const data = parseFrontmatter(file);
    const images = Array.isArray(data?.images) ? data.images : [];
    for (const image of images) {
      if (
        image &&
        typeof image === 'object' &&
        (image as { sourceClass?: string }).sourceClass === 'simulated' &&
        typeof (image as { src?: string }).src === 'string'
      ) {
        addPublic((image as { src: string }).src);
      }
    }
  }

  for (const file of filesRecursively(join(root, 'src/components/visuals')).filter((f) => f.endsWith('.astro'))) {
    if (readFileSync(file, 'utf8').includes('sourceClass="simulated"'))
      paths.add(relative(root, file).split(sep).join('/'));
  }

  return [...paths].sort();
}

function formatZod(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => `${prefix}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

export function authorshipProvenanceProblems(
  root: string,
  topicStatuses: ReadonlyMap<string, string>,
  b1TopicIds: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  const authorshipPath = join(root, 'data/authorship-provenance.yaml');
  const assetPath = join(root, 'data/asset-provenance.yaml');

  const authorshipResult = authorshipManifestSchema.safeParse(YAML.parse(readFileSync(authorshipPath, 'utf8')));
  if (!authorshipResult.success) {
    problems.push(...formatZod('data/authorship-provenance.yaml', authorshipResult.error));
  } else {
    problems.push(...reviewedTopicAuthorshipProblems(authorshipResult.data, topicStatuses, b1TopicIds));
  }

  const assetResult = assetProvenanceManifestSchema.safeParse(YAML.parse(readFileSync(assetPath, 'utf8')));
  if (!assetResult.success) {
    problems.push(...formatZod('data/asset-provenance.yaml', assetResult.error));
  } else {
    const entries = new Map<string, (typeof assetResult.data.assets)[number]>();
    for (const asset of assetResult.data.assets) {
      if (entries.has(asset.path)) problems.push(`data/asset-provenance.yaml: duplicate path "${asset.path}"`);
      entries.set(asset.path, asset);
      if (asset.legacy !== LEGACY_ASSET_PATHS.has(asset.path)) {
        problems.push(
          `data/asset-provenance.yaml: "${asset.path}" legacy flag disagrees with the frozen 2026-07-26 allowlist`,
        );
      }
      const absolute = join(root, asset.path);
      if (!existsSync(absolute)) {
        problems.push(`data/asset-provenance.yaml: "${asset.path}" does not resolve`);
        continue;
      }
      const actual = createHash('sha256').update(readFileSync(absolute)).digest('hex');
      if (actual !== asset.sha256)
        problems.push(`data/asset-provenance.yaml: "${asset.path}" SHA-256 is stale`);
      if (asset.prompt && !existsSync(join(root, asset.prompt)))
        problems.push(`data/asset-provenance.yaml: prompt "${asset.prompt}" for "${asset.path}" does not resolve`);
    }

    const expected = simulatedInstructionalAssetPaths(root);
    for (const path of expected)
      if (!entries.has(path)) problems.push(`data/asset-provenance.yaml: missing simulated/generated asset "${path}"`);
    for (const path of entries.keys())
      if (!expected.includes(path)) problems.push(`data/asset-provenance.yaml: "${path}" is not a current simulated/generated asset`);
  }

  return problems;
}
