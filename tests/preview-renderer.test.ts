import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentGraph } from '@da/content/graph';
import { languageCoverage, renderSource } from '@da/content/preview';

describe('safe editorial article preview', () => {
  test('renders one requested half and normal Markdown without leaking sibling languages', () => {
    const payload = renderSource({
      path: 'content/topics/a1/test.mdx',
      language: 'ru',
      text: '## Regel\n\n<Bilingual><En>English **rule**.</En><Ru>Русское **правило**.</Ru><Uk>Українське **правило**.</Uk></Bilingual>\n\n| A | B |\n|---|---|\n| 1 | 2 |',
    });
    expect(JSON.stringify(payload.root)).toContain('Русское');
    expect(JSON.stringify(payload.root)).not.toContain('English');
    expect(JSON.stringify(payload.root)).not.toContain('Українське');
    expect(JSON.stringify(payload.root)).toContain('table');
    expect(payload.diagnostics).toEqual([]);
  });

  test('never executes imports, expressions or unknown components', () => {
    const payload = renderSource({
      path: 'content/topics/a1/test.mdx',
      language: 'en',
      text: 'export const x = dangerous()\n\n{dangerous()}\n\n<Unknown answer={dangerous()} />',
    });
    expect(payload.diagnostics.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(payload.root)).not.toContain('dangerous()');
  });

  test('every current topic parses with only allowlisted components', () => {
    const graph = contentGraph();
    for (const topic of graph.topics.values()) {
      const text = readFileSync(resolve(graph.root, topic.article), 'utf8');
      const payload = renderSource({ path: topic.article, text, language: 'en' });
      expect(payload.diagnostics, topic.article).toEqual([]);
      expect(payload.available, topic.article).toBe(true);
    }
  });

  test('language coverage distinguishes authored German halves from German examples', () => {
    const text = '<Bilingual><En>EN</En><Ru>RU</Ru><Uk>UK</Uk></Bilingual>\n\nDeutsch bleibt im Beispiel.';
    const coverage = languageCoverage('test', 'content/topics/a1/test.mdx', text);
    expect(coverage.languages.find((entry) => entry.language === 'de')?.status).toBe('unsupported');
    expect(coverage.languages.find((entry) => entry.language === 'en')?.status).toBe('complete');
  });

  test('reports the current corpus language contract without treating German examples as translations', () => {
    const graph = contentGraph();
    const totals = { de: { complete: 0, partial: 0, unsupported: 0 }, en: { complete: 0, partial: 0, unsupported: 0 }, ru: { complete: 0, partial: 0, unsupported: 0 }, uk: { complete: 0, partial: 0, unsupported: 0 } };
    for (const topic of graph.topics.values()) {
      const text = readFileSync(resolve(graph.root, topic.article), 'utf8');
      const coverage = languageCoverage(topic.id, topic.article, text);
      for (const entry of coverage.languages) totals[entry.language][entry.status] += 1;
    }
    expect(totals.en).toEqual({ complete: 57, partial: 0, unsupported: 0 });
    expect(totals.ru).toEqual({ complete: 57, partial: 0, unsupported: 0 });
    expect(totals.uk).toEqual({ complete: 57, partial: 0, unsupported: 0 });
    expect(totals.de).toEqual({ complete: 14, partial: 0, unsupported: 43 });
  });
});
