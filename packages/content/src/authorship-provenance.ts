import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
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

const currentTopicRecordSchema = z
  .object({
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
  })
  .superRefine((record, ctx) => {
    if (record.humanReview.status === 'complete' && record.aiAssistance.tools.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['aiAssistance', 'tools'],
        message: 'must name at least one drafting tool before human review is complete',
      });
    }
  });

export const authorshipManifestSchema = z.object({
  version: z.literal(1),
  topics: z.array(z.union([legacyTopicRecordSchema, currentTopicRecordSchema])),
});
export type AuthorshipManifest = z.infer<typeof authorshipManifestSchema>;

// Frozen on 2026-07-26. These topics predate the provenance workflow; no later topic may
// inherit their exemption by changing a mutable manifest flag.
export const LEGACY_TOPIC_IDS = new Set([
  'erfahrungen-erzaehlen',
  'leben-veraendern',
  'gesundheit-wohlbefinden',
]);

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
    if (record.legacy !== LEGACY_TOPIC_IDS.has(record.topic)) {
      problems.push(
        `data/authorship-provenance.yaml: "${record.topic}" legacy flag disagrees with the frozen B1.1–B1.3 allowlist`,
      );
    }
    if (
      !LEGACY_TOPIC_IDS.has(record.topic) &&
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

const assetChangeSchema = z.object({
  sha256,
  changedAt: z.iso.date(),
  tool: nonEmpty,
  brief: nonEmpty,
  humanEdits: z.array(nonEmpty).min(1),
});

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
    changes: z.array(assetChangeSchema).default([]),
  })
  .superRefine((asset, ctx) => {
    if (!asset.legacy && asset.promptUnavailable) {
      ctx.addIssue({ code: 'custom', message: 'new assets cannot use promptUnavailable' });
    }
    if (!asset.legacy && asset.creationMode !== 'human-authored') {
      if (!asset.generationTool)
        ctx.addIssue({ code: 'custom', path: ['generationTool'], message: 'is required for a new AI-assisted asset' });
      if (!asset.prompt)
        ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'or an approved brief is required for a new AI-assisted asset' });
      if (asset.humanEdits.length === 0)
        ctx.addIssue({ code: 'custom', path: ['humanEdits'], message: 'must record subsequent composition or editing for a new AI-assisted asset' });
    }
    if (!asset.legacy && asset.creationMode === 'ai-generated-base') {
      if (!asset.candidateCount)
        ctx.addIssue({ code: 'custom', path: ['candidateCount'], message: 'is required for a new generated base' });
      if (!asset.humanSelectionReason)
        ctx.addIssue({ code: 'custom', path: ['humanSelectionReason'], message: 'is required for a new generated base' });
    }
    if (!asset.legacy && asset.candidateCount && !asset.humanSelectionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['humanSelectionReason'],
        message: 'is required whenever candidates were selected',
      });
    }
  });

export const assetProvenanceManifestSchema = z.object({
  version: z.literal(1),
  assets: z.array(assetRecordSchema),
});
export type AssetProvenanceManifest = z.infer<typeof assetProvenanceManifestSchema>;

// Frozen on 2026-07-26. These are the pre-workflow bytes, not merely a path
// allowlist. A legacy path whose current hash diverges owes a matching change
// record, so unavailable creation history never exempts later edits.
export const LEGACY_ASSET_BASELINE_SHA256: Readonly<Record<string, string>> = {
  'public/discovery/berlin-ubahn-karte.svg': '2b5d58ab0b2d4c34ed98f9ce1341b153d41010f70490e10cdc515782951af391',
  'public/discovery/schrebergaerten.webp': '04a53cf7fa2c4c1d3d636d85c31c53bb87f546c7136ff6afd54b56067818075e',
  'public/documents/a2/aemter-anmeldung-formular.svg': '247c25e7e8723bb624dcfb8038266ebbed7979aa2114840699079dbae638b7b8',
  'public/documents/a2/einkaufen-kassenbon-vergleich.svg': '994d899c03321fb89f970494ec3e49726b3f360a2f9818320d6acf995e85e6f6',
  'public/documents/a2/reisen-zugausfall.svg': 'f5d26465ef19ebb23c70228618601b86dd4ab6fc04d311d9c7b317332cbe26e0',
  'public/documents/a2/wohnen-wohnungsanzeige.svg': '1c27215b33de6bfb0a6d22921b71935d95e979d00382c02bf2cef7bc373706be',
  'src/assets/illustrations/a2/wohnen-position-carpet.webp': 'd3608f4f66d93c004bcb673966c7f187188dec9ccf26a73774560520954411cd',
  'src/assets/illustrations/a2/wohnen-position-lamp.webp': '6ab98b5887bc47330a74f625445b3da69b6ce69e6a9adf28ab0fa1a281f70fac',
  'src/assets/illustrations/a2/wohnen-position-picture.webp': '37d54ff828b4a78cb38a6628ba8f6caaee1091a618e7d0488fdbed8b8093f9ee',
  'src/assets/illustrations/a2/wohnen-position-verbs.webp': '2e4636bfb4c38bede12582b5ad74625b19109024a8a1b2e59250594f6a697407',
  'src/assets/illustrations/a2/wohnen-wo-wohin-action.webp': '06df2bd37387f17c5d6856b21d4c5b5ea0de65ae9dc30b5ac0ad152898e65c15',
  'src/assets/illustrations/a2/wohnen-wo-wohin-state.webp': 'e95d2855fdb038132db1d970d47f651e56089776d85b36ca78ced3d7619906ed',
  'src/assets/illustrations/a2/wohnen-wo-wohin.webp': '2f1b8e427dd8fb16c4247d3cabd60bdcb20ffcdef3384593f2f275c901a744fa',
  'src/components/visuals/AdministrativeLetterFigure.astro': '1b9364af26feaab77088e311622c0119d8147b3c3e208adde3c47ac4dc0d0486',
  'src/components/visuals/ParticipantRoleFigure.astro': '886a28e666646324df8783f4a12ce5d2f102901b712f216ea307b9b299d1edef',
  'src/components/visuals/RouteMovementFigure.astro': 'e175b17aa93aa43ef2698fc169632866d6fbe0c8362fb506d96578b4795f3d8d',
  'src/components/visuals/SentenceRail.astro': '5f17aaac6d1b78de170ac73f2ac90bf128eedef42168bed7a785be54ed051d80',
  'src/components/visuals/TimeRelationFigure.astro': '1e60feaa0590fd3b2b49040648cabef7637f0ffbf6103504bf210b65d8957915',
  'src/components/visuals/WohnenWoWohin.astro': 'd1f8c1d999dd8d179ecb7e08150a3e503a056b997bdb63fda52a5d0af97898da',
};
export const LEGACY_ASSET_PATHS = new Set(Object.keys(LEGACY_ASSET_BASELINE_SHA256));

type AssetRecord = AssetProvenanceManifest['assets'][number];

const CANONICAL_TEXT_ASSET_EXTENSIONS = new Set(['.astro', '.svg']);

export function assetSha256(path: string): string {
  const bytes = readFileSync(path);
  const canonical =
    CANONICAL_TEXT_ASSET_EXTENSIONS.has(extname(path).toLowerCase())
      ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
      : bytes;
  return createHash('sha256').update(canonical).digest('hex');
}

export function archivedPromptPathProblem(root: string, prompt: string): string | undefined {
  const archive = resolve(root, 'data/prompts');
  const candidate = resolve(root, prompt);
  const lexicalRelative = relative(archive, candidate);
  if (lexicalRelative.startsWith(`..${sep}`) || lexicalRelative === '..') {
    return `"${prompt}" must stay under data/prompts/`;
  }
  if (!existsSync(candidate)) return `"${prompt}" does not resolve`;
  const realRelative = relative(realpathSync(archive), realpathSync(candidate));
  if (realRelative.startsWith(`..${sep}`) || realRelative === '..') {
    return `"${prompt}" resolves outside data/prompts/`;
  }
  if (!statSync(candidate).isFile()) return `"${prompt}" must resolve to a file`;
  return undefined;
}

export function legacyAssetChangeProblems(asset: AssetRecord): string[] {
  const baseline = LEGACY_ASSET_BASELINE_SHA256[asset.path];
  if (!baseline || asset.sha256 === baseline) return [];
  const matchingChange = asset.changes.find((change) => change.sha256 === asset.sha256);
  return matchingChange
    ? []
    : [
        `data/asset-provenance.yaml: changed legacy asset "${asset.path}" needs a change record for SHA-256 ${asset.sha256}`,
      ];
}

function filesRecursively(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((file) => join(dir, file));
}

function parseFrontmatter(file: string): Record<string, unknown> | undefined {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? (YAML.parse(match[1]!) as Record<string, unknown>) : undefined;
}

export const isLearningFigureComponent = (source: string): boolean => /<LearningFigure\b/.test(source);

export function simulatedInstructionalAssetPaths(root: string): string[] {
  const paths = new Set<string>();
  const addPublic = (asset: string) => paths.add(`public/${asset.replace(/^\/+/, '')}`);

  for (const file of filesRecursively(join(root, 'src/assets/illustrations'))) {
    // This directory is reserved for course-created illustration assets. Treat
    // the directory, not a format allowlist, as the provenance boundary so a
    // future SVG, AVIF, or other supported format cannot bypass the manifest.
    if (statSync(file).isFile()) paths.add(relative(root, file).split(sep).join('/'));
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
    // A visual may spell the prop as a quoted attribute, an Astro expression, or a
    // forwarded variable. The wrapper call itself is the durable boundary: every
    // instructional visual component using LearningFigure owes a provenance record,
    // regardless of sourceClass serialization.
    if (isLearningFigureComponent(readFileSync(file, 'utf8')))
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
      problems.push(...legacyAssetChangeProblems(asset));
      const absolute = join(root, asset.path);
      if (!existsSync(absolute)) {
        problems.push(`data/asset-provenance.yaml: "${asset.path}" does not resolve`);
        continue;
      }
      const actual = assetSha256(absolute);
      if (actual !== asset.sha256)
        problems.push(`data/asset-provenance.yaml: "${asset.path}" SHA-256 is stale`);
      if (asset.prompt) {
        const promptProblem = archivedPromptPathProblem(root, asset.prompt);
        if (promptProblem)
          problems.push(
            `data/asset-provenance.yaml: prompt for "${asset.path}" ${promptProblem}`,
          );
      }
      for (const change of asset.changes) {
        const briefProblem = archivedPromptPathProblem(root, change.brief);
        if (briefProblem)
          problems.push(
            `data/asset-provenance.yaml: change brief for "${asset.path}" ${briefProblem}`,
          );
      }
    }

    const expected = simulatedInstructionalAssetPaths(root);
    for (const path of expected)
      if (!entries.has(path)) problems.push(`data/asset-provenance.yaml: missing simulated/generated asset "${path}"`);
    for (const path of entries.keys())
      if (!expected.includes(path)) problems.push(`data/asset-provenance.yaml: "${path}" is not a current simulated/generated asset`);
  }

  return problems;
}
