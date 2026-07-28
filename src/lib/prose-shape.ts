/**
 * Prose shape for explanation halves: how big a single paragraph is allowed to
 * get inside `<En>`/`<Ru>`/`<Uk>`/`<De>`. Shared by `scripts/validate.ts`,
 * `scripts/prose-shape.ts` and the tests (house pattern: testable module in
 * src/lib/, thin wiring in the script — like src/lib/langcheck.ts). Nothing
 * here is imported by runtime code; it runs at authoring/validation time only.
 *
 * Why a word cap at all. The explanation article is the **model stage** of the
 * lesson cycle, and a paragraph is its unit of segmentation: one claim, its
 * evidence, and a visual boundary the reader can rest at. The two newest B1
 * articles arrived with single blocks of 412 and 271 words carrying ~9 idea
 * units each, against a corpus where no A1 or A2 file exceeds 110 — the
 * signaling and segmenting the A2 articles get from `### subsections` was
 * simply missing. Reasoning, measurement and the four levers:
 * `docs/article-prose.md`.
 *
 * The cap is a **tripwire, not a target.** Readability formulas are validated
 * as correlational indices and writing to them strips cohesion, which is the
 * one thing a low-knowledge reader (a learner meeting the rule for the first
 * time) needs most. Nothing here rewards shorter prose; it only refuses a wall.
 */

/** The four explanation halves, in the order they are authored. */
export const PROSE_LANGS = ['En', 'Ru', 'Uk', 'De'] as const;
export type ProseLang = (typeof PROSE_LANGS)[number];

/**
 * Hard ceiling for one paragraph inside one explanation half.
 *
 * Corpus-derived, not chosen: at the time it was introduced the longest
 * paragraph in any A1, A2 or discovery file was 110 words, and exactly four B1
 * files exceeded it (133 / 209 / 271 / 412). 120 therefore refuses the wall
 * without touching a single shipped A1/A2 paragraph. The authoring target is
 * ≤ 90 — the ceiling exists for the case where the target was missed, not as
 * the thing to aim at.
 *
 * Command behind those figures: `bun scripts/prose-shape.ts content/topics`.
 */
export const MAX_PARAGRAPH_WORDS = 120;

/** One paragraph of one explanation half, located well enough to fix. */
export interface ProseParagraph {
  lang: ProseLang;
  /** 1-based index of the `<lang>` block within the body. */
  block: number;
  /** 1-based index of the paragraph within that block. */
  index: number;
  words: number;
  /** The paragraph with markup stripped — what `words` counted. */
  text: string;
}

/** Aggregate shape of one half, for the reporter. Stats only — never gated. */
export interface ProseLangStats {
  paragraphs: number;
  words: number;
  mean: number;
  p90: number;
  max: number;
  /** Share (0–1) of sentences over 30 words. Approximate — see `sentences`. */
  longSentenceShare: number;
}

const BLOCK_SPLIT = /\n\s*\n/;

/**
 * Lines that are not running prose. Dropped before counting, so a paragraph
 * that happens to sit against a list keeps an honest size:
 * markdown tables, list items, blockquotes, headings, and lines that are
 * nothing but a JSX/MDX element.
 */
function isStructuralLine(line: string): boolean {
  const t = line.trim();
  if (t === '') return true;
  if (t.startsWith('|')) return true; // table row
  if (/^[-*+]\s/.test(t)) return true; // bullet — `*text*` italics have no space after the star
  if (/^\d+[.)]\s/.test(t)) return true; // ordered list
  if (t.startsWith('>')) return true; // blockquote (German examples)
  if (t.startsWith('#')) return true; // heading
  if (/^import\s/.test(t)) return true;
  if (/^<[^>]+\/?>$/.test(t)) return true; // a bare element on its own line
  return false;
}

/** Strip the markup that carries no words: MDX tags, emphasis, code, glosses. */
function stripMarkup(text: string): string {
  return text
    .replace(/\[\[([^\]]*?)::[^\]]*?\]\]/g, '$1') // [[de::en::ru]] → de
    .replace(/<[^>]*>/g, ' ')
    .replace(/`+/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');
}

/** Words = whitespace-separated tokens containing at least one letter or digit. */
function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

const blocksOf = (body: string, lang: ProseLang): string[] =>
  (body.match(new RegExp(`<${lang}>[\\s\\S]*?</${lang}>`, 'g')) ?? []).map((block) =>
    block.slice(lang.length + 2, -(lang.length + 3)),
  );

/**
 * Every prose paragraph of every explanation half, in document order.
 * A chunk left with fewer than three words after filtering (a stray caption,
 * a lone example line) is not a paragraph and is dropped rather than counted.
 */
export function proseParagraphs(body: string): ProseParagraph[] {
  const out: ProseParagraph[] = [];
  for (const lang of PROSE_LANGS) {
    blocksOf(body, lang).forEach((block, blockIndex) => {
      let index = 0;
      for (const chunk of block.split(BLOCK_SPLIT)) {
        const prose = chunk
          .split('\n')
          .filter((line) => !isStructuralLine(line))
          .join(' ');
        const text = stripMarkup(prose).replace(/\s+/g, ' ').trim();
        const words = countWords(text);
        if (words < 3) continue;
        index += 1;
        out.push({ lang, block: blockIndex + 1, index, words, text });
      }
    });
  }
  return out;
}

/**
 * Approximate sentence split — stats only, never a gate. German example
 * sentences sit inside the prose in italics, so a boundary can be missed or
 * invented; the figure is a shape signal, not a measurement to quote alone.
 *
 * The lookahead is `\p{Lu}`, not `[A-ZÄÖÜ]`: a Latin-only class never matches a
 * Cyrillic capital, so the RU and UK halves came back as one sentence each and
 * their long-sentence share read 56–69% where the EN half read 10%. A statistic
 * that only works for one of four halves is worse than none.
 *
 * `z. B.`, `u. a.` and `d. h.` split on their first period because `B` is a
 * capital, so a fragment ending in a one-letter token is rejoined — otherwise
 * every abbreviation invents a sentence boundary and pads the denominator,
 * making long sentences look rarer than they are. The two-word floor after that
 * drops what is left of a stray fragment, never a real short sentence.
 */
export function sentences(paragraph: string): string[] {
  const parts = paragraph.split(/(?<=[.!?])\s+(?=[\p{Lu}„«])/u);
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && /(?:^|\s)\p{L}\.$/u.test(previous.trim())) {
      merged[merged.length - 1] = `${previous} ${part}`;
      continue;
    }
    merged.push(part);
  }
  return merged.map((s) => s.trim()).filter((s) => countWords(s) >= 2);
}

/** Per-half aggregates for the reporter. Empty halves are omitted. */
export function proseShapeStats(body: string): Partial<Record<ProseLang, ProseLangStats>> {
  const stats: Partial<Record<ProseLang, ProseLangStats>> = {};
  const paragraphs = proseParagraphs(body);
  for (const lang of PROSE_LANGS) {
    const mine = paragraphs.filter((p) => p.lang === lang);
    if (mine.length === 0) continue;
    const sizes = mine.map((p) => p.words).sort((a, b) => a - b);
    const total = sizes.reduce((a, b) => a + b, 0);
    const allSentences = mine.flatMap((p) => sentences(p.text));
    const long = allSentences.filter((s) => countWords(s) > 30).length;
    stats[lang] = {
      paragraphs: sizes.length,
      words: total,
      mean: total / sizes.length,
      p90: sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.9))]!,
      max: sizes[sizes.length - 1]!,
      longSentenceShare: allSentences.length === 0 ? 0 : long / allSentences.length,
    };
  }
  return stats;
}

/**
 * The gate: one message per paragraph over the cap, naming the half, the block
 * and enough of the text to find it. Everything else about prose shape —
 * whether `## Erklärung` is split into `###` subsections, whether a table sits
 * beside the prose that explains it, whether a stated fact is ever drilled — is
 * a judgement about meaning and stays with the author (`docs/article-prose.md`).
 */
export function proseShapeProblems(body: string, opts: { max?: number } = {}): string[] {
  const max = opts.max ?? MAX_PARAGRAPH_WORDS;
  return proseParagraphs(body)
    .filter((p) => p.words > max)
    .map(
      (p) =>
        `<${p.lang}> block ${p.block}, paragraph ${p.index}: ${p.words} words (max ${max}) — split it, one claim per paragraph, and give each part its own ### subsection where it names a different confusion: "${p.text.slice(0, 70)}…"`,
    );
}
