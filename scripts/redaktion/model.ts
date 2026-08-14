/**
 * The Redaktion model — one normalised graph of the corpus, built once and rendered many times.
 *
 * WHY A MODEL RATHER THAN FOUR LOADERS. The console began as four hand-built views over what
 * exists: the level overview, the spine, the topic spec, the inventory. Every new question ("show
 * me the Kasus strand from A1 to B1", "which published structure does no row cover", "which `~`
 * headword is claimed by which grammar point") needed its own pass over the same files, so the
 * cost of a view was the cost of a loader. This module pays that once. A view is now a function
 * from the graph to HTML, and adding one costs a file.
 *
 * WHAT THE GRAPH SPANS, and this is the design commitment: **the language, not the corpus**. The
 * Sprachkarte has A1…C2 columns although the course reaches B1, the strand ladders show structures
 * with no content yet, and `gaps()` derives the holes — a published structure no row claims, a
 * confusion no probe re-asks, a `~` claim with no grammar point behind it, an article whose
 * Erklärung has no addressable subsections. A console that can only show what exists cannot show
 * that something is missing, and missing is the thing this repo keeps failing to notice: A1 read
 * 100% for months against a list that was itself incomplete.
 *
 * EVERY MEASUREMENT IS IMPORTED, never reimplemented — `grammarCoverage`, `goetheCoverage`,
 * `structureCoverage`, `levelDepth` all come from `src/lib/`. If a number here contradicts
 * `bun scripts/grammar-coverage.ts`, `bun scripts/coverage.ts`, `bun scripts/structures.ts` or
 * `bun scripts/grammar-depth.ts`, this loader is wrong and not the script.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import {
  atlasSchema,
  exerciseSetSchema,
  readingSchema,
  topicSchema,
  vocabFileSchema,
  LEVELS,
  type AtlasNode,
  type AtlasUnit,
  type ExerciseSet,
  type Level,
  type Reading,
  type Topic,
  type VocabFile,
} from '@da/schema';
import {
  grammarCoverage,
  loadGrammarInventory,
  productionLevel,
  receptionLevel,
  GRAMMAR_STRANDS,
  type GrammarCoverage,
  type GrammarPoint,
  type GrammarStrand,
} from '@da/content/grammar-coverage';
import { goetheCoverage, hasManifest, type Coverage } from '@da/content/coverage';
import { structureCoverage, loadStructureSources, entryRef, type StructureCoverage, type StructureSource } from '@da/content/structures';
import { levelDepth, tagDepths, pointDepths, type LevelDepth, type TagDepth, type PointDepth } from '@da/content/grammar-depth';
import { focusIntroducedBy } from '@da/content/focus-tags';

export const ROOT = join(import.meta.dirname, '..', '..');
export const CONTENT = join(ROOT, 'content');
export const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

/** The item-mix bars from CLAUDE.md, applied over a topic's `role: practice` sets. */
export const MIN_TRANSLATE = 2;
export const MAX_MC_PERCENT = 100 / 3;
export const MAX_SELECTION_PERCENT = 45;

/** Roles that own their own page and sit in no topic's `exercises` list. */
export const STANDALONE_ROLES = new Set(['checkpoint', 'probe', 'placement', 'exam-practice']);

/**
 * The columns of the Sprachkarte. Deliberately every CEFR level, not the three with content: a
 * level with no manifest cannot notice its own gaps, which is precisely how A2 spent months at 67%
 * of its standard while calling itself complete. B2 and C1 are empty columns on purpose — the size
 * of the job is on screen before any of it is done, which is the one thing the B1 manifest got
 * right by being authored at 0%.
 */
export const CEFR_COLUMNS: readonly Level[] = LEVELS;

/** Problems found while loading — surfaced in the console header rather than thrown. */
export const loadNotes: string[] = [];

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}

export const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

/**
 * Parse against the repo schema, but never die on a content error: this is the instrument an
 * editor opens *while* authoring, so a half-written file must degrade to a note in the header
 * rather than an empty page. Raw data is used on failure, and every reader is defensive about
 * missing arrays for exactly that case.
 */
function coerce<T>(
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } },
  raw: unknown,
  where: string,
): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data as T;
  loadNotes.push(`${where}: does not match its schema — shown from raw YAML (run bun run validate)`);
  return raw as T;
}

function parseFrontmatter(src: string, where: string): unknown {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) {
    loadNotes.push(`${where}: missing frontmatter block`);
    return {};
  }
  try {
    return YAML.parse(m[1]!);
  } catch (e) {
    loadNotes.push(`${where}: frontmatter YAML parse error: ${e instanceof Error ? e.message : e}`);
    return {};
  }
}

function readYaml<T>(
  file: string,
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } },
): T | undefined {
  try {
    return coerce<T>(schema, YAML.parse(readFileSync(file, 'utf8')), rel(file));
  } catch (e) {
    loadNotes.push(`${rel(file)}: YAML parse error: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface TopicFile {
  data: Topic;
  file: string;
  /** German H2/H3 headings, in order — the article skeleton, visible as an outline */
  headings: { depth: number; text: string }[];
  /** `### ` headings inside `## Erklärung` — the addressable anchors for its confusions */
  erklaerungSubsections: string[];
}

export const topics = new Map<string, TopicFile>();
for (const file of listFiles(join(CONTENT, 'topics'), '.mdx')) {
  const src = readFileSync(file, 'utf8');
  const data = coerce<Topic>(topicSchema, parseFrontmatter(src, rel(file)), rel(file));
  const id = data?.id ?? file.split(sep).at(-1)!.replace(/\.mdx$/, '');
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '');
  const headings = [...body.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((m) => ({
    depth: m[1]!.length,
    text: m[2]!,
  }));
  // The subsections of `## Erklärung` specifically. CLAUDE.md requires one per named confusion,
  // and nothing enforces it — twenty of forty-nine articles have none, so the confusion a grammar
  // point names has no anchor anywhere in the prose that explains it.
  const erklaerung: string[] = [];
  let inside = false;
  for (const h of headings) {
    if (h.depth === 2) inside = h.text.trim().startsWith('Erklärung');
    else if (inside) erklaerung.push(h.text);
  }
  topics.set(id, { data, file: rel(file), headings, erklaerungSubsections: erklaerung });
}

export interface SetFile {
  id: string;
  data: ExerciseSet;
  file: string;
  level: Level;
}

export const sets = new Map<string, SetFile>();
const exercisesBase = join(CONTENT, 'exercises');
for (const file of listFiles(exercisesBase, '.yaml')) {
  const data = readYaml<ExerciseSet>(file, exerciseSetSchema);
  if (!data) continue;
  const parts = relative(exercisesBase, file).split(sep);
  const id = parts.join('/').replace(/\.yaml$/, '');
  sets.set(id, { id, data, file: rel(file), level: parts[0]!.toUpperCase() as Level });
}

export interface ReadingFile {
  id: string;
  data: Reading;
  file: string;
  level: Level;
  words: number;
  glosses: number;
}

export const readings = new Map<string, ReadingFile>();
const readingBase = join(CONTENT, 'reading');
for (const file of listFiles(readingBase, '.yaml')) {
  const data = readYaml<Reading>(file, readingSchema);
  if (!data) continue;
  const parts = relative(readingBase, file).split(sep);
  const id = parts.join('/').replace(/\.yaml$/, '');
  const text = (data.text ?? []).join('\n');
  readings.set(id, {
    id,
    data,
    file: rel(file),
    level: parts[0]!.toUpperCase() as Level,
    // The gloss marker's German half is part of the text; its two glosses are not.
    words: text.replace(/\[\[(.+?)::.*?::.*?\]\]/g, '$1').split(/\s+/).filter(Boolean).length,
    glosses: [...text.matchAll(/\[\[.+?::.*?::.*?\]\]/g)].length,
  });
}

export const vocab = new Map<string, { id: string; data: VocabFile; file: string }>();
for (const file of listFiles(join(CONTENT, 'vocab'), '.yaml')) {
  const data = readYaml<VocabFile>(file, vocabFileSchema);
  if (!data) continue;
  const id = data.id ?? file.split(sep).at(-1)!.replace(/\.yaml$/, '');
  vocab.set(id, { id, data, file: rel(file) });
}

const atlasFile = join(CONTENT, 'atlas.yaml');
export const atlas = readYaml<{ nodes: AtlasNode[]; units: AtlasUnit[] }>(atlasFile, atlasSchema) ?? {
  nodes: [],
  units: [],
};
export const nodes = new Map((atlas.nodes ?? []).map((n) => [n.id, n]));
export const units = atlas.units ?? [];

/**
 * The inventory is the console's backbone, but a malformed YAML here must still produce a page
 * saying so rather than a stack trace — the editor is likely to be mid-edit in this very file when
 * they open the console.
 */
export let inventory: GrammarPoint[] = [];
try {
  inventory = loadGrammarInventory(ROOT);
} catch (e) {
  loadNotes.push(
    `data/grammar-inventory.yaml: ${e instanceof Error ? e.message : e} — Inventar, Sprachkarte und Grammatik-Abdeckung fehlen auf dieser Seite`,
  );
}
export const pointById = new Map(inventory.map((p) => [p.id, p]));

export let sources: StructureSource[] = [];
try {
  sources = loadStructureSources(ROOT);
} catch (e) {
  loadNotes.push(`data/strukturenlisten/: ${e instanceof Error ? e.message : e}`);
}

/** Levels the console reports content for: those that actually have a topics directory. */
export const CONSOLE_LEVELS: Level[] = LEVELS.filter((l) =>
  existsSync(join(CONTENT, 'topics', l.toLowerCase())),
);

// ---------------------------------------------------------------------------
// Imported measurements — never recomputed here
// ---------------------------------------------------------------------------

export const grammar = new Map<Level, GrammarCoverage>();
export const wortliste = new Map<Level, Coverage>();
export const depth = new Map<Level, LevelDepth>();
export const structures = new Map<Level, StructureCoverage>();

for (const level of CONSOLE_LEVELS) {
  if (inventory.length) {
    try {
      grammar.set(level, grammarCoverage(level, ROOT));
    } catch (e) {
      loadNotes.push(`Grammatik-Abdeckung ${level}: ${e instanceof Error ? e.message : e}`);
    }
    try {
      depth.set(level, levelDepth(level, ROOT));
    } catch (e) {
      loadNotes.push(`Grammatik-Tiefe ${level}: ${e instanceof Error ? e.message : e}`);
    }
    try {
      structures.set(level, structureCoverage(level, ROOT));
    } catch (e) {
      loadNotes.push(`Strukturen-Abdeckung ${level}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!hasManifest(level, ROOT)) continue;
  try {
    wortliste.set(level, goetheCoverage(level, ROOT));
  } catch (e) {
    loadNotes.push(`Wortliste-Abdeckung ${level}: ${e instanceof Error ? e.message : e}`);
  }
}

export const tagDepth = inventory.length ? tagDepths(ROOT) : new Map<string, TagDepth>();
export const pointDepth = new Map<string, PointDepth>(
  (inventory.length ? pointDepths(ROOT) : []).map((p) => [p.point.id, p]),
);

// ---------------------------------------------------------------------------
// Derived indexes
// ---------------------------------------------------------------------------

/** topic id → the focus tags it introduces (the inverse of focusIntroducedBy). */
export const introducedTags = new Map<string, string[]>();
for (const [tag, topic] of Object.entries(focusIntroducedBy)) {
  introducedTags.set(topic, [...(introducedTags.get(topic) ?? []), tag]);
}
for (const list of introducedTags.values()) list.sort();

/** topic id → its unit, from `units:` file order. */
export const unitOfTopic = new Map<string, AtlasUnit>();
for (const unit of units) for (const t of unit.topics ?? []) unitOfTopic.set(t, unit);

/** Spine order: units in file order, topics in unit order. */
export const spineOrder: string[] = units.flatMap((u) => u.topics ?? []);
export const spineIndex = new Map(spineOrder.map((id, i) => [id, i]));

/** Sets a topic owns: those it lists, plus standalone sets that back-reference it. */
export const standaloneByTopic = new Map<string, SetFile[]>();
for (const set of sets.values()) {
  if (!STANDALONE_ROLES.has(set.data.role ?? 'practice')) continue;
  const owner = set.data.topic;
  if (!owner) continue;
  standaloneByTopic.set(owner, [...(standaloneByTopic.get(owner) ?? []), set]);
}

/** Reverse edges — what needs this topic, what deepens it, what it is related from. */
export const neededBy = new Map<string, string[]>();
export const deepenedBy = new Map<string, string[]>();
export const relatedFrom = new Map<string, string[]>();
for (const node of nodes.values()) {
  for (const p of node.prerequisites ?? []) neededBy.set(p, [...(neededBy.get(p) ?? []), node.id]);
  for (const d of node.deepens ?? []) deepenedBy.set(d, [...(deepenedBy.get(d) ?? []), node.id]);
  for (const r of node.related ?? []) relatedFrom.set(r, [...(relatedFrom.get(r) ?? []), node.id]);
}

/** Inventory rows a topic owns: it introduces one of the row's tags, or is named in taught_in. */
export const inventoryByTopic = new Map<string, GrammarPoint[]>();
for (const point of inventory) {
  const owners = new Set<string>();
  for (const tag of point.focus ?? []) {
    const owner = focusIntroducedBy[tag];
    if (owner) owners.add(owner);
  }
  for (const t of point.taught_in ?? []) owners.add(t);
  for (const owner of owners)
    inventoryByTopic.set(owner, [...(inventoryByTopic.get(owner) ?? []), point]);
}

/** focus tag → every item carrying it, with the set it lives in. The Fokus view's whole content. */
export interface TaggedItem {
  set: SetFile;
  itemId: string;
  type: string;
  preview?: boolean;
}
export const itemsByTag = new Map<string, TaggedItem[]>();
for (const set of sets.values())
  for (const item of set.data.items ?? []) {
    if (!item.focus) continue;
    itemsByTag.set(item.focus, [
      ...(itemsByTag.get(item.focus) ?? []),
      { set, itemId: item.id, type: item.type, preview: item.preview },
    ]);
  }

/** The point(s) whose tags a topic's article should be explaining, per strand. */
export const pointsByStrand = new Map<GrammarStrand, GrammarPoint[]>();
for (const strand of GRAMMAR_STRANDS) pointsByStrand.set(strand, []);
for (const point of inventory) {
  if (!point.strand) continue;
  pointsByStrand.set(point.strand, [...(pointsByStrand.get(point.strand) ?? []), point]);
}
for (const list of pointsByStrand.values())
  list.sort(
    (a, b) =>
      LEVELS.indexOf(productionLevel(a)) - LEVELS.indexOf(productionLevel(b)) ||
      a.id.localeCompare(b.id),
  );

/** Reverse `deepens`: point id → the points that build on it. */
export const deepenedByPoint = new Map<string, string[]>();
for (const point of inventory)
  for (const base of point.deepens ?? [])
    deepenedByPoint.set(base, [...(deepenedByPoint.get(base) ?? []), point.id]);

/** entry ref → the inventory rows claiming it, for the Quellen view. */
export const claimsByEntry = new Map<string, string[]>();
for (const point of inventory)
  for (const ref of point.claims ?? [])
    claimsByEntry.set(ref, [...(claimsByEntry.get(ref) ?? []), point.id]);

export { productionLevel, receptionLevel, entryRef, GRAMMAR_STRANDS };
export type { GrammarPoint, GrammarStrand, TagDepth, PointDepth, LevelDepth, StructureCoverage, StructureSource, Coverage, GrammarCoverage, Level, AtlasUnit, AtlasNode, VocabFile };

// ---------------------------------------------------------------------------
// Item mix
// ---------------------------------------------------------------------------

export interface ItemMix {
  total: number;
  byType: Map<string, number>;
  translate: number;
  mc: number;
  selection: number;
  mcPercent: number;
  selectionPercent: number;
  /** '' fine · 'at' exactly at the bar · 'over' past it (a validator failure) */
  translateFlag: '' | 'at' | 'over';
  mcFlag: '' | 'at' | 'over';
  selectionFlag: '' | 'at' | 'over';
}

/**
 * The item mix over a topic's `role: practice` sets, counted by validate.ts's rule:
 * `audio-comprehension` is excluded from both sides, because the bar governs written formats and a
 * listening task cannot ask for production at all.
 */
export function itemMix(topicId: string): ItemMix | undefined {
  const topic = topics.get(topicId)?.data;
  if (!topic) return undefined;
  const items = (topic.exercises ?? [])
    .filter((id) => sets.get(id)?.data.role === 'practice')
    .flatMap((id) => sets.get(id)!.data.items ?? [])
    .filter((i) => i.type !== 'audio-comprehension');
  if (!items.length) return undefined;
  const byType = new Map<string, number>();
  for (const i of items) byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
  const count = (t: string) => byType.get(t) ?? 0;
  const total = items.length;
  const translate = count('translate');
  const mc = count('mc');
  const selection = mc + count('match') + count('order');
  return {
    total,
    byType,
    translate,
    mc,
    selection,
    mcPercent: (100 * mc) / total,
    selectionPercent: (100 * selection) / total,
    translateFlag: translate < MIN_TRANSLATE ? 'over' : translate === MIN_TRANSLATE ? 'at' : '',
    mcFlag: mc * 3 > total ? 'over' : mc * 3 === total ? 'at' : '',
    selectionFlag:
      selection * 100 > total * MAX_SELECTION_PERCENT
        ? 'over'
        : selection * 100 === total * MAX_SELECTION_PERCENT
          ? 'at'
          : '',
  };
}

// ---------------------------------------------------------------------------
// Gaps — the derived nodes, and the reason this console exists
// ---------------------------------------------------------------------------

/**
 * A hole, of a named class, with the thing that would close it.
 *
 * Each class is a question no single artifact can answer about itself, which is exactly why they
 * were all invisible: a topic file cannot know that its Erklärung has no subsections *relative to
 * the rule*, an inventory row cannot know that no probe re-asks it, and a Wortliste `~` cannot know
 * that no grammar point claims the structure it is standing in for.
 */
export interface Gap {
  kind:
    | 'unclaimed-structure'
    | 'untaught-point'
    | 'no-probe'
    | 'thin-tag'
    | 'single-file-tag'
    | 'no-erklaerung-subsections'
    | 'unanchored-level';
  level?: Level;
  /** what is missing, in one line */
  what: string;
  /** where it is, as a route or a repo path */
  where: string;
  /** the route the console can jump to, if any */
  route?: string;
  detail?: string;
}

export function gaps(): Gap[] {
  const out: Gap[] = [];

  for (const level of CONSOLE_LEVELS) {
    const s = structures.get(level);
    if (!s) continue;
    if (!s.anchored) {
      out.push({
        kind: 'unanchored-level',
        level,
        what: `${level} hat keine externe Quelle`,
        where: 'data/strukturenlisten/',
        detail:
          'Ohne Strukturenliste misst sich das Inventar dieses Niveaus nur an sich selbst. Welches Dokument fehlt und was es kostet, steht in data/strukturenlisten/README.md.',
      });
      continue;
    }
    for (const entry of s.unclaimed)
      out.push({
        kind: 'unclaimed-structure',
        level,
        what: entry.entry.de,
        where: `${entry.sourceId} · ${entry.section.de}${entry.section.page ? `, S. ${entry.section.page}` : ''}`,
        route: `#quellen-${entry.sourceId}`,
        detail: entry.entry.specified ? `in der Quelle nur ${entry.entry.specified}` : undefined,
      });

    const g = grammar.get(level);
    for (const p of g?.points ?? [])
      if (p.status === 'missing')
        out.push({
          kind: 'untaught-point',
          level,
          what: p.point.de,
          where: p.point.id,
          route: `#struktur-${p.point.id}`,
          detail: `kein practice/drill-Item trägt: ${p.unmetTags.join(', ')}`,
        });

    const d = depth.get(level);
    for (const p of d?.points ?? []) {
      if (p.teaching > 0 && p.probe === 0)
        out.push({
          kind: 'no-probe',
          level,
          what: p.point.de,
          where: p.point.id,
          route: `#struktur-${p.point.id}`,
          detail: `${p.teaching} Übungsitems, aber keine verzögerte Kontrolle`,
        });
    }
    for (const t of d?.tags ?? []) {
      if (t.teaching > 0 && t.teaching <= 3)
        out.push({
          kind: 'thin-tag',
          level,
          what: t.tag,
          where: t.introducedBy ?? '—',
          route: `#fokus-${t.tag}`,
          detail: `nur ${t.teaching} Übungsitems (${t.production} produktiv)`,
        });
      if (t.files === 1)
        out.push({
          kind: 'single-file-tag',
          level,
          what: t.tag,
          where: t.introducedBy ?? '—',
          route: `#fokus-${t.tag}`,
          detail: 'in genau einer Übungsdatei — einmal geübt, nie verteilt wiederholt',
        });
    }
  }

  for (const [id, topic] of topics)
    if (topic.headings.some((h) => h.depth === 2 && h.text.trim().startsWith('Erklärung')) && !topic.erklaerungSubsections.length)
      out.push({
        kind: 'no-erklaerung-subsections',
        level: topic.data.level,
        what: topic.data.title_de ?? id,
        where: topic.file,
        route: `#topic-${id}`,
        detail: 'keine ###-Abschnitte in ## Erklärung — die benannten Verwechslungen haben keinen Anker',
      });

  return out;
}

export const GAP_LABELS: Record<Gap['kind'], { de: string; why: string }> = {
  'unclaimed-structure': {
    de: 'Struktur ohne Inventarzeile',
    why: 'Eine veröffentlichte Norm führt sie, das Inventar dieses Kurses kennt sie nicht — der Nenner selbst ist unvollständig.',
  },
  'untaught-point': {
    de: 'Inventarzeile ohne Unterricht',
    why: 'Die Zeile existiert, aber kein practice- oder drill-Item trägt ihren Fokus-Tag.',
  },
  'no-probe': {
    de: 'ohne verzögerte Kontrolle',
    why: 'Geübt, aber nie nach einem Intervall erneut gefragt — der Lernzyklus endet vor seinem letzten Schritt.',
  },
  'thin-tag': {
    de: 'sehr wenig Übung',
    why: 'Drei Items oder weniger. Kein Grenzwert, nur ein Ausreißer gegen den Median des Niveaus.',
  },
  'single-file-tag': {
    de: 'in nur einer Übungsdatei',
    why: 'Einmal geübt und nie wieder verteilt — verteiltes Üben und Verschachteln finden nicht statt.',
  },
  'no-erklaerung-subsections': {
    de: 'Erklärung ohne ###-Abschnitte',
    why: 'CLAUDE.md verlangt einen Abschnitt je benannter Verwechslung; ohne ihn ist die Stelle, die eine Struktur erklärt, nicht adressierbar.',
  },
  'unanchored-level': {
    de: 'Niveau ohne externe Quelle',
    why: 'Das Inventar dieses Niveaus misst sich nur an sich selbst — genau der Zustand, in dem A1 monatelang 100% meldete.',
  },
};
