/**
 * Tonwerk's theme against the bar the `@vitavision/ui` tokens are held to: text at least 4.5:1 on
 * every surface, the accent at least 3:1 as a focus ring and a checked fill, and the accent kept
 * apart from every verdict colour for a reader with any dichromacy.
 *
 * The system checks its own values. Tonwerk overrides three of them, so the system's test no
 * longer covers the colours on screen — this one does. Both stylesheets are read from disk: the
 * surfaces from the installed package, so an upgrade that moves a grey is checked here too.
 *
 * The maths is the system's own (WCAG 2.2 relative luminance; Machado, Oliveira & Fernandes 2009
 * at full severity; OKLab distance), restated because the package that exports it brings a test
 * toolchain this app does not use.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The spec runs under happy-dom, whose `import.meta.url` is not a file URL; vitest runs from the
// package directory.
const require = createRequire(join(process.cwd(), 'package.json'));
const system = readFileSync(require.resolve('@vitavision/ui/styles.css'), 'utf8');
const tonwerk = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');

/** The `--name: #hex;` declarations of one rule block, and `var(--other)` aliases resolved. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no "${selector} {" block`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]),
  );
}

const declared = { ...block(system, '.dark'), ...block(tonwerk, 'html.dark') };
function hex(name: string): string {
  const value = declared[name];
  if (!value) throw new Error(`token --${name} not found`);
  const alias = /^var\(--([\w-]+)\)$/.exec(value);
  return alias ? hex(alias[1]!) : value;
}

const channels = (h: string): number[] =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(h: string): number {
  const [r, g, b] = channels(h).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function composite(fg: string, alpha: number, bg: string): string {
  const [a, b] = [channels(fg), channels(bg)];
  return `#${a
    .map((c, i) =>
      Math.round((c * alpha + b[i]! * (1 - alpha)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const SIMULATIONS: Record<string, number[][]> = {
  none: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function oklab([r, g, b]: number[]): number[] {
  const cbrt = (x: number): number => Math.sign(x) * Math.abs(x) ** (1 / 3);
  const l = cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The smallest OKLab distance × 100 over typical vision and every simulated dichromacy. */
function worstDeltaE(a: string, b: string): number {
  return Math.min(
    ...Object.values(SIMULATIONS).map((matrix) => {
      const seen = (h: string): number[] => {
        const rgb = channels(h).map(linear);
        return oklab(
          matrix.map((row) =>
            Math.min(1, Math.max(0, row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!)),
          ),
        );
      };
      const [p, q] = [seen(a), seen(b)];
      return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!) * 100;
    }),
  );
}

const SURFACES = ['ground', 'surface', 'raised', 'overlay'];
const TONES = ['signal', 'normal', 'defect', 'warn'];

describe('Tonwerk theme: contrast on the system surfaces', () => {
  const pairs: [string, string, string, number][] = [];
  for (const surface of SURFACES) {
    for (const tone of TONES) pairs.push([`${tone} text on ${surface}`, tone, surface, 4.5]);
    pairs.push([`signal (focus, checked) on ${surface}`, 'signal', surface, 3]);
  }
  it.each(pairs)('%s', (_what, fg, bg, min) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(min);
  });

  it.each(['signal', 'signal-strong'])('signal-fg on %s (the primary button)', (fill) => {
    expect(contrast(hex('signal-fg'), hex(fill))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES.flatMap((tone) => ['surface', 'ground'].map((s) => [tone, s])))(
    '%s text on its own /12 tint over %s (badges, callouts)',
    (tone, surface) => {
      const tint = composite(hex(tone), 0.12, hex(surface));
      expect(contrast(hex(tone), tint)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('Tonwerk theme: colour vision', () => {
  // The system's dark-theme floor. A person's brass and the machine's verdicts must stay two
  // colours for every reader, or the one distinction the palette exists to draw is lost.
  it.each(['normal', 'defect', 'warn'])(
    'signal stays apart from %s under every dichromacy',
    (verdict) => {
      expect(worstDeltaE(hex('signal'), hex(verdict))).toBeGreaterThanOrEqual(9.3);
    },
  );

  it('the machine’s pass and the alarm stay apart', () => {
    expect(worstDeltaE(hex('normal'), hex('defect'))).toBeGreaterThanOrEqual(9.3);
  });
});
