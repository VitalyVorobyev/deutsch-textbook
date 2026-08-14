/**
 * Input load — how much of a topic's German the learner has not met yet.
 *
 * Build-time only (reads the repo, like packages/content/src/coverage.ts), imported by
 * `bun scripts/comprehensibility.ts` and by tests. Nothing in the runtime app
 * imports it, and it hooks into no gate: **there is no threshold here and no
 * pass/fail.** Outliers are the product — a topic whose article sits far above
 * its level's median is a place to look, not a defect to fail a build on.
 *
 * ## Why it exists
 *
 * Perceived difficulty varies substantially between topics and no instrument
 * saw it: `prose-shape` measures the *explanation* halves (paragraph size), and
 * CEFR discipline ("an A2 article must be readable by an A2 learner") binds only
 * at authoring time, by judgement, one file at a time. This measures the other
 * side — the **German** the learner has to get through — against what the spine
 * says they have already met at that point. Backlog P24-9(a).
 *
 * ## The known set — the counting method the numbers carry
 *
 * Spine position `P` of a topic is its index in `content/atlas.yaml`'s `units:`
 * order, levels concatenated A1 → A2 → B1 (file order **is** the recommended
 * path). For the topic at position P the learner is assumed to know:
 *
 *  1. **Prior taught surface** — the German of every topic at position < P:
 *     article bodies with frontmatter and **all four** explanation halves
 *     stripped (`<En>`, `<Ru>`, `<Uk>`, `<De>`), their readings (each
 *     `[[de::en::ru]]` gloss reduced to its German half), and their
 *     `role: practice` / `role: drill` items' German. The four-half strip is
 *     where this differs from `taughtSurface()` in coverage.ts, which strips two:
 *     a German word used *inside* an explanation half is talked about, not read
 *     as content German, and that is as true of the `<De>` half as of the `<En>`.
 *  2. **Prior vocab** — every entry of every deck attached through topic
 *     frontmatter `vocab:` at position **≤ P**, own decks included: a word the
 *     topic's own deck teaches is support, not load. `de`, `plural`,
 *     `praesens_3sg`, `partizip2` and `accept` are all tokenized, so an
 *     inflected form the deck actually shows counts as met.
 *  3. **The ≤level Wortliste** — every headword of `data/goethe-<l>-wortliste.txt`
 *     for each level l ≤ the topic's level, `#` lines dropped and a leading `~`
 *     removed, a `stem-` headword expanded over the same endings `addresses()`
 *     allows. This is the standard the level is measured against; a word on it is
 *     a word the level is supposed to reach.
 *
 * A token of the topic's own German is **ahead of the learner** when it is in
 * none of the three and survives the light inflection fallback in `isKnown`.
 *
 * ## Honesty
 *
 * The method is a heuristic, deliberately a generous one — `LIGHT_ENDINGS` folds
 * a form onto a known stem without a lemmatizer, `SUBORDINATORS` is a word list
 * and not a parse, `GRAMMAR_TERMS` is a root list and not a lemmatizer. It
 * therefore **under**-reports load rather than inventing it, which is what a
 * ranking wants: every topic is folded by the same hand. The numbers are for
 * ranking topics against each other with one instrument, and must never be
 * published as absolute claims about a learner ("this article is 8% unknown
 * vocabulary" is not something this can support).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { repoRoot } from './repo-root';
import { join } from 'node:path';
import * as YAML from 'yaml';
import { normalize } from './coverage';
import type { Level } from '@da/schema';

/** Levels with both a spine and a Wortliste to be measured against. */
export const RANKED_LEVELS = ['A1', 'A2', 'B1'] as const;
export type RankedLevel = (typeof RANKED_LEVELS)[number];

/** The three German surfaces a topic puts in front of the learner. */
export const SECTIONS = ['article', 'reading', 'items'] as const;
export type Section = (typeof SECTIONS)[number];

/** The four explanation halves, as they are written in the MDX body. */
export const HALVES = ['En', 'Ru', 'Uk', 'De'] as const;
export type Half = (typeof HALVES)[number];

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * A bound morpheme, written with its leading hyphen as a paradigm table writes
 * it: `-e`, `-st`, `-en`, `-chen`, `-heit`. Dropped before tokenizing, because it
 * is not a word and reporting `-en` as "a word ahead of the learner" is a
 * category error — the conjugation table in `praesens-wortstellung` and the
 * suffix table in `artikel-genus` are made of these. The hyphen must open the
 * token, so `E-Mail` and `Vor- und Nachteile` are untouched.
 */
const BOUND_MORPHEME = /(^|[\s|(])-[a-zäöüßA-ZÄÖÜ]+/g;

/**
 * The German of a text as bare lowercase tokens, using coverage.ts's `normalize`
 * so both instruments agree on what a word is. Digits, punctuation and currency
 * signs fall out in normalization, so a number is never a token at all — one of
 * the three "never ahead" classes for free.
 */
export function tokens(text: string): string[] {
  // Emphasis is stripped rather than normalized away: a paradigm table writes
  // the ending it teaches in bold *inside* the word (`wohn**st**`), and letting
  // normalization turn the asterisks into spaces cut that into `wohn` + `st`,
  // then reported the fragment as a word the learner had never met.
  const folded = normalize(text.replace(/[*`]/g, '').replace(BOUND_MORPHEME, ' '));
  return folded === '' ? [] : folded.split(' ');
}

/**
 * Endings the ahead-check may strip from, or add to, a token before giving up.
 *
 * Not a stemmer and not trying to be: it exists so that `gekündigt` beside a
 * known `kündigen`, or `Rechnungen` beside `Rechnung`, is not counted as a word
 * the learner has never met. Umlaut plurals (`Sätze` from `Satz`) are out of
 * reach and stay counted as ahead — a known, uniform under-fold.
 */
export const LIGHT_ENDINGS = ['e', 'en', 'er', 'es', 'em', 'n', 's', 't', 'st', 'et'] as const;

/** Roman numerals as they occur here (Futur I, Passiv II) — never ahead. The
    letter set is restricted to i/v/x so that German words like `mild` and `mix`
    are not read as numbers. */
const ROMAN = /^[ivx]{1,4}$/;

/**
 * The closed class the manifests cannot supply, because a Wortliste is a list of
 * **lemmas** and a text shows **forms**: `sein` is on it and `ist` is not, `haben`
 * is and `hat` is not, and `dem`, `den`, `des`, `im`, `zum`, `sich` are on none of
 * the three at all. Without this, the first topic on the spine — which has no
 * prior taught surface to fall back on — reads `ist` and `im` as words ahead of
 * the learner, and its share is an artifact of the manifest's citation forms
 * rather than of the article.
 *
 * Hand-curated and deliberately not a stemmer, the same device and the same
 * argument as `INFLECTIONS` in packages/content/src/coverage.ts. It covers the articles and
 * their contractions, the personal and reflexive pronouns, and the finite and
 * participle forms of the auxiliaries and modals — nothing lexical. Ablaut in a
 * *lexical* strong verb (`gibt`, `trifft`, `spricht`) is out of scope and still
 * reads as ahead; see the honesty note in the module doc.
 */
export const FUNCTION_WORDS = [
  // definite article and contractions
  'der', 'die', 'das', 'den', 'dem', 'des',
  'im', 'am', 'ins', 'ans', 'aufs', 'beim', 'vom', 'zum', 'zur', 'fürs', 'ums', 'durchs',
  // personal, reflexive and indefinite pronouns
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch',
  'mir', 'dir', 'ihm', 'ihnen', 'sich', 'man', 'einander',
  // determiners and possessives — the manifests carry the citation form only
  // (`~euer`), and no text ever shows it: this is the same set, and the same
  // argument, as INFLECTIONS in packages/content/src/coverage.ts
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines',
  'mein', 'meine', 'meinen', 'meinem', 'meiner', 'meines',
  'dein', 'deine', 'deinen', 'deinem', 'deiner', 'deines',
  'seine', 'seinen', 'seinem', 'seiner', 'seines',
  'ihre', 'ihren', 'ihrem', 'ihrer', 'ihres',
  'unser', 'unsere', 'unseren', 'unserem', 'unserer', 'unseres',
  'euer', 'eure', 'euren', 'eurem', 'eurer', 'eures',
  'dieser', 'diese', 'dieses', 'diesen', 'diesem',
  'welcher', 'welche', 'welches', 'welchen', 'welchem',
  'jeder', 'jede', 'jedes', 'jeden', 'jedem',
  // sein
  'bin', 'bist', 'ist', 'sind', 'seid', 'war', 'warst', 'waren', 'wart', 'gewesen',
  'sei', 'seien', 'wäre', 'wären', 'wärst',
  // haben
  'habe', 'hast', 'hat', 'habt', 'hatte', 'hattest', 'hatten', 'hattet', 'gehabt',
  'hätte', 'hätten', 'hättest',
  // werden
  'werde', 'wirst', 'wird', 'werdet', 'wurde', 'wurdest', 'wurden', 'wurdet',
  'geworden', 'worden', 'würde', 'würden', 'würdest',
  // modals
  'kann', 'kannst', 'könnt', 'konnte', 'konnten', 'gekonnt',
  'muss', 'musst', 'müsst', 'musste', 'mussten', 'gemusst',
  'will', 'willst', 'wollt', 'wollte', 'wollten', 'gewollt',
  'soll', 'sollst', 'sollt', 'sollte', 'sollten', 'gesollt',
  'darf', 'darfst', 'dürft', 'durfte', 'durften', 'gedurft',
  'mag', 'magst', 'mögt', 'mochte', 'mochten', 'gemocht', 'möchte', 'möchten', 'möchtest',
  // weiß / wissen is irregular in exactly this way
  'weiß', 'weißt', 'wusste', 'wussten', 'gewusst',
] as const;

const FUNCTION_WORD_SET = new Set<string>(FUNCTION_WORDS.map((w) => normalize(w)));

/** ä→a, ö→o, ü→u — tried as a last resort on a stem, so `Sätze` reaches `Satz`
    and `fährt` reaches `fahren`. Generous by construction: it also folds `schön`
    onto `schon`, which under-reports load rather than inventing it. */
function deumlaut(word: string): string {
  return word.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

/**
 * Is this token something the learner has met? Exact membership first, then one
 * light fold: strip one listed ending, then try the stem itself and the stem
 * plus any listed ending. Two steps rather than one because the known set holds
 * infinitives and singulars — `spielt` reaches `spielen` only via `spiel`.
 */
export function isKnown(token: string, has: (t: string) => boolean): boolean {
  if (FUNCTION_WORD_SET.has(token) || has(token)) return true;
  const stems = [token];
  for (const ending of LIGHT_ENDINGS) {
    if (token.length > ending.length + 2 && token.endsWith(ending)) {
      stems.push(token.slice(0, -ending.length));
    }
  }
  const reachable = (stem: string) => has(stem) || LIGHT_ENDINGS.some((e) => has(stem + e));
  return stems.some((stem) => reachable(stem) || reachable(deumlaut(stem)));
}

/**
 * The morphemes a written-out German number is built from, longest first so the
 * peeling in `isNumberWord` is greedy.
 *
 * Needed because "a number is never load" cannot be left to normalization here:
 * a `listen` item writes its numbers as words by authoring rule ("numbers
 * written as words", CLAUDE.md), so `hundertfünfundsiebzig` and `siebzehnten`
 * arrive as tokens. They were seven of the twenty-five distinct ahead tokens in
 * `geld-vertraege`'s item section — a quarter of a list whose whole purpose is
 * to be acted on.
 */
const NUMBER_STEMS = [
  'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn',
  'milliarde', 'million', 'tausend', 'hundert',
  'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig',
  'zwölf', 'zehn', 'elf', 'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs',
  'sieben', 'acht', 'neun', 'ein', 'und',
];

/** Ordinal and inflected tails, allowed only *after* a stem — `dreißig|sten`,
    `siebzehn|te`. Letting them peel from the front too made `ersten` and
    `Enten` numbers. */
const NUMBER_TAILS = ['', 'sten', 'ster', 'stem', 'ste', 'st', 'ten', 'ter', 'tem', 'te', 'en', 'er', 'em', 's'];

/** Is this token a German number written out in words? Peel stems off the front,
    then allow one tail. `Achtung` survives (`ung` is no tail) and `einsam`
    survives (`am` is none either); `hundertfünfundsiebzig` does not. */
export function isNumberWord(token: string): boolean {
  let rest = token;
  let stems = 0;
  for (;;) {
    const stem = NUMBER_STEMS.find((s) => rest.startsWith(s));
    if (!stem) break;
    rest = rest.slice(stem.length);
    stems += 1;
  }
  return stems > 0 && NUMBER_TAILS.includes(rest);
}

/** A single letter, a Roman numeral and a number — written in digits or in
    words — are never load. */
export function isCountedAsAhead(token: string): boolean {
  return token.length > 1 && !ROMAN.test(token) && !isNumberWord(token);
}

// ---------------------------------------------------------------------------
// Reducing content to German
// ---------------------------------------------------------------------------

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

export function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER, '');
}

export function frontmatterOf(source: string): unknown {
  const match = FRONTMATTER.exec(source);
  return match ? YAML.parse(match[1]!) : undefined;
}

/** `[[German phrase::en::ru(::uk)]]` → the German phrase. */
export function reduceGlosses(text: string): string {
  return text.replace(/\[\[([^\]]+?)::[^\]]*\]\]/g, '$1');
}

/** Every block of one explanation half, tags removed. */
export function halfBlocks(body: string, half: Half): string[] {
  const blocks = body.match(new RegExp(`<${half}>[\\s\\S]*?</${half}>`, 'g')) ?? [];
  return blocks.map((block) => block.slice(half.length + 2, -(half.length + 3)));
}

/**
 * The German a topic article actually shows: the body with frontmatter and all
 * four halves removed, MDX tags dropped, glosses reduced. What survives is the
 * headings, the tables, the `## Beispiele` blockquotes and any German prose
 * outside a half — everything the learner reads whatever explanation language
 * they picked.
 *
 * A `<CaseTable>`/`<SentenceRail>` renders a paradigm from
 * `content/reference-data/`, which is deliberately not pulled in: those tables
 * are articles and pronouns, function words known long before the topic that
 * displays them, so counting them would only pad the denominator.
 *
 * The four `##` skeleton headings are dropped and the `###` subsection headings
 * are kept. `Kurz gesagt`, `Erklärung`, `Beispiele` and `Häufige Fehler` are the
 * same eight words in all 46 articles — template, not input — and in a small A1
 * article they were an eighth of the surface. A `###` heading names the
 * confusion the subsection is about and is authored German the learner reads.
 *
 * An `import` line is source code and drops out too. It is not a theoretical
 * hazard: the eight files that import a visual component were reporting
 * `astro`, `src`, `components`, `from` and the component's own name as German
 * ahead of the learner, which on a 89-token A1 article was a third of its load.
 */
export function articleGerman(source: string): string {
  let body = stripFrontmatter(source);
  for (const half of HALVES) body = body.replace(new RegExp(`<${half}>[\\s\\S]*?</${half}>`, 'g'), ' ');
  return reduceGlosses(body)
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !/^##\s/.test(t) && !/^(?:import|export)\s/.test(t);
    })
    .join('\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/`+/g, ' ');
}

/**
 * The lines of the article that are running German, for sentence shape: table
 * rows and headings are dropped (a `| Kasus | Form |` row is not a sentence and
 * would wreck a mean), blockquote and list markers are stripped off the front of
 * what is left. Ordering is per line, so an example that ends without a full
 * stop cannot swallow the next one.
 */
export function articleSentenceLines(source: string): string[] {
  return articleGerman(source)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('|') && !line.startsWith('#'))
    .map((line) => line.replace(/^[>\-*+]\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim())
    .filter((line) => line !== '');
}

/**
 * The German-bearing fields of an exercise item, by type — an explicit
 * allow-list mirroring `itemGerman` in packages/content/src/coverage.ts, and kept beside it
 * rather than shared because the two answer different questions and neither
 * should silently move the other. `prompt_en`/`prompt_ru`, bilingual
 * instructions and meaning-side `match` rights are not German and are not here.
 *
 * Counted, by type: mc `prompt` + `options`; cloze/listen `text` + `accept`;
 * match `left` (and a plain-string `right`, which is a German↔German pair);
 * order `words` + `accept`; table `title`, `columns`, row labels and cell
 * answers; form `title`, `source`, field labels and answers; translate `answer`
 * + `accept`; write/speak `model_answer`; audio-comprehension `question`,
 * `options` and the spoken `source.turns`.
 */
export function itemGerman(item: Record<string, unknown>): string[] {
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
      push(item.text);
      push(item.accept);
      break;
    case 'match':
      for (const p of (item.pairs ?? []) as Array<Record<string, unknown>>) {
        push(p.left);
        push(p.right); // a record right is a meaning gloss; push's string guard skips it
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
    case 'form':
      push(item.title);
      push(item.source);
      for (const field of (item.fields ?? []) as Array<Record<string, unknown>>) {
        push(field.label);
        push(field.answer);
        push(field.accept);
      }
      break;
    case 'translate':
      push(item.answer);
      push(item.accept);
      break;
    case 'write':
    case 'speak':
      push(item.model_answer);
      break;
    case 'audio-comprehension': {
      push(item.question);
      push(item.options);
      const src = (item.source ?? {}) as Record<string, unknown>;
      const turns = (src.turns ?? []) as Array<Record<string, unknown>>;
      for (const t of turns) push(t.text);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sentence shape
// ---------------------------------------------------------------------------

/**
 * Words a subordinate clause is usually announced by, plus the relative
 * pronouns whose form is unambiguous. **A proxy, not a parse**: `da` and `als`
 * are counted whether they subordinate or not, and a verb-final clause with no
 * marker at all is invisible here. The figure is comparable between topics
 * because the same list runs over all of them, and means nothing on its own.
 */
export const SUBORDINATORS = [
  'dass', 'weil', 'wenn', 'als', 'ob', 'obwohl', 'damit', 'während', 'nachdem', 'bevor',
  'seit', 'seitdem', 'sobald', 'solange', 'falls', 'da', 'indem', 'denen', 'deren', 'dessen',
] as const;

const SUBORDINATOR_SET = new Set<string>(SUBORDINATORS);

/**
 * A comma directly before `der/die/das/dem/den` — the relative-clause heuristic,
 * counted on top of the list above. It also catches an apposition, which is the
 * price of not parsing.
 */
const RELATIVE = /,\s*(?:der|die|das|dem|den)(?![a-zäöüßA-ZÄÖÜ])/g;

/** Abbreviations whose full stop is not a sentence boundary. */
const ABBREVIATIONS = [
  'z', 'b', 'd', 'h', 'u', 'a', 'ca', 'bzw', 'usw', 'evtl', 'ggf', 'bspw', 'inkl', 'ggü',
  'nr', 'hr', 'fr', 'dr', 'st', 'mio', 'mrd', 'tel',
];

/**
 * Sentences, split on `.!?` before a capital or an opening quote.
 *
 * Three rejoins, each of which invents a boundary otherwise: an abbreviation
 * (`z. B.`, `d. h.`, `Nr. 12`), any single-letter fragment end, and an ordinal
 * (`am 3. Mai`, `vom 20. April` — the readings are full of dates). Approximate
 * by construction, like `sentences()` in packages/content/src/prose-shape.ts.
 */
export function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+(?=[\p{Lu}„«"])/u);
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    const tail = previous?.trim().match(/(?:^|\s)([\p{L}\p{N}]+)\.$/u)?.[1];
    if (
      previous !== undefined &&
      tail !== undefined &&
      (tail.length === 1 || /^\d+$/.test(tail) || ABBREVIATIONS.includes(tail.toLowerCase()))
    ) {
      merged[merged.length - 1] = `${previous} ${part}`;
      continue;
    }
    merged.push(part);
  }
  return merged.map((s) => s.trim()).filter((s) => countWords(s) >= 2);
}

/** Words = whitespace tokens carrying a letter or digit (the house rule, as in
    scripts/lang-cost.ts and packages/content/src/prose-shape.ts). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** Subordinator occurrences plus comma-relatives, in one sentence. */
export function nebensatzMarkers(sentence: string): number {
  const listed = tokens(sentence).filter((t) => SUBORDINATOR_SET.has(t)).length;
  return listed + (sentence.match(RELATIVE)?.length ?? 0);
}

export interface SentenceStats {
  sentences: number;
  meanWords: number;
  maxWords: number;
  /** Nebensatz markers per sentence — the proxy above, averaged. */
  nebensatzPerSentence: number;
}

export function sentenceStats(lines: string[]): SentenceStats {
  const all = lines.flatMap(splitSentences);
  if (all.length === 0) return { sentences: 0, meanWords: 0, maxWords: 0, nebensatzPerSentence: 0 };
  const sizes = all.map(countWords);
  const markers = all.reduce((n, s) => n + nebensatzMarkers(s), 0);
  return {
    sentences: all.length,
    meanWords: sizes.reduce((a, b) => a + b, 0) / all.length,
    maxWords: Math.max(...sizes),
    nebensatzPerSentence: markers / all.length,
  };
}

// ---------------------------------------------------------------------------
// Terminology density
// ---------------------------------------------------------------------------

/**
 * Grammar terms, as roots. Latin-script roots match exactly or with one
 * `TERM_SUFFIXES` ending, so `Verben` counts and `Verbindung` does not;
 * Cyrillic roots are written as stems and match by prefix, because Russian and
 * Ukrainian inflect a term far past any suffix list (`падеж` → `падежом`,
 * `прикметник` → `прикметника`) and an exact-match rule would report the RU and
 * UK halves as term-free — a statistic that only works for one half is worse
 * than none, the same lesson `sentences()` in prose-shape.ts learned.
 *
 * Umlaut plurals are listed as their own roots (`nebensätz`) because the suffix
 * rule cannot reach inside the stem.
 */
export const GRAMMAR_TERMS = [
  // German
  'kasus', 'nominativ', 'akkusativ', 'dativ', 'genitiv', 'artikel', 'verb', 'nomen',
  'substantiv', 'adjektiv', 'adverb', 'pronomen', 'präposition', 'konjunktion', 'präsens',
  'präteritum', 'perfekt', 'plusquamperfekt', 'futur', 'partizip', 'infinitiv', 'konjunktiv',
  'passiv', 'aktiv', 'nebensatz', 'nebensätz', 'hauptsatz', 'hauptsätz', 'relativsatz',
  'relativsätz', 'endung', 'deklination', 'konjugation', 'singular', 'plural', 'modalverb',
  'reflexiv', 'trennbar',
  // English
  'case', 'tense', 'clause', 'participle', 'infinitive', 'subjunctive', 'passive',
  'declension', 'conjugation', 'subordinate', 'auxiliary',
  // Russian (stems)
  'падеж', 'глагол', 'существительн', 'прилагательн', 'местоимени', 'предлог', 'союз',
  'окончани', 'склонени', 'спряжени', 'причасти', 'инфинитив', 'залог', 'наклонени',
  'придаточн',
  // Ukrainian (stems)
  'відмін', 'дієслов', 'іменник', 'прикметник', 'займенник', 'прийменник', 'сполучник',
  'закінченн', 'дієвідмінюванн', 'дієприкметник',
] as const;

/** The one ending a Latin-script term root may carry and still count. */
export const TERM_SUFFIXES = ['', 'e', 'en', 'er', 'es', 'em', 'n', 's'] as const;

const CYRILLIC_ROOT = /[Ѐ-ӿ]/;
const LATIN_TERMS = GRAMMAR_TERMS.filter((t) => !CYRILLIC_ROOT.test(t));
const CYRILLIC_TERMS = GRAMMAR_TERMS.filter((t) => CYRILLIC_ROOT.test(t));
const LATIN_FORMS = new Set(LATIN_TERMS.flatMap((t) => TERM_SUFFIXES.map((s) => t + s)));

/** Does this word count as a grammar term? A word counts once however many
    roots it matches. */
export function isGrammarTerm(word: string): boolean {
  const w = word.toLowerCase();
  return LATIN_FORMS.has(w) || CYRILLIC_TERMS.some((root) => w.startsWith(root));
}

export interface TerminologyStats {
  words: number;
  terms: number;
  /** grammar-term occurrences per 100 words */
  per100: number;
}

export function terminologyDensity(text: string): TerminologyStats {
  const plain = reduceGlosses(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*]+/g, ' ');
  const words = countWords(plain);
  const terms = plain
    .split(/[^\p{L}]+/u)
    .filter((w) => w !== '' && isGrammarTerm(w)).length;
  return { words, terms, per100: words === 0 ? 0 : (terms / words) * 100 };
}

// ---------------------------------------------------------------------------
// The corpus
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

export interface TopicSource {
  id: string;
  level: Level;
  /** index in the spine (atlas `units:` file order, levels concatenated) */
  position: number;
  file: string;
  /** raw MDX source, frontmatter included */
  source: string;
  vocab: string[];
  exercises: string[];
  reading: string[];
}

export interface ReadingSource {
  /** everything German the reading shows: title, paragraphs, question German */
  german: string;
  /** the paragraphs alone — the reading proper, which is what a sentence
      statistic may be taken over. A title is a noun phrase and an mc option is
      a fragment; counting either as a sentence pulls a mean down by a third. */
  paragraphs: string[];
}

export interface Corpus {
  /** spine order — this array's index IS the position */
  topics: TopicSource[];
  /** `<level>/<id>` → the reading's German (glosses reduced) */
  readings: Map<string, ReadingSource>;
  /** `<level>/<id>` → the German of a practice/drill set, empty for other roles */
  exercises: Map<string, string>;
  /** deck id → every German form the deck shows */
  decks: Map<string, string[]>;
  /** level → Wortliste headword tokens, stem headwords expanded */
  wortlisten: Map<RankedLevel, Set<string>>;
}

/** Endings a `stem-` Wortliste headword may take — the same list `addresses()`
    uses in packages/content/src/coverage.ts, so the two instruments read the manifest alike. */
const STEM_ENDINGS = ['', 'e', 'er', 'es', 'en', 'em'];

/**
 * A Wortliste manifest as tokens: `#` lines dropped, a leading `~` (taught as
 * grammar, no flashcard) removed, a `stem-` headword expanded over
 * `STEM_ENDINGS`. A multi-word headword contributes each of its tokens, because
 * this set answers "has the learner met this word", not coverage.ts's "does the
 * course teach this entry".
 */
export function parseWortliste(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const word = line.startsWith('~') ? line.slice(1) : line;
    if (word.endsWith('-')) {
      const stem = normalize(word.slice(0, -1));
      for (const ending of STEM_ENDINGS) out.add(stem + ending);
      continue;
    }
    for (const token of tokens(word)) out.add(token);
  }
  return out;
}

function wortlisteTokens(root: string, level: RankedLevel): Set<string> {
  const path = join(root, `data/goethe-${level.toLowerCase()}-wortliste.txt`);
  return existsSync(path) ? parseWortliste(readFileSync(path, 'utf8')) : new Set<string>();
}

/** Everything the report reads, loaded once. */
export function loadCorpus(root = repoRoot()): Corpus {
  const atlas = YAML.parse(readFileSync(join(root, 'content/atlas.yaml'), 'utf8')) as {
    units: Array<{ level: Level; topics: string[] }>;
  };
  const order = atlas.units.flatMap((unit) => unit.topics);

  const byId = new Map<string, Omit<TopicSource, 'position'>>();
  for (const file of walk(join(root, 'content/topics'), '.mdx')) {
    const source = readFileSync(file, 'utf8');
    const fm = frontmatterOf(source) as
      | { id: string; level: Level; vocab?: string[]; exercises?: string[]; reading?: string[] }
      | undefined;
    if (!fm) continue;
    byId.set(fm.id, {
      id: fm.id,
      level: fm.level,
      file,
      source,
      vocab: fm.vocab ?? [],
      exercises: fm.exercises ?? [],
      reading: fm.reading ?? [],
    });
  }

  const topics: TopicSource[] = [];
  for (const id of order) {
    const topic = byId.get(id);
    if (topic) topics.push({ ...topic, position: topics.length });
  }

  const readings = new Map<string, ReadingSource>();
  const readingRoot = join(root, 'content/reading');
  for (const file of walk(readingRoot, '.yaml')) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as {
      title_de?: string;
      text?: string[];
      questions?: Array<Record<string, unknown>>;
    };
    const paragraphs = (data.text ?? []).map(reduceGlosses);
    const parts = [data.title_de ?? '', ...paragraphs];
    for (const q of data.questions ?? []) parts.push(...itemGerman({ ...q, type: 'mc' }));
    readings.set(refOf(readingRoot, file), { german: parts.join('\n'), paragraphs });
  }

  const exercises = new Map<string, string>();
  const exerciseRoot = join(root, 'content/exercises');
  for (const file of walk(exerciseRoot, '.yaml')) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as {
      role?: string;
      items?: Array<Record<string, unknown>>;
    };
    const role = data.role ?? 'practice';
    const german =
      role === 'practice' || role === 'drill'
        ? (data.items ?? []).flatMap(itemGerman).join('\n')
        : '';
    exercises.set(refOf(exerciseRoot, file), german);
  }

  const decks = new Map<string, string[]>();
  const vocabDir = join(root, 'content/vocab');
  for (const file of walk(vocabDir, '.yaml')) {
    const data = YAML.parse(readFileSync(file, 'utf8')) as {
      id: string;
      entries: Array<{
        de: string;
        plural?: string;
        praesens_3sg?: string;
        partizip2?: string;
        accept?: string[];
      }>;
    };
    decks.set(
      data.id,
      data.entries.flatMap((e) =>
        [e.de, e.plural, e.praesens_3sg, e.partizip2, ...(e.accept ?? [])].filter(
          (v): v is string => typeof v === 'string',
        ),
      ),
    );
  }

  const wortlisten = new Map<RankedLevel, Set<string>>();
  for (const level of RANKED_LEVELS) wortlisten.set(level, wortlisteTokens(root, level));

  return { topics, readings, exercises, decks, wortlisten };
}

/** `content/reading/b1/geld-vertraege.yaml` → `b1/geld-vertraege`, the id shape
    topic frontmatter refers to a reading or an exercise set by. */
function refOf(base: string, file: string): string {
  return file.slice(base.length + 1).replace(/\.yaml$/, '').split(/[\\/]/).join('/');
}

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

export interface SectionLoad {
  tokens: number;
  ahead: number;
  /** ahead tokens per 100 tokens of this section */
  per100: number;
  /** distinct ahead tokens with their counts, most frequent first — the
      actionable half of the report */
  distinct: Array<{ token: string; count: number }>;
}

export interface TopicLoad {
  id: string;
  level: Level;
  position: number;
  sections: Record<Section, SectionLoad>;
  /** article + reading pooled — the ranking's sort key */
  overall: { tokens: number; ahead: number; per100: number };
  sentences: SentenceStats;
  terminology: Partial<Record<Half, TerminologyStats>>;
  known: { priorSurface: number; vocab: number; wortliste: number };
}

function measure(text: string, has: (t: string) => boolean): SectionLoad {
  const counts = new Map<string, number>();
  let total = 0;
  let ahead = 0;
  for (const token of tokens(text)) {
    total += 1;
    if (!isCountedAsAhead(token) || isKnown(token, has)) continue;
    ahead += 1;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return {
    tokens: total,
    ahead,
    per100: total === 0 ? 0 : (ahead / total) * 100,
    distinct: [...counts.entries()]
      .map(([token, count]) => ({ token, count }))
      .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token)),
  };
}

/** The German of one topic, by section. */
function ownGerman(corpus: Corpus, topic: TopicSource): Record<Section, string> {
  return {
    article: articleGerman(topic.source),
    reading: topic.reading.map((ref) => corpus.readings.get(ref)?.german ?? '').join('\n'),
    items: topic.exercises.map((ref) => corpus.exercises.get(ref) ?? '').join('\n'),
  };
}

/**
 * Every topic on the spine, measured in one pass.
 *
 * One pass rather than one call per topic because the known set is cumulative:
 * the prior taught surface at position P is the surface at P-1 plus what the
 * topic at P-1 taught, and the attached decks accumulate the same way. Walking
 * the spine once is both the cheap way and the way that cannot disagree with
 * itself about what "prior" means.
 */
export function measureSpine(corpus: Corpus): TopicLoad[] {
  const priorSurface = new Set<string>();
  const deckTokens = new Set<string>();
  const wortlisteCache = new Map<Level, Set<string>>();
  const out: TopicLoad[] = [];

  for (const topic of corpus.topics) {
    // Own decks first: a word the topic's own deck teaches is support, not load.
    for (const deck of topic.vocab) {
      for (const form of corpus.decks.get(deck) ?? []) for (const t of tokens(form)) deckTokens.add(t);
    }
    let wortliste = wortlisteCache.get(topic.level);
    if (!wortliste) {
      wortliste = cumulativeWortliste(corpus, topic.level);
      wortlisteCache.set(topic.level, wortliste);
    }
    const has = (t: string) => priorSurface.has(t) || deckTokens.has(t) || wortliste.has(t);

    const german = ownGerman(corpus, topic);
    const sections = {
      article: measure(german.article, has),
      reading: measure(german.reading, has),
      items: measure(german.items, has),
    } satisfies Record<Section, SectionLoad>;

    const pooledTokens = sections.article.tokens + sections.reading.tokens;
    const pooledAhead = sections.article.ahead + sections.reading.ahead;

    const readingLines = topic.reading.flatMap((ref) => corpus.readings.get(ref)?.paragraphs ?? []);

    const body = stripFrontmatter(topic.source);
    const terminology: Partial<Record<Half, TerminologyStats>> = {};
    for (const half of HALVES) {
      const blocks = halfBlocks(body, half);
      if (blocks.length === 0) continue;
      terminology[half] = terminologyDensity(blocks.join('\n\n'));
    }

    out.push({
      id: topic.id,
      level: topic.level,
      position: topic.position,
      sections,
      overall: {
        tokens: pooledTokens,
        ahead: pooledAhead,
        per100: pooledTokens === 0 ? 0 : (pooledAhead / pooledTokens) * 100,
      },
      sentences: sentenceStats([...articleSentenceLines(topic.source), ...readingLines]),
      terminology,
      known: { priorSurface: priorSurface.size, vocab: deckTokens.size, wortliste: wortliste.size },
    });

    for (const text of Object.values(german)) for (const t of tokens(text)) priorSurface.add(t);
  }
  return out;
}

/**
 * The Wortliste of every level up to and including this one, as one set. B2 has
 * no manifest, so a B2 topic is measured against all three that exist — the most
 * generous reading available, which is the right direction for a level whose own
 * standard is not in the repo.
 *
 * Memoized per corpus, never in a module-level cache: two corpora in one process
 * (a fixture beside the repo, in tests) must not answer each other's question.
 */
export function cumulativeWortliste(corpus: Corpus, level: Level): Set<string> {
  const index = RANKED_LEVELS.indexOf(level as RankedLevel);
  const upTo = index === -1 ? RANKED_LEVELS : RANKED_LEVELS.slice(0, index + 1);
  const out = new Set<string>();
  for (const l of upTo) for (const token of corpus.wortlisten.get(l) ?? []) out.add(token);
  return out;
}

/** Highest terminology density across the halves a topic actually carries. */
export function maxTerminology(load: TopicLoad): number {
  return Math.max(0, ...HALVES.map((half) => load.terminology[half]?.per100 ?? 0));
}

/** The median — norms here are read off the corpus, never hand-written. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
