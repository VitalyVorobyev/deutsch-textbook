import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSource, resolveEditableSource, saveSource } from '@da/content/editor';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'redaktion-editor-'));
  mkdirSync(join(root, 'content', 'topics', 'a1'), { recursive: true });
  writeFileSync(join(root, 'content', 'topics', 'a1', 'probe.mdx'), '## Erklärung\n\n### Form\n\nText.\n');
  const topic = readFileSync(join(import.meta.dir, '..', 'content', 'topics', 'a1', 'erste-schritte.topic.yaml'), 'utf8')
    .replace('status: reviewed', 'status: draft');
  writeFileSync(join(root, 'content', 'topics', 'a1', 'probe.topic.yaml'), topic);
  return root;
}

describe('Redaktion source editor', () => {
  test('reads and atomically saves the exact source text', async () => {
    const root = fixture();
    try {
      const before = await readSource(root, 'content/topics/a1/probe.mdx');
      const text = `${before.text}\n## Beispiele\n`;
      const result = await saveSource(root, { path: before.path, text, expectedRevision: before.revision });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.changed).toBe(true);
      expect(result.snapshot.text).toBe(text);
      expect(readFileSync(join(root, before.path), 'utf8')).toBe(text);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('refuses stale revisions without overwriting the external change', async () => {
    const root = fixture();
    try {
      const before = await readSource(root, 'content/topics/a1/probe.mdx');
      writeFileSync(join(root, before.path), '# external\n');
      const result = await saveSource(root, { path: before.path, text: '# editor\n', expectedRevision: before.revision });
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.conflict?.text).toBe('# external\n');
      expect(readFileSync(join(root, before.path), 'utf8')).toBe('# external\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks invalid MDX and keeps the original bytes', async () => {
    const root = fixture();
    try {
      const before = await readSource(root, 'content/topics/a1/probe.mdx');
      const result = await saveSource(root, {
        path: before.path,
        text: '<Bilingual>\n',
        expectedRevision: before.revision,
      });
      expect(result.ok).toBe(false);
      expect(readFileSync(join(root, before.path), 'utf8')).toBe(before.text);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('cannot bypass the strict reviewed gate through generic source Save', async () => {
    const root = fixture();
    try {
      const path = 'content/topics/a1/probe.topic.yaml';
      const before = await readSource(root, path);
      const result = await saveSource(root, {
        path,
        text: before.text.replace('status: draft', 'status: reviewed'),
        expectedRevision: before.revision,
      });
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.diagnostics[0]?.message).toContain('strict corpus-wide reviewed gate');
      expect(readFileSync(join(root, path), 'utf8')).toBe(before.text);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects lexical traversal and a symlink that leaves the checkout', () => {
    const root = fixture();
    const outside = mkdtempSync(join(tmpdir(), 'redaktion-outside-'));
    try {
      writeFileSync(join(outside, 'secret.yaml'), 'secret: true\n');
      symlinkSync(join(outside, 'secret.yaml'), join(root, 'content', 'topics', 'a1', 'escape.yaml'));
      expect(() => resolveEditableSource(root, '../secret.yaml')).toThrow();
      expect(() => resolveEditableSource(root, 'content/topics/a1/escape.yaml')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
