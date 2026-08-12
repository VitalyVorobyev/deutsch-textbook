/**
 * Redaktion — the editorial console. Run with: bun run redaktion
 *
 * WHAT IT IS. One self-contained HTML file at `redaktion/index.html` holding the
 * editorial specification of the whole corpus: what each level contains, the spine in
 * `content/atlas.yaml` file order with a presence badge per shipping-checklist artifact,
 * the full spec of every topic (frontmatter, outcomes, edges in both directions, sets,
 * readings, decks, the grammar-inventory rows it owns, repo paths + GitHub links), and
 * `data/grammar-inventory.yaml` grouped by the level its standard puts it at.
 *
 * WHY IT IS INDEPENDENT OF THE PRODUCT. The site teaches; this reads the repo *as an
 * editorial object* and asks questions no learner ever asks — which topic is missing a
 * probe, which inventory row is taught a level away from where its standard puts it,
 * which source citation backs a row. Wiring that into the Astro build would give the
 * learner-facing product a second audience and a second set of reasons to change. So it
 * is a generated instrument like `public/exams/`: `redaktion/` is gitignored, the file
 * is regenerated on demand, it makes zero network requests and it opens from `file://`.
 *
 * EVERY FIGURE IS COMPUTED AT GENERATION TIME, never written by hand — the same rule the
 * Über page is held to. The two coverage measurements are *imported*, not reimplemented
 * (`src/lib/grammar-coverage.ts`, `src/lib/coverage.ts`), so this console and
 * `bun scripts/grammar-coverage.ts` / `bun scripts/coverage.ts` cannot disagree; anything
 * counted here instead (sets, items, item mix, glosses, edges) is counted from the same
 * files the validator reads, by the same rule it uses. If a number here contradicts a
 * script, this loader is wrong.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
} from '../src/lib/schemas';
import {
  grammarCoverage,
  loadGrammarInventory,
  type GrammarCoverage,
  type GrammarPoint,
} from '../src/lib/grammar-coverage';
import { goetheCoverage, hasManifest, type Coverage } from '../src/lib/coverage';
import { focusIntroducedBy } from '../src/lib/focus-tags';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');
const OUT_DIR = join(ROOT, 'redaktion');
const OUT_FILE = join(OUT_DIR, 'index.html');
const GITHUB = 'https://github.com/VitalyVorobyev/deutsch-textbook/blob/main';

/** The item-mix bars from CLAUDE.md, applied over a topic's `role: practice` sets. */
const MIN_TRANSLATE = 2;
const MAX_MC_PERCENT = 100 / 3;
const MAX_SELECTION_PERCENT = 45;

/** Roles that own their own page and sit in no topic's `exercises` list. */
const STANDALONE_ROLES = new Set(['checkpoint', 'probe', 'placement', 'exam-practice']);

/** Problems found while loading — surfaced in the console header rather than thrown. */
const loadNotes: string[] = [];

// ---------------------------------------------------------------------------
// Loading — node:fs + yaml + the repo's own schemas, exactly as validate.ts does
// ---------------------------------------------------------------------------

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}

const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

/**
 * Parse against the repo schema, but never die on a content error: this is the
 * instrument an editor opens *while* authoring, so a half-written file must degrade to
 * a note in the header rather than an empty page. Raw data is used on failure, and every
 * reader below is defensive about missing arrays for exactly that case.
 */
function coerce<T>(schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } }, raw: unknown, where: string): T {
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

function readYaml<T>(file: string, schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown } }): T | undefined {
  try {
    return coerce<T>(schema, YAML.parse(readFileSync(file, 'utf8')), rel(file));
  } catch (e) {
    loadNotes.push(`${rel(file)}: YAML parse error: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}

interface TopicFile {
  data: Topic;
  file: string;
  /** German H2/H3 headings, in order — the article skeleton, visible as an outline */
  headings: { depth: number; text: string }[];
}

const topics = new Map<string, TopicFile>();
for (const file of listFiles(join(CONTENT, 'topics'), '.mdx')) {
  const src = readFileSync(file, 'utf8');
  const data = coerce<Topic>(topicSchema, parseFrontmatter(src, rel(file)), rel(file));
  const id = data?.id ?? file.split(sep).at(-1)!.replace(/\.mdx$/, '');
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '');
  const headings = [...body.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((m) => ({
    depth: m[1]!.length,
    text: m[2]!,
  }));
  topics.set(id, { data, file: rel(file), headings });
}

interface SetFile {
  id: string;
  data: ExerciseSet;
  file: string;
  level: Level;
}

const sets = new Map<string, SetFile>();
const exercisesBase = join(CONTENT, 'exercises');
for (const file of listFiles(exercisesBase, '.yaml')) {
  const data = readYaml<ExerciseSet>(file, exerciseSetSchema);
  if (!data) continue;
  const parts = relative(exercisesBase, file).split(sep);
  const id = parts.join('/').replace(/\.yaml$/, '');
  sets.set(id, { id, data, file: rel(file), level: parts[0]!.toUpperCase() as Level });
}

interface ReadingFile {
  id: string;
  data: Reading;
  file: string;
  level: Level;
  words: number;
  glosses: number;
}

const readings = new Map<string, ReadingFile>();
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

const vocab = new Map<string, { id: string; data: VocabFile; file: string }>();
for (const file of listFiles(join(CONTENT, 'vocab'), '.yaml')) {
  const data = readYaml<VocabFile>(file, vocabFileSchema);
  if (!data) continue;
  const id = data.id ?? file.split(sep).at(-1)!.replace(/\.yaml$/, '');
  vocab.set(id, { id, data, file: rel(file) });
}

const atlasFile = join(CONTENT, 'atlas.yaml');
const atlas = readYaml<{ nodes: AtlasNode[]; units: AtlasUnit[] }>(atlasFile, atlasSchema) ?? {
  nodes: [],
  units: [],
};
const nodes = new Map((atlas.nodes ?? []).map((n) => [n.id, n]));
const units = atlas.units ?? [];

/**
 * The inventory is the console's backbone, but a malformed YAML here must still
 * produce a page saying so rather than a stack trace — the editor is likely to be
 * mid-edit in this very file when they open the console.
 */
let inventory: GrammarPoint[] = [];
try {
  inventory = loadGrammarInventory(ROOT);
} catch (e) {
  loadNotes.push(
    `data/grammar-inventory.yaml: ${e instanceof Error ? e.message : e} — Inventar und Grammatik-Abdeckung fehlen auf dieser Seite`,
  );
}

/** Levels the console reports on: those that actually have a topics directory. */
const CONSOLE_LEVELS: Level[] = LEVELS.filter((l) =>
  existsSync(join(CONTENT, 'topics', l.toLowerCase())),
);

/**
 * Both coverage figures are IMPORTED, never recomputed, so this console and
 * `bun scripts/grammar-coverage.ts` / `bun scripts/coverage.ts` read the same
 * measurement out of the same module. A level whose measurement throws is reported
 * as absent rather than as zero — a level with no figure must not claim one.
 */
const grammar = new Map<Level, GrammarCoverage>();
const wortliste = new Map<Level, Coverage>();
for (const level of CONSOLE_LEVELS) {
  if (inventory.length) {
    try {
      grammar.set(level, grammarCoverage(level, ROOT));
    } catch (e) {
      loadNotes.push(`Grammatik-Abdeckung ${level}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!hasManifest(level, ROOT)) continue;
  try {
    wortliste.set(level, goetheCoverage(level, ROOT));
  } catch (e) {
    loadNotes.push(`Wortliste-Abdeckung ${level}: ${e instanceof Error ? e.message : e}`);
  }
}

// ---------------------------------------------------------------------------
// Derived indexes
// ---------------------------------------------------------------------------

/** topic id → the focus tags it introduces (the inverse of focusIntroducedBy). */
const introducedTags = new Map<string, string[]>();
for (const [tag, topic] of Object.entries(focusIntroducedBy)) {
  introducedTags.set(topic, [...(introducedTags.get(topic) ?? []), tag]);
}
for (const list of introducedTags.values()) list.sort();

/** topic id → its unit, from `units:` file order. */
const unitOfTopic = new Map<string, AtlasUnit>();
for (const unit of units) for (const t of unit.topics ?? []) unitOfTopic.set(t, unit);

/** Spine order: units in file order, topics in unit order. */
const spineOrder: string[] = units.flatMap((u) => u.topics ?? []);
const spineIndex = new Map(spineOrder.map((id, i) => [id, i]));

/** Sets a topic owns: those it lists, plus standalone sets that back-reference it. */
const standaloneByTopic = new Map<string, SetFile[]>();
for (const set of sets.values()) {
  if (!STANDALONE_ROLES.has(set.data.role ?? 'practice')) continue;
  const owner = set.data.topic;
  if (!owner) continue;
  standaloneByTopic.set(owner, [...(standaloneByTopic.get(owner) ?? []), set]);
}

/** Reverse edges — what needs this topic, what deepens it, what it is related from. */
const neededBy = new Map<string, string[]>();
const deepenedBy = new Map<string, string[]>();
const relatedFrom = new Map<string, string[]>();
for (const node of nodes.values()) {
  for (const p of node.prerequisites ?? []) neededBy.set(p, [...(neededBy.get(p) ?? []), node.id]);
  for (const d of node.deepens ?? []) deepenedBy.set(d, [...(deepenedBy.get(d) ?? []), node.id]);
  for (const r of node.related ?? []) relatedFrom.set(r, [...(relatedFrom.get(r) ?? []), node.id]);
}

/** Inventory rows a topic owns: it introduces one of the row's tags, or is named in taught_in. */
const inventoryByTopic = new Map<string, GrammarPoint[]>();
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

interface ItemMix {
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
 * `audio-comprehension` is excluded from both sides, because the bar governs written
 * formats and a listening task cannot ask for production at all.
 */
function itemMix(topicId: string): ItemMix | undefined {
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
// HTML helpers
// ---------------------------------------------------------------------------

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pct = (n: number): string => `${Math.round(n)}%`;
const pct1 = (n: number): string => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

type ChipState = 'ok' | 'miss' | 'none' | 'warn' | 'info';

const chip = (state: ChipState, label: string, title = ''): string =>
  `<span class="chip ${state}"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</span>`;

/** A repo path with the GitHub link beside it. */
const path = (p: string): string =>
  `<span class="path"><code>${esc(p)}</code> <a class="gh" href="${GITHUB}/${esc(p)}" title="auf GitHub öffnen">↗</a></span>`;

const anchor = (id: string, text: string): string =>
  `<a class="topic-link" href="#topic-${esc(id)}">${esc(text)}</a>`;

/** Links to a topic anchor when the topic exists; plain code when the id dangles. */
const topicRef = (id: string): string =>
  topics.has(id)
    ? `<a class="topic-link" href="#topic-${esc(id)}"><code>${esc(id)}</code></a>`
    : `<code class="dangling" title="kein Thema mit dieser id">${esc(id)}</code>`;

const histogram = (counts: Map<string, number>): string =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `<span class="hist"><span class="hist-k">${esc(k)}</span><span class="hist-v">${v}</span></span>`)
    .join('');

const table = (head: string[], rows: string[][], cls = ''): string =>
  `<div class="scroll"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  `</tbody></table></div>`;

/** The lowercase blob the client-side filter matches against. */
const searchKey = (...parts: (string | undefined)[]): string =>
  esc(parts.filter(Boolean).join(' ').toLowerCase());

// ---------------------------------------------------------------------------
// View 1 — Überblick
// ---------------------------------------------------------------------------

function levelStats(level: Level) {
  const levelTopics = [...topics.values()].filter((t) => t.data.level === level);
  const levelSets = [...sets.values()].filter((s) => s.level === level);
  const levelReadings = [...readings.values()].filter((r) => r.level === level);
  const levelVocab = [...vocab.values()].filter((v) => v.data.level === level);
  const byRole = new Map<string, number>();
  for (const s of levelSets) byRole.set(s.data.role ?? 'practice', (byRole.get(s.data.role ?? 'practice') ?? 0) + 1);
  return {
    units: units.filter((u) => u.level === level).length,
    topics: levelTopics,
    reviewed: levelTopics.filter((t) => t.data.status === 'reviewed').length,
    sets: levelSets,
    byRole,
    items: levelSets.reduce((n, s) => n + (s.data.items?.length ?? 0), 0),
    readings: levelReadings,
    intensive: levelReadings.filter((r) => (r.data.kind ?? 'intensive') === 'intensive').length,
    vocab: levelVocab,
    entries: levelVocab.reduce((n, v) => n + (v.data.entries?.length ?? 0), 0),
    outcomes: levelTopics.reduce((n, t) => n + (nodes.get(t.data.id)?.outcomes?.length ?? 0), 0),
  };
}

function renderUeberblick(): string {
  const cards = CONSOLE_LEVELS.map((level) => {
    const s = levelStats(level);
    const g = grammar.get(level);
    const w = wortliste.get(level);

    const grammarRows = (g?.points ?? []).map((p) => {
      const owners = [...new Set((p.point.focus ?? []).map((t) => focusIntroducedBy[t]).filter(Boolean))] as string[];
      const taughtBy = p.point.reference_only ? (p.point.taught_in ?? []) : owners;
      const mark = p.status === 'covered' ? '✓' : p.status === 'late' ? '~' : '✗';
      return [
        `<span class="status-${p.status}">${mark}</span>`,
        `<code>${esc(p.point.id)}</code>`,
        esc(p.point.de),
        taughtBy.length ? taughtBy.map(topicRef).join(' ') : '<span class="muted">—</span>',
        p.status === 'late'
          ? `<span class="status-late">${esc(p.taughtAt ?? '')}</span>`
          : p.unmetTags.length
            ? `<span class="status-missing">${esc(p.unmetTags.join(', '))}</span>`
            : '<span class="muted">—</span>',
      ];
    });

    const wortlisteBlock = w
      ? `<div class="metric">
           <div class="metric-head"><span>Wortliste</span><b>${w.cards + w.grammar}/${w.total}</b><span class="pcttag">${pct(w.percent)}</span></div>
           <div class="bar"><span class="bar-cards" style="width:${(100 * w.cards) / w.total}%"></span><span class="bar-grammar" style="width:${(100 * w.grammar) / w.total}%"></span></div>
           <div class="metric-sub">${w.cards} als Karten · ${w.grammar} als Grammatik (<code>~</code>) · ${w.missing} fehlen${w.unearned.length ? ` · <span class="status-missing">${w.unearned.length} unbelegte <code>~</code></span>` : ''}</div>
         </div>`
      : `<div class="metric"><div class="metric-head"><span>Wortliste</span><b class="muted">keine Wortliste</b></div>
           <div class="metric-sub">Kein <code>data/goethe-${level.toLowerCase()}-wortliste.txt</code> — dieses Niveau hat keine Abdeckungszahl und darf keine behaupten.</div></div>`;

    const roleLine = [...s.byRole.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([role, n]) => `<span class="hist"><span class="hist-k">${esc(role)}</span><span class="hist-v">${n}</span></span>`)
      .join('');

    return `<section class="card" data-group>
      <h3 id="ueberblick-${esc(level)}">${esc(level)}</h3>
      <div class="kpis">
        <div class="kpi"><b>${s.units}</b><span>Einheiten</span></div>
        <div class="kpi"><b>${s.topics.length}</b><span>Themen</span></div>
        <div class="kpi"><b>${s.reviewed}/${s.topics.length}</b><span>reviewed</span></div>
        <div class="kpi"><b>${s.outcomes}</b><span>Outcomes</span></div>
        <div class="kpi"><b>${s.sets.length}</b><span>Übungssätze</span></div>
        <div class="kpi"><b>${s.items}</b><span>Items</span></div>
        <div class="kpi"><b>${s.readings.length}</b><span>Lesetexte</span></div>
        <div class="kpi"><b>${s.vocab.length}</b><span>Vokabeldecks</span></div>
        <div class="kpi"><b>${s.entries}</b><span>Vokabeln</span></div>
      </div>

      ${
        g
          ? `<div class="metric">
        <div class="metric-head"><span>Grammatik-Inventar</span><b>${g.taught}/${g.total}</b><span class="pcttag">${pct(g.percent)}</span></div>
        <div class="bar"><span class="bar-cards" style="width:${g.total ? (100 * g.covered) / g.total : 0}%"></span><span class="bar-late" style="width:${g.total ? (100 * g.late) / g.total : 0}%"></span></div>
        <div class="metric-sub">${g.covered} abgedeckt · ${g.late} spät gelehrt · ${g.missing} fehlen</div>
        <details><summary>Punkt für Punkt — wer lehrt was</summary>
          ${table(['', 'Punkt', 'Struktur (de)', 'gelehrt von', 'Hinweis'], grammarRows, 'compact')}
        </details>
      </div>`
          : `<div class="metric"><div class="metric-head"><span>Grammatik-Inventar</span><b class="muted">nicht messbar</b></div>
        <div class="metric-sub">Das Inventar konnte nicht gelesen werden — siehe die Ladehinweise oben.</div></div>`
      }

      ${wortlisteBlock}

      <div class="metric">
        <div class="metric-head"><span>Sätze nach Rolle</span></div>
        <div class="metric-sub hists">${roleLine}</div>
        <div class="metric-sub">Lesetexte: ${s.intensive} intensiv · ${s.readings.length - s.intensive} extensiv</div>
      </div>
    </section>`;
  }).join('');

  return `<section class="view" id="view-ueberblick">
    <h2>Überblick</h2>
    <p class="lede">Jede Zahl auf dieser Seite wird beim Generieren aus <code>content/</code> und <code>data/</code> berechnet — keine ist von Hand geschrieben. Die beiden Abdeckungsmaße stammen aus denselben Modulen wie <code>bun scripts/grammar-coverage.ts</code> und <code>bun scripts/coverage.ts</code>.</p>
    <p class="note">Zählweise: Übungssätze und Lesetexte nach ihrem Verzeichnis (<code>content/exercises/&lt;level&gt;/</code>), Vokabeldecks nach ihrem deklarierten <code>level</code>, Themen nach der Frontmatter. Outcomes stammen aus dem Atlas-Knoten.</p>
    <div class="cards">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// View 2 — Lernpfad (spine)
// ---------------------------------------------------------------------------

interface Presence {
  article: SetPresenceChip;
  pretest: SetPresenceChip;
  primary: SetPresenceChip;
  extra: SetPresenceChip;
  probe: SetPresenceChip;
  reading: SetPresenceChip;
  vocabDeck: SetPresenceChip;
  outcomes: SetPresenceChip;
  tags: SetPresenceChip;
}
interface SetPresenceChip {
  state: ChipState;
  label: string;
  title: string;
}

function presence(id: string): Presence {
  const topic = topics.get(id);
  const data = topic?.data;
  const node = nodes.get(id);
  const listed = (data?.exercises ?? []).map((e) => sets.get(e)).filter(Boolean) as SetFile[];
  const practice = listed.filter((s) => s.data.role === 'practice');
  const primary = practice[0];
  const extra = [...practice.slice(1), ...listed.filter((s) => s.data.role === 'drill')];
  const standalone = standaloneByTopic.get(id) ?? [];
  const probes = standalone.filter((s) => s.data.role === 'probe');
  const pretestSet = data?.pretest ? sets.get(data.pretest) : undefined;
  const topicReadings = (data?.reading ?? []).map((r) => readings.get(r)).filter(Boolean) as ReadingFile[];
  const decks = (data?.vocab ?? []).map((v) => vocab.get(v)).filter(Boolean);
  const outcomes = node?.outcomes ?? [];
  const tags = introducedTags.get(id) ?? [];
  const armed = probes.reduce((n, p) => n + (p.data.arming?.length ?? 0), 0);

  return {
    article: topic
      ? {
          state: data?.status === 'reviewed' ? 'ok' : 'warn',
          label: `Artikel · ${data?.status ?? 'draft'}`,
          title: topic.file,
        }
      : { state: 'miss', label: 'Artikel', title: 'keine .mdx-Datei' },
    pretest: pretestSet
      ? { state: 'ok', label: `Pretest ${pretestSet.data.items?.length ?? 0}`, title: pretestSet.file }
      : { state: 'miss', label: 'Pretest', title: 'kein pretest: in der Frontmatter' },
    primary: primary
      ? {
          state: 'ok',
          label: `Praxis ${primary.data.items?.length ?? 0}`,
          title: `primaryPractice: ${primary.id} (${primary.file})`,
        }
      : { state: 'miss', label: 'Praxis', title: 'kein role: practice Satz — der Lernpfad käme nie weiter' },
    extra: extra.length
      ? {
          state: 'info',
          label: `+${extra.length} ${extra.length === 1 ? 'Satz' : 'Sätze'}`,
          title: extra.map((s) => `${s.id} (${s.data.role})`).join(', '),
        }
      : { state: 'none', label: 'keine weiteren', title: 'nur der primäre Praxissatz' },
    probe: probes.length
      ? {
          state: 'ok',
          label: `Probe ${probes.map((p) => p.data.items?.length ?? 0).join('+')} · arming ${armed}`,
          title: probes.map((p) => p.file).join(', '),
        }
      : { state: 'miss', label: 'Probe', title: 'keine probe-<id>.yaml Familie' },
    reading: topicReadings.length
      ? {
          state: 'ok',
          label: `Lesen ${topicReadings.length}`,
          title: topicReadings.map((r) => `${r.id} (${r.data.kind ?? 'intensive'}, ${r.words} Wörter, ${r.glosses} Glossen)`).join(', '),
        }
      : { state: 'miss', label: 'Lesen', title: 'kein reading: in der Frontmatter' },
    vocabDeck: decks.length
      ? {
          state: 'info',
          label: `Deck ${decks.length}`,
          title: decks.map((d) => `${d!.id} (${d!.data.entries?.length ?? 0})`).join(', '),
        }
      : { state: 'none', label: 'kein Deck', title: 'das Thema führt kein eigenes Wortfeld ein' },
    outcomes: outcomes.length
      ? { state: 'ok', label: `Outcomes ${outcomes.length}`, title: outcomes.map((o) => o.id).join(', ') }
      : { state: 'miss', label: 'Outcomes', title: 'kein Atlas-Knoten oder keine Outcomes' },
    tags: tags.length
      ? { state: 'info', label: `Fokus ${tags.length}`, title: tags.join(', ') }
      : { state: 'none', label: 'kein Fokus', title: 'führt keinen neuen Fokus-Tag ein' },
  };
}

function mixLine(id: string): string {
  const mix = itemMix(id);
  if (!mix) return `<div class="mix muted">kein Praxis-Item</div>`;
  const flag = (f: string) => (f === 'over' ? ' <span class="flag over" title="über der Grenze">▲</span>' : f === 'at' ? ' <span class="flag at" title="genau an der Grenze">△</span>' : '');
  return `<div class="mix">
    <span class="mix-n">${mix.total} Praxis-Items</span>
    <span class="mix-f">translate <b>${mix.translate}</b><span class="cap">/ ≥ ${MIN_TRANSLATE}</span>${flag(mix.translateFlag)}</span>
    <span class="mix-f">mc <b>${pct1(mix.mcPercent)}</b><span class="cap">/ ≤ ${pct1(MAX_MC_PERCENT)}</span>${flag(mix.mcFlag)}</span>
    <span class="mix-f">Auswahl <b>${pct1(mix.selectionPercent)}</b><span class="cap">/ ≤ ${MAX_SELECTION_PERCENT}%</span>${flag(mix.selectionFlag)}</span>
  </div>`;
}

function renderLernpfad(): string {
  const orphanTopics = [...topics.keys()].filter((id) => !unitOfTopic.has(id));
  const orphanNote = orphanTopics.length
    ? `<p class="note warnnote">${orphanTopics.length} Thema/Themen in keiner Einheit: ${orphanTopics.map(topicRef).join(', ')}</p>`
    : '';

  const levels = CONSOLE_LEVELS.map((level) => {
    const levelUnits = units.filter((u) => u.level === level);
    const unitBlocks = levelUnits
      .map((unit, i) => {
        const rows = (unit.topics ?? [])
          .map((id) => {
            const topic = topics.get(id);
            const node = nodes.get(id);
            const p = presence(id);
            const chips = [p.article, p.pretest, p.primary, p.extra, p.probe, p.reading, p.vocabDeck, p.outcomes, p.tags]
              .map((c) => chip(c.state, c.label, c.title))
              .join('');
            return `<div class="row" data-search="${searchKey(id, topic?.data.title_de, topic?.data.title_en, topic?.data.title_ru, unit.title_de)}">
              <div class="row-head">
                <span class="row-title">${anchor(id, topic?.data.title_de ?? id)}</span>
                <code class="row-id">${esc(id)}</code>
                <span class="tag">${esc(topic?.data.kind ?? node?.kind ?? '?')}</span>
                <span class="tag alt">${esc(node?.strand ?? '?')}</span>
              </div>
              <div class="badges">${chips}</div>
              ${mixLine(id)}
            </div>`;
          })
          .join('');
        return `<section class="unit" data-group>
          <h4><span class="unit-n">${i + 1}</span> ${esc(unit.title_de)} <code>${esc(unit.id)}</code></h4>
          ${rows}
        </section>`;
      })
      .join('');
    return `<div class="level-block" data-group><h3 id="lernpfad-${esc(level)}">${esc(level)} <span class="muted">— ${levelUnits.length} Einheiten, ${levelUnits.reduce((n, u) => n + (u.topics?.length ?? 0), 0)} Themen</span></h3>${unitBlocks}</div>`;
  }).join('');

  return `<section class="view" id="view-lernpfad" hidden>
    <h2>Lernpfad</h2>
    <p class="lede">Die Reihenfolge der Einheiten in <code>content/atlas.yaml</code> <b>ist</b> der empfohlene Weg — sie wird hier unverändert wiedergegeben. Ein fehlendes Artefakt erscheint als hohles Chip, nicht als Lücke.</p>
    <p class="note">Chips: <span class="chip ok">vorhanden</span> <span class="chip warn">vorhanden, aber draft</span> <span class="chip miss">fehlt (Checkliste verlangt es)</span> <span class="chip info">optional, vorhanden</span> <span class="chip none">optional, nicht vorhanden</span>. Item-Mix über die <code>role: practice</code>-Sätze des Themas, <code>audio-comprehension</code> auf beiden Seiten ausgenommen — dieselbe Zählweise wie <code>scripts/validate.ts</code>.</p>
    ${orphanNote}
    ${levels}
  </section>`;
}

// ---------------------------------------------------------------------------
// View 3 — Themen-Detail
// ---------------------------------------------------------------------------

function setBlock(set: SetFile, primaryId?: string): string {
  const items = set.data.items ?? [];
  const types = new Map<string, number>();
  const focus = new Map<string, number>();
  let untagged = 0;
  let preview = 0;
  for (const item of items) {
    types.set(item.type, (types.get(item.type) ?? 0) + 1);
    if (item.focus) focus.set(item.focus, (focus.get(item.focus) ?? 0) + 1);
    else untagged++;
    if (item.preview) preview++;
  }
  const flags = [
    set.id === primaryId ? chip('ok', 'primaryPractice', 'Der erste role: practice Satz — seine Item-Liste darf nicht mehr wachsen') : '',
    set.data.arming?.length ? chip('info', `arming ${set.data.arming.length}`, (set.data.arming ?? []).join('\n')) : '',
    set.data.stimulus ? chip('info', `stimulus ${set.data.stimulus}`) : '',
    preview ? chip('warn', `preview ${preview}`, 'absichtliche Vorgriffe — zählen nicht als Lehrbeleg') : '',
  ]
    .filter(Boolean)
    .join('');
  return `<div class="set">
    <div class="set-head"><span class="role role-${esc(set.data.role ?? 'practice')}">${esc(set.data.role ?? 'practice')}</span>
      <code>${esc(set.id)}</code><span class="muted">${items.length} Items</span>${flags}</div>
    <div class="set-body">
      <div class="hists"><span class="hist-label">Typen</span>${histogram(types)}</div>
      <div class="hists"><span class="hist-label">Fokus</span>${focus.size ? histogram(focus) : '<span class="muted">keiner</span>'}${untagged ? `<span class="hist muted"><span class="hist-k">ohne Tag</span><span class="hist-v">${untagged}</span></span>` : ''}</div>
      ${path(set.file)}
    </div>
  </div>`;
}

function renderTopicDetail(id: string): string {
  const topic = topics.get(id);
  const data = topic?.data;
  const node = nodes.get(id);
  const unit = unitOfTopic.get(id);
  const listed = (data?.exercises ?? []).map((e) => sets.get(e)).filter(Boolean) as SetFile[];
  const primaryId = listed.find((s) => s.data.role === 'practice')?.id;
  const pretestSet = data?.pretest ? sets.get(data.pretest) : undefined;
  const standalone = standaloneByTopic.get(id) ?? [];
  const topicReadings = (data?.reading ?? []).map((r) => readings.get(r)).filter(Boolean) as ReadingFile[];
  const decks = ((data?.vocab ?? []).map((v) => vocab.get(v)).filter(Boolean)) as { id: string; data: VocabFile; file: string }[];
  const rows = inventoryByTopic.get(id) ?? [];
  const tags = introducedTags.get(id) ?? [];
  const p = presence(id);

  const outcomeRows = (node?.outcomes ?? []).map((o) => [
    `<code>${esc(o.id)}</code>`,
    `<span class="tag">${esc(o.mode)}</span>`,
    o.domain ? `<span class="tag alt">${esc(o.domain)}</span>` : '<span class="muted">—</span>',
    `<div class="lang"><b>de</b> ${esc(o.de)}</div><div class="lang"><b>en</b> ${esc(o.en)}</div><div class="lang"><b>ru</b> ${esc(o.ru)}</div>${o.uk ? `<div class="lang"><b>uk</b> ${esc(o.uk)}</div>` : '<div class="lang muted"><b>uk</b> —</div>'}`,
  ]);

  const edge = (label: string, ids: string[], hint: string) =>
    `<div class="edge"><span class="edge-label" title="${esc(hint)}">${esc(label)}</span>${ids.length ? ids.map(topicRef).join(' ') : '<span class="muted">—</span>'}</div>`;

  const inventoryRows = rows.map((r) => [
    `<code>${esc(r.id)}</code>`,
    `<span class="tag lvl-${esc(r.standard_level)}">${esc(r.standard_level)}</span>`,
    `<div><b>${esc(r.de)}</b></div><div class="muted">${esc(r.en)}</div>${r.note ? `<div class="rownote">${esc(r.note)}</div>` : ''}`,
    (r.focus ?? []).map((t) => `<code class="tagcode">${esc(t)}</code>`).join(' ') || (r.reference_only ? '<span class="tag alt">reference_only</span>' : '<span class="muted">—</span>'),
  ]);

  const headingOutline = (topic?.headings ?? [])
    .map((h) => `<span class="chip ${h.depth === 2 ? 'info' : 'none'}" title="H${h.depth}">${esc(h.text)}</span>`)
    .join('');

  return `<article class="topic-card" id="topic-${esc(id)}" data-search="${searchKey(id, data?.title_de, data?.title_en, data?.title_ru, ...(data?.tags ?? []), ...tags)}">
    <header class="topic-head">
      <h3>${esc(data?.title_de ?? id)}</h3>
      <div class="topic-meta">
        <code class="row-id">${esc(id)}</code>
        <span class="tag lvl-${esc(data?.level ?? '')}">${esc(data?.level ?? '?')}</span>
        <span class="tag">${esc(data?.kind ?? '?')}</span>
        <span class="tag alt">${esc(node?.strand ?? '?')}</span>
        <span class="tag alt">${esc(node?.group ?? '?')}</span>
        <span class="tag ${data?.status === 'reviewed' ? 'ok-tag' : 'warn-tag'}">${esc(data?.status ?? 'draft')}</span>
        ${unit ? `<span class="muted">Einheit <a class="topic-link" href="#lernpfad-${esc(data?.level ?? '')}">${esc(unit.title_de)}</a> (<code>${esc(unit.id)}</code>, Position ${(spineIndex.get(id) ?? 0) + 1} im Pfad)</span>` : '<span class="status-missing">in keiner Einheit</span>'}
      </div>
      <div class="titles">
        <div class="lang"><b>en</b> ${esc(data?.title_en)}</div>
        <div class="lang"><b>ru</b> ${esc(data?.title_ru)}</div>
        ${data?.title_uk ? `<div class="lang"><b>uk</b> ${esc(data.title_uk)}</div>` : '<div class="lang muted"><b>uk</b> —</div>'}
      </div>
      <div class="badges">${[p.article, p.pretest, p.primary, p.extra, p.probe, p.reading, p.vocabDeck, p.outcomes, p.tags].map((c) => chip(c.state, c.label, c.title)).join('')}</div>
      ${mixLine(id)}
      ${topic ? path(topic.file) : '<span class="status-missing">keine .mdx-Datei</span>'}
    </header>

    <h4>Artikel-Gliederung</h4>
    <div class="badges">${headingOutline || '<span class="muted">keine Überschriften</span>'}</div>
    ${data?.tags?.length ? `<div class="edge"><span class="edge-label">tags</span>${data.tags.map((t) => `<code class="tagcode">${esc(t)}</code>`).join(' ')}</div>` : ''}

    <h4>Kanten</h4>
    <div class="edges">
      ${edge('braucht (prerequisites)', node?.prerequisites ?? data?.prerequisites ?? [], 'Was vorher gekonnt sein muss')}
      ${edge('wird gebraucht von', neededBy.get(id) ?? [], 'Themen, die dieses als prerequisite führen')}
      ${edge('vertieft (deepens)', node?.deepens ?? [], 'Basisthemen, die dieses erneut aufgreift — die Kante trägt einen gemeinsamen Fokus-Tag')}
      ${edge('wird vertieft von', deepenedBy.get(id) ?? [], 'Themen, die dieses vertiefen')}
      ${edge('verwandt (related)', [...new Set([...(node?.related ?? []), ...(relatedFrom.get(id) ?? [])])], 'symmetrisch, nicht blockierend')}
    </div>

    <h4>Outcomes <span class="muted">${outcomeRows.length}</span></h4>
    ${outcomeRows.length ? table(['id', 'mode', 'domain', 'Can-do'], outcomeRows, 'outcomes') : '<p class="muted">keine — kein Atlas-Knoten?</p>'}

    <h4>Übungssätze</h4>
    ${pretestSet ? setBlock(pretestSet, primaryId) : '<p class="status-missing">kein Pretest</p>'}
    ${listed.length ? listed.map((s) => setBlock(s, primaryId)).join('') : '<p class="status-missing">keine gelisteten Sätze</p>'}
    ${standalone.length ? `<div class="sub">Eigenständige Sätze (Probe, Checkpoint, Placement — bewusst in keiner <code>exercises:</code>-Liste)</div>${standalone.map((s) => setBlock(s, primaryId)).join('')}` : ''}

    <h4>Lesetexte</h4>
    ${
      topicReadings.length
        ? table(
            ['id', 'Art', 'Wörter', 'Glossen', 'Fragen', 'Datei'],
            topicReadings.map((r) => [
              `<code>${esc(r.id)}</code>`,
              `<span class="tag">${esc(r.data.kind ?? 'intensive')}</span>`,
              String(r.words),
              String(r.glosses),
              String(r.data.questions?.length ?? 0),
              path(r.file),
            ]),
          )
        : '<p class="status-missing">kein Lesetext</p>'
    }

    <h4>Vokabeldecks</h4>
    ${
      decks.length
        ? table(
            ['id', 'Niveau', 'Einträge', 'Datei'],
            decks.map((d) => [
              `<code>${esc(d.id)}</code>`,
              `<span class="tag lvl-${esc(d.data.level)}">${esc(d.data.level)}</span>`,
              String(d.data.entries?.length ?? 0),
              path(d.file),
            ]),
          )
        : '<p class="muted">kein eigenes Wortfeld</p>'
    }

    <h4>Fokus-Tags, die dieses Thema einführt <span class="muted">${tags.length}</span></h4>
    <div class="badges">${tags.length ? tags.map((t) => `<code class="tagcode">${esc(t)}</code>`).join(' ') : '<span class="muted">keine</span>'}</div>

    <h4>Grammatik-Inventar <span class="muted">${rows.length} Zeile(n)</span></h4>
    <p class="note">Zeilen, deren Fokus-Tag dieses Thema einführt oder deren <code>taught_in</code> es nennt. Die <code>note:</code> trägt die Quellenangabe und steht darum vollständig hier.</p>
    ${inventoryRows.length ? table(['Punkt', 'Standard', 'Struktur & Quelle', 'Fokus'], inventoryRows, 'inv') : '<p class="muted">keine Inventarzeile</p>'}
  </article>`;
}

function renderDetail(): string {
  const ordered = [
    ...spineOrder.filter((id) => topics.has(id)),
    ...[...topics.keys()].filter((id) => !spineIndex.has(id)),
  ];
  return `<section class="view" id="view-detail" hidden>
    <h2>Themen-Detail</h2>
    <p class="lede">Die vollständige Spezifikation je Thema, in Pfadreihenfolge. Jeder Pfad verlinkt auf GitHub; jede Kante ist in beide Richtungen aufgeführt.</p>
    ${ordered.map(renderTopicDetail).join('')}
  </section>`;
}

// ---------------------------------------------------------------------------
// View 4 — Inventar
// ---------------------------------------------------------------------------

function renderInventar(): string {
  const byLevel = new Map<string, GrammarPoint[]>();
  for (const p of inventory) byLevel.set(p.standard_level, [...(byLevel.get(p.standard_level) ?? []), p]);

  const blocks = [...byLevel.keys()]
    .sort((a, b) => LEVELS.indexOf(a as Level) - LEVELS.indexOf(b as Level))
    .map((level) => {
      const points = byLevel.get(level)!;
      const cov = grammar.get(level as Level);
      const statusOf = new Map((cov?.points ?? []).map((r) => [r.point.id, r]));
      const rows = points.map((point) => {
        const result = statusOf.get(point.id);
        const teachers = point.reference_only
          ? (point.taught_in ?? []).map((t) => ({ topic: t, tag: undefined as string | undefined }))
          : (point.focus ?? []).map((tag) => ({ topic: focusIntroducedBy[tag], tag }));
        const teacherCells = teachers.length
          ? teachers
              .map(({ topic, tag }) => {
                if (!topic)
                  return `<div class="teacher"><span class="status-missing">nicht registriert</span>${tag ? ` <code class="tagcode">${esc(tag)}</code>` : ''}</div>`;
                const tLevel = topics.get(topic)?.data.level;
                const mismatch = tLevel && tLevel !== level;
                return `<div class="teacher${mismatch ? ' mismatch' : ''}">${topicRef(topic)} <span class="tag lvl-${esc(tLevel ?? '')}">${esc(tLevel ?? '?')}</span>${mismatch ? `<span class="flag over" title="Zeile steht im Standard bei ${esc(level)}, gelehrt wird sie im ${esc(tLevel)}-Material">▲</span>` : ''}${tag ? ` <code class="tagcode">${esc(tag)}</code>` : ''}</div>`;
              })
              .join('')
          : '<span class="muted">—</span>';
        const marks = [
          point.reference_only ? chip('info', 'reference_only', 'benennt keine Verwechslung — bezahlt mit taught_in') : '',
          result ? chip(result.status === 'covered' ? 'ok' : result.status === 'late' ? 'warn' : 'miss', result.status === 'covered' ? 'abgedeckt' : result.status === 'late' ? `spät (${result.taughtAt})` : 'fehlt', result.unmetTags.length ? `kein practice/drill-Item trägt: ${result.unmetTags.join(', ')}` : '') : '',
        ]
          .filter(Boolean)
          .join('');
        return [
          `<code>${esc(point.id)}</code>${marks ? `<div class="badges">${marks}</div>` : ''}`,
          `<div><b>${esc(point.de)}</b></div><div class="muted">${esc(point.en)}</div>${point.note ? `<div class="rownote">${esc(point.note)}</div>` : ''}`,
          teacherCells,
        ];
      });
      return `<div class="level-block" data-group>
        <h3 id="inventar-${esc(level)}">${esc(level)} <span class="muted">— ${points.length} Zeilen${cov ? `, ${cov.taught}/${cov.total} gelehrt` : ''}</span></h3>
        <div class="scroll"><table class="inv"><thead><tr><th>Punkt</th><th>Struktur, Beschreibung &amp; Quelle</th><th>eingeführt von (Niveau des Materials)</th></tr></thead><tbody>
        ${rows
          .map(
            (r, i) =>
              `<tr data-search="${searchKey(points[i]!.id, points[i]!.de, points[i]!.en, ...(points[i]!.focus ?? []), ...(points[i]!.taught_in ?? []))}">${r.map((c) => `<td>${c}</td>`).join('')}</tr>`,
          )
          .join('')}
        </tbody></table></div>
      </div>`;
    })
    .join('');

  return `<section class="view" id="view-inventar" hidden>
    <h2>Inventar</h2>
    <p class="lede">Jede Zeile aus <code>data/grammar-inventory.yaml</code>, gruppiert nach <code>standard_level</code> — also danach, wo die Prüfungsnorm den Punkt ansetzt. Daneben steht das Niveau des Materials, das ihn tatsächlich lehrt: weichen beide voneinander ab, ist die Zeile mit ▲ markiert. Genau diese Abweichung ist der „falsch vollständige Nenner“, für den dieses Instrument existiert.</p>
    <p class="note">Regierende Dokumente:
      <a class="doc" href="${GITHUB}/docs/curriculum/a2-b1.md">docs/curriculum/a2-b1.md ↗</a> (der eingefrorene Kontrakt) ·
      <a class="doc" href="${GITHUB}/docs/curriculum/level-completeness-audit.md">docs/curriculum/level-completeness-audit.md ↗</a> (das Audit vom 2026-08-12, das diese Konsole ausgelöst hat) ·
      <a class="doc" href="${GITHUB}/data/grammar-inventory.yaml">data/grammar-inventory.yaml ↗</a> ·
      <a class="doc" href="${GITHUB}/docs/authoring/focus-tags.md">docs/authoring/focus-tags.md ↗</a>
    </p>
    ${blocks}
  </section>`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f5;
  --panel: #ffffff;
  --panel-2: #f1f1ee;
  --fg: #1b1b19;
  --muted: #6b6b65;
  --border: #d9d9d3;
  --accent: #2f5d8a;
  --ok-fg: #1c6b3f;
  --ok-bg: #e2f2e8;
  --ok-br: #8dc9a8;
  --warn-fg: #8a5a12;
  --warn-bg: #faf0dd;
  --warn-br: #dcb572;
  --miss-fg: #9a2b2b;
  --miss-br: #d99a9a;
  --info-fg: #2f5d8a;
  --info-bg: #e6eef6;
  --info-br: #9dbcd8;
  --code-bg: #eeeeea;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16171a;
    --panel: #1e2024;
    --panel-2: #24272c;
    --fg: #e6e6e2;
    --muted: #9a9a94;
    --border: #34373d;
    --accent: #8fb8e0;
    --ok-fg: #86d6a8;
    --ok-bg: #1c2f25;
    --ok-br: #34694b;
    --warn-fg: #e0b872;
    --warn-bg: #302819;
    --warn-br: #6b5424;
    --miss-fg: #e79a9a;
    --miss-br: #7c3a3a;
    --info-fg: #9dc4e8;
    --info-bg: #1b262f;
    --info-br: #3a5670;
    --code-bg: #2a2d33;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
}
code, .mono { font-family: var(--mono); font-size: 0.86em; background: var(--code-bg); padding: 0.08em 0.34em; border-radius: 3px; }
a { color: var(--accent); }
h2 { font-size: 1.5rem; margin: 0 0 0.4rem; letter-spacing: -0.01em; }
h3 { font-size: 1.15rem; margin: 1.6rem 0 0.5rem; letter-spacing: -0.01em; }
h4 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin: 1.3rem 0 0.4rem; font-weight: 600; }
p { margin: 0.4rem 0; }
.muted { color: var(--muted); }

/* --- sidebar --- */
#side {
  position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
  background: var(--panel); border-right: 1px solid var(--border); padding: 1.1rem 0.9rem;
}
#side h1 { font-size: 1.05rem; margin: 0 0 0.15rem; letter-spacing: -0.01em; }
#side .sub { color: var(--muted); font-size: 0.78rem; margin-bottom: 0.9rem; }
#filter { width: 100%; padding: 0.45rem 0.55rem; border: 1px solid var(--border); border-radius: 6px;
  background: var(--panel-2); color: var(--fg); font: inherit; font-size: 0.86rem; }
#filter-count { font-size: 0.74rem; color: var(--muted); min-height: 1.1em; display: block; margin: 0.3rem 0 0.8rem; }
#nav a { display: block; padding: 0.34rem 0.5rem; border-radius: 5px; text-decoration: none; color: var(--fg); font-size: 0.9rem; }
#nav a:hover { background: var(--panel-2); }
#nav a.current { background: var(--info-bg); color: var(--info-fg); font-weight: 600; }
#nav .sublinks { display: flex; gap: 0.3rem; padding: 0 0.5rem 0.4rem 1.1rem; }
#nav .sublinks a { padding: 0.1rem 0.4rem; font-size: 0.78rem; background: var(--panel-2); }
#nav .group-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 1rem 0 0.25rem 0.5rem; }

/* --- main --- */
main { padding: 1.6rem 2rem 5rem; max-width: 1120px; min-width: 0; }
.lede { color: var(--muted); max-width: 78ch; }
.note { font-size: 0.82rem; color: var(--muted); background: var(--panel); border: 1px solid var(--border);
  border-radius: 7px; padding: 0.5rem 0.7rem; margin: 0.7rem 0; max-width: 90ch; }
.warnnote { border-color: var(--miss-br); color: var(--miss-fg); }
.doc { white-space: nowrap; }

/* --- overview cards --- */
.cards { display: grid; gap: 1rem; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; }
.card h3 { margin-top: 0; }
.kpis { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.9rem; }
.kpi { background: var(--panel-2); border-radius: 7px; padding: 0.4rem 0.65rem; min-width: 84px; }
.kpi b { display: block; font-size: 1.12rem; letter-spacing: -0.02em; }
.kpi span { font-size: 0.72rem; color: var(--muted); }
.metric { border-top: 1px solid var(--border); padding-top: 0.7rem; margin-top: 0.7rem; }
.metric-head { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.9rem; }
.metric-head b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.pcttag { font-size: 0.78rem; color: var(--muted); }
.metric-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
.bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--panel-2); margin-top: 0.4rem; }
.bar-cards { background: var(--ok-br); }
.bar-grammar { background: var(--info-br); }
.bar-late { background: var(--warn-br); }
details summary { cursor: pointer; font-size: 0.82rem; color: var(--accent); margin-top: 0.5rem; }

/* --- chips --- */
.chip { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.73rem; line-height: 1.5;
  padding: 0.06rem 0.42rem; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; }
.chip.ok { background: var(--ok-bg); border-color: var(--ok-br); color: var(--ok-fg); }
.chip.info { background: var(--info-bg); border-color: var(--info-br); color: var(--info-fg); }
.chip.warn { background: var(--warn-bg); border-color: var(--warn-br); color: var(--warn-fg); }
.chip.miss { background: transparent; border-style: dashed; border-color: var(--miss-br); color: var(--miss-fg); }
.chip.none { background: transparent; border-style: dashed; border-color: var(--border); color: var(--muted); }
.badges { display: flex; flex-wrap: wrap; gap: 0.28rem; margin: 0.35rem 0; }
.tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  border: 1px solid var(--border); border-radius: 4px; padding: 0 0.3rem; }
.tag.alt { color: var(--accent); border-color: var(--info-br); }
.tag.ok-tag { color: var(--ok-fg); border-color: var(--ok-br); }
.tag.warn-tag { color: var(--warn-fg); border-color: var(--warn-br); }
.tagcode { color: var(--accent); }
.dangling { color: var(--miss-fg); text-decoration: underline dotted; }
.status-covered, .status-ok { color: var(--ok-fg); }
.status-late { color: var(--warn-fg); }
.status-missing { color: var(--miss-fg); }
.flag { font-size: 0.7rem; }
.flag.over { color: var(--miss-fg); }
.flag.at { color: var(--warn-fg); }

/* --- spine --- */
.level-block { margin-bottom: 1.6rem; }
.unit { background: var(--panel); border: 1px solid var(--border); border-radius: 9px; padding: 0.6rem 0.85rem; margin-bottom: 0.55rem; }
.unit h4 { margin: 0 0 0.35rem; font-size: 0.8rem; text-transform: none; letter-spacing: 0; color: var(--fg); }
.unit-n { display: inline-block; min-width: 1.5em; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.row { padding: 0.45rem 0; border-top: 1px dashed var(--border); }
.unit .row:first-of-type { border-top: 0; }
.row-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.45rem; }
.row-title a { font-weight: 600; text-decoration: none; }
.row-title a:hover { text-decoration: underline; }
.row-id { color: var(--muted); }
.mix { display: flex; flex-wrap: wrap; gap: 0.7rem; font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.mix b { color: var(--fg); }
.mix .cap { opacity: 0.65; margin-left: 0.2rem; }

/* --- topic detail --- */
.topic-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 1rem 1.2rem 1.3rem; margin-bottom: 1.1rem; scroll-margin-top: 1rem; }
.topic-card.flash { outline: 2px solid var(--accent); }
.topic-card h3 { margin-top: 0; }
.topic-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.82rem; }
.titles { margin: 0.4rem 0; }
.lang { font-size: 0.84rem; }
.lang b { display: inline-block; min-width: 1.7em; color: var(--muted); font-weight: 600; font-size: 0.74rem; text-transform: uppercase; }
.edges { display: grid; gap: 0.25rem; }
.edge { font-size: 0.84rem; display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: baseline; }
.edge-label { min-width: 15em; color: var(--muted); font-size: 0.76rem; }
.set { border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; margin-bottom: 0.4rem; background: var(--panel-2); }
.set-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.84rem; }
.set-body { margin-top: 0.3rem; display: grid; gap: 0.2rem; }
.role { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.35rem;
  border-radius: 4px; border: 1px solid var(--border); }
.role-practice { color: var(--ok-fg); border-color: var(--ok-br); }
.role-drill { color: var(--info-fg); border-color: var(--info-br); }
.role-pretest, .role-checkpoint, .role-placement, .role-probe, .role-exam-practice { color: var(--warn-fg); border-color: var(--warn-br); }
.hists { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.hist-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); min-width: 4em; }
.hist { display: inline-flex; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.hist-k { padding: 0 0.3rem; }
.hist-v { padding: 0 0.3rem; background: var(--border); font-variant-numeric: tabular-nums; }
.path { display: inline-flex; align-items: baseline; gap: 0.3rem; font-size: 0.8rem; }
.gh { text-decoration: none; }
.sub { font-size: 0.76rem; color: var(--muted); margin: 0.6rem 0 0.3rem; }
.rownote { font-size: 0.79rem; color: var(--muted); border-left: 2px solid var(--border); padding-left: 0.5rem; margin-top: 0.3rem; }
.teacher { display: flex; align-items: center; gap: 0.28rem; flex-wrap: wrap; }
.teacher.mismatch { background: var(--warn-bg); border-radius: 4px; padding: 0 0.2rem; }

/* --- tables --- */
.scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: 0.84rem; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--panel-2); text-align: left;
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
  padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); }
td { padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0; }
table.compact td { padding: 0.22rem 0.5rem; font-size: 0.8rem; }
table.outcomes td:nth-child(4) { min-width: 30ch; }
table.inv td:nth-child(2) { min-width: 34ch; }

footer { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border);
  font-size: 0.78rem; color: var(--muted); }

@media (max-width: 900px) {
  body { grid-template-columns: 1fr; }
  #side { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
  main { padding: 1.2rem 1rem 4rem; }
  .edge-label { min-width: 100%; }
}
@media print { #side { display: none; } .view { display: block !important; } }
`;

const JS = `
(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav a[data-view]'));
  var flashed = null;

  function showView(id) {
    var found = false;
    views.forEach(function (v) {
      var on = v.id === 'view-' + id;
      v.hidden = !on;
      if (on) found = true;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('current', a.getAttribute('data-view') === id);
    });
    return found;
  }

  function route() {
    var hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (flashed) { flashed.classList.remove('flash'); flashed = null; }
    if (!hash) { showView('ueberblick'); return; }
    if (document.getElementById('view-' + hash)) { showView(hash); window.scrollTo(0, 0); return; }
    var el = document.getElementById(hash);
    if (!el) { showView('ueberblick'); return; }
    var view = el.closest('.view');
    if (view) showView(view.id.replace(/^view-/, ''));
    el.scrollIntoView();
    if (el.classList.contains('topic-card')) { el.classList.add('flash'); flashed = el; }
  }

  window.addEventListener('hashchange', route);

  var input = document.getElementById('filter');
  var count = document.getElementById('filter-count');
  var searchables = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-group]'));

  function applyFilter() {
    var q = input.value.trim().toLowerCase();
    var hits = 0;
    searchables.forEach(function (el) {
      var on = q === '' || el.getAttribute('data-search').indexOf(q) !== -1;
      el.hidden = !on;
      if (on) hits++;
    });
    groups.forEach(function (g) {
      var kids = g.querySelectorAll('[data-search]');
      if (!kids.length) { g.hidden = false; return; }
      var any = Array.prototype.some.call(kids, function (el) { return !el.hidden; });
      g.hidden = !any;
    });
    count.textContent = q === '' ? searchables.length + ' Einträge' : hits + ' von ' + searchables.length + ' Treffern';
  }

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; applyFilter(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });

  applyFilter();
  route();
})();
`;

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unbekannt';
  }
}

function page(): string {
  const generated = new Date().toISOString();
  const sha = gitSha();
  const totals = {
    topics: topics.size,
    sets: sets.size,
    items: [...sets.values()].reduce((n, s) => n + (s.data.items?.length ?? 0), 0),
    readings: readings.size,
    decks: vocab.size,
    entries: [...vocab.values()].reduce((n, v) => n + (v.data.entries?.length ?? 0), 0),
    tags: Object.keys(focusIntroducedBy).length,
    points: inventory.length,
  };

  const notes = loadNotes.length
    ? `<p class="note warnnote"><b>${loadNotes.length} Ladehinweis(e):</b><br>${loadNotes.map(esc).join('<br>')}</p>`
    : '';

  const levelLinks = (prefix: string) =>
    `<div class="sublinks">${CONSOLE_LEVELS.map((l) => `<a href="#${prefix}-${l}">${l}</a>`).join('')}</div>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redaktion — Deutsch-Atlas</title>
<style>${CSS}</style>
</head>
<body>
<nav id="side">
  <h1>Redaktion</h1>
  <div class="sub">Deutsch-Atlas — redaktionelle Konsole</div>
  <input id="filter" type="search" placeholder="Filter: Titel oder id  (/)" autocomplete="off" spellcheck="false">
  <span id="filter-count"></span>
  <div id="nav">
    <a href="#ueberblick" data-view="ueberblick">Überblick</a>
    ${levelLinks('ueberblick')}
    <a href="#lernpfad" data-view="lernpfad">Lernpfad</a>
    ${levelLinks('lernpfad')}
    <a href="#detail" data-view="detail">Themen-Detail</a>
    <a href="#inventar" data-view="inventar">Inventar</a>
    <div class="group-label">Bestand</div>
    <div class="note" style="margin:0.2rem 0 0">
      ${totals.topics} Themen · ${totals.sets} Sätze · ${totals.items} Items<br>
      ${totals.readings} Lesetexte · ${totals.decks} Decks · ${totals.entries} Vokabeln<br>
      ${totals.tags} Fokus-Tags · ${totals.points} Inventarzeilen
    </div>
  </div>
</nav>
<main>
  ${notes}
  ${renderUeberblick()}
  ${renderLernpfad()}
  ${renderDetail()}
  ${renderInventar()}
  <footer>
    Generiert ${esc(generated)} aus ${esc(sha)} · <code>bun run redaktion</code> · alle Zahlen zur Generierzeit aus <code>content/</code> und <code>data/</code> berechnet · <code>redaktion/</code> ist gitignored und wird nie committet.
  </footer>
</main>
<script>${JS}</script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
const html = page();
writeFileSync(OUT_FILE, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ ${rel(OUT_FILE)} — ${kb} KB`);
console.log(
  `  ${topics.size} Themen · ${units.length} Einheiten · ${sets.size} Sätze · ${inventory.length} Inventarzeilen`,
);
for (const level of CONSOLE_LEVELS) {
  const g = grammar.get(level);
  const w = wortliste.get(level);
  console.log(
    `  ${level}: ` +
      (g ? `Grammatik ${g.taught}/${g.total} (${g.percent}%)` : 'Grammatik nicht messbar') +
      (w ? ` · Wortliste ${w.cards + w.grammar}/${w.total} (${w.percent}%)` : ' · keine Wortliste'),
  );
}
if (loadNotes.length) {
  console.warn(`\n${loadNotes.length} Ladehinweis(e) — sie stehen auch im Kopf der Konsole:`);
  for (const note of loadNotes) console.warn(`  ${note}`);
}
