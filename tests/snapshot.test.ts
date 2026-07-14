import { describe, expect, test } from 'bun:test';
import { parseProgressSnapshot } from '../src/lib/snapshot-schema';
import {
  mergeAttempts,
  mergeCards,
  mergeFeedback,
  mergeSessions,
  mergeTopics,
} from '../src/lib/snapshot-merge';
import type { StoredCard } from '../src/lib/store';
import { buildDeck, wordFieldContexts } from '../src/lib/srs';

const legacy = (version: number) => ({
  version,
  exportedAt: '2026-07-13T12:00:00.000Z',
  attempts: [{
    setId: 'a2/x', itemId: 'one', itemType: 'translate', correct: true,
    given: 'Gut.', ts: 1,
  }],
  cards: {},
});

describe('snapshot v5', () => {
  test('migrates every supported version through an explicit v5 boundary', () => {
    for (const version of [1, 2, 3, 4, 5]) {
      const migrated = parseProgressSnapshot(legacy(version));
      expect(migrated.version).toBe(5);
      expect(migrated.attempts).toHaveLength(1);
      expect(migrated.sessions).toEqual([]);
      expect(migrated.topics).toEqual({});
      expect(migrated.feedback).toEqual({});
    }
  });

  test('rejects malformed nested progress instead of shallowly accepting it', () => {
    expect(() => parseProgressSnapshot({ ...legacy(5), attempts: [{ correct: true }] })).toThrow();
    expect(() => parseProgressSnapshot({ ...legacy(5), cards: { x: { reps: 1 } } })).toThrow();
    expect(() => parseProgressSnapshot(legacy(6))).toThrow();
  });

  test('round-trips structured practice and feedback', () => {
    const parsed = parseProgressSnapshot({
      ...legacy(5),
      attempts: [{
        ...legacy(5).attempts[0], itemRevision: 1, evidence: 'practice',
        practice: {
          kind: 'writing', draft: 'Ich komme.', revision: 'Ich komme morgen.',
          before: ['needs-work'], after: ['met'],
        },
      }],
      feedback: {
        berlin: { artifactId: 'berlin', difficulty: 'comfortable', useful: true, wantsMore: true, ts: 4 },
      },
    });
    expect(parseProgressSnapshot(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe('pure snapshot merge policy', () => {
  const card = (over: Partial<StoredCard> = {}): StoredCard => ({
    due: '2026-07-14T00:00:00.000Z', stability: 1, difficulty: 5,
    elapsed_days: 1, scheduled_days: 1, learning_steps: 0, reps: 1,
    lapses: 0, state: 2, ...over,
  });

  test('is deterministic and preserves the most advanced/local-latest records', () => {
    const attempt = { setId: 'a2/x', itemId: 'i', itemType: 'mc', correct: true, given: '0', ts: 2 };
    expect(mergeAttempts([attempt], [attempt])).toEqual([attempt]);
    expect(mergeSessions(
      [{ date: '2026-07-14', reviewed: 1, trained: 2, ts: 2 }],
      [{ date: '2026-07-13', reviewed: 1, trained: 2, ts: 1 }],
    ).map((row) => row.ts)).toEqual([1, 2]);
    expect(mergeCards({ x: card({ reps: 2 }) }, { x: card({ reps: 3 }) }).x?.reps).toBe(3);
    expect(mergeTopics(
      { x: { readAt: 2, manual: 'learned', manualAt: 2 } },
      { x: { readAt: 1, manual: 'reopened', manualAt: 3 } },
    ).x).toEqual({ readAt: 2, manual: 'reopened', manualAt: 3 });
    expect(mergeFeedback(
      { x: { artifactId: 'x', difficulty: 'too-hard', useful: false, wantsMore: false, ts: 1 } },
      { x: { artifactId: 'x', difficulty: 'comfortable', useful: true, wantsMore: true, ts: 2 } },
    ).x?.difficulty).toBe('comfortable');
  });
});

test('Wortfeld context enriches backs without changing card identities or fronts', () => {
  const entries = [{
    de: 'Zug', ipa: 'tsuːk', pos: 'noun' as const, gender: 'm' as const,
    plural: 'die Züge', en: 'train', ru: 'поезд',
    example_de: 'Der Zug kommt.', example_en: 'The train is coming.', example_ru: 'Поезд прибывает.',
    accept: [],
  }];
  const plain = buildDeck('travel', entries);
  const contexts = wordFieldContexts([{
    id: 'travel', topic: 'travel', level: 'A2',
    title_de: 'Reisen', title_en: 'Travel', title_ru: 'Путешествия',
    members: [{
      kind: 'card', role: 'active', ref: { deck: 'travel', de: 'Zug' },
      relations: [{
        type: 'collocation', de: 'den Zug nehmen',
        explanation: { en: 'take the train', ru: 'сесть на поезд' },
      }],
    }],
  }]);
  const enriched = buildDeck('travel', entries, contexts);
  expect(enriched.map(({ id, de, en, ru, dir }) => ({ id, de, en, ru, dir })))
    .toEqual(plain.map(({ id, de, en, ru, dir }) => ({ id, de, en, ru, dir })));
  expect(enriched[0]?.context?.[0]?.de).toBe('den Zug nehmen');
});
