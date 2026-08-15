/**
 * A non-executable MDX projection for editorial previews.
 *
 * `@mdx-js/mdx` is used as a parser only. Imports, exports, expressions, raw HTML and unknown
 * components never reach React as code: they become diagnostics plus an explicit unsupported node.
 */
import { createHash } from 'node:crypto';
import { createProcessor } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';

export type ContentLanguage = 'de' | 'en' | 'ru' | 'uk';
export type LanguageStatus = 'complete' | 'partial' | 'unsupported';

export interface TopicLanguageCoverage {
  topicId: string;
  languages: Array<{
    language: ContentLanguage;
    status: LanguageStatus;
    authored: number;
    required: number;
    missing: Array<{ path: string; field?: string; artifact: string }>;
  }>;
}

export interface PreviewDiagnostic {
  id: string;
  severity: 'attention' | 'info';
  message: string;
  line?: number;
}

interface ContainerNode { children: PreviewNode[] }
export type PreviewNode =
  | ({ type: 'root' } & ContainerNode)
  | ({ type: 'paragraph' } & ContainerNode)
  | ({ type: 'heading'; depth: number } & ContainerNode)
  | ({ type: 'strong' | 'emphasis' | 'delete' | 'blockquote' | 'listItem' | 'tableRow' } & ContainerNode)
  | ({ type: 'list'; ordered: boolean; start?: number } & ContainerNode)
  | ({ type: 'tableCell'; header: boolean } & ContainerNode)
  | ({ type: 'table' } & ContainerNode)
  | { type: 'text' | 'inlineCode' | 'code'; value: string }
  | { type: 'break' | 'thematicBreak' }
  | ({ type: 'link'; url: string } & ContainerNode)
  | { type: 'image'; url: string; alt?: string }
  | { type: 'component'; name: string; props: Record<string, string | boolean> }
  | { type: 'unsupported'; label: string };

export interface PreviewPayload {
  path: string;
  language: ContentLanguage;
  available: boolean;
  root: PreviewNode & { type: 'root' };
  languages: TopicLanguageCoverage['languages'];
  diagnostics: PreviewDiagnostic[];
}

export interface RenderSourceInput {
  path: string;
  text: string;
  language: ContentLanguage;
}

type Ast = {
  type: string;
  name?: string;
  value?: string;
  url?: string;
  alt?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  children?: Ast[];
  attributes?: Array<{ type: string; name?: string; value?: unknown }>;
  position?: { start?: { line?: number } };
};

const LANG_TAG: Record<ContentLanguage, string> = { de: 'De', en: 'En', ru: 'Ru', uk: 'Uk' };
const LANGUAGES = Object.keys(LANG_TAG) as ContentLanguage[];
const COMPONENTS = new Set([
  'AdministrativeLetterFigure', 'CaseTable', 'NarrativeTimelineFigure', 'ParticipantRoleFigure',
  'PronominalAdverbFlow', 'PronominalAdverbTable', 'RouteMovementFigure', 'SentenceRail',
  'TimeRelationFigure', 'WohnenWoWohin',
]);
const CONTAINERS = new Set(['root', 'paragraph', 'strong', 'emphasis', 'delete', 'blockquote', 'listItem']);

const id = (path: string, message: string): string =>
  `${path}:${createHash('sha1').update(message).digest('hex').slice(0, 10)}`;

function parse(text: string): Ast {
  return createProcessor({ format: 'mdx', remarkPlugins: [remarkGfm] }).parse(text) as Ast;
}

function bilinguals(tree: Ast): Ast[] {
  const result: Ast[] = [];
  const walk = (node: Ast) => {
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Bilingual') result.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return result;
}

function languageNodes(block: Ast, tag: string): Ast[] {
  const result: Ast[] = [];
  const walk = (node: Ast) => {
    if (node !== block && node.name === tag) {
      result.push(node);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(block);
  return result;
}

export function languageCoverage(topicId: string, path: string, text: string): TopicLanguageCoverage {
  let blocks: Ast[] = [];
  try { blocks = bilinguals(parse(text)); } catch { /* syntax diagnostics belong to renderSource/validateSource */ }
  const required = blocks.length;
  return {
    topicId,
    languages: LANGUAGES.map((language) => {
      const tag = LANG_TAG[language];
      const authored = blocks.filter((block) => languageNodes(block, tag).length > 0).length;
      return {
        language,
        status: required > 0 && authored === required ? 'complete' as const : authored > 0 ? 'partial' as const : 'unsupported' as const,
        authored,
        required,
        missing: authored === required ? [] : [{ path, field: tag, artifact: 'topic-article' }],
      };
    }),
  };
}

function props(node: Ast, diagnostics: PreviewDiagnostic[], path: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !attribute.name || !['string', 'boolean', 'undefined'].includes(typeof attribute.value)) {
      const message = `${node.name}: dynamische MDX-Attribute werden nicht ausgeführt`;
      diagnostics.push({ id: id(path, message), severity: 'attention', message, line: node.position?.start?.line });
      continue;
    }
    result[attribute.name] = attribute.value === undefined ? true : attribute.value as string | boolean;
  }
  return result;
}

function project(node: Ast, language: ContentLanguage, diagnostics: PreviewDiagnostic[], path: string, tableHeader = false): PreviewNode[] {
  const nested = () => (node.children ?? []).flatMap((child) => project(child, language, diagnostics, path, tableHeader));
  if (CONTAINERS.has(node.type)) return [{ type: node.type as 'root', children: nested() } as PreviewNode];
  if (node.type === 'heading') return [{ type: 'heading', depth: Math.min(6, Math.max(1, node.depth ?? 2)), children: nested() }];
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') return [{ type: node.type, value: node.value ?? '' }];
  if (node.type === 'break' || node.type === 'thematicBreak') return [{ type: node.type }];
  if (node.type === 'link') return [{ type: 'link', url: node.url ?? '', children: nested() }];
  if (node.type === 'image') return [{ type: 'image', url: node.url ?? '', alt: node.alt }];
  if (node.type === 'list') return [{ type: 'list', ordered: !!node.ordered, start: node.start, children: nested() }];
  if (node.type === 'tableCell') return [{ type: 'tableCell', header: tableHeader, children: nested() }];
  if (node.type === 'tableRow') return [{ type: 'tableRow', children: (node.children ?? []).flatMap((child) => project(child, language, diagnostics, path, tableHeader)) }];
  if (node.type === 'table') return [{ type: 'table', children: (node.children ?? []).flatMap((child, index) => project(child, language, diagnostics, path, index === 0)) }];

  if (node.type === 'yaml') return [];
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    if (node.name === 'Bilingual') {
      const chosen = languageNodes(node, LANG_TAG[language]);
      return chosen.flatMap((entry) => (entry.children ?? []).flatMap((child) => project(child, language, diagnostics, path)));
    }
    if (Object.values(LANG_TAG).includes(node.name ?? ''))
      return node.name === LANG_TAG[language] ? nested() : [];
    if (node.name && COMPONENTS.has(node.name)) return [{ type: 'component', name: node.name, props: props(node, diagnostics, path) }];
    const label = node.name ? `<${node.name}>` : 'anonymes MDX-Element';
    const message = `${label} hat keinen sicheren Vorschau-Renderer`;
    diagnostics.push({ id: id(path, message), severity: 'attention', message, line: node.position?.start?.line });
    return [{ type: 'unsupported', label }];
  }

  if (node.type === 'mdxjsEsm') {
    // Existing articles import their allowlisted Atlas figure next to the prose. The preview never
    // resolves or executes that module; it merely accepts this exact declarative spelling and
    // renders the later component node through its own registry.
    const imports = (node.value ?? '').split(/\r?\n/).filter(Boolean).map((line) =>
      /^import\s+([A-Z][A-Za-z0-9]*)\s+from\s+['"]@components\/(?:visuals|reference)\/[^'"]+\.astro['"];?\s*$/.exec(line),
    );
    if (imports.length && imports.every((match) => match && COMPONENTS.has(match[1]!))) return [];
    const message = `${node.type} wird in der Vorschau nicht ausgeführt`;
    diagnostics.push({ id: id(path, message), severity: 'attention', message, line: node.position?.start?.line });
    return [{ type: 'unsupported', label: node.type }];
  }
  if (node.type.includes('Expression') || node.type === 'html') {
    const message = `${node.type} wird in der Vorschau nicht ausgeführt`;
    diagnostics.push({ id: id(path, message), severity: 'attention', message, line: node.position?.start?.line });
    return [{ type: 'unsupported', label: node.type }];
  }
  const message = `Markdown-Knoten ${node.type} wird noch nicht dargestellt`;
  diagnostics.push({ id: id(path, message), severity: 'info', message, line: node.position?.start?.line });
  return [{ type: 'unsupported', label: node.type }];
}

export function renderSource(input: RenderSourceInput): PreviewPayload {
  const diagnostics: PreviewDiagnostic[] = [];
  let tree: Ast;
  try { tree = parse(input.text); }
  catch (error) {
    const message = `MDX: ${error instanceof Error ? error.message : String(error)}`;
    return {
      path: input.path, language: input.language, available: false,
      root: { type: 'root', children: [] }, languages: [],
      diagnostics: [{ id: id(input.path, message), severity: 'attention', message }],
    };
  }
  const coverage = languageCoverage(input.path.split('/').at(-1)?.replace(/\.mdx$/, '') ?? input.path, input.path, input.text);
  const status = coverage.languages.find((entry) => entry.language === input.language)?.status;
  const projected = project(tree, input.language, diagnostics, input.path);
  const root = projected[0]?.type === 'root' ? projected[0] as PreviewNode & { type: 'root' } : { type: 'root' as const, children: projected };
  return { path: input.path, language: input.language, available: status !== 'unsupported', root, languages: coverage.languages, diagnostics };
}
