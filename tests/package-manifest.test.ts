/**
 * Properties of the package manifests that only npm enforces — in a repo that never runs npm.
 *
 * This exists because the defect it catches took production down for seven commits while every
 * gate stayed green. npm refuses an `overrides` entry aimed at a package the root also depends
 * on directly unless the two specs match **character for character**; Bun does not enforce that
 * rule at all. So on 2026-08-26 #233 bumped `dependencies.sharp` to `^0.35.4`, left
 * `overrides.sharp` at `^0.35.0`, and `bun install`, `bun run validate`, `bun test`,
 * `bun run check`, `bun run lint`, `bun run build` and CI all passed — while every Cloudflare
 * deploy died before wrangler started:
 *
 *     Executing user deploy command: npx wrangler deploy
 *     npm error code EOVERRIDE
 *     npm error Override for sharp@^0.35.4 conflicts with direct dependency
 *
 * The deploy step was the one npm invocation in an otherwise all-Bun pipeline (it is a Workers
 * Builds dashboard setting, so it is not in this repo and cannot be grepped for). It has since
 * been moved to `bunx wrangler deploy`, which would hide this class rather than fix it — hence
 * this test. The manifest is wrong independently of who runs the deploy, and a contributor,
 * a tool or a different host may still reach for npm.
 *
 * Note that `npm install` on this repo fails anyway, on `workspace:*` — npm does not speak that
 * protocol. `npx` does not resolve workspace deps, so it gets past that and only ever tripped on
 * the overrides rule. Do not "verify" this file with `npm install`; use `npx wrangler --version`.
 */
import { expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

test('no overrides entry contradicts the direct dependency it shadows', () => {
  const files = execSync('git ls-files -co --exclude-standard "*package.json"', {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    // A vendored fixture or a stale worktree is not this repo's manifest.
    .filter((f) => !f.includes('node_modules/') && !f.includes('.claude/worktrees/'));

  // Sanity check on the listing itself — a silently empty file list would make this test pass
  // by measuring nothing, which is the same failure mode it exists to catch.
  expect(files.length).toBeGreaterThan(5);
  expect(files).toContain('package.json');

  const conflicts: string[] = [];

  for (const file of files) {
    let pkg: Manifest;
    try {
      pkg = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
    } catch {
      continue; // malformed JSON is the type-check's finding, not this test's
    }

    for (const [name, override] of Object.entries(pkg.overrides ?? {})) {
      const direct = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
      // An override on a package that is NOT a direct dependency is the normal case — a
      // security floor for a transitive copy — and npm accepts any spec there.
      if (direct === undefined || direct === override) continue;

      conflicts.push(
        `${file}: overrides.${name} is "${override}" but it is also a direct dependency at ` +
          `"${direct}". npm rejects this pair with EOVERRIDE — bump both or neither.`,
      );
    }
  }

  expect(conflicts).toEqual([]);
});
