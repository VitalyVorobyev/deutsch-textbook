/**
 * The graph, flattened for a browser.
 *
 * The model is built with `Map`s and cyclic-ish indexes because that is what makes it cheap to
 * read from Node. None of that survives `JSON.stringify`, so this module is the one place that
 * decides what crosses the wire and in what shape — rather than every view inventing its own.
 *
 * TWO TIERS, on purpose. The **structure** (49 topics, 569 elements, 97 inventory rows, 179
 * outcomes, the problems, the profiles) is a few hundred kilobytes and ships on first paint,
 * because every view needs some of it and a second round-trip per view is the thing that made the
 * old generated console a single 2.4 MB file. The **bulk** (1 976 items, 3 554 vocabulary entries,
 * every reading's text) is an order of magnitude larger, is needed by two views out of nine, and
 * ships per chunk on demand.
 */
import type { AtlasGroup, AtlasUnit, Level, Outcome } from '@da/schema';
import { LEVELS } from '@da/schema';
import type { ContentGraph } from './graph';
import type { Element } from './elements';
import { levelMedians, problems, readingWords, topicProfile, type LevelMedians, type Problem, type TopicProfile } from './profile';
import { grammarCoverage, type GrammarCoverage, type GrammarPoint } from './grammar-coverage';
import { goetheCoverage, hasManifest, type Coverage } from './coverage';
import { structureCoverage, type StructureCoverage, type StructureSource } from './structures';
import { levelDepth, type LevelDepth } from './grammar-depth';
import { focusIntroducedBy } from './focus-tags';

export interface TopicSummary {
  id: string;
  title: string;
  level: Level;
  kind: string;
  status: string;
  file: string;
  unit?: string;
  unitTitle?: string;
  /** Position on the recommended path. */
  spine: number;
  /** `###` headings inside `## Erklärung` — the addressable anchor per named confusion. */
  subsections: string[];
  prerequisites: string[];
  deepens: string[];
  neededBy: string[];
  deepenedBy: string[];
  outcomes: Outcome[];
}

export interface TagSummary {
  tag: string;
  /** The topic that introduces the confusion, from the allowlist. */
  introducedBy?: string;
  level?: Level;
  teaching: number;
  probes: number;
  elements: string[];
  points: string[];
}

export interface ReadingSummary {
  id: string;
  topic: string;
  level: Level;
  title: string;
  kind: string;
  words: number;
  glosses: number;
  questions: number;
  file: string;
}

export interface DeckSummary {
  id: string;
  title: string;
  level: Level;
  entries: number;
  productive: number;
  owners: string[];
  file: string;
}

export interface LevelReport {
  level: Level;
  grammar?: GrammarCoverage;
  wortliste?: Coverage;
  depth?: LevelDepth;
  structures?: StructureCoverage;
  medians?: LevelMedians;
}

export interface GraphPayload {
  root: string;
  notes: string[];
  levels: Level[];
  groups: AtlasGroup[];
  units: AtlasUnit[];
  topics: TopicSummary[];
  elements: Element[];
  /** Without `elements` — join to the top-level array by `topic`. */
  profiles: Omit<TopicProfile, 'elements'>[];
  problems: Problem[];
  inventory: GrammarPoint[];
  sources: StructureSource[];
  tags: TagSummary[];
  readings: ReadingSummary[];
  decks: DeckSummary[];
  reports: LevelReport[];
}

const TEACHING = new Set(['praxis', 'drill']);

/**
 * Keyed on the graph object itself, so it is invalidated exactly when the graph is rebuilt and
 * never otherwise. Without it the editorial server spent **7 seconds on every request**: the graph
 * is memoised, but the four coverage measurements it calls are not, and each of them walks the
 * corpus again. That is the eight-passes problem reappearing one layer up — worth saying out loud,
 * because building the graph did not remove it, it only moved where it has to be paid.
 */
const payloadCache = new WeakMap<ContentGraph, GraphPayload>();

export function graphPayload(graph: ContentGraph): GraphPayload {
  const hit = payloadCache.get(graph);
  if (hit) return hit;
  const built = buildPayload(graph);
  payloadCache.set(graph, built);
  return built;
}

function buildPayload(graph: ContentGraph): GraphPayload {
  const topics: TopicSummary[] = [...graph.topics.values()].map((topic) => {
    const unit = graph.unitOfTopic.get(topic.id);
    return {
      id: topic.id,
      title: topic.data.title_de,
      level: topic.data.level,
      kind: topic.data.kind,
      status: topic.data.status ?? 'draft',
      file: topic.file,
      unit: unit?.id,
      unitTitle: unit?.title_de,
      spine: graph.spineIndex.get(topic.id) ?? -1,
      subsections: topic.erklaerungSubsections,
      prerequisites: topic.data.prerequisites ?? [],
      deepens: topic.data.deepens ?? [],
      neededBy: graph.neededBy.get(topic.id) ?? [],
      deepenedBy: graph.deepenedBy.get(topic.id) ?? [],
      outcomes: topic.data.outcomes ?? [],
    };
  });
  topics.sort((a, b) => a.spine - b.spine);

  const tags: TagSummary[] = [];
  const allTags = new Set<string>([...Object.keys(focusIntroducedBy), ...graph.elementsByTag.keys()]);
  for (const tag of [...allTags].sort()) {
    const elements = graph.elementsByTag.get(tag) ?? [];
    tags.push({
      tag,
      introducedBy: focusIntroducedBy[tag],
      level: elements[0]?.level,
      teaching: elements.filter((e) => TEACHING.has(e.kind)).reduce((n, e) => n + e.depth.items, 0),
      probes: elements.filter((e) => e.kind === 'probe').length,
      elements: elements.map((e) => e.id),
      points: graph.inventory.filter((p) => (p.focus ?? []).includes(tag)).map((p) => p.id),
    });
  }

  const readings: ReadingSummary[] = [...graph.readings.values()].map((reading) => {
    const element = graph.elements.find((e) => e.id.startsWith(`${reading.id}#lesetext`));
    return {
      id: reading.id,
      topic: reading.data.topic,
      level: reading.level,
      title: reading.data.title_de,
      kind: reading.data.kind ?? 'intensive',
      words: element ? readingWords(graph, element) : 0,
      glosses: (reading.data.text ?? []).reduce((n, p) => n + [...p.matchAll(/\[\[/g)].length, 0),
      questions: reading.data.questions?.length ?? 0,
      file: reading.file,
    };
  });

  const decks: DeckSummary[] = [...graph.vocab.values()].map((deck) => ({
    id: deck.id,
    title: deck.data.title_de,
    level: deck.data.level,
    entries: deck.data.entries?.length ?? 0,
    productive: (deck.data.entries ?? []).filter((e) => (e.cards ?? 'both') === 'both').length,
    owners: graph.deckOwners.get(deck.id) ?? [],
    file: deck.file,
  }));

  const medians = levelMedians(graph);
  // `Coverage.ownedBy` and `TagDepth.byType` are Maps. `JSON.stringify` turns a Map into `{}`
  // without complaint, so a view reading either would find an empty object and report "nothing"
  // rather than fail — the silent-absence failure this whole model exists to make impossible.
  // Strip them here: no view needs them, and an absent field is a type error while an empty one
  // is a wrong answer.
  const wireSafe = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_key, v) =>
    v instanceof Map ? Object.fromEntries(v) : v)) as T;
  const reports: LevelReport[] = LEVELS.map((level) => {
    const report: LevelReport = { level, medians: medians.get(level) };
    // Each measurement is imported, never reimplemented. A figure here that disagrees with
    // `bun scripts/<name>.ts` means this payload is wrong and the script is right.
    try {
      report.grammar = grammarCoverage(level, graph.root);
    } catch { /* a level with no inventory rows simply has no grammar report */ }
    try {
      if (hasManifest(level, graph.root)) report.wortliste = goetheCoverage(level, graph.root);
    } catch { /* no Wortliste manifest at this level */ }
    try {
      report.depth = levelDepth(level, graph.root);
    } catch { /* no tags at this level */ }
    try {
      report.structures = structureCoverage(level, graph.root);
    } catch { /* no external anchor at this level */ }
    return wireSafe(report);
  });

  return {
    root: graph.root,
    notes: graph.notes,
    levels: [...LEVELS],
    groups: graph.groups,
    units: graph.units,
    topics,
    elements: graph.elements,
    // `elements` is dropped from each profile: it is the same array the payload already ships at
    // top level, and re-embedding it per topic doubled the wire size. The client joins by topic id.
    profiles: [...graph.topics.keys()]
      .map((id) => topicProfile(graph, id))
      .filter((p): p is TopicProfile => !!p)
      .map(({ elements: _elements, ...rest }) => rest as Omit<TopicProfile, 'elements'>),
    problems: problems(graph),
    inventory: graph.inventory,
    sources: graph.sources,
    tags,
    readings,
    decks,
    reports,
  };
}

/** The bulk tiers, fetched per view rather than on first paint. */
export type ChunkName = 'items' | 'vocab' | 'texts';

export function graphChunk(graph: ContentGraph, name: ChunkName): unknown {
  switch (name) {
    case 'items':
      return [...graph.sets.values()].map((set) => ({
        id: set.id,
        topic: set.data.topic,
        role: set.data.role ?? 'practice',
        level: set.level,
        file: set.file,
        arming: set.data.arming ?? [],
        items: set.data.items ?? [],
      }));
    case 'vocab':
      return [...graph.vocab.values()].map((deck) => ({
        id: deck.id,
        level: deck.data.level,
        file: deck.file,
        entries: deck.data.entries ?? [],
      }));
    case 'texts':
      return [...graph.readings.values()].map((reading) => ({
        id: reading.id,
        topic: reading.data.topic,
        level: reading.level,
        title: reading.data.title_de,
        text: reading.data.text ?? [],
        questions: reading.data.questions ?? [],
      }));
  }
}
