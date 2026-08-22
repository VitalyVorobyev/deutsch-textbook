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
  // Every .md under docs/, recursively, minus two directories:
  //   archive/         — frozen history; archived files keep the links they shipped with.
  //   GeotheInstitute/ — gitignored official exam material (ADR 0009). It is absent from a clean
  //                      checkout and from CI, so a test that saw it locally would be a test that
  //                      only ever failed on one machine.
  const excluded = [`archive${sep}`, `GeotheInstitute${sep}`];
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

        const [targetPart, fragment] = raw.startsWith('#')
          ? ['', raw.slice(1)]
          : raw.split('#', 2);
        const target = targetPart
          ? resolve(dirname(file), decodeURIComponent(targetPart))
          : file;
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
});
