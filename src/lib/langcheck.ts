/**
 * Language-discipline checks for content trees and MDX bodies, shared by
 * `scripts/validate.ts` and the tests (house pattern: testable module in
 * src/lib/, thin wiring in the script — like src/lib/grading-decisions.ts).
 *
 * Four explanation languages, three letter-set oracles:
 * - `en`/`*_en` and `de`/`*_de` fields must contain no Cyrillic;
 * - `ru`/`*_ru` fields must contain no Ukrainian-only letters (і ї є ґ);
 * - `uk`/`*_uk` fields must contain no Russian-only letters (ы э ъ ё).
 * A letter set cannot prove a text is the language it claims, but a leaked
 * letter from the other alphabet is a hard, unambiguous defect — the cheap
 * check that catches the expensive mistake (a Russian paragraph shipped as
 * Ukrainian, Cyrillic pasted into an EN half).
 */

/** Any Cyrillic — forbidden in `en`/`*_en` (bilingual voice) and `de`/`*_de` fields. */
export const CYRILLIC = /[Ѐ-ӿ]/;
/** Letters Ukrainian has and Russian lacks — forbidden in `ru`/`*_ru` fields. */
export const UK_ONLY = /[іїєґІЇЄҐ]/;
/** Letters Russian has and Ukrainian lacks — forbidden in `uk`/`*_uk` fields. */
export const RU_ONLY = /[ыэъёЫЭЪЁ]/;

const LANGS = ['en', 'ru', 'uk', 'de'] as const;
type Lang = (typeof LANGS)[number];

function langOfKey(key: string): Lang | undefined {
  for (const lang of LANGS) {
    if (key === lang || key.endsWith(`_${lang}`)) return lang;
  }
  return undefined;
}

const snippet = (value: string) => value.slice(0, 70);

function walkObjects(node: unknown, path: string, visit: (obj: object, path: string) => void): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkObjects(v, `${path}[${i}]`, visit));
    return;
  }
  if (node && typeof node === 'object') {
    visit(node, path);
    for (const [key, value] of Object.entries(node)) {
      walkObjects(value, path ? `${path}.${key}` : key, visit);
    }
  }
}

/**
 * Letter-set purity over a whole YAML/frontmatter tree: flags the wrong
 * alphabet in any string under a language-named key (`en`/`*_en`, `ru`/`*_ru`,
 * `uk`/`*_uk`, `de`/`*_de`). Replaces the old EN-only `checkEnFields` walker.
 */
export function langFieldProblems(node: unknown): string[] {
  const problems: string[] = [];
  walkObjects(node, '', (obj, path) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value !== 'string') continue;
      const lang = langOfKey(key);
      if (!lang) continue;
      const at = path ? `${path}.${key}` : key;
      if (lang === 'en' && CYRILLIC.test(value))
        problems.push(`Cyrillic in English-facing field ${at}: "${snippet(value)}"`);
      else if (lang === 'de' && CYRILLIC.test(value))
        problems.push(`Cyrillic in German field ${at}: "${snippet(value)}"`);
      else if (lang === 'ru' && UK_ONLY.test(value))
        problems.push(`Ukrainian-only letters in Russian field ${at}: "${snippet(value)}"`);
      else if (lang === 'uk' && RU_ONLY.test(value))
        problems.push(`Russian-only letters in Ukrainian field ${at}: "${snippet(value)}"`);
    }
  });
  return problems;
}

function hasLangStringField(node: unknown, lang: Lang): boolean {
  let found = false;
  walkObjects(node, '', (obj) => {
    if (found) return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && langOfKey(key) === lang) {
        found = true;
        return;
      }
    }
  });
  return found;
}

/** Whether any `uk`/`*_uk` key with a string value exists anywhere in the tree. */
export function hasUkField(node: unknown): boolean {
  return hasLangStringField(node, 'uk');
}

/** Whether any `ru`/`*_ru` key with a string value exists anywhere in the tree —
    the denominator of the Über page's UK-translation figure (src/lib/coverage.ts). */
export function hasRuField(node: unknown): boolean {
  return hasLangStringField(node, 'ru');
}

/**
 * Ukrainian parity: a scope that carries ANY `uk` field must carry one beside
 * EVERY `ru`/`*_ru` field — a half-translated file is how a UK reader silently
 * gets a Russian page halfway through a lesson. The scope is the node passed
 * in: a whole file for content files, a single node/group/unit for
 * content/atlas.yaml (so translating one topic's outcomes does not force the
 * entire atlas at once).
 *
 * `forceUk` lets the caller bridge uk content this walker cannot see — a
 * reading's 4-field glosses live inside `text` strings, invisible here.
 */
export function ukParityProblems(node: unknown, opts: { forceUk?: boolean } = {}): string[] {
  if (!opts.forceUk && !hasUkField(node)) return [];
  const problems: string[] = [];
  walkObjects(node, '', (obj, path) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value !== 'string' || langOfKey(key) !== 'ru') continue;
      const sibling = key === 'ru' ? 'uk' : `${key.slice(0, -3)}_uk`;
      const has = (obj as Record<string, unknown>)[sibling];
      if (typeof has === 'string' && has.length > 0) continue;
      const at = path ? `${path}.${key}` : key;
      problems.push(
        `${at} has no ${sibling} sibling — this scope carries uk, so parity requires uk beside every ru field`,
      );
    }
  });
  return problems;
}

const EXPLAIN_KEYS = new Set<string>(LANGS);

/**
 * A "bilingual explanation record": an object whose keys include `en` and `ru`
 * (strings) and nothing outside {en, ru, uk, de}. The shape test structurally
 * excludes outcomes (id/mode/… keys), exercise items, vocab entries, reference
 * examples — everything whose `de` is German *content* rather than a German
 * explanation half.
 */
function isExplainRecord(obj: object): boolean {
  const entries = Object.entries(obj);
  return (
    entries.every(([key]) => EXPLAIN_KEYS.has(key)) &&
    typeof (obj as Record<string, unknown>).en === 'string' &&
    typeof (obj as Record<string, unknown>).ru === 'string'
  );
}

/**
 * German-medium parity: within one scope, either every bilingual explanation
 * record carries a `de` half or none does. B1 material is authored
 * German-medium from day one, and a half-`de` file would flap a 'de' reader
 * between German and the EN fallback paragraph by paragraph.
 *
 * Callers must exempt `content/reference-data`: its {de,en,ru} records are
 * German example sentences with translations — the one shape this structural
 * test cannot tell apart from an explanation record.
 */
/** A match pair's meaning-side right ({en, ru, uk?}) is shape-identical to an
    explanation record but never carries de by design — a meaning gloss is not
    an explanation, and the strict schema forbids the key, so counting it here
    would make de parity unsatisfiable for any set that has both a de half and
    a record right (the P8-4 satisfiability trap). */
const MATCH_RIGHT_PATH = /\.pairs\[\d+\]\.right$/;

export function deParityProblems(node: unknown): string[] {
  const withDe: string[] = [];
  const withoutDe: string[] = [];
  walkObjects(node, '', (obj, path) => {
    if (MATCH_RIGHT_PATH.test(path)) return;
    if (!isExplainRecord(obj)) return;
    const de = (obj as Record<string, unknown>).de;
    if (typeof de === 'string' && de.length > 0) withDe.push(path || '(root)');
    else withoutDe.push(path || '(root)');
  });
  if (withDe.length === 0 || withoutDe.length === 0) return [];
  return withoutDe.map(
    (at) =>
      `${at} has no de half — this scope carries de (e.g. ${withDe[0]}), so parity requires de on every bilingual explanation record`,
  );
}

/** What `mdxLangProblems` found in an MDX body. Balance problems are reported
    separately because the callers disagree on severity (topic bodies warn,
    discovery bodies fail — the pre-existing contract for `<En>`). */
export interface MdxLangReport {
  /** unbalanced <En>/<Ru>/<Uk>/<De> tag counts */
  balance: string[];
  /** wrong-alphabet leaks inside language blocks — always errors */
  letters: string[];
  /** a body with any <Uk> (or <De>) must carry one in every <Bilingual> block — always errors */
  parity: string[];
}

/**
 * MDX-body mirror of the YAML checks: tag balance for all four language
 * blocks, letter sets inside each (`<En>`/`<De>`: no Cyrillic; `<Ru>`: no
 * Ukrainian-only letters; `<Uk>`: no Russian-only letters), and per-body
 * parity for the optional halves.
 *
 * `forceUk` bridges frontmatter uk the body scan cannot see: parity is
 * per FILE (docs/i18n-design.md), so a `title_uk` alone must demand a `<Uk>`
 * half in every `<Bilingual>` block — otherwise a wave could translate the
 * title, skip the article, and both validate and count as translated. The
 * reverse bridge (body `<Uk>` forcing frontmatter parity) is the caller's:
 * pass the body's `<Uk>` presence as `forceUk` to `ukParityProblems`.
 */
export function mdxLangProblems(body: string, opts: { forceUk?: boolean } = {}): MdxLangReport {
  const balance: string[] = [];
  const letters: string[] = [];
  const parity: string[] = [];

  const blocksOf = (tag: string): string[] =>
    body.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g')) ?? [];

  const checkLetters = (tag: string, re: RegExp, what: string): void => {
    blocksOf(tag).forEach((block, i) => {
      for (const line of block.split('\n')) {
        if (re.test(line)) {
          letters.push(`${what} inside <${tag}> block ${i + 1}: "${snippet(line.trim())}"`);
        }
      }
    });
  };

  for (const tag of ['En', 'Ru', 'Uk', 'De']) {
    const opens = (body.match(new RegExp(`<${tag}>`, 'g')) ?? []).length;
    const closes = (body.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    if (opens !== closes) balance.push(`unbalanced <${tag}> tags (${opens} open, ${closes} close)`);
  }

  checkLetters('En', CYRILLIC, 'Cyrillic');
  checkLetters('De', CYRILLIC, 'Cyrillic');
  checkLetters('Ru', UK_ONLY, 'Ukrainian-only letters');
  checkLetters('Uk', RU_ONLY, 'Russian-only letters');

  const bilinguals = body.match(/<Bilingual>[\s\S]*?<\/Bilingual>/g) ?? [];
  for (const tag of ['Uk', 'De'] as const) {
    const inBody = body.includes(`<${tag}>`);
    const forced = tag === 'Uk' && (opts.forceUk ?? false);
    if (!inBody && !forced) continue;
    const carrier = inBody ? `<${tag}> elsewhere` : 'uk in its frontmatter';
    bilinguals.forEach((block, i) => {
      if (!block.includes(`<${tag}>`))
        parity.push(
          `<Bilingual> block ${i + 1} has no <${tag}> half, but this file carries ${carrier} — the optional halves are all-or-none per file`,
        );
    });
  }

  return { balance, letters, parity };
}
