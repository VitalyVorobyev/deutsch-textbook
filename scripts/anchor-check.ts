#!/usr/bin/env bun
/**
 * Hold a transcribed inventory anchor against the PDF it was transcribed from.
 *
 * WHY THIS EXISTS. `data/strukturenlisten/`, `data/handlungslisten/` and `data/themenlisten/` are
 * the denominators the whole coverage story rests on — if a label in one of them was invented, the
 * course measures itself against a standard nobody published; if a label was *missed*, coverage
 * flatters itself by exactly the amount that went missing. Neither failure is visible: the YAML
 * parses, the schema is satisfied, `bun run validate` is green, and `structures.ts` happily reports
 * a percentage of the wrong list. This repo already published 100% against an incomplete A1
 * denominator for months. A transcription claim needs a command behind it, and this is it.
 *
 * WHAT IT CHECKS, in the order the failures matter:
 *
 *   1. INVENTED — every word of every `de:` label must occur in the source's own page range. A
 *      label assembled from two printed lines still passes (that is a reading of the layout, and
 *      each file records the ones it had to make); a label containing a word the page does not
 *      contain is a fabrication and fails.
 *   2. LEAKED — no entry label may be an example sentence. ADR 0011's boundary is labels only:
 *      *that* the exam tests `wegen` with two cases is a fact, and the sentence the booklet chose
 *      to illustrate it with is not ours to take.
 *   3. UNACCOUNTED — source lines in the page range that look like a label and that no entry
 *      matches. This one is a REVIEW LIST, not a verdict: a two-column PDF puts headings, footers,
 *      running titles and wrapped example fragments in the same text stream, so most rows are
 *      noise. It is printed because the alternative is deciding completeness by feel, and it is
 *      the direction that hides real holes.
 *
 * The PDFs are local-only and gitignored (ADR 0009), so a clean checkout cannot run this. That is
 * stated, not worked around: with the source absent the check reports `skipped` and exits 0, the
 * same contract `exam:ingest` keeps. It never becomes a gate on a machine that cannot see the file.
 *
 *   bun scripts/anchor-check.ts                 # every anchor with a local source
 *   bun scripts/anchor-check.ts goethe-dtz      # one
 *   bun scripts/anchor-check.ts goethe-dtz --unaccounted   # + the review list
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as YAML from 'yaml';
import { repoRoot } from '@da/content/repo-root';

const ANCHOR_DIRS = ['strukturenlisten', 'handlungslisten', 'themenlisten'];

interface Entry { key: string; de: string; note?: string }
interface Section { id: string; de: string; page?: number; entries: Entry[] }
interface Anchor {
  source: {
    id: string;
    title: string;
    pages?: string;
    local?: string;
    /**
     * Which pages of the PDF hold `pages:`. Declared outright rather than derived from an offset,
     * because the offset model does not survive contact with the real files: the retired Start
     * Deutsch 2 booklet is a two-up scan whose every PDF page carries two printed pages, so no
     * single addend maps one to the other.
     */
    pdf_pages?: string;
    /** x-bands (PDF points) where this document prints its label columns; see `unaccounted`. */
    label_columns?: [number, number][];
  };
  sections: Section[];
}

/**
 * Fold a label to comparable words. Case and the punctuation a table uses to join alternatives
 * (`der / die / das`, `um … zu`) carry no evidence about whether the words were printed; the words
 * do. Hyphenated affixes stay whole, because `-chen` and `chen` are different claims.
 */
const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[„“"»«()[\],;:!?.…]/g, ' ')
    .replace(/[/|]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^[–—+-]+$/.test(w));

/**
 * Does the page contain this word, allowing for a column-break hyphen?
 *
 * A narrow table column splits `Komposita – gleiches Bestimmungs-` from its `wort`, and the naive
 * repair — rejoin every `-` before a newline — is wrong in a two-column PDF: it welded the end of a
 * right-hand example (`… zu meiner Freun-`) onto the start of the next left-hand label (`gut/…`),
 * inventing the token `freungut` and then accusing a correct entry of having made `gut` up. So the
 * text is never mutated; the *lookup* reaches across the hyphen instead, and only for a word that
 * is genuinely a prefix followed by its genuine remainder.
 */
function onPage(word: string, haystack: Set<string>, stems: string[]): boolean {
  if (haystack.has(word)) return true;
  return stems.some((stem) => word.startsWith(stem) && haystack.has(word.slice(stem.length)));
}

/** An example sentence, as opposed to a structure label. Both tests must hold to accuse. */
const looksLikeSentence = (text: string): boolean =>
  /[.!?]\s*$/.test(text.trim()) && text.trim().split(/\s+/).length >= 5;

function pdfText(pdf: string, from: number, to: number): string {
  const out = Bun.spawnSync(['pdftotext', '-f', String(from), '-l', String(to), '-layout', pdf, '-']);
  if (out.exitCode !== 0) throw new Error(`pdftotext failed on ${pdf}: ${out.stderr.toString()}`);
  return out.stdout.toString();
}

/**
 * The completeness direction: which printed labels did the transcription never account for?
 *
 * It needs to know where a label column *is*. Without that the answer was 221 rows of noise —
 * running titles, page numbers, and every wrapped fragment of a two-column example — which is a
 * review list nobody reads, i.e. the same as no check at all. `pdftotext -bbox-layout` gives each
 * line an x, and a table's label columns cluster hard: in the DTZ's §8.4 the left labels sit at
 * x≈63 and their examples at x≈178, the right labels at x≈325 and theirs at x≈441. So each source
 * declares the bands, and everything outside them is example text by construction rather than by
 * guessing at punctuation.
 *
 * Still a review list and not a verdict: a wrapped label's continuation line sits in the band too.
 */
function unaccounted(anchor: Anchor, pdf: string, from: number, to: number): string[] | undefined {
  const bands = anchor.source.label_columns;
  if (!bands?.length) return undefined;

  const out = Bun.spawnSync(['pdftotext', '-f', String(from), '-l', String(to), '-bbox-layout', pdf, '-']);
  const xml = out.stdout.toString();

  const known = new Set<string>();
  for (const section of anchor.sections) {
    // "1.1 Verb · Tempus" is printed as the group header "1 Verb" plus the row header "1.1 Tempus",
    // so every recombination of its number and its parts counts as accounted.
    const [, number = '', rest = section.de] = section.de.match(/^([\d.]+)\s+(.*)$/) ?? [];
    for (const part of rest.split(/[·|]/)) {
      known.add(norm(part));
      known.add(norm(`${number} ${part}`));
      known.add(norm(`${number.split('.')[0]} ${part}`));
    }
    known.add(norm(section.de));
    for (const entry of section.entries) {
      known.add(norm(entry.de));
      // A label transcribed as one entry may be printed as two lines, and each half must count as
      // accounted or every wrapped row would resurface here as a false hole.
      for (const part of entry.de.split(/[:,/]| – |\s…\s/)) known.add(norm(part));
    }
  }

  const rows: string[] = [];
  const seen = new Set<string>();
  const lineRe = /<line xMin="([\d.]+)"[^>]*>(.*?)<\/line>/gs;
  for (const match of xml.matchAll(lineRe)) {
    const x = Number(match[1]);
    if (!bands.some(([lo, hi]) => x >= lo && x <= hi)) continue;
    const text = [...match[2].matchAll(/<word[^>]*>(.*?)<\/word>/g)]
      .map((w) => w[1])
      .join(' ')
      .replace(/&amp;/g, '&');
    const key = norm(text);
    if (!key || seen.has(key) || known.has(key)) continue;
    seen.add(key);
    rows.push(text);
  }
  return rows;
}

const norm = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, '');

function loadAnchors(root: string): { file: string; anchor: Anchor }[] {
  const found: { file: string; anchor: Anchor }[] = [];
  for (const dir of ANCHOR_DIRS) {
    const path = join(root, 'data', dir);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path).filter((f) => f.endsWith('.yaml')).sort()) {
      found.push({ file: join('data', dir, name), anchor: YAML.parse(readFileSync(join(path, name), 'utf8')) as Anchor });
    }
  }
  return found;
}

function main() {
  const argv = process.argv.slice(2);
  const showUnaccounted = argv.includes('--unaccounted');
  const only = argv.find((a) => !a.startsWith('--'));
  const root = repoRoot();

  if (Bun.spawnSync(['which', 'pdftotext']).exitCode !== 0) {
    console.log('pdftotext not found (brew install poppler) — nothing checked.');
    process.exit(0);
  }

  let failures = 0;
  let checked = 0;

  for (const { anchor } of loadAnchors(root)) {
    const { source } = anchor;
    if (only && source.id !== only) continue;

    const entries = anchor.sections.flatMap((s) => s.entries.map((e) => ({ section: s, entry: e })));
    const pdf = source.local ? join(root, source.local) : undefined;
    const range = (source.pdf_pages ?? '').match(/^(\d+)\s*[–-]\s*(\d+)$/);

    if (!pdf || !existsSync(pdf) || !range) {
      const why = !pdf
        ? 'no source.local'
        : !existsSync(pdf)
          ? 'source absent locally (ADR 0009)'
          : 'no source.pdf_pages — nothing to read it against';
      console.log(`⏭  ${source.id.padEnd(22)} ${String(entries.length).padStart(3)} entries — skipped: ${why}`);
      continue;
    }

    checked += 1;
    const text = pdfText(pdf, Number(range[1]), Number(range[2]));
    const haystack = new Set(words(text));
    const stems = [...haystack].filter((w) => w.endsWith('-') && w.length > 2).map((w) => w.slice(0, -1));

    const invented: string[] = [];
    const leaked: string[] = [];
    for (const { section, entry } of entries) {
      const missing = words(entry.de).filter((w) => !onPage(w, haystack, stems));
      if (missing.length) invented.push(`${section.id}/${entry.key}: “${entry.de}” — not on the page: ${missing.join(', ')}`);
      if (looksLikeSentence(entry.de)) leaked.push(`${section.id}/${entry.key}: “${entry.de}”`);
    }

    const status = invented.length || leaked.length ? '✗' : '✓';
    console.log(
      `${status}  ${source.id.padEnd(22)} ${String(entries.length).padStart(3)} entries · ${anchor.sections.length} sections · S. ${source.pages}`,
    );
    for (const line of invented) console.log(`     invented? ${line}`);
    for (const line of leaked) console.log(`     example sentence as a label: ${line}`);
    failures += invented.length + leaked.length;

    if (showUnaccounted) {
      const rows = unaccounted(anchor, pdf, Number(range[1]), Number(range[2]));
      if (!rows) {
        console.log('     --unaccounted needs source.label_columns — see data/strukturenlisten/README.md');
      } else {
        console.log(`     ${rows.length} label-column line(s) matching no transcribed entry:`);
        for (const row of rows) console.log(`       · ${row}`);
      }
    }
  }

  if (!checked) console.log('\nNothing checked — the sources are local-only (ADR 0009).');
  else console.log(`\n${failures === 0 ? 'No fabricated labels and no leaked examples.' : `${failures} problem(s).`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
