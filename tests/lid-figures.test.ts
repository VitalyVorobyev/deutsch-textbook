/**
 * Leben-in-Deutschland lesson figures (`figures:` + `<Figure>`, ADR 0021): the pixel-size reader,
 * the schema's provenance rules, and the cross-file rules `bun run validate` runs through
 * `lidLessonProblems` → `lidFigureProblems`.
 *
 * Every case builds its own throwaway root: synthetic image headers written under `public/`, a
 * bank stated in the test, and figures that spell out every field an assertion reads — never the
 * real lessons, images or bank, whose content would then decide whether the rule looks right.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  LID_FIGURE_MAX_BYTES,
  lidFigureSchema,
  lidLessonSchema,
  type LidBank,
  type LidFigure,
} from '@da/schema/lid';
import { imageDimensions } from '@da/content/image-size';
import {
  LID_LESSONS_DIR,
  LID_TOPICS_FILE,
  lidFigureProblems,
  lidLessonBodyProblems,
  lidLessonProblems,
} from '@da/content/lid';
import { repoRoot } from '@da/content/repo-root';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A root holding the given public files, by path under `public/`. */
function rootWith(files: Record<string, Uint8Array>): string {
  const root = mkdtempSync(join(tmpdir(), 'lid-figures-'));
  roots.push(root);
  for (const [path, bytes] of Object.entries(files)) {
    const full = join(root, 'public', path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }
  return root;
}

/** The start of a PNG — signature, IHDR length and type, width, height — padded to `size` bytes. */
function png(width: number, height: number, size = 24): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** A RIFF/WEBP container whose first chunk is `chunk`, with `body` written from byte 20. */
function webp(chunk: string, body: number[]): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  bytes.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  bytes.set(
    [...chunk].map((c) => c.charCodeAt(0)),
    12,
  );
  bytes.set(body, 20);
  return bytes;
}

describe('imageDimensions', () => {
  test('PNG: IHDR width and height', () => {
    expect(imageDimensions(png(794, 672))).toEqual({ width: 794, height: 672 });
  });

  test('JPEG: the first start-of-frame, past an APP0 segment', () => {
    // SOI, APP0 of length 4 (two payload bytes), SOF0: length, precision, height 280, width 421.
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x18, 0x01,
      0xa5, 0, 0, 0,
    ]);
    expect(imageDimensions(jpeg)).toEqual({ width: 421, height: 280 });
  });

  test('WebP: lossy VP8, lossless VP8L and extended VP8X', () => {
    // VP8: frame tag, start code 9d 01 2a, then 900 and 888 as 14-bit little-endian.
    expect(
      imageDimensions(webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x84, 0x03, 0x78, 0x03])),
    ).toEqual({ width: 900, height: 888 });
    // VP8L: signature 0x2f, then (width − 1) | (height − 1) << 14 = 499 | 299 << 14.
    const bits = 499 | (299 << 14);
    expect(
      imageDimensions(
        webp('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, bits >>> 24]),
      ),
    ).toEqual({
      width: 500,
      height: 300,
    });
    // VP8X: four flag bytes, then canvas width − 1 = 899 and height − 1 = 729, 24-bit little-endian.
    expect(
      imageDimensions(webp('VP8X', [0x10, 0, 0, 0, 0x83, 0x03, 0x00, 0xd9, 0x02, 0x00])),
    ).toEqual({ width: 900, height: 730 });
  });

  test('SVG: the root width and height when both are pixel lengths, else the viewBox', () => {
    const svg = (text: string) => imageDimensions(new TextEncoder().encode(text));
    const NS = 'xmlns="http://www.w3.org/2000/svg"';
    expect(svg(`<svg ${NS} width="10" height="12"/>`)).toEqual({ width: 10, height: 12 });
    expect(svg(`<svg ${NS} width='40px' height='30px' viewBox="0 0 4 3">`)).toEqual({
      width: 40,
      height: 30,
    });
    expect(svg(`<svg ${NS} viewBox="0 0 360 420">`)).toEqual({ width: 360, height: 420 });
    expect(svg(`<svg ${NS} viewBox="-5,-5, 200 , 100">`)).toEqual({ width: 200, height: 100 });
    // One length scales the viewBox, as a browser does for <img>; a relative one counts as absent.
    expect(svg(`<svg ${NS} width="720" viewBox="0 0 360 420">`)).toEqual({
      width: 720,
      height: 840,
    });
    expect(svg(`<svg ${NS} height="210" viewBox="0 0 360 420">`)).toEqual({
      width: 180,
      height: 210,
    });
    expect(svg(`<svg ${NS} width="100%" height="100%" viewBox="0 0 360 420">`)).toEqual({
      width: 360,
      height: 420,
    });
    // The root may follow an XML declaration, comments and a doctype — and only those.
    const prologue = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Karte -->\n<!DOCTYPE svg>\n';
    expect(svg(`${prologue}<svg ${NS} viewBox="0 0 8 6">`)).toEqual({ width: 8, height: 6 });
    expect(svg(`<html><svg ${NS} viewBox="0 0 8 6"></svg></html>`)).toBeUndefined();
  });

  test('an SVG without a readable size is undefined', () => {
    const svg = (text: string) => imageDimensions(new TextEncoder().encode(text));
    expect(svg('<svg/>')).toBeUndefined();
    expect(svg('<svg width="10em" height="5em">')).toBeUndefined();
    expect(svg('<svg width="10">')).toBeUndefined();
    expect(svg('<svg viewBox="0 0 0 10">')).toBeUndefined();
    expect(svg('<svg viewBox="0 0 10">')).toBeUndefined();
    expect(svg('<svg viewBox="0 0 ten 10">')).toBeUndefined();
  });

  test('anything else is undefined, never a guess', () => {
    expect(imageDimensions(new TextEncoder().encode('width="10" height="10"'))).toBeUndefined();
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff]))).toBeUndefined();
    expect(imageDimensions(webp('VP8 ', [0, 0, 0, 0, 0, 0]))).toBeUndefined();
  });
});

const caption = { de: 'Die Flagge.', en: 'The flag.', ru: 'Флаг.', uk: 'Прапор.' };
const credit = {
  attribution: 'Jemand',
  license: 'CC BY-SA 3.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
  source_url: 'https://commons.wikimedia.org/wiki/File:Flagge.svg',
};
const REAL: LidFigure = {
  id: 'zz-flagge',
  src: '/lid/lessons/zz-flagge.png',
  width: 5,
  height: 3,
  alt_de: 'Eine Flagge',
  caption,
  sourceClass: 'real',
  ...credit,
};
const OFFICIAL: LidFigure = {
  id: 'zz-karte',
  src: '/lid/ZZ-01.png',
  width: 8,
  height: 6,
  alt_de: 'Eine Karte',
  caption,
  sourceClass: 'official',
};

describe('lidFigureSchema — provenance', () => {
  const issues = (figure: unknown) => {
    const parsed = lidFigureSchema.safeParse(figure);
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  };

  test('the two fixtures are valid', () => {
    expect(issues(REAL)).toEqual([]);
    expect(issues(OFFICIAL)).toEqual([]);
  });

  test('real and adapted require all four credit fields', () => {
    for (const key of ['attribution', 'license', 'license_url', 'source_url'] as const) {
      const { [key]: _dropped, ...rest } = REAL;
      expect(issues(rest).join('\n')).toContain(`missing ${key}`);
      expect(issues({ ...rest, sourceClass: 'adapted' }).join('\n')).toContain(`missing ${key}`);
    }
  });

  test('a simulated figure needs no credit, but lives under /lid/lessons/ like every course figure', () => {
    const { attribution: _a, license: _l, license_url: _u, source_url: _s, ...bare } = REAL;
    expect(issues({ ...bare, sourceClass: 'simulated' })).toEqual([]);
    expect(
      issues({ ...bare, sourceClass: 'simulated', src: '/lid/lessons/zz-schaubild.svg' }),
    ).toEqual([]);
    expect(
      issues({ ...bare, sourceClass: 'simulated', src: '/lid/lessons/zz-schaubild.gif' }).length,
    ).toBeGreaterThan(0);
    expect(issues({ ...REAL, src: '/lid/zz-flagge.png' }).join('\n')).toContain(
      'a course figure lives under /lid/lessons/',
    );
  });

  test('an official figure is a bank path and carries no credit of its own', () => {
    expect(issues({ ...OFFICIAL, src: '/lid/lessons/zz-karte.png' }).join('\n')).toContain(
      'an official figure is a bank picture',
    );
    expect(issues({ ...OFFICIAL, attribution: 'BAMF' }).join('\n')).toContain(
      'an official figure is credited as the catalogue — drop attribution',
    );
  });

  test('every caption carries all four languages; licence and source links are https', () => {
    expect(
      issues({ ...REAL, caption: { de: 'Die Flagge.', en: 'The flag.', ru: 'Флаг.' } }).length,
    ).toBeGreaterThan(0);
    expect(
      issues({ ...REAL, source_url: 'http://commons.wikimedia.org/wiki/File:Flagge.svg' }).length,
    ).toBeGreaterThan(0);
  });

  test('a figure id is listed once per lesson', () => {
    const lesson = {
      title_de: 'T',
      order: 1,
      topics: ['staatssymbole'],
      summary_de: 'S',
      sources: [{ title: 'Q', url: 'https://example.org/' }],
      terms: [{ de: 'die Flagge', en: 'flag', ru: 'флаг' }],
      figures: [REAL, REAL],
    };
    const parsed = lidLessonSchema.safeParse(lesson);
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.message)).toContain(
      'figure "zz-flagge" is listed twice',
    );
    expect(lidLessonSchema.parse({ ...lesson, figures: undefined }).figures).toEqual([]);
  });
});

/** A bank with one picture that ships and one press photo that does not — only what the rules read. */
const BANK = {
  questions: [
    {
      id: 'ZZ-01',
      images: [{ path: '/lid/ZZ-01.png', sha256: '0'.repeat(64), width: 8, height: 6 }],
    },
    {
      id: 'ZZ-02',
      images: [
        {
          path: '/lid/ZZ-02.jpeg',
          sha256: '0'.repeat(64),
          width: 8,
          height: 6,
          withheld: '© Jemand',
        },
      ],
    },
  ],
} as unknown as LidBank;

const FILES = { 'lid/lessons/zz-flagge.png': png(5, 3), 'lid/ZZ-01.png': png(8, 6) };
const BODY = 'Text.\n\n<Figure id="zz-flagge" />\n\nText.\n\n<Figure id="zz-karte" />\n';
const lesson = (over: { file?: string; body?: string; figures?: LidFigure[] } = {}) => ({
  file: 'content/lid/lessons/zz.mdx',
  body: BODY,
  figures: [REAL, OFFICIAL],
  ...over,
});

describe('lidFigureProblems — the cross-file rules', () => {
  /** `bank: null` is "no bank imported" — a default parameter would swallow `undefined`. */
  const problems = (
    lessons = [lesson()],
    files: Record<string, Uint8Array> = FILES,
    bank: LidBank | null = BANK,
  ) => lidFigureProblems(rootWith(files), lessons, bank ?? undefined);

  test('a lesson whose figures are all shown, present, sized and credited is valid', () => {
    expect(problems()).toEqual([]);
  });

  test('a <Figure> names a figure of its own lesson', () => {
    expect(problems([lesson({ body: `${BODY}<Figure id="zz-fahne" />\n` })])).toEqual([
      'content/lid/lessons/zz.mdx: <Figure> "zz-fahne" is not one of this lesson\'s figures',
    ]);
    const other = lesson({
      file: 'content/lid/lessons/yy.mdx',
      body: '<Figure id="yy-bild" />',
      figures: [{ ...REAL, id: 'yy-bild' }],
    });
    expect(problems([lesson({ body: `${BODY}<Figure id="yy-bild" />\n` }), other])).toEqual([
      'content/lid/lessons/zz.mdx: <Figure> "yy-bild" is not one of this lesson\'s figures (it is declared in content/lid/lessons/yy.mdx)',
    ]);
  });

  test('every declared figure is shown — a tag inside an MDX comment does not count', () => {
    const hidden = 'Text.\n\n<Figure id="zz-flagge" />\n\n{/* <Figure id="zz-karte" /> */}\n';
    expect(problems([lesson({ body: hidden })])).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-karte" is declared but no <Figure> shows it',
    ]);
  });

  test('figure ids are unique across lessons', () => {
    const other = lesson({
      file: 'content/lid/lessons/yy.mdx',
      body: '<Figure id="zz-flagge" />',
      figures: [REAL],
    });
    expect(problems([lesson(), other])).toEqual([
      'content/lid/lessons/yy.mdx: figure "zz-flagge" is already declared in content/lid/lessons/zz.mdx — figure ids are unique across lessons',
    ]);
  });

  test('the file exists under public/', () => {
    expect(problems([lesson()], { 'lid/ZZ-01.png': png(8, 6) })).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-flagge": /lid/lessons/zz-flagge.png does not exist under public/',
    ]);
  });

  test("the declared size is the file's, and the header must be readable", () => {
    expect(problems([lesson()], { ...FILES, 'lid/lessons/zz-flagge.png': png(6, 3) })).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-flagge": /lid/lessons/zz-flagge.png is 6×3, the figure says 5×3',
    ]);
    expect(
      problems([lesson()], {
        ...FILES,
        'lid/lessons/zz-flagge.png': new TextEncoder().encode('<svg/>'),
      }),
    ).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-flagge": /lid/lessons/zz-flagge.png has no PNG, JPEG, WebP or SVG header to read its size from',
    ]);
  });

  describe('an SVG figure', () => {
    const SKETCH: LidFigure = {
      id: 'zz-schaubild',
      src: '/lid/lessons/zz-schaubild.svg',
      width: 360,
      height: 420,
      alt_de: 'Ein Schaubild',
      caption,
      sourceClass: 'simulated',
    };
    const svgBody = 'Text.\n\n<Figure id="zz-schaubild" />\n';
    /** A clean drawing: a marker referenced inside the file, with `extra` added to its body. */
    const drawing = (extra = '', root = 'viewBox="0 0 360 420"') =>
      new TextEncoder().encode(
        `<svg xmlns="http://www.w3.org/2000/svg" ${root}><defs><marker id="m"><path d="M0 0L10 5z"/></marker></defs>` +
          `<line x1="0" y1="0" x2="9" y2="9" marker-end="url(#m)"/><use href="#m"/>${extra}</svg>`,
      );
    const check = (bytes: Uint8Array, figure: LidFigure = SKETCH) =>
      problems([lesson({ body: svgBody, figures: [figure] })], {
        'lid/lessons/zz-schaubild.svg': bytes,
      });
    const hazard = (what: string) =>
      `content/lid/lessons/zz.mdx: figure "zz-schaubild": /lid/lessons/zz-schaubild.svg carries ${what} — an SVG figure also opens on its own, so it holds no script and no external reference`;

    test('is sized by its viewBox, and references inside the file are fine', () => {
      expect(check(drawing())).toEqual([]);
      expect(check(drawing('', 'width="720" height="840" viewBox="0 0 360 420"'))).toEqual([
        'content/lid/lessons/zz.mdx: figure "zz-schaubild": /lid/lessons/zz-schaubild.svg is 720×840, the figure says 360×420',
      ]);
    });

    test('carries no script, handler, embedded HTML or reference outside the file', () => {
      expect(check(drawing('<script>alert(1)</script>'))).toEqual([hazard('<script>')]);
      expect(check(drawing('<rect onclick="x()"/>'))).toEqual([hazard('an event handler (on…=)')]);
      expect(check(drawing('<a href="javascript:void(0)"><text>x</text></a>'))).toEqual([
        hazard('a javascript: URL'),
        hazard('an href outside the file'),
      ]);
      expect(check(drawing('<foreignObject><div>x</div></foreignObject>'))).toEqual([
        hazard('<foreignObject>'),
      ]);
      expect(check(drawing('<image xlink:href="https://example.org/x.png"/>'))).toEqual([
        hazard('an href outside the file'),
      ]);
      expect(check(drawing('<rect style="fill:url(https://example.org/p.svg#a)"/>'))).toEqual([
        hazard('a url() outside the file'),
      ]);
      expect(check(drawing('<style>@import "x.css";</style>'))).toEqual([hazard('an @import')]);
    });

    test('a raster figure is not read as SVG text', () => {
      expect(
        problems([lesson()], { ...FILES, 'lid/lessons/zz-flagge.png': png(5, 3, 64) }),
      ).toEqual([]);
    });
  });

  test(`a file over ${LID_FIGURE_MAX_BYTES / 1000} KB is refused; one at the ceiling is not`, () => {
    expect(
      problems([lesson()], {
        ...FILES,
        'lid/lessons/zz-flagge.png': png(5, 3, LID_FIGURE_MAX_BYTES),
      }),
    ).toEqual([]);
    expect(
      problems([lesson()], {
        ...FILES,
        'lid/lessons/zz-flagge.png': png(5, 3, LID_FIGURE_MAX_BYTES + 1),
      }),
    ).toEqual([
      `content/lid/lessons/zz.mdx: figure "zz-flagge": /lid/lessons/zz-flagge.png is ${LID_FIGURE_MAX_BYTES + 1} bytes, over the ${LID_FIGURE_MAX_BYTES}-byte ceiling`,
    ]);
  });

  test('an official figure is a picture of the bank, never a withheld one', () => {
    const notInBank = { ...OFFICIAL, src: '/lid/ZZ-03.png' };
    expect(
      problems([lesson({ figures: [REAL, notInBank] })], { ...FILES, 'lid/ZZ-03.png': png(8, 6) }),
    ).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-karte": /lid/ZZ-03.png is not a picture of the official bank',
    ]);
    const withheld = { ...OFFICIAL, src: '/lid/ZZ-02.jpeg' };
    expect(
      problems([lesson({ figures: [REAL, withheld] })], { ...FILES, 'lid/ZZ-02.jpeg': png(8, 6) }),
    ).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-karte": /lid/ZZ-02.jpeg is withheld (© Jemand) — a withheld photo never ships',
    ]);
    expect(problems([lesson()], FILES, null)).toEqual([
      'content/lid/lessons/zz.mdx: figure "zz-karte" is official, but there is no data/lid/bank.yaml to find it in',
    ]);
  });

  test('a tag is <Figure id="…" /> for one figure or <Figure ids="… …" /> for a row of two or three', () => {
    const at = (tag: string) => problems([lesson({ body: `${BODY}${tag}\n` })]);
    expect(at('<Figure ids="zz-flagge zz-karte" />')).toEqual([]);
    expect(at('<Figure src="zz-flagge" />')).toEqual([
      'content/lid/lessons/zz.mdx: <Figure src="zz-flagge" /> is not <Figure id="…" /> or <Figure ids="… …" />',
    ]);
    expect(at('<Figure id="zz-flagge zz-karte" />')).toEqual([
      'content/lid/lessons/zz.mdx: <Figure id="zz-flagge zz-karte" />: id names one figure — a row is ids="… …"',
    ]);
    expect(at('<Figure ids="zz-flagge" />')).toEqual([
      'content/lid/lessons/zz.mdx: <Figure ids="zz-flagge" />: a row holds two or three figures',
    ]);
    expect(at('<Figure ids="zz-flagge zz-karte zz-flagge zz-karte" />')).toEqual([
      'content/lid/lessons/zz.mdx: <Figure ids="zz-flagge zz-karte zz-flagge zz-karte" />: a row holds two or three figures',
    ]);
  });
});

const FIXTURE = readFileSync(
  join(import.meta.dir, 'fixtures', 'lid-lessons', 'zz-fixture.mdx'),
  'utf8',
);

/** The fixture with `from` replaced by `to` — and a loud failure if `from` is not in it. */
function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`fixture has no ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

describe('a figure in the lesson body', () => {
  const body = FIXTURE.slice(FIXTURE.indexOf('## Kurz gesagt'));

  test('it is not German text: a heading with only a figure and a subsection needs no <Translation>', () => {
    const bare = edit(
      edit(
        body,
        'Die Bundesflagge ist schwarz-rot-gold. So steht es im Grundgesetz.\n\n',
        '<Figure id="zz-flagge" />\n\n',
      ),
      body.match(/<Translation>[\s\S]*?<\/Translation>/)![0],
      '',
    );
    expect(lidLessonBodyProblems(bare)).toEqual([]);
  });

  test("it stands with the German it illustrates, before the section's <Translation>", () => {
    const after = edit(
      body,
      '</Translation>\n\n### Die Hauptstadt',
      '</Translation>\n\n<Figure id="zz-flagge" />\n\n### Die Hauptstadt',
    );
    expect(lidLessonBodyProblems(after)).toEqual([
      '"## Die Flagge": the <Translation> comes last, after the German it translates',
    ]);
  });
});

describe('wired into lidLessonProblems', () => {
  // The fixture carries no Ukrainian; a figure caption does, so the lesson must carry it everywhere.
  const withUk = edit(
    edit(
      edit(FIXTURE, 'ru: федеральный флаг }', 'ru: федеральный флаг, uk: федеральний прапор }'),
      'ru: столица }',
      'ru: столица, uk: столиця }',
    ),
    '</Ru>\n',
    '</Ru>\n<Uk>\nТестовий урок для перевірки механізму уроків, а не навчальний матеріал.\n</Uk>\n',
  ).replaceAll('</Ru>\n</Translation>', '</Ru>\n<Uk>\nПереклад.\n</Uk>\n</Translation>');
  const figures = [
    'figures:',
    '  - id: zz-flagge',
    '    src: /lid/lessons/zz-flagge.png',
    '    width: 5',
    '    height: 3',
    '    alt_de: Eine Flagge',
    '    caption: { de: Die Flagge., en: The flag., ru: Флаг., uk: Прапор. }',
    '    sourceClass: real',
    '    attribution: Jemand',
    '    license: CC BY-SA 3.0',
    '    license_url: https://creativecommons.org/licenses/by-sa/3.0/',
    '    source_url: https://commons.wikimedia.org/wiki/File:Flagge.svg',
    '---',
  ].join('\n');
  const lessonText = edit(
    edit(
      withUk,
      '  - { de: die Hauptstadt, en: capital, ru: столица, uk: столиця }\n---',
      `  - { de: die Hauptstadt, en: capital, ru: столица, uk: столиця }\n${figures}`,
    ),
    'So steht es im Grundgesetz.\n',
    'So steht es im Grundgesetz.\n\n<Figure id="zz-flagge" />\n',
  );

  function lessonRoot(text: string): string {
    const root = rootWith({ 'lid/lessons/zz-flagge.png': png(5, 3) });
    mkdirSync(join(root, LID_LESSONS_DIR), { recursive: true });
    cpSync(join(repoRoot(), LID_TOPICS_FILE), join(root, LID_TOPICS_FILE));
    writeFileSync(join(root, LID_LESSONS_DIR, 'zz-fixture.mdx'), text);
    return root;
  }

  test('a lesson with a shown, present figure passes; the same lesson without its <Figure> does not', () => {
    expect(lidLessonProblems(lessonRoot(lessonText))).toEqual([]);
    expect(
      lidLessonProblems(lessonRoot(edit(lessonText, '\n<Figure id="zz-flagge" />\n', ''))),
    ).toEqual([
      `${LID_LESSONS_DIR}/zz-fixture.mdx: figure "zz-flagge" is declared but no <Figure> shows it`,
    ]);
  });
});
