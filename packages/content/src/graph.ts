/**
 * The content graph — one pass over `content/` and `data/`, built once, read many times.
 *
 * WHY. Eight modules walked the corpus independently: the validator, four coverage instruments,
 * the comprehensibility report, the provenance checker and the editorial console's own loader.
 * Each re-parsed the same 336 YAML sets, 49 MDX files and 129 decks, and each built the fraction of
 * the graph it happened to need — so there was no shared model, there were eight partial ones, and
 * a question that spanned two of them ("which topics teach a structure the standard lists but whose
 * article has no subsection for it?") had nowhere to be asked.
 *
 * WHAT IT SPANS. The corpus, plus the shape of what is missing from it: elements a topic does not
 * have, stages of the lesson cycle nothing fills, links that exist in one direction only. A model
 * that can only represent what exists cannot report an absence, and absence is what this repo keeps
 * failing to notice — A1 published 100% for months against a list that was itself incomplete.
 *
 * WHAT IT IS NOT. Not a source of truth: `content/` is, and stays, because git review is the
 * editorial process. Not a cache with a lifetime: it is memoised per root for the life of the
 * process and rebuilt from scratch next time. Not a validator: a malformed file becomes a `note`
 * and the graph still builds, because this is the model an editor reads *while* authoring — an
 * editorial tool that goes blank on the file you are editing is the one that is useless.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import {
  atlasSchema,
  discoverySchema,
  exerciseSetSchema,
  listeningArtifactSchema,
  readingSchema,
  topicManifestSchema,
  visualDocumentSchema,
  vocabFileSchema,
  wordFieldSchema,
  wortnetzSchema,
  type AtlasGroup,
  type AtlasUnit,
  type Discovery,
  type ExerciseSet,
  type Level,
  type ListeningArtifact,
  type Outcome,
  type Reading,
  type TopicManifest,
  type VisualDocument,
  type VocabFile,
  type WordField,
  type Wortnetz,
} from '@da/schema';
import { repoRoot } from './repo-root';
import {
  loadGrammarInventory,
  loadGrammarTracks,
  productionLevel,
  type GrammarPoint,
  type GrammarTrack,
} from './grammar-coverage';
import { invalidateGrammarDepth } from './grammar-depth';
import { invalidateCoverageCaches } from './coverage';
import { invalidateGrammarCoverageCaches } from './grammar-coverage';
import { loadStructureSources, type StructureSource } from './structures';
import { idFromManifestPath, manifestFiles, MANIFEST_SUFFIX } from './topics';
import {
  defaultStage,
  kindForReading,
  kindForRole,
  learningMedium,
  summariseItems,
  type Element,
  type ElementKind,
  type LessonStage,
} from './elements';

// ---------------------------------------------------------------------------
// Node wrappers — the parsed file plus what only the file's *location* knows
// ---------------------------------------------------------------------------

/**
 * A topic is two files: the manifest that declares it and the article that teaches it.
 * `file` is the manifest — the thing an editor changes to change the topic — and `article` is the
 * prose, which is what the `artikel` element and every prose-shape finding must point at.
 */
export interface TopicFile {
  id: string;
  data: TopicManifest;
  file: string;
  article: string;
  /** German H2/H3 headings in order — the article skeleton as an outline. */
  headings: { depth: number; text: string }[];
  /** `###` headings inside `## Erklärung`: the addressable anchor for each named confusion. */
  erklaerungSubsections: string[];
  /** Body word count. */
  words: number;
}

export interface SetFile {
  id: string;
  data: ExerciseSet;
  file: string;
  /** From the directory. An exercise set carries no `level` field. */
  level: Level;
}

export interface ReadingFile {
  id: string;
  data: Reading;
  file: string;
  /** From the directory. A reading carries no `level` field either. */
  level: Level;
}

export interface VocabDeck {
  id: string;
  data: VocabFile;
  file: string;
}

export interface ContentGraph {
  root: string;
  /** Files that did not match their schema. Surfaced, never thrown — see the module doc. */
  notes: string[];

  topics: Map<string, TopicFile>;
  sets: Map<string, SetFile>;
  readings: Map<string, ReadingFile>;
  vocab: Map<string, VocabDeck>;
  listening: Map<string, { id: string; data: ListeningArtifact; file: string; level: Level }>;
  documents: Map<string, { id: string; data: VisualDocument; file: string }>;
  discovery: Map<string, { id: string; data: Discovery; file: string }>;
  wortfelder: Map<string, { id: string; data: WordField; file: string }>;
  wortnetze: Map<string, { id: string; data: Wortnetz; file: string }>;

  groups: AtlasGroup[];
  units: AtlasUnit[];

  inventory: GrammarPoint[];
  grammarTracks: GrammarTrack[];
  pointById: Map<string, GrammarPoint>;
  sources: StructureSource[];

  /** Every artifact, one shape. The layer no field in the corpus expresses. */
  elements: Element[];

  // --- indexes, all derived ------------------------------------------------
  /** Elements owned by a topic, in lesson-cycle order. */
  elementsByTopic: Map<string, Element[]>;
  /** The recommended path, flattened: topic ids in spine order. */
  spineOrder: string[];
  spineIndex: Map<string, number>;
  unitOfTopic: Map<string, AtlasUnit>;
  /** Outcome id → the outcome and the topic that declares it. */
  outcomes: Map<string, { outcome: Outcome; topic: string }>;
  /** Focus tag → every element carrying it. */
  elementsByTag: Map<string, Element[]>;
  /** Grammar point id → the topics whose elements carry one of its tags. */
  topicsByPoint: Map<string, string[]>;
  /** Reverse of `prerequisites`, `deepens`, `related`. */
  neededBy: Map<string, string[]>;
  deepenedBy: Map<string, string[]>;
  relatedFrom: Map<string, string[]>;
  /** Deck id → topics that list it in `vocab:`. Decks no topic owns are Wortliste completion decks. */
  deckOwners: Map<string, string[]>;
}

// ---------------------------------------------------------------------------
// Reading the corpus
// ---------------------------------------------------------------------------

const LEVEL_DIRS: Record<string, Level> = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' };

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}

/** The level a file's directory declares, for the entities that carry no `level` field. */
function levelFromPath(root: string, file: string): Level {
  for (const segment of relative(root, file).split(sep)) {
    const level = LEVEL_DIRS[segment.toLowerCase()];
    if (level) return level;
  }
  return 'A1';
}

/** Path-id as the rest of the repo spells it: `a2/perfekt-haben-sein`, level dir included. */
function pathId(base: string, file: string, ext: string): string {
  return relative(base, file).split(sep).join('/').replace(new RegExp(`${ext}$`), '');
}

interface Loader {
  notes: string[];
  rel: (file: string) => string;
}

function makeLoader(root: string): Loader {
  return { notes: [], rel: (file) => relative(root, file).split(sep).join('/') };
}

/**
 * Parse against the repo schema, but never die on a content error. Raw data is returned on
 * failure and every reader below is defensive about missing arrays, so a half-written file
 * degrades to one note in the header rather than an empty editor.
 */
function coerce<T>(
  loader: Loader,
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } },
  raw: unknown,
  where: string,
): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data as T;
  loader.notes.push(`${where}: does not match its schema — read from raw YAML (run bun run validate)`);
  return raw as T;
}

function readYaml<T>(
  loader: Loader,
  file: string,
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } },
): T | undefined {
  try {
    return coerce<T>(loader, schema, YAML.parse(readFileSync(file, 'utf8')), loader.rel(file));
  } catch (e) {
    loader.notes.push(`${loader.rel(file)}: YAML parse error: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

function readMdx<T>(
  loader: Loader,
  file: string,
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } },
): { data: T; body: string } {
  const src = readFileSync(file, 'utf8');
  const match = FRONTMATTER.exec(src);
  let raw: unknown = {};
  if (!match) loader.notes.push(`${loader.rel(file)}: missing frontmatter block`);
  else {
    try {
      raw = YAML.parse(match[1]!);
    } catch (e) {
      loader.notes.push(`${loader.rel(file)}: frontmatter parse error: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { data: coerce<T>(loader, schema, raw, loader.rel(file)), body: src.replace(FRONTMATTER, '') };
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

function build(root: string): ContentGraph {
  const loader = makeLoader(root);
  const rel = loader.rel;
  const CONTENT = join(root, 'content');

  // --- topics -------------------------------------------------------------
  // The manifest is the topic; the article beside it is one of its elements. A manifest that does
  // not parse is skipped with a note, the same as every other artifact — an unreadable declaration
  // is not a topic with missing fields, it is a file being edited.
  const topics = new Map<string, TopicFile>();
  for (const file of manifestFiles(root)) {
    const data = readYaml<TopicManifest>(loader, file, topicManifestSchema);
    if (!data) continue;
    const id = idFromManifestPath(file);
    const articleFile = file.replace(new RegExp(`${MANIFEST_SUFFIX}$`), '.mdx');
    const body = existsSync(articleFile) ? readFileSync(articleFile, 'utf8') : '';
    if (!body) loader.notes.push(`${rel(file)}: no article at ${rel(articleFile)}`);
    const headings = [...body.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((m) => ({
      depth: m[1]!.length,
      text: m[2]!,
    }));
    const erklaerung: string[] = [];
    let inside = false;
    for (const h of headings) {
      if (h.depth === 2) inside = h.text.trim().startsWith('Erklärung');
      else if (inside) erklaerung.push(h.text);
    }
    topics.set(id, {
      id,
      data,
      file: rel(file),
      article: rel(articleFile),
      headings,
      erklaerungSubsections: erklaerung,
      words: body.split(/\s+/).filter(Boolean).length,
    });
  }

  // --- exercise sets ------------------------------------------------------
  const sets = new Map<string, SetFile>();
  const exercisesBase = join(CONTENT, 'exercises');
  for (const file of listFiles(exercisesBase, '.yaml')) {
    const data = readYaml<ExerciseSet>(loader, file, exerciseSetSchema);
    if (!data) continue;
    const id = pathId(exercisesBase, file, '.yaml');
    sets.set(id, { id, data, file: rel(file), level: levelFromPath(root, file) });
  }

  // --- readings -----------------------------------------------------------
  const readings = new Map<string, ReadingFile>();
  const readingBase = join(CONTENT, 'reading');
  for (const file of listFiles(readingBase, '.yaml')) {
    const data = readYaml<Reading>(loader, file, readingSchema);
    if (!data) continue;
    const id = pathId(readingBase, file, '.yaml');
    readings.set(id, { id, data, file: rel(file), level: levelFromPath(root, file) });
  }

  // --- vocabulary ---------------------------------------------------------
  const vocab = new Map<string, VocabDeck>();
  for (const file of listFiles(join(CONTENT, 'vocab'), '.yaml')) {
    const data = readYaml<VocabFile>(loader, file, vocabFileSchema);
    if (!data) continue;
    const id = data.id ?? file.split(sep).at(-1)!.replace(/\.yaml$/, '');
    vocab.set(id, { id, data, file: rel(file) });
  }

  // --- listening, documents, discovery, lexical overlays ------------------
  const listening = new Map<string, { id: string; data: ListeningArtifact; file: string; level: Level }>();
  for (const file of listFiles(join(CONTENT, 'listening'), '.yaml')) {
    const data = readYaml<ListeningArtifact>(loader, file, listeningArtifactSchema);
    if (!data) continue;
    listening.set(data.id, { id: data.id, data, file: rel(file), level: data.level ?? levelFromPath(root, file) });
  }

  const documents = new Map<string, { id: string; data: VisualDocument; file: string }>();
  const documentsBase = join(CONTENT, 'documents');
  for (const file of listFiles(documentsBase, '.yaml')) {
    const data = readYaml<VisualDocument>(loader, file, visualDocumentSchema);
    if (!data) continue;
    documents.set(pathId(documentsBase, file, '.yaml'), { id: pathId(documentsBase, file, '.yaml'), data, file: rel(file) });
  }

  const discovery = new Map<string, { id: string; data: Discovery; file: string }>();
  for (const file of listFiles(join(CONTENT, 'discovery'), '.mdx')) {
    const { data } = readMdx<Discovery>(loader, file, discoverySchema);
    const id = data?.id ?? file.split(sep).at(-1)!.replace(/\.mdx$/, '');
    discovery.set(id, { id, data, file: rel(file) });
  }

  const wortfelder = new Map<string, { id: string; data: WordField; file: string }>();
  for (const file of listFiles(join(CONTENT, 'wortfelder'), '.yaml')) {
    const data = readYaml<WordField>(loader, file, wordFieldSchema);
    if (!data) continue;
    wortfelder.set(data.id, { id: data.id, data, file: rel(file) });
  }

  const wortnetze = new Map<string, { id: string; data: Wortnetz; file: string }>();
  for (const file of listFiles(join(CONTENT, 'wortnetze'), '.yaml')) {
    const data = readYaml<Wortnetz>(loader, file, wortnetzSchema);
    if (!data) continue;
    wortnetze.set(data.id, { id: data.id, data, file: rel(file) });
  }

  // --- the atlas ----------------------------------------------------------
  const atlasFile = join(CONTENT, 'atlas.yaml');
  const atlas = (existsSync(atlasFile)
    ? readYaml<{ groups: AtlasGroup[]; units: AtlasUnit[] }>(loader, atlasFile, atlasSchema)
    : undefined) ?? { groups: [], units: [] };
  const units = atlas.units ?? [];

  // --- the grammar inventory and its external anchors ---------------------
  let inventory: GrammarPoint[] = [];
  let grammarTracks: GrammarTrack[] = [];
  try {
    inventory = loadGrammarInventory(root);
    grammarTracks = loadGrammarTracks(root);
  } catch (e) {
    loader.notes.push(`data/grammar-inventory.yaml: ${e instanceof Error ? e.message : e}`);
  }
  let sources: StructureSource[] = [];
  try {
    sources = loadStructureSources(root);
  } catch (e) {
    loader.notes.push(`data/strukturenlisten: ${e instanceof Error ? e.message : e}`);
  }

  const graph: ContentGraph = {
    root,
    notes: loader.notes,
    topics,
    sets,
    readings,
    vocab,
    listening,
    documents,
    discovery,
    wortfelder,
    wortnetze,
    groups: atlas.groups ?? [],
    units,
    inventory,
    grammarTracks,
    pointById: new Map(inventory.map((p) => [p.id, p])),
    sources,
    elements: [],
    elementsByTopic: new Map(),
    spineOrder: [],
    spineIndex: new Map(),
    unitOfTopic: new Map(),
    outcomes: new Map(),
    elementsByTag: new Map(),
    topicsByPoint: new Map(),
    neededBy: new Map(),
    deepenedBy: new Map(),
    relatedFrom: new Map(),
    deckOwners: new Map(),
  };

  buildElements(graph);
  buildIndexes(graph);
  return graph;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------


function element(
  kind: ElementKind,
  id: string,
  topic: string,
  level: Level,
  file: string,
  extra: Partial<Element> = {},
): Element {
  return {
    id,
    kind,
    topic,
    level,
    stage: extra.stage ?? defaultStage(kind),
    touches: extra.touches ?? [],
    modes: extra.modes ?? [],
    focus: extra.focus ?? [],
    outcomes: extra.outcomes ?? [],
    depth: extra.depth ?? { items: 1, production: 0, parts: 0 },
    file,
    title: extra.title,
    activity: extra.activity,
    medium: extra.medium,
    stageDeclared: extra.stageDeclared,
  };
}

function buildElements(graph: ContentGraph): void {
  const out: Element[] = [];

  for (const topic of graph.topics.values()) {
    out.push(
      element('artikel', `${topic.id}#artikel`, topic.id, topic.data.level, topic.article, {
        touches: ['input'],
        modes: ['reading'],
        depth: { items: 1, production: 0, parts: topic.erklaerungSubsections.length },
        title: topic.data.title_de,
      }),
    );
  }

  for (const set of graph.sets.values()) {
    const topic = set.data?.topic;
    if (!topic) continue;
    const kind = kindForRole(set.data.role);
    const declared = set.data.stage;
    const summary = summariseItems(set.data.items ?? []);
    out.push(
      element(kind, `${set.id}#${kind}`, topic, set.level, set.file, {
        ...summary,
        stage: declared ?? defaultStage(kind),
        activity: set.data.activity,
        medium: set.data.activity ? learningMedium(set.data) : undefined,
        stageDeclared: declared ? true : undefined,
        title: set.data.title_de ?? set.data.title?.de,
      }),
    );
  }

  for (const reading of graph.readings.values()) {
    const topic = reading.data?.topic;
    if (!topic) continue;
    const kind = kindForReading(reading.data.kind);
    const questions = reading.data.questions ?? [];
    const outcomes = [...new Set(questions.flatMap((q) => q.outcomes ?? []))].sort();
    out.push(
      element(kind, `${reading.id}#${kind}`, topic, reading.level, reading.file, {
        touches: questions.length ? ['input', 'abruf'] : ['input'],
        modes: ['reading'],
        outcomes,
        depth: { items: 1, production: 0, parts: questions.length },
        title: reading.data.title_de,
      }),
    );
  }

  // A recording belongs to the topic of the set whose item names it; the artifact itself
  // records only a level. Two hops, and the only path that exists.
  const recordingTopic = new Map<string, string>();
  for (const set of graph.sets.values()) {
    for (const item of set.data?.items ?? []) {
      const recording = (item as { recording?: string }).recording;
      if (recording && set.data.topic) recordingTopic.set(recording, set.data.topic);
    }
  }
  for (const artifact of graph.listening.values()) {
    const topic = recordingTopic.get(artifact.id);
    if (!topic) continue;
    out.push(
      element('hoertext', `${artifact.id}#hoertext`, topic, artifact.level, artifact.file, {
        touches: ['input'],
        modes: ['listening'],
        depth: { items: 1, production: 0, parts: artifact.data.transcript?.length ?? 0 },
        title: artifact.data.title?.de,
      }),
    );
  }

  for (const doc of graph.documents.values()) {
    if (!doc.data?.topic) continue;
    out.push(
      element('dokument', `${doc.id}#dokument`, doc.data.topic, doc.data.level ?? 'A1', doc.file, {
        touches: ['input'],
        modes: ['reading'],
        title: doc.data.title_de,
      }),
    );
  }

  for (const field of graph.wortfelder.values()) {
    if (!field.data?.topic) continue;
    out.push(
      element('wortfeld', `${field.id}#wortfeld`, field.data.topic, field.data.level ?? 'A1', field.file, {
        touches: ['input'],
        depth: { items: 1, production: 0, parts: field.data.members?.length ?? 0 },
        title: field.data.title_de,
      }),
    );
  }

  for (const piece of graph.discovery.values()) {
    for (const topic of piece.data?.topics ?? []) {
      out.push(
        element('entdecken', `${piece.id}#entdecken@${topic}`, topic, piece.data.level ?? 'A1', piece.file, {
          touches: ['input'],
          modes: ['reading'],
          title: piece.data.title_de,
        }),
      );
    }
  }

  for (const topic of graph.topics.values()) {
    for (const deckId of topic.data.elements.vocab) {
      const deck = graph.vocab.get(deckId);
      if (!deck) continue;
      const entries = deck.data?.entries ?? [];
      const productive = entries.filter((e) => (e.cards ?? 'both') === 'both').length;
      out.push(
        element('wortschatz', `${deckId}#wortschatz@${topic.id}`, topic.id, deck.data?.level ?? topic.data.level, deck.file, {
          touches: productive ? ['abruf', 'produktion'] : ['abruf'],
          depth: { items: entries.length, production: productive, parts: entries.length + productive },
          title: deck.data?.title_de,
        }),
      );
    }
  }

  graph.elements = out;
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/** Display and grouping order: the lesson cycle, then everything outside it. */
const STAGE_ORDER: Record<LessonStage, number> = {
  pretest: 0,
  modell: 1,
  geruest: 2,
  ausblenden: 3,
  transfer: 4,
  nachpruefung: 5,
  keine: 6,
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function buildIndexes(graph: ContentGraph): void {
  for (const element of graph.elements) {
    push(graph.elementsByTopic, element.topic, element);
    for (const tag of element.focus) push(graph.elementsByTag, tag, element);
  }
  for (const list of graph.elementsByTopic.values()) {
    list.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.id.localeCompare(b.id));
  }

  for (const unit of graph.units) {
    for (const topicId of unit.topics ?? []) {
      graph.unitOfTopic.set(topicId, unit);
      graph.spineOrder.push(topicId);
    }
  }
  graph.spineOrder.forEach((id, i) => graph.spineIndex.set(id, i));

  // The manifest IS the node: `graph.nodes` used to be a second map of the same 49 things, read
  // from `atlas.yaml`'s `nodes:` array, and keeping the two in step was a job for the validator.
  for (const { id, data } of graph.topics.values()) {
    for (const outcome of data.outcomes ?? []) graph.outcomes.set(outcome.id, { outcome, topic: id });
    for (const prerequisite of data.prerequisites ?? []) push(graph.neededBy, prerequisite, id);
    for (const base of data.deepens ?? []) push(graph.deepenedBy, base, id);
    for (const other of data.related ?? []) push(graph.relatedFrom, other, id);
  }

  // A point is "in" a topic when the topic has an element carrying one of its focus tags.
  // Deliberately over any element, not only practice/drill: this index answers "where is this
  // taught or tested", which is a different question from `grammarCoverage`'s "is it taught".
  for (const point of graph.inventory) {
    const topics = new Set<string>();
    for (const tag of point.focus ?? []) {
      for (const element of graph.elementsByTag.get(tag) ?? []) topics.add(element.topic);
    }
    for (const topicId of point.taught_in ?? []) topics.add(topicId);
    if (topics.size) graph.topicsByPoint.set(point.id, [...topics].sort());
  }

  for (const topic of graph.topics.values()) {
    for (const deckId of topic.data.elements.vocab) push(graph.deckOwners, deckId, topic.id);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const cache = new Map<string, ContentGraph>();

/**
 * The graph for a repo root. Memoised per root for the life of the process: every instrument in
 * a single `bun run validate` or one editorial page load reads the same object, which is the
 * whole point. Pass `{ fresh: true }` where a rebuild is the intent — the write path, and the
 * dev server after a file changes.
 */
export function contentGraph(root: string = repoRoot(), options: { fresh?: boolean } = {}): ContentGraph {
  if (!options.fresh) {
    const hit = cache.get(root);
    if (hit) return hit;
  }
  const graph = build(root);
  cache.set(root, graph);
  return graph;
}

/**
 * Drop the memo — for tests and for the editorial dev server's file watcher.
 *
 * It clears `grammar-depth`'s cache too, because that module keeps its own corpus pass (it predates
 * the graph and still walks `content/exercises` itself). **One invalidation entry point is the
 * point**: the watcher calls this, and a second cache with a second invalidator is a stale figure
 * waiting for someone to forget it.
 */
export function invalidateContentGraph(root?: string): void {
  if (root) cache.delete(root);
  else cache.clear();
  invalidateGrammarDepth(root);
  // The coverage and grammar-coverage memos hold parsed copies of the same files the graph does,
  // so they belong to the graph's lifetime. Dropping the graph and leaving them would be the
  // stale-number failure the memos were added to avoid causing.
  invalidateCoverageCaches(root);
  invalidateGrammarCoverageCaches(root);
}

export { productionLevel };
export type { Element, ElementKind, LessonStage };
