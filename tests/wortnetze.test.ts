import { describe, expect, test } from 'bun:test';
import { wortnetzSchema, type Wortnetz } from '../src/lib/schemas';
import { wortnetzContexts } from '../src/lib/srs';
import { wortnetzCardRefProblems } from '../src/lib/wortnetze';

function text() {
  return { en: 'English', ru: 'Русский', uk: 'Українська' };
}

function example() {
  return { de: 'Ich benutze das.', en: 'I use it.', ru: 'Я это использую.', uk: 'Я це використовую.' };
}

type MutableTestNetwork = {
  members: Array<{ id: string; gloss?: { uk?: string } }>;
  relations: Array<{ to: string; basis: string }>;
};

function network(over: Record<string, unknown> = {}): unknown {
  return {
    id: 'test-netz',
    kind: 'meaning-contrast',
    level: 'A2',
    title_de: 'Testnetz',
    title: text(),
    introduction: text(),
    members: [
      {
        kind: 'card',
        id: 'benutzen',
        status: 'productive',
        ref: { deck: 'handlungen', de: 'benutzen' },
        usage: text(),
        collocations: ['etwas benutzen'],
        example: example(),
      },
      {
        kind: 'receptive',
        id: 'verwenden',
        status: 'receptive',
        de: 'verwenden',
        gloss: text(),
        usage: text(),
        collocations: [],
        example: { ...example(), de: 'Ich verwende das.' },
      },
    ],
    relations: [{
      from: 'benutzen',
      to: 'verwenden',
      type: 'meaning-contrast',
      basis: 'current-meaning',
      explanation: text(),
    }],
    ...over,
  };
}

describe('wortnetz schema', () => {
  test('accepts a mixed card and receptive network', () => {
    expect(wortnetzSchema.parse(network()).id).toBe('test-netz');
  });

  test('rejects duplicate member ids and unresolved relation targets', () => {
    const value = network() as MutableTestNetwork;
    value.members[1].id = 'benutzen';
    value.relations[0].to = 'missing';
    const result = wortnetzSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain('duplicate member id "benutzen"');
      expect(result.error.issues.map((issue) => issue.message)).toContain('unknown member "missing"');
    }
  });

  test('rejects a missing Ukrainian half', () => {
    const value = network() as MutableTestNetwork;
    delete value.members[1]!.gloss!.uk;
    expect(wortnetzSchema.safeParse(value).success).toBe(false);
  });

  test('requires a source note for historical claims', () => {
    const value = network() as MutableTestNetwork;
    value.relations[0].basis = 'historical';
    const result = wortnetzSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message))
        .toContain('historical relations require an authoring source note');
    }
  });
});

describe('wortnetz catalog integration', () => {
  const parsed = wortnetzSchema.parse(network()) as Wortnetz;

  test('reports unknown decks and headwords', () => {
    expect(wortnetzCardRefProblems(parsed, new Map())).toEqual([
      'card member "benutzen" references unknown deck "handlungen"',
    ]);
    expect(wortnetzCardRefProblems(parsed, new Map([['handlungen', new Set(['machen'])]]))).toEqual([
      'card member "benutzen" references missing headword "benutzen" in deck "handlungen"',
    ]);
  });

  test('adds context only to existing card refs', () => {
    const contexts = wortnetzContexts([parsed]);
    expect(Object.keys(contexts)).toEqual(['handlungen::benutzen']);
    expect(contexts['handlungen::benutzen']).toEqual([
      expect.objectContaining({ type: 'meaning-contrast', de: 'verwenden' }),
    ]);
  });
});
