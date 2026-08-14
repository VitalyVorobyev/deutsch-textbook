/**
 * Source-preserving editor operations for Redaktion.
 *
 * The graph is a projection; the checked-out files remain the source of truth.
 * This module therefore writes the exact text the editor shows, never a
 * serialised object. It owns the filesystem security boundary shared by the
 * Vite development transport and the desktop sidecar.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { compile } from '@mdx-js/mdx';
import * as YAML from 'yaml';
import {
  atlasSchema,
  CEFR_LEVELS,
  discoverySchema,
  exerciseSetSchema,
  listeningArtifactSchema,
  readingSchema,
  referenceDataSchema,
  topicManifestSchema,
  visualDocumentSchema,
  vocabFileSchema,
  wordFieldSchema,
  wortnetzSchema,
} from '@da/schema';

export type SourceKind =
  | 'topic-manifest'
  | 'topic-article'
  | 'exercise-set'
  | 'reading'
  | 'vocabulary'
  | 'listening'
  | 'document'
  | 'discovery'
  | 'reference'
  | 'wortfeld'
  | 'wortnetz'
  | 'atlas'
  | 'grammar-inventory'
  | 'data'
  | 'text';

export interface Diagnostic {
  id: string;
  severity: 'blocking' | 'attention' | 'info';
  scope: 'workspace' | 'topic' | 'material' | 'source';
  entityId?: string;
  path?: string;
  message: string;
}

export interface FileSnapshot {
  path: string;
  kind: SourceKind;
  text: string;
  revision: string;
  diagnostics: Diagnostic[];
}

export interface SaveFileInput {
  path: string;
  text: string;
  expectedRevision: string;
}

export type SaveFileResult =
  | { ok: true; snapshot: FileSnapshot; changed: boolean }
  | { ok: false; conflict?: FileSnapshot; diagnostics: Diagnostic[] };

type Schema = { safeParse: (value: unknown) => { success: boolean; error?: { issues?: { path: PropertyKey[]; message: string }[] } } };

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const sourceKind = (path: string): SourceKind => {
  if (/^content\/topics\/[^/]+\/[^/]+\.topic\.yaml$/.test(path)) return 'topic-manifest';
  if (/^content\/topics\/[^/]+\/[^/]+\.mdx$/.test(path)) return 'topic-article';
  if (/^content\/exercises\/[^/]+\/[^/]+\.yaml$/.test(path)) return 'exercise-set';
  if (/^content\/reading\/[^/]+\/[^/]+\.yaml$/.test(path)) return 'reading';
  if (/^content\/vocab\/[^/]+\.yaml$/.test(path)) return 'vocabulary';
  if (/^content\/listening\/[^/]+\/[^/]+\.yaml$/.test(path)) return 'listening';
  if (/^content\/documents\/.+\.yaml$/.test(path)) return 'document';
  if (/^content\/discovery\/.+\.mdx$/.test(path)) return 'discovery';
  if (/^content\/reference-data\/.+\.yaml$/.test(path)) return 'reference';
  if (/^content\/wortfelder\/.+\.yaml$/.test(path)) return 'wortfeld';
  if (/^content\/wortnetze\/.+\.yaml$/.test(path)) return 'wortnetz';
  if (path === 'content/atlas.yaml') return 'atlas';
  if (path === 'data/grammar-inventory.yaml') return 'grammar-inventory';
  if (/^data\/.+\.(?:yaml|yml|json)$/.test(path)) return 'data';
  return 'text';
};

const schemaFor = (kind: SourceKind): Schema | undefined => ({
  'topic-manifest': topicManifestSchema,
  'exercise-set': exerciseSetSchema,
  reading: readingSchema,
  vocabulary: vocabFileSchema,
  listening: listeningArtifactSchema,
  document: visualDocumentSchema,
  reference: referenceDataSchema,
  wortfeld: wordFieldSchema,
  wortnetz: wortnetzSchema,
  atlas: atlasSchema,
} as Partial<Record<SourceKind, Schema>>)[kind];

const revisionOf = (text: string): string => createHash('sha256').update(text).digest('hex');
const cefrLevels = new Set<string>(CEFR_LEVELS);

function diagnostic(path: string, message: string): Diagnostic {
  return {
    id: `${path}:${createHash('sha1').update(message).digest('hex').slice(0, 12)}`,
    severity: 'blocking',
    scope: 'source',
    path,
    message,
  };
}

function validateGrammarInventory(path: string, value: unknown): Diagnostic[] {
  if (!value || typeof value !== 'object') return [diagnostic(path, 'grammar inventory must be a mapping')];
  const inventory = value as { tracks?: unknown; points?: unknown };
  if (!Array.isArray(inventory.tracks) || !Array.isArray(inventory.points))
    return [diagnostic(path, 'grammar inventory needs tracks and points arrays')];
  const trackIds = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  for (const [index, raw] of inventory.tracks.entries()) {
    const track = raw as Record<string, unknown>;
    if (typeof track?.id !== 'string' || !track.id) diagnostics.push(diagnostic(path, `tracks.${index}.id: required`));
    else if (trackIds.has(track.id)) diagnostics.push(diagnostic(path, `tracks.${index}.id: duplicate "${track.id}"`));
    else trackIds.add(track.id);
    for (const field of ['strand', 'title_de', 'title_en', 'order'])
      if (track?.[field] === undefined) diagnostics.push(diagnostic(path, `tracks.${index}.${field}: required`));
  }
  const pointIds = new Set<string>();
  for (const [index, raw] of inventory.points.entries()) {
    const point = raw as Record<string, unknown>;
    if (typeof point?.id !== 'string' || !point.id) diagnostics.push(diagnostic(path, `points.${index}.id: required`));
    else if (pointIds.has(point.id)) diagnostics.push(diagnostic(path, `points.${index}.id: duplicate "${point.id}"`));
    else pointIds.add(point.id);
    if (typeof point?.track !== 'string' || !trackIds.has(point.track))
      diagnostics.push(diagnostic(path, `points.${index}.track: unknown grammar track`));
    const level = point?.level as Record<string, unknown> | undefined;
    if (!level || !cefrLevels.has(String(level.reception)))
      diagnostics.push(diagnostic(path, `points.${index}.level.reception: expected A1–C2`));
    if (!level || !cefrLevels.has(String(level.production)))
      diagnostics.push(diagnostic(path, `points.${index}.level.production: expected A1–C2`));
    if (level && cefrLevels.has(String(level.reception)) && cefrLevels.has(String(level.production)) &&
        CEFR_LEVELS.indexOf(level.reception as (typeof CEFR_LEVELS)[number]) > CEFR_LEVELS.indexOf(level.production as (typeof CEFR_LEVELS)[number]))
      diagnostics.push(diagnostic(path, `points.${index}.level: reception must not follow production`));
  }
  return diagnostics;
}

/** Resolve an existing source and prove both its spelling and symlink target stay in the checkout. */
export function resolveEditableSource(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes('\\'))
    throw new Error('source path must be a repo-relative POSIX path');
  if (!/^(?:content|data)\//.test(relativePath) || !/\.(?:yaml|yml|mdx|md|txt|json)$/.test(relativePath))
    throw new Error('only existing editorial sources under content/ or data/ are writable');
  const resolvedRoot = realpathSync(root);
  const lexical = resolve(resolvedRoot, relativePath);
  if (!lexical.startsWith(resolvedRoot + sep)) throw new Error('source path escapes the selected checkout');
  if (!existsSync(lexical) || !statSync(lexical).isFile()) throw new Error('source file does not exist');
  const physical = realpathSync(lexical);
  if (!physical.startsWith(resolvedRoot + sep)) throw new Error('source symlink escapes the selected checkout');
  return physical;
}

export async function validateSource(path: string, text: string): Promise<Diagnostic[]> {
  if (Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES)
    return [diagnostic(path, `source exceeds the ${MAX_SOURCE_BYTES}-byte editor limit`)];
  const kind = sourceKind(path);
  if (kind === 'topic-article' || kind === 'discovery') {
    try {
      await compile(text, { format: 'mdx' });
    } catch (error) {
      return [diagnostic(path, `MDX: ${error instanceof Error ? error.message : String(error)}`)];
    }
    if (kind === 'discovery') {
      const match = FRONTMATTER.exec(text);
      if (!match) return [diagnostic(path, 'discovery MDX needs a YAML frontmatter block')];
      try {
        const parsed = discoverySchema.safeParse(YAML.parse(match[1]!));
        if (!parsed.success)
          return (parsed.error.issues ?? []).map((issue) =>
            diagnostic(path, `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`),
          );
      } catch (error) {
        return [diagnostic(path, `frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`)];
      }
    }
    return [];
  }
  if (/\.(?:yaml|yml)$/.test(path)) {
    const document = YAML.parseDocument(text);
    if (document.errors.length)
      return document.errors.map((error) => diagnostic(path, `YAML: ${error.message}`));
    if (kind === 'grammar-inventory') return validateGrammarInventory(path, document.toJS());
    const schema = schemaFor(kind);
    if (schema) {
      const parsed = schema.safeParse(document.toJS());
      if (!parsed.success)
        return (parsed.error?.issues ?? []).map((issue) =>
          diagnostic(path, `${issue.path.join('.') || 'document'}: ${issue.message}`),
        );
    }
  } else if (path.endsWith('.json')) {
    try { JSON.parse(text); } catch (error) {
      return [diagnostic(path, `JSON: ${error instanceof Error ? error.message : String(error)}`)];
    }
  }
  return [];
}

export async function readSource(root: string, path: string): Promise<FileSnapshot> {
  const file = resolveEditableSource(root, path);
  const text = readFileSync(file, 'utf8');
  return { path, kind: sourceKind(path), text, revision: revisionOf(text), diagnostics: await validateSource(path, text) };
}

export async function saveSource(root: string, input: SaveFileInput): Promise<SaveFileResult> {
  let before: FileSnapshot;
  try {
    before = await readSource(root, input.path);
  } catch (error) {
    return { ok: false, diagnostics: [diagnostic(input.path, error instanceof Error ? error.message : String(error))] };
  }
  if (before.revision !== input.expectedRevision)
    return { ok: false, conflict: before, diagnostics: [diagnostic(input.path, 'the file changed on disk; reload or merge before saving')] };
  const diagnostics = await validateSource(input.path, input.text);
  if (diagnostics.some((item) => item.severity === 'blocking')) return { ok: false, diagnostics };
  // A generic source save may leave cross-file diagnostics behind, but it must never smuggle a
  // topic through the one transition whose contract is deliberately corpus-wide. The dedicated
  // reviewed transaction runs full validation and rolls back on provenance or evidence failures.
  if (before.kind === 'topic-manifest') {
    const previousStatus = (YAML.parse(before.text) as { status?: string }).status;
    const nextStatus = (YAML.parse(input.text) as { status?: string }).status;
    if (previousStatus !== 'reviewed' && nextStatus === 'reviewed')
      return {
        ok: false,
        diagnostics: [diagnostic(input.path, 'use “Als geprüft markieren” for the strict corpus-wide reviewed gate')],
      };
  }
  if (before.text === input.text) return { ok: true, snapshot: before, changed: false };

  const target = resolveEditableSource(root, input.path);
  const temp = resolve(dirname(target), `.${basename(target)}.${randomUUID()}.redaktion-tmp`);
  const mode = statSync(target).mode;
  try {
    writeFileSync(temp, input.text, { encoding: 'utf8', mode });
    chmodSync(temp, mode);
    renameSync(temp, target);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
  return { ok: true, snapshot: await readSource(root, input.path), changed: true };
}
