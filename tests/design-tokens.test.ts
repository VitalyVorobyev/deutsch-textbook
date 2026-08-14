/**
 * The editorial app and the learner app are one visual family, and this is the only thing that
 * says so twice.
 *
 * `packages/ui/src/tokens.css` was written to promote the learner app's palette from convention to
 * declaration — `stone` surfaces, `amber` brand, `emerald` success, `sky` links — and its own
 * comment claims "the palette does not change". It changed. The first version set the dark page to
 * `stone-950` against `src/styles/global.css`'s `dark:bg-stone-900` body, raised surfaces to
 * `stone-900` against the app's `dark:bg-stone-800` cards, and borders to `stone-800` against
 * `dark:border-stone-700`: a full step darker throughout, with card borders one step from
 * invisible. Nothing caught it, because a colour that is merely *wrong* renders perfectly.
 *
 * So the two files are held equal here. This is a small test guarding a claim the repo makes in
 * prose (CLAUDE.md, the tokens header) and could not otherwise keep — the same reason
 * `tests/focus-tags.test.ts` holds a doc table and an allowlist equal in both directions.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not pin every token, because most of them have no
 * counterpart to drift from: the learner app has no `--color-ink-muted`, it has `text-stone-500`
 * typed out in ninety places. Only the surfaces and rules that both files independently name are
 * checked, and each assertion cites the learner-app declaration it is anchored to.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '@da/content/repo-root';

const root = repoRoot();
const tokens = readFileSync(join(root, 'packages/ui/src/tokens.css'), 'utf8');
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

describe('design tokens stay in the learner app’s family', () => {
  test('the dark page background is the app’s body colour, not a darker one', () => {
    // src/styles/global.css: body { @apply bg-stone-50 … dark:bg-stone-900 … }
    expect(global).toContain('dark:bg-stone-900');
    expect(darkToken('surface')).toBe('stone-900');
  });

  test('the light page background is the app’s body colour', () => {
    expect(global).toContain('bg-stone-50');
    expect(lightToken('surface')).toBe('stone-50');
  });

  test('a raised surface is a card, and a card in this product is stone-800 in the dark', () => {
    // The learner app types this literally in CurriculumPath.tsx, ProgressPanel.tsx and
    // pruefung/shared.tsx: `rounded-lg border border-stone-200 bg-white dark:border-stone-700
    // dark:bg-stone-800`. Both halves of that pair are pinned, because they were both wrong.
    expect(darkToken('surface-raised')).toBe('stone-800');
    expect(darkToken('border-subtle')).toBe('stone-700');
    expect(lightToken('surface-raised')).toBe('white');
    expect(lightToken('border-subtle')).toBe('stone-200');
  });

  test('a recessed surface moves away from the page, in both themes', () => {
    // Light: stone-50 page, stone-100 well. Dark has to mirror the direction, or a row hover and a
    // card end up the same colour — which is what happened when sunken was set to stone-900 beside
    // a stone-900 page.
    expect(lightToken('surface-sunken')).toBe('stone-100');
    expect(darkToken('surface-sunken')).toBe('stone-950');
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
   * Measured on the palette as it shipped: **seven of the eight role/theme text combinations were
   * under 4.5:1** — rose-600 on the dark page read 3.72, amber-600 on the light page 3.05. Nothing
   * caught it, because a colour that is merely unreadable renders perfectly and the author who
   * picked it can see it fine on their own monitor.
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
    'stone-50': '#fafaf9', 'stone-100': '#f5f5f4', 'stone-700': '#44403c',
    'stone-800': '#292524', 'stone-900': '#1c1917', 'stone-950': '#0c0a09',
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
        ['light', lightToken(`${role}-ink`), ['stone-50', 'white']],
        ['dark', darkToken(`${role}-ink`), ['stone-900', 'stone-800']],
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
        ['light', lightToken(role), 'stone-50'],
        ['dark', darkToken(role) ?? lightToken(role), 'stone-900'],
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
