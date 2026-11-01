/**
 * Deutsch-Atlas's theme layer on `@vitavision/ui` (ADR 0011), and the things about it that are
 * silent when broken.
 *
 * THE PACKAGE HAS TO ASK TO BE SCANNED. Tailwind v4 detects sources from the Vite root, which for
 * Redaktion is `apps/redaktion`, so a class written only in `packages/ui/src` is never generated:
 * the component renders, the class is in the DOM, and it computes to nothing. Measured once in the
 * browser: `Panel`'s `p-5` computed to padding 0 px. This file fails if a `.tsx` in the package
 * falls outside the globs.
 *
 * THE LAYER DEFINES NO COLOUR NAMES. Redaktion's old vocabulary collided with the system's
 * (`surface` was the page here and is a panel there; `warn` was failure red here and is caution
 * amber there), so an alias layer redefining them would repaint the system's own components.
 * Colour values and their contrast are the system's, tested upstream; a Deutsch-Atlas retune
 * overrides the system's variables, as Tonwerk's theme does, never Tailwind colour names.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { repoRoot } from '@da/content/repo-root';

const root = repoRoot();
const tokensPath = join(root, 'packages/ui/src/tokens.css');
const tokens = readFileSync(tokensPath, 'utf8');

const walk = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full, ext) : ext.test(entry) ? [full] : [];
  });

describe('the shared package reaches Tailwind’s scanner', () => {
  /**
   * The whole defect in one assertion. Without a matching `@source`, a class that exists only in
   * this package is dropped from the stylesheet with no error anywhere — not at build, not at
   * type-check, not in the console.
   */
  test('every .tsx in packages/ui/src is covered by an @source glob in tokens.css', () => {
    const globs = [...tokens.matchAll(/@source\s+'([^']+)'/g)].map((m) =>
      resolve(join(root, 'packages/ui/src'), m[1]!),
    );
    expect(
      globs.length,
      'tokens.css declares no @source — the package will not be scanned',
    ).toBeGreaterThan(0);

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

    const uncovered = sources.filter(
      (file) => !globs.some((glob) => !relative(glob, file).startsWith('..')),
    );
    expect(uncovered.map((f) => relative(root, f))).toEqual([]);
  });
});

describe('the theme layer', () => {
  test('defines no Tailwind colour names and imports no second Tailwind', () => {
    expect(tokens).not.toMatch(/--color-[a-z-]+\s*:/);
    expect(tokens).not.toMatch(/@theme\b/);
    expect(tokens).not.toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  test('comes after the system in the app stylesheet, so a retune would win', () => {
    const entry = readFileSync(join(root, 'apps/redaktion/src/styles.css'), 'utf8');
    const order = [
      "'tailwindcss'",
      "'@vitavision/ui/styles.css'",
      "'@vitavision/workbench/styles.css'",
      "'@da/ui/tokens.css'",
    ].map((name) => entry.indexOf(`@import ${name}`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  test('no Redaktion or renderer source uses a retired colour name', () => {
    const retired =
      /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|outline|divide|fill|stroke)-(?:ink|ink-muted|surface-raised|surface-sunken|border-subtle|border-strong|brand|brand-ink|brand-soft|ok|ok-ink|ok-soft|info|info-ink|info-soft|warn-ink|warn-soft)(?![\w-])|var\(--color-(?:ink|surface-raised|surface-sunken|border-subtle|brand|ok|info|warn-ink)\b/;
    const files = [
      ...walk(join(root, 'apps/redaktion/src'), /\.(tsx?|css)$/),
      ...walk(join(root, 'packages/renderers/src'), /\.(tsx?|css)$/),
      ...walk(join(root, 'packages/ui/src'), /\.(tsx?|css)$/),
    ];
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => [line, i] as const)
        .filter(([line]) => retired.test(line))
        .map(([, i]) => `${relative(root, file)}:${i + 1}`),
    );
    expect(hits).toEqual([]);
  });
});
