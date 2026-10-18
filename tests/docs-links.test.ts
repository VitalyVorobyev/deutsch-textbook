import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, '..');

function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

describe('documentation links', () => {
  // Every .md under docs/, recursively, minus GeotheInstitute/: gitignored official exam material
  // (ADR 0009), absent from a clean checkout and from CI, so a test that saw it locally would be a
  // test that only ever failed on one machine.
  const excluded = [`GeotheInstitute${sep}`];
  const activeDocs = (readdirSync(join(root, 'docs'), { recursive: true }) as string[])
    .filter((name) => name.endsWith('.md') && !excluded.some((dir) => name.startsWith(dir)))
    .map((name) => join(root, 'docs', name));
  const files = [join(root, 'README.md'), join(root, 'CLAUDE.md'), ...activeDocs];

  test('every local Markdown target and heading fragment resolves', () => {
    const failures: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const links = source.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);

      for (const match of links) {
        const raw = match[1];
        if (/^(?:https?:|mailto:)/.test(raw)) continue;

        const [targetPart, fragment] = raw.startsWith('#') ? ['', raw.slice(1)] : raw.split('#', 2);
        const target = targetPart ? resolve(dirname(file), decodeURIComponent(targetPart)) : file;
        if (!existsSync(target)) {
          failures.push(`${relative(root, file)} → missing ${raw}`);
          continue;
        }

        if (fragment && target.endsWith('.md')) {
          const headings = readFileSync(target, 'utf8')
            .split('\n')
            .filter((line) => /^#{1,6}\s/.test(line))
            .map((line) => slug(line.replace(/^#{1,6}\s+/, '')));
          if (!headings.includes(decodeURIComponent(fragment))) {
            failures.push(`${relative(root, file)} → missing heading ${raw}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  // The mirror of the test above, and the one that was missing. Checking that every link RESOLVES
  // says nothing about whether a document can be REACHED: nine files — two of them over a thousand
  // lines — had drifted out of every index unnoticed, because nothing asked the question. An
  // unindexed doc is not neutral; it is a document a reader will not find and an author will not
  // update, which is how a stale claim survives.
  test('every active doc is reachable from an index', () => {
    const indexes = files.filter(
      (file) => file.endsWith('README.md') || file.endsWith('CLAUDE.md'),
    );
    const linked = new Set<string>();
    for (const index of indexes) {
      for (const match of readFileSync(index, 'utf8').matchAll(/\]\(([^)\s#]+)/g)) {
        const raw = match[1]!;
        if (/^(?:https?:|mailto:)/.test(raw)) continue;
        linked.add(resolve(dirname(index), decodeURIComponent(raw)));
      }
    }

    const orphans = activeDocs
      .filter((doc) => !doc.endsWith('README.md') && !linked.has(doc))
      .map((doc) => relative(root, doc));

    expect(orphans).toEqual([]);
  });

  // A developer doc states the current contract, queue or procedure; history lives in `git log`
  // (docs/README.md). The two shapes history took here were an archive directory and dated
  // pass-log headings ("### 2026-07-19 — case cluster (batch 1)"), and both grew back unnoticed
  // because nothing asked. ADRs are exempt: a decision record is dated by nature.
  test('developer docs keep no history', () => {
    expect(existsSync(join(root, 'docs', 'archive'))).toBe(false);
    const dated = files
      .filter((file) => !relative(root, file).startsWith(`docs${sep}adrs${sep}`))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((line) => /^#{1,6}\s.*\b20\d\d-\d\d-\d\d\b/.test(line))
          .map((line) => `${relative(root, file)}: ${line}`),
      );
    expect(dated).toEqual([]);
  });

  // Code comments cite decisions as "ADR 0006" or by path, and the link test above reads only
  // Markdown. When the ADR set was rewritten, 355 such mentions in 162 files had to move, and
  // nothing but this test would notice one that pointed at a number that no longer exists — or
  // that wrapped "ADR" and its number across a line break. CHANGELOG.md is history and exempt.
  test('every ADR mention names an existing record', () => {
    const adrDir = join(root, 'docs', 'adrs');
    const records = new Map(
      readdirSync(adrDir)
        .filter((name) => /^\d{4}-.+\.md$/.test(name))
        .map((name) => [name.slice(0, 4), name]),
    );
    const tracked = Bun.spawnSync(['git', 'ls-files'], { cwd: root })
      .stdout.toString()
      .split('\n')
      .filter(
        (name) =>
          name &&
          name !== 'CHANGELOG.md' &&
          /\.(md|mdx|ts|tsx|astro|yaml|rs|toml|css|py)$/.test(name),
      );

    const failures: string[] = [];
    for (const name of tracked) {
      const source = readFileSync(join(root, name), 'utf8');
      for (const match of source.matchAll(/\bADRs?\s+(?:(?:\/\/|\*|#)\s*)?(\d{4})/g)) {
        if (!records.has(match[1]!)) failures.push(`${name}: ADR ${match[1]}`);
      }
      for (const match of source.matchAll(/adrs\/(\d{4}-[a-z0-9-]+\.md)/g)) {
        if (records.get(match[1]!.slice(0, 4)) !== match[1])
          failures.push(`${name}: adrs/${match[1]}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
