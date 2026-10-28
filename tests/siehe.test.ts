import { afterEach, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import GithubSlugger from 'github-slugger';
import { headingSlug, sieheLinks, sieheProblems } from '@da/content/siehe';
import { SIEHE_KEY, initSiehe, readReturn } from '../src/lib/siehe';

const topicsDir = join(import.meta.dir, '..', 'content', 'topics');

describe('headingSlug', () => {
  // Astro ids headings with github-slugger; the validator checks <Siehe> anchors with
  // headingSlug. Held equal over every heading in the corpus, so neither can drift alone.
  test('matches github-slugger on every article heading', () => {
    let count = 0;
    for (const level of readdirSync(topicsDir))
      for (const file of readdirSync(join(topicsDir, level)).filter((f) => f.endsWith('.mdx'))) {
        const body = readFileSync(join(topicsDir, level, file), 'utf8');
        for (const [, text] of body.matchAll(/^#{2,3}\s+(.+)$/gm)) {
          const visible = text!.replace(/[*_`]/g, '').trim();
          expect(headingSlug(text!)).toBe(new GithubSlugger().slug(visible));
          count++;
        }
      }
    expect(count).toBeGreaterThan(300);
  });
});

describe('sieheProblems', () => {
  const targets = {
    topicBody: (key: string) =>
      key === 'a2/einkaufen'
        ? '## Kurz gesagt\n\n### Ungleich, gleich und am höchsten\n'
        : undefined,
    referenzPage: (id: string) => id === 'zeitformen',
  };

  test('accepts a topic, a heading anchor and a Referenz page that exist', () => {
    const body =
      '<Siehe to="a2/einkaufen">A2</Siehe> <Siehe to="a2/einkaufen#ungleich-gleich-und-am-höchsten">x</Siehe> <Siehe to="referenz/zeitformen">R</Siehe>';
    expect(sieheLinks(body)).toHaveLength(3);
    expect(sieheProblems(body, targets)).toEqual([]);
  });

  test('names a missing topic, heading or Referenz page', () => {
    const body =
      '<Siehe to="a2/einkaufen-alt">x</Siehe> <Siehe to="a2/einkaufen#am-hoechsten">x</Siehe> <Siehe to="referenz/zeiten">x</Siehe>';
    const problems = sieheProblems(body, targets);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain('no topic "a2/einkaufen-alt"');
    expect(problems[1]).toContain('no heading with the id "am-hoechsten"');
    expect(problems[2]).toContain('no Referenz page "zeiten"');
  });
});

describe('initSiehe — the way back', () => {
  // happy-dom starts at about:blank, where history cannot move; tests set a real origin.
  const go = (path: string) =>
    (globalThis as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
      `https://deutsch-atlas.example${path}`,
    );
  afterEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
    (globalThis as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
      'about:blank',
    );
  });

  test('a click records the origin, the link position and the page title', () => {
    go('/topics/b1/leben-veraendern');
    document.body.innerHTML =
      '<main><h1>Leben verändern</h1><p><a data-siehe href="/topics/a2/x">a</a> <a data-siehe href="/topics/a2/einkaufen#k">b</a></p></main>';
    initSiehe(document, sessionStorage);
    const second = document.querySelectorAll('a')[1]!;
    expect(second.id).toBe('siehe-1');
    second.addEventListener('click', (e) => e.preventDefault());
    second.click();
    expect(readReturn(sessionStorage)).toEqual({
      back: '/topics/b1/leben-veraendern#siehe-1',
      title: 'Leben verändern',
      target: '/topics/a2/einkaufen',
    });
  });

  test('the target page shows one pill back; any other page drops the record', () => {
    sessionStorage.setItem(
      SIEHE_KEY,
      JSON.stringify({
        back: '/topics/b1/leben-veraendern#siehe-1',
        title: 'Leben verändern',
        target: '/topics/a2/einkaufen',
      }),
    );
    go('/topics/a2/einkaufen#k');
    initSiehe(document, sessionStorage);
    const pill = document.querySelector<HTMLAnchorElement>('a.siehe-return');
    expect(pill?.textContent).toBe('← Zurück zu „Leben verändern“');
    expect(pill?.getAttribute('href')).toBe('/topics/b1/leben-veraendern#siehe-1');

    document.body.innerHTML = '';
    go('/ueben/wiederholen');
    initSiehe(document, sessionStorage);
    expect(document.querySelector('a.siehe-return')).toBeNull();
    expect(sessionStorage.getItem(SIEHE_KEY)).toBeNull();
  });

  test('coming back opens the fold around the link and marks it', () => {
    go('/topics/b1/leben-veraendern#siehe-0');
    document.body.innerHTML =
      '<main><details><summary>Erklärung</summary><a data-siehe href="/topics/a2/x">a</a></details></main>';
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    try {
      initSiehe(document, sessionStorage);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
    expect(document.querySelector('details')!.open).toBe(true);
    expect(scrolled).toEqual(['siehe-0']);
    expect(document.getElementById('siehe-0')!.classList.contains('siehe-returned')).toBe(true);
  });
});
