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
