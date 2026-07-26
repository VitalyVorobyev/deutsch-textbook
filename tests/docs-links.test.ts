import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

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
  const activeDocs = readdirSync(join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
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
});
