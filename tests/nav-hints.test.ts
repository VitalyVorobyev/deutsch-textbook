/**
 * Navigation tooltips (`src/lib/nav-hints.ts`): a page's description is the `title` of the link
 * that leads to it, in the learner's explanation language. The pages themselves no longer print
 * it, so this is now the only place the text lives — it is held to the same alphabet rules as any
 * authored half.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { langFieldProblems } from '@da/schema/langcheck';
import { applyHints, hintAttrs, NAV_HINTS } from '../src/lib/nav-hints';

function link(attrs: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement('a');
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  document.body.append(a);
  return a;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applyHints', () => {
  test('sets the title from the active explanation language', () => {
    const a = link(hintAttrs('wiederholen'));
    applyHints(document, 'ru');
    expect(a.title).toBe(NAV_HINTS.wiederholen.ru);
    applyHints(document, 'uk');
    expect(a.title).toBe(NAV_HINTS.wiederholen.uk);
  });

  test('falls back to EN under de, with no language, and for a missing half', () => {
    const a = link(hintAttrs('themen'));
    applyHints(document, 'de');
    expect(a.title).toBe(NAV_HINTS.themen.en);
    applyHints(document, undefined);
    expect(a.title).toBe(NAV_HINTS.themen.en);
    const partial = link({ 'data-hint-en': 'Only English' });
    applyHints(document, 'ru');
    expect(partial.title).toBe('Only English');
  });

  test('re-applies on a language switch, and leaves unhinted links alone', () => {
    const a = link(hintAttrs('referenz'));
    const plain = link({ href: '/about' });
    applyHints(document, 'ru');
    applyHints(document, 'en');
    expect(a.title).toBe(NAV_HINTS.referenz.en);
    expect(plain.hasAttribute('title')).toBe(false);
  });

  test('a link without a hint gets no attributes', () => {
    expect(hintAttrs(undefined)).toEqual({});
  });
});

describe('NAV_HINTS', () => {
  test('every hint has all three halves', () => {
    const empty = Object.entries(NAV_HINTS).flatMap(([key, hint]) =>
      (['en', 'ru', 'uk'] as const).filter((lang) => !hint[lang].trim()).map((lang) => `${key}.${lang}`),
    );
    expect(empty).toEqual([]);
  });

  test('every half keeps to its alphabet', () => {
    expect(langFieldProblems(NAV_HINTS)).toEqual([]);
  });
});
