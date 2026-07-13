/**
 * Goethe Wortliste coverage — how much of an official CEFR word list the course
 * actually teaches. Build-time only (reads the repo), shared by the
 * `bun scripts/coverage.ts` report and the Über page, so a claim on the public
 * page can never drift from the manifest it is measured against.
 *
 * data/goethe-<level>-wortliste.txt holds bare headwords in `# --- section ---`
 * blocks. A word listed in several sections counts once, for its first. A
 * leading `~` marks a word the course addresses as grammar (pronouns, articles,
 * case prepositions…) — addressed, but deliberately without a flashcard.
 *
 * A manifest is measured against **every** deck, not only the decks of its own
 * level: the Goethe A2 list is not a superset of the A1 one, but the two overlap
 * heavily, and an A1 deck that already teaches a word on the A2 list has taught
 * it. Coverage is a question about the learner, not about our filing.
 *
 * ## The `~` must be earned
 *
 * A `~` used to be a self-certification: the manifest asserted the course taught
 * the word as grammar, and nothing checked. Anyone could have raised a level to
 * 100% by typing tildes, and the Über page would have published it. Auditing the
 * marks found nine that were false — `außer`, `außerhalb`, `gegenüber`, `wegen`,
 * `einig-`, `manch-`, `darauf`, `darüber` occurred nowhere in `content/` at all,
 * and A1's `euer` occurred only inside English explanation prose.
 *
 * So a `~` is now checked against the German the course actually teaches
 * (`taughtSurface`). A word that surface does not contain is **demoted into
 * `missing`** and listed on `unearned`, and `bun run validate` hard-fails on it.
 * The claim and the measurement are the same object.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import type { Level } from './schemas';

const VOCAB_DIR = 'content/vocab';

/** Levels that have a committed Wortliste manifest to be measured against. */
export const MEASURED_LEVELS = ['A1', 'A2'] as const;
export type MeasuredLevel = (typeof MEASURED_LEVELS)[number];

const manifestPath = (level: Level): string =>
  `data/goethe-${level.toLowerCase()}-wortliste.txt`;

export interface CoverageSection {
  name: string;
  /** manifest words a deck teaches as a flashcard */
  covered: string[];
  /** manifest words no deck teaches yet */
  missing: string[];
  /** `~` words the course really does address, without a flashcard */
  grammar: string[];
  /** `~` words nothing in content/ addresses — a claim we have not paid for */
  unearned: string[];
}

export interface Coverage {
  level: Level;
  sections: CoverageSection[];
  /** headword → the deck ids that teach it */
  ownedBy: Map<string, string[]>;
  /** every manifest word, however addressed */
  total: number;
  /** taught as a flashcard */
  cards: number;
  /** addressed as grammar, and verified to be */
  grammar: number;
  /** neither — including the `~` words below, which are claims, not coverage */
  missing: number;
  /** `~` words the taught surface does not contain; validate hard-fails on these */
  unearned: string[];
  /** (cards + grammar) / total, rounded to a percent */
  percent: number;
}

/** Every headword any deck teaches → the deck ids that teach it. */
function deckHeadwords(root: string): Map<string, string[]> {
  const ownedBy = new Map<string, string[]>();
  const vocabDir = join(root, VOCAB_DIR);
  for (const file of readdirSync(vocabDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const data = YAML.parse(readFileSync(join(vocabDir, file), 'utf8')) as {
      id: string;
      entries: Array<{ de: string }>;
    };
    for (const entry of data.entries) {
      ownedBy.set(entry.de, [...(ownedBy.get(entry.de) ?? []), data.id]);
    }
  }
  return ownedBy;
}

// ---------------------------------------------------------------------------
// The taught surface — the German the course actually teaches
// ---------------------------------------------------------------------------

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, ext));
    else if (name.endsWith(ext)) out.push(path);
  }
  return out.sort();
}

/**
 * The German-bearing fields of an exercise item, by type. An explicit allow-list,
 * not a deny-list: `focus: wo-wohin` and `outcomes: [dativ-artikel-nutzen]` are
 * kebab-case identifiers that happen to contain German words, and crediting a `~`
 * to a *tag name* would be exactly the laundering this check exists to stop.
 */
function itemGerman(item: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(push);
  };
  switch (item.type) {
    case 'mc':
      push(item.prompt);
      push(item.options);
      break;
    case 'cloze':
    case 'listen':
      // cloze gaps are {{answer}} / {{answer|alt}} — the braces and pipe fall out
      // in normalization, so both alternatives land in the surface.
      push(item.text);
      push(item.accept);
      break;
    case 'match':
      for (const p of (item.pairs ?? []) as Array<Record<string, unknown>>) {
        push(p.left);
        push(p.right);
      }
      break;
    case 'order':
      push(item.words);
      push(item.accept);
      break;
    case 'table':
      push(item.title);
      push(item.columns);
      for (const r of (item.rows ?? []) as Array<Record<string, unknown>>) {
        push(r.label);
        for (const c of (r.cells ?? []) as Array<Record<string, unknown>>) push(c.answer);
      }
      break;
    case 'translate':
      // prompt_en / prompt_ru are the source sentence, not German.
      push(item.answer);
      push(item.accept);
      break;
    case 'write':
    case 'speak':
      // prompt/goal/requirements/checklist are bilingual instructions.
      push(item.model_answer);
      break;
    case 'audio-comprehension': {
      push(item.question);
      push(item.options);
      const src = (item.source ?? {}) as Record<string, unknown>;
      const turns = (src.turns ?? src.transcript ?? []) as Array<Record<string, unknown>>;
      for (const t of turns) push(t.text);
      break;
    }
  }
  return out;
}

/**
 * Every string of German the course teaches, as one blob:
 *
 *  1. topic article bodies **with `<En>…</En>` and `<Ru>…</Ru>` stripped**. A word
 *     merely *named* inside an English gloss is talked about, not taught — that is
 *     precisely how A1 claimed `euer`, and it is the whole difference between an
 *     honest rule and a generous one.
 *  2. reading paragraphs, each `[[de::en::ru]]` gloss reduced to its German half.
 *     CLAUDE.md sends receptive-only language *to readings*, so excluding them
 *     would put this check at odds with the authoring contract.
 *  3. exercise items of `role: practice` and `role: drill` only — mirroring the
 *     existing "outcome measured by nothing" rule in scripts/validate.ts. A pretest
 *     is a guess taken before the lesson; a checkpoint or probe *tests* rather than
 *     teaches. Vocab `example_de` is excluded on the same logic: a word used in
 *     another word's example sentence is not itself taught.
 */
export function taughtSurface(root = process.cwd()): string {
  const parts: string[] = [];

  for (const file of walk(join(root, 'content/topics'), '.mdx')) {
    const body = readFileSync(file, 'utf8')
      .replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '')
      .replace(/<En>[\s\S]*?<\/En>/g, ' ')
      .replace(/<Ru>[\s\S]*?<\/Ru>/g, ' ');
    parts.push(body);
  }

  for (const file of walk(join(root, 'content/reading'), '.yaml')) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as {
      title_de?: string;
      text?: string[];
      questions?: Array<Record<string, unknown>>;
    };
    parts.push(data.title_de ?? '');
    // [[German phrase::en gloss::ru gloss]] → the German phrase
    for (const p of data.text ?? []) parts.push(p.replace(/\[\[(.+?)::.*?::.*?\]\]/g, '$1'));
    for (const q of data.questions ?? []) parts.push(...itemGerman({ ...q, type: 'mc' }));
  }

  for (const file of walk(join(root, 'content/exercises'), '.yaml')) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as {
      role?: string;
      items?: Array<Record<string, unknown>>;
    };
    const role = data.role ?? 'practice';
    if (role !== 'practice' && role !== 'drill') continue;
    for (const item of data.items ?? []) parts.push(...itemGerman(item));
  }

  return normalize(parts.join('\n'));
}

/**
 * Fold to a bare stream of lowercase German letters separated by single spaces.
 *
 * Lowercasing is right *here* and wrong in `deckHeadwords` above, and the two
 * must not be unified. A deck headword is matched exactly, because German case
 * carries the lexeme: the manifests contain `arm`/`Arm`, `weg`/`Weg`,
 * `morgen`/`Morgen`, `bitte`/`Bitte`, `husten`/`Husten` and `orange`/`Orange` as
 * six separate pairs of words. But a *sentence* capitalizes whatever starts it,
 * so a case-sensitive surface would report `der` unearned because the article
 * happens to open every table row. Different question, different answer.
 */
function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-zäöüß]+/g, ' ')
    .trim();
}

/**
 * Determiners and possessives whose citation form is not what a sentence shows.
 * Explicit and greppable, deliberately not a stemmer: the `~` set is ~60 words
 * per level and hand-curatable, and a stemmer's only job here would be to
 * launder words that the course does not actually teach.
 */
const INFLECTIONS: Record<string, string[]> = {
  dieser: ['dieser', 'diese', 'dieses', 'diesen', 'diesem'],
  welcher: ['welcher', 'welche', 'welches', 'welchen', 'welchem'],
  jeder: ['jeder', 'jede', 'jedes', 'jeden', 'jedem'],
  kein: ['kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines'],
  ein: ['ein', 'eine', 'einen', 'einem', 'einer', 'eines'],
  mein: ['mein', 'meine', 'meinen', 'meinem', 'meiner', 'meines'],
  dein: ['dein', 'deine', 'deinen', 'deinem', 'deiner', 'deines'],
  unser: ['unser', 'unsere', 'unseren', 'unserem', 'unserer', 'unseres'],
  euer: ['euer', 'eure', 'euren', 'eurem', 'eurer', 'eures'],
};

/** Endings a `stem-` headword (all-, ander-, manch-) may take. Ending-restricted
    on purpose: this is what stops `manch-` being credited to `manchmal`. */
const STEM_ENDINGS = ['', 'e', 'er', 'es', 'en', 'em'];

/** Does the taught surface actually address this manifest word? */
export function addresses(surface: string, word: string): boolean {
  const tokens = new Set(surface.split(' '));
  const has = (w: string) => tokens.has(w);

  if (word.endsWith('-')) {
    const stem = normalize(word.slice(0, -1));
    return STEM_ENDINGS.some((e) => has(stem + e));
  }

  const n = normalize(word);
  if (!n) return false;

  // Normalize *first*, then decide phrase vs token: `d.h.` has no space but folds
  // to `d h`, so a decision taken on the raw string would silently take the wrong
  // branch and always report it unearned.
  if (n.includes(' ')) return ` ${surface} `.includes(` ${n} `);

  return (INFLECTIONS[n] ?? [n]).some(has);
}

export function hasManifest(level: Level, root = process.cwd()): boolean {
  return existsSync(join(root, manifestPath(level)));
}

export function goetheCoverage(level: Level, root = process.cwd()): Coverage {
  const ownedBy = deckHeadwords(root);
  const surface = taughtSurface(root);

  const sections: CoverageSection[] = [];
  const seen = new Set<string>();
  let current: CoverageSection | undefined;
  for (const raw of readFileSync(join(root, manifestPath(level)), 'utf8').split('\n')) {
    const line = raw.trim();
    const header = line.match(/^# --- (.+?) ---/);
    if (header) {
      current = { name: header[1]!, covered: [], missing: [], grammar: [], unearned: [] };
      sections.push(current);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const isGrammar = line.startsWith('~');
    const word = isGrammar ? line.slice(1) : line;
    if (seen.has(word)) continue; // first section wins
    seen.add(word);
    if (isGrammar) {
      // An unearned `~` is not coverage, it is a claim. It counts as missing.
      if (addresses(surface, word)) current?.grammar.push(word);
      else current?.unearned.push(word);
    } else if (ownedBy.has(word)) current?.covered.push(word);
    else current?.missing.push(word);
  }

  const cards = sections.reduce((n, s) => n + s.covered.length, 0);
  const grammar = sections.reduce((n, s) => n + s.grammar.length, 0);
  const unearned = sections.flatMap((s) => s.unearned);
  const missing = sections.reduce((n, s) => n + s.missing.length, 0) + unearned.length;
  const total = cards + grammar + missing;
  return {
    level,
    sections,
    ownedBy,
    total,
    cards,
    grammar,
    missing,
    unearned,
    percent: total === 0 ? 0 : Math.round(((cards + grammar) / total) * 100),
  };
}
