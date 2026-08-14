/**
 * The design tokens, and the two things about them that are silent when broken.
 *
 * THE FIRST IS THAT THE PACKAGE HAS TO ASK TO BE SCANNED. Tailwind v4 detects sources from the Vite
 * root, which for the editorial app is `apps/redaktion` — so every class written in
 * `packages/ui/src` was simply never generated, and the failure is invisible three times over: the
 * component renders, the class is right there in the DOM, and any class the package happens to
 * share with an app file works fine. Measured in the browser on the build the author called ugly:
 * `Panel`'s `p-5` computed to **padding: 0px**, `Callout`'s `border-l-4` to **border-left-width:
 * 0px**, `StatGroup`'s `sm:grid-cols-2` to a single 382 px column. "Cards with zero padding" was a
 * literal description. One `@source` line fixed all of it at once, and this file fails if a `.tsx`
 * in the package ever falls outside those globs again.
 *
 * THE SECOND IS CONTRAST. Seven of the eight role/theme text combinations shipped under the 4.5:1
 * floor, because a colour that is merely unreadable renders perfectly and the author who picked it
 * can see it on their own monitor. That is why each role is two tokens — a fill held to 3:1 and an
 * `-ink` held to 4.5:1 — and why the ratios are asserted here rather than asserted in a comment.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It no longer holds the editorial ramp equal to the learner
 * app's. That equality was a real guard against accidental drift, and it was traded for a
 * deliberate divergence: slate instead of stone, so the four role hues read as signal on a dense
 * dark page and the two applications are told apart on sight. What is still pinned to the product
 * is the part that carries meaning — which hue means what — plus the step structure the ramp has to
 * have, and the floors, which are what the equality test was really protecting.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { repoRoot } from '@da/content/repo-root';

const root = repoRoot();
const tokensPath = join(root, 'packages/ui/src/tokens.css');
const tokens = readFileSync(tokensPath, 'utf8');
const global = readFileSync(join(root, 'src/styles/global.css'), 'utf8');

/**
 * Split on the RULE, not on the attribute selector: `@custom-variant dark (&:where([data-theme=
 * 'dark'], …))` is declared above the override block and contains the same substring twice, so a
 * naive split hands back the two characters between those two occurrences. Every dark lookup then
 * returns `undefined` — which this test caught on its first run by failing rather than by quietly
 * comparing nothing.
 */
const DARK_RULE = ":root[data-theme='dark']";
const darkBlock = tokens.slice(tokens.indexOf(DARK_RULE));
const lightBlock = tokens.slice(0, tokens.indexOf(DARK_RULE));

const value = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`--color-${name}:\\s*var\\(--color-([a-z0-9-]+)\\)`))?.[1];

/** The value of `--color-<name>` inside the dark override block. */
const darkToken = (name: string): string | undefined => value(darkBlock, name);

/** The value of `--color-<name>` in `@theme` — the light palette. */
const lightToken = (name: string): string | undefined => value(lightBlock, name);

describe('the shared package reaches Tailwind’s scanner', () => {
  /**
   * The whole defect in one assertion. Without a matching `@source`, a class that exists only in
   * this package is dropped from the stylesheet with no error anywhere — not at build, not at
   * type-check, not in the console.
   */
  test('every .tsx in packages/ui/src is covered by an @source glob in tokens.css', () => {
    const globs = [...tokens.matchAll(/@source\s+'([^']+)'/g)].map((m) => resolve(join(root, 'packages/ui/src'), m[1]!));
    expect(globs.length, 'tokens.css declares no @source — the package will not be scanned').toBeGreaterThan(0);

    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.tsx')) sources.push(full);
      }
    };
    walk(join(root, 'packages/ui/src'));
    expect(sources.length, 'no .tsx found — this test would pass vacuously').toBeGreaterThan(0);

    const uncovered = sources.filter((file) => !globs.some((glob) => !relative(glob, file).startsWith('..')));
    expect(uncovered.map((f) => relative(root, f))).toEqual([]);
  });
});

describe('design tokens', () => {
  test('the ramp is slate — a deliberate divergence from the learner app’s stone', () => {
    // The learner app stays warm; changing either side is a product decision, not a tidy-up. The
    // assertion exists so that switching them back is a conscious edit with a reason attached.
    expect(global).toContain('dark:bg-stone-900');
    expect(darkToken('surface')).toBe('slate-900');
    expect(lightToken('surface')).toBe('slate-50');
  });

  test('a card sits one step above the page and its border one step above that', () => {
    // The learner app types this literally in CurriculumPath.tsx, ProgressPanel.tsx and
    // pruefung/shared.tsx: `rounded-lg border border-stone-200 bg-white dark:border-stone-700
    // dark:bg-stone-800`. The hues diverge now; the STEPS may not, or a card stops being a card.
    expect(darkToken('surface-raised')).toBe('slate-800');
    expect(darkToken('border-subtle')).toBe('slate-700');
    expect(lightToken('surface-raised')).toBe('white');
    expect(lightToken('border-subtle')).toBe('slate-200');
  });

  test('a recessed surface moves away from the page, in both themes', () => {
    // Light: slate-50 page, slate-100 well. Dark has to mirror the direction, or a row hover and a
    // card end up the same colour — which is what happened when sunken was set to the page colour.
    expect(lightToken('surface-sunken')).toBe('slate-100');
    expect(darkToken('surface-sunken')).toBe('slate-950');
    expect(darkToken('surface-sunken')).not.toBe(darkToken('surface'));
    expect(darkToken('surface-sunken')).not.toBe(darkToken('surface-raised'));
  });

  test('the four palette roles are the ones the learner app agreed on by repetition', () => {
    // amber = brand and active, emerald = success and mastery, sky = links and anything read,
    // rose = failure. Changing one of these is changing the product, not the editorial tool.
    expect(lightToken('brand')).toMatch(/^amber-/);
    expect(lightToken('ok')).toMatch(/^emerald-/);
    expect(lightToken('info')).toMatch(/^sky-/);
    expect(lightToken('warn')).toMatch(/^rose-/);
  });

  /**
   * The contrast floor, which is the reason each role is two tokens.
   *
   * WCAG 2.2: 4.5:1 for text under 18.66 px, 3:1 for a graphic that carries meaning. The `-ink`
   * half is held to the first, the fill half to the second. If a future palette change drops a pair
   * below its floor, this goes red with the measured number in the failure.
   */
  const HEX: Record<string, string> = {
    'amber-300': '#fcd34d', 'amber-600': '#d97706', 'amber-700': '#b45309',
    'emerald-400': '#34d399', 'emerald-600': '#059669', 'emerald-700': '#047857',
    'sky-400': '#38bdf8', 'sky-600': '#0284c7', 'sky-700': '#0369a1',
    'rose-400': '#fb7185', 'rose-600': '#e11d48', 'rose-700': '#be123c',
    'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-700': '#334155',
    'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
    white: '#ffffff',
  };
  const channel = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string): number => {
    const [x, y] = [luminance(HEX[a]!), luminance(HEX[b]!)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const ROLES = ['brand', 'ok', 'info', 'warn'] as const;

  test('every -ink role reads at 4.5:1 on both surfaces it can sit on, in both themes', () => {
    const failures: string[] = [];
    for (const role of ROLES) {
      for (const [theme, token, grounds] of [
        ['light', lightToken(`${role}-ink`), ['slate-50', 'white']],
        ['dark', darkToken(`${role}-ink`), ['slate-900', 'slate-800']],
      ] as const) {
        expect(token, `${theme} --color-${role}-ink is not declared`).toBeDefined();
        for (const ground of grounds) {
          const ratio = contrast(token!, ground);
          if (ratio < 4.5) failures.push(`${theme} ${role}-ink (${token}) on ${ground}: ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test('every fill role reads at 3:1 as a graphic, in both themes', () => {
    // A bar, a dot or a rule is not text, so it is held to the graphic floor — which is exactly why
    // collapsing fill and text into one token forced a choice that failed one of them.
    const failures: string[] = [];
    for (const role of ROLES) {
      for (const [theme, token, ground] of [
        ['light', lightToken(role), 'slate-50'],
        ['dark', darkToken(role) ?? lightToken(role), 'slate-900'],
      ] as const) {
        const ratio = contrast(token!, ground);
        if (ratio < 3) failures.push(`${theme} ${role} fill (${token}) on ${ground}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('dark mode is a data-theme attribute in both files, so neither can flash', () => {
    // The learner app sets it pre-paint from an inline script in Base.astro; a media query in the
    // editorial app would disagree with it on the first frame.
    expect(global).toContain('@custom-variant dark (&:where([data-theme="dark"]');
    expect(tokens).toContain("@custom-variant dark (&:where([data-theme='dark']");
  });
});
