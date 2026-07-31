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
import { A1_CARD_ID_MIGRATION } from '../src/lib/a1-card-id-migration';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const legacy = (version: number) => ({
  version,
  exportedAt: '2026-07-13T12:00:00.000Z',
  attempts: [{
    setId: 'a2/x', itemId: 'one', itemType: 'translate', correct: true,
    given: 'Gut.', ts: 1,
  }],
  cards: {},
});

describe('snapshot v7', () => {
  test('migrates every supported version through an explicit v7 boundary', () => {
    for (const version of [1, 2, 3, 4, 5, 6, 7]) {
      const migrated = parseProgressSnapshot(legacy(version));
      expect(migrated.version).toBe(7);
      expect(migrated.attempts).toHaveLength(1);
      expect(migrated.sessions).toEqual([]);
      expect(migrated.topics).toEqual({});
      expect(migrated.feedback).toEqual({});
    }
  });

  test('rejects malformed nested progress instead of shallowly accepting it', () => {
    expect(() => parseProgressSnapshot({ ...legacy(6), attempts: [{ correct: true }] })).toThrow();
    expect(() => parseProgressSnapshot({ ...legacy(6), cards: { x: { reps: 1 } } })).toThrow();
    expect(() => parseProgressSnapshot(legacy(8))).toThrow();
  });

  test('carries placement across the v5 boundary in both directions', () => {
    // A v5 file predates placement entirely: it must import clean, not be rejected for
    // lacking a field that did not exist when it was written.
    const fromV5 = parseProgressSnapshot({
      ...legacy(5),
      topics: { dativ: { readAt: 7, manual: 'learned', manualAt: 8 } },
    });
    expect(fromV5.topics.dativ).toEqual({ readAt: 7, manual: 'learned', manualAt: 8 });

    const placed = parseProgressSnapshot({
      ...legacy(7),
      topics: { dativ: { placement: { setId: 'a1/placement-a1', at: 9, score: 1 } } },
    });
    expect(placed.topics.dativ?.placement?.setId).toBe('a1/placement-a1');
    expect(parseProgressSnapshot(JSON.parse(JSON.stringify(placed)))).toEqual(placed);
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

  test('relocates both card directions without losing any FSRS field or creating duplicates', () => {
    const pairs = Object.entries(A1_CARD_ID_MIGRATION);
    const [oldRecognition, newRecognition] = pairs.find(([id]) => id.endsWith('::de-x'))!;
    const [oldProduction, newProduction] = pairs.find(([id]) =>
      id.endsWith('::x-de') && id.slice(0, -6) === oldRecognition.slice(0, -6))!;
    const recognition = {
      due: '2026-08-04T00:00:00.000Z', stability: 4.5, difficulty: 3.2,
      elapsed_days: 6, scheduled_days: 9, learning_steps: 1, reps: 8,
      lapses: 2, state: 2, last_review: '2026-07-26T00:00:00.000Z',
      introducedAt: '2026-05-01T00:00:00.000Z',
    };
    const production = { ...recognition, stability: 2.25, reps: 11, lapses: 4 };
    const migrated = parseProgressSnapshot({
      ...legacy(6),
      cards: { [oldRecognition]: recognition, [oldProduction]: production },
    });

    expect(migrated.cards[newRecognition]).toEqual(recognition);
    expect(migrated.cards[newProduction]).toEqual(production);
    expect(migrated.cards[oldRecognition]).toBeUndefined();
    expect(migrated.cards[oldProduction]).toBeUndefined();
    expect(Object.keys(migrated.cards)).toHaveLength(2);
  });

  test('the committed inventory accounts for all 94 relocated A1 headwords', () => {
    const inventory = YAML.parse(readFileSync(
      new URL('../data/a1-card-id-migration.yaml', import.meta.url),
      'utf8',
    )) as {
      unchangedDecks: string[];
      moved: Array<{ de: string; cards: Array<{ from: string; to: string }> }>;
    };
    const modal = YAML.parse(readFileSync(
      new URL('../content/vocab/modalverben.yaml', import.meta.url),
      'utf8',
    )) as { entries: unknown[] };

    expect(inventory.moved).toHaveLength(87);
    expect(inventory.unchangedDecks).toEqual(['modalverben']);
    expect(inventory.moved.length + modal.entries.length).toBe(94);
    for (const entry of inventory.moved) {
      expect(entry.cards).toHaveLength(2);
      for (const card of entry.cards) expect(A1_CARD_ID_MIGRATION[card.from]).toBe(card.to);
    }
    expect(Object.keys(A1_CARD_ID_MIGRATION)).toHaveLength(174);
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

  // mergeTopics rebuilds its output field by field, so a new TopicProgress field it does
  // not name is dropped on every import — silently, which is the whole hazard.
  test('preserves placement, higher score winning, exactly as the writer does', () => {
    const weak = { setId: 'a1/placement-a1', at: 5, score: 0.8 };
    const strong = { setId: 'a1/placement-a1', at: 9, score: 1 };

    expect(mergeTopics({ x: { placement: weak } }, {}).x?.placement).toEqual(weak);
    expect(mergeTopics({}, { x: { placement: weak } }).x?.placement).toEqual(weak);
    expect(mergeTopics({ x: { placement: weak } }, { x: { placement: strong } }).x?.placement)
      .toEqual(strong);
    // A worse retake must not un-place a topic on import either — a round-trip through
    // export and import cannot be allowed to undo what setTopicPlacement refused to undo.
    expect(mergeTopics({ x: { placement: strong } }, { x: { placement: weak } }).x?.placement)
      .toEqual(strong);
    // and it survives beside the fields that were already merged
    expect(mergeTopics(
      { x: { readAt: 2, placement: weak } },
      { x: { manual: 'learned', manualAt: 3 } },
    ).x).toEqual({ readAt: 2, manual: 'learned', manualAt: 3, placement: weak });
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
