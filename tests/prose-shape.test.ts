import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_PARAGRAPH_WORDS,
  proseParagraphs,
  proseShapeProblems,
  proseShapeStats,
  sentences,
} from '@da/content/prose-shape';

/** A body of `n` words, as one paragraph inside one half. */
const half = (tag: string, n: number) => `<${tag}>\n${Array(n).fill('Wort').join(' ')}\n</${tag}>`;

describe('paragraph extraction', () => {
  test('splits a half on blank lines, and only inside the half', () => {
    const body = 'Outside the block entirely, in German, always visible.\n\n<En>\nOne two three.\n\nFour five six seven.\n</En>';
    const paragraphs = proseParagraphs(body);
    expect(paragraphs.map((p) => p.words)).toEqual([3, 4]);
    expect(paragraphs.map((p) => p.index)).toEqual([1, 2]);
    expect(paragraphs.every((p) => p.lang === 'En')).toBe(true);
  });

  test('structural lines are not prose the reader wades through', () => {
    // Tables and example blockquotes live outside the halves in a topic article,
    // but a half may still carry a list — and a list is scannable in a way a
    // paragraph is not, so counting it against the cap would punish the fix.
    const body = [
      '<En>',
      '| Kasus | Form |',
      '| --- | --- |',
      '| Dativ | dem Kollegen |',
      '- a bulleted point that is long enough to matter here',
      '1. an ordered one',
      '> a quoted German example sentence',
      '#### a heading',
      '<SentenceRail view="subordinate" />',
      'This sentence is the only prose in the block.',
      '</En>',
    ].join('\n');
    expect(proseParagraphs(body).map((p) => p.words)).toEqual([9]);
  });

  test('markup carries no words: emphasis, code, MDX tags and glosses', () => {
    const body = '<En>\n**Bold** *italic* `code` [[der Kollege::the colleague::коллега]] plain\n</En>';
    const [paragraph] = proseParagraphs(body);
    expect(paragraph!.words).toBe(6); // Bold italic code der Kollege plain
    expect(paragraph!.text).toBe('Bold italic code der Kollege plain');
  });

  test('all four halves are counted, and an absent half reports nothing', () => {
    const body = `${half('En', 5)}\n${half('Ru', 6)}\n${half('Uk', 7)}`;
    const stats = proseShapeStats(body);
    expect(stats.En?.max).toBe(5);
    expect(stats.Ru?.max).toBe(6);
    expect(stats.Uk?.max).toBe(7);
    expect(stats.De).toBeUndefined();
  });

  test('blocks are numbered per half, so a message locates the paragraph', () => {
    const body = `${half('En', 3)}\n${half('En', 4)}`;
    expect(proseParagraphs(body).map((p) => [p.block, p.index, p.words])).toEqual([
      [1, 1, 3],
      [2, 1, 4],
    ]);
  });
});

describe('the cap', () => {
  test('the ceiling itself passes and one word over fails', () => {
    expect(proseShapeProblems(half('En', MAX_PARAGRAPH_WORDS))).toHaveLength(0);
    expect(proseShapeProblems(half('En', MAX_PARAGRAPH_WORDS + 1))).toHaveLength(1);
  });

  test('the message names the half, the block and the size', () => {
    const [problem] = proseShapeProblems(`${half('Ru', 4)}\n${half('Ru', 200)}`);
    expect(problem).toContain('<Ru> block 2');
    expect(problem).toContain('200 words (max 120)');
  });

  test('every half is gated, not just the one authored first', () => {
    expect(proseShapeProblems(half('De', 300))).toHaveLength(1);
    expect(proseShapeProblems(half('Uk', 300))).toHaveLength(1);
  });
});

describe('sentence statistics', () => {
  // Regression: the split lookahead was `[A-ZÄÖÜ„]`, which never matches a
  // Cyrillic capital — the RU and UK halves came back as a single sentence each
  // and their long-sentence share read 56–69% where EN read 10%.
  test('sentences split in Cyrillic as well as Latin', () => {
    expect(sentences('Первое предложение тут. Второе предложение тут. Третье тоже тут.')).toHaveLength(3);
    expect(sentences('First sentence here. Second sentence here.')).toHaveLength(2);
  });

  // `z. B.` splits on its first period because `B` is a capital. Left alone,
  // every abbreviation invents a boundary and pads the denominator.
  test('an abbreviation does not invent a sentence', () => {
    expect(sentences('Viele Nomen dekliniert man so, z. B. der Kollege.')).toHaveLength(1);
    expect(sentences('Das gilt u. a. für Personen. Der zweite Satz steht hier.')).toHaveLength(2);
  });

  test('the long-sentence share is a share of sentences, not of paragraphs', () => {
    const long = Array(40).fill('Wort').join(' ');
    const stats = proseShapeStats(`<En>\nKurz und gut hier. ${long}.\n</En>`);
    expect(stats.En?.longSentenceShare).toBeCloseTo(0.5, 5);
  });
});

/**
 * The corpus ratchet. `bun run validate` enforces the same rule at content-change
 * time; this keeps it true for anyone who runs only `bun test`, and it is the
 * check that would have caught the drift when B1.4 was authored.
 */
describe('the shipped corpus', () => {
  const roots = ['content/topics', 'content/discovery'];
  const mdxFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? mdxFiles(join(dir, entry.name))
        : entry.name.endsWith('.mdx')
          ? [join(dir, entry.name)]
          : [],
    );

  for (const root of roots) {
    test(`no explanation paragraph in ${root} exceeds ${MAX_PARAGRAPH_WORDS} words`, () => {
      const offenders = mdxFiles(root).flatMap((file) =>
        proseShapeProblems(readFileSync(file, 'utf8')).map((p) => `${file}: ${p}`),
      );
      expect(offenders).toEqual([]);
    });
  }
});
