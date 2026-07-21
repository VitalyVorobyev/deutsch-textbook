/**
 * Properties of the source files themselves, not of the code in them.
 *
 * This exists because the defect it catches survives every other gate. A NUL byte in a
 * `.ts` file is valid TypeScript, so tests, `astro check`, ESLint and the production build
 * all pass — but `file` reports the source as `data` instead of text, and grep, ripgrep and
 * every editor search then **skip the file silently**, returning "no matches" rather than
 * an error. Two files in this repo sat that way; working out why a search over
 * `progress-audit.ts` kept coming back empty cost half a dozen dead-end greps.
 *
 * Both were using NUL as a composite-map-key separator, which is a good idea — no rendering
 * can contain one, so no pair of parts can collide. Emitting it as a literal byte rather than
 * as an escape sequence is the part that costs, and it buys nothing: the escape produces the
 * identical string at runtime and leaves the file searchable.
 */
import { expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SOURCE = /\.(ts|tsx|astro|md|mdx|yaml|json|css|js)$/;

test('no tracked source file contains a NUL byte', () => {
  const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => SOURCE.test(f));

  // Sanity check on the listing itself — a silently empty file list would make this test
  // pass by measuring nothing, which is the same failure mode it exists to catch.
  expect(files.length).toBeGreaterThan(100);

  const offenders = files.filter((f) => {
    try {
      return readFileSync(f).includes(0);
    } catch {
      return false; // deleted between listing and reading
    }
  });

  expect(offenders).toEqual([]);
});
