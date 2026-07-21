import { describe, expect, test } from 'bun:test';

import { discoverySchema } from '../src/lib/schemas';

const base = {
  id: 'test-piece',
  level: 'A2',
  title_de: 'Titel',
  title_en: 'Title',
  title_ru: 'Заголовок',
  summary: { en: 'An English summary.', ru: 'Русское описание.' },
};

const image = (overrides: Record<string, unknown>) => ({
  src: '/discovery/test.svg',
  alt: 'A test image',
  sourceClass: 'simulated',
  ...overrides,
});

describe('discoverySchema images', () => {
  test('simulated image needs no attribution or license', () => {
    expect(discoverySchema.safeParse({ ...base, images: [image({})] }).success).toBe(true);
  });

  test.each(['real', 'adapted'])('%s image without attribution and license is rejected', (sourceClass) => {
    expect(discoverySchema.safeParse({ ...base, images: [image({ sourceClass })] }).success).toBe(false);
    expect(
      discoverySchema.safeParse({ ...base, images: [image({ sourceClass, attribution: 'BVG archive' })] }).success,
    ).toBe(false);
    expect(
      discoverySchema.safeParse({
        ...base,
        images: [image({ sourceClass, attribution: 'BVG archive', license: 'CC BY-SA 4.0' })],
      }).success,
    ).toBe(true);
  });

  test('the retired bare image field fails loudly instead of being stripped', () => {
    expect(discoverySchema.safeParse({ ...base, image: '/discovery/test.svg' }).success).toBe(false);
  });
});

describe('discoverySchema links', () => {
  test('https link with a label passes; note is optional', () => {
    expect(
      discoverySchema.safeParse({ ...base, links: [{ url: 'https://example.org/karte', label: 'Beispiel' }] }).success,
    ).toBe(true);
  });

  test('http link is rejected', () => {
    expect(
      discoverySchema.safeParse({ ...base, links: [{ url: 'http://example.org', label: 'Beispiel' }] }).success,
    ).toBe(false);
  });
});

describe('discoverySchema defaults', () => {
  test('images and links default to empty arrays, status to draft', () => {
    const parsed = discoverySchema.parse(base);
    expect(parsed.images).toEqual([]);
    expect(parsed.links).toEqual([]);
    expect(parsed.status).toBe('draft');
  });
});

// The topic link exists so a piece can be reached from the lesson instead of only from
// /entdecken — five pieces shipped with no route to them at all, which is a likelier
// reading of the single "useful: no" datum than the writing was. What it must NOT do is
// turn optional material into an obligation, so the contract is: optional on both sides,
// one-way, and carrying no progress semantics whatsoever.
describe('the topic link is navigation, never obligation', () => {
  test('topics defaults to empty — a piece belongs to no lesson unless it says so', () => {
    expect(discoverySchema.parse(base).topics).toEqual([]);
  });

  test('topics accepts kebab-case slugs and rejects anything else', () => {
    expect(discoverySchema.parse({ ...base, topics: ['stadt-wege'] }).topics)
      .toEqual(['stadt-wege']);
    expect(discoverySchema.safeParse({ ...base, topics: ['Stadt Wege'] }).success).toBe(false);
  });

  test('the link carries no progress fields — the schema is strict, so it cannot', () => {
    // A `completed`/`required`/`readAt` field on a discovery piece would be the moment
    // exploration became debt. .strict() means any such addition fails loudly here.
    for (const smuggled of ['required', 'completed', 'readAt', 'mastery']) {
      expect(discoverySchema.safeParse({ ...base, [smuggled]: true }).success).toBe(false);
    }
  });
});
