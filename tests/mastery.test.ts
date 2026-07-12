import { describe, expect, test } from 'bun:test';
import { goalRoute, lessonCompleted, masteryGaps, recommendedForGoal, recommendedNext, topicTier, type TopicContext, type TopicNode } from '../src/lib/mastery';
import type { Attempt } from '../src/lib/store';

const node: TopicNode = {
  id: 'basis', path: '/topics/a1/basis', level: 'A1', kind: 'grammar',
  title_de: 'Basis', title_en: 'Basics', title_ru: 'База', prerequisites: [],
  exerciseSets: ['a1/basis'], vocabIds: [], readingIds: [], pretestId: 'a1/basis-pretest',
};

const attempt = (setId: string, ts: number, correct = true): Attempt => ({
  setId, itemId: `i-${ts}`, itemType: 'mc', correct, given: 'x', ts,
});

describe('measured mastery', () => {
  test('pretest-only activity never becomes practiced', () => {
    const ctx: TopicContext = { attempts: [attempt('a1/basis-pretest', 1)], cards: {}, topics: {} };
    expect(topicTier(node, ctx)).toBe('untouched');
    expect(topicTier(node, { ...ctx, topics: { basis: { readAt: 1 } } })).toBe('read');
  });

  test('mastery requires verified accuracy across two days', () => {
    const day1 = new Date(2026, 0, 1, 10).getTime();
    const day2 = new Date(2026, 0, 2, 10).getTime();
    const attempts = [0, 1, 2, 3].map((n) => attempt('a1/basis', day1 + n));
    attempts.push(attempt('a1/basis', day2));
    const ctx: TopicContext = { attempts, cards: {}, topics: { basis: { readAt: day1 } } };
    expect(masteryGaps(node, ctx).every((gap) => gap.met)).toBe(true);
    expect(topicTier(node, ctx)).toBe('mastered');
  });

  test('practice evidence does not satisfy measured mastery', () => {
    const attempts = Array.from({ length: 6 }, (_, n) => ({
      ...attempt('a1/basis', new Date(2026, 0, n < 3 ? 1 : 2, 10, n).getTime()),
      evidence: 'practice' as const,
    }));
    const ctx: TopicContext = { attempts, cards: {}, topics: { basis: { readAt: 1 } } };
    expect(topicTier(node, ctx)).toBe('practiced');
    expect(masteryGaps(node, ctx).find((gap) => gap.req === 'attempts')?.met).toBe(false);
  });

  test('recommendedNext uses measured tiers', () => {
    const second = { ...node, id: 'next', path: '/topics/a1/next', title_de: 'Next', exerciseSets: ['a1/next'] };
    const ctx: TopicContext = { attempts: [], cards: {}, topics: {} };
    expect(recommendedNext(['basis', 'next'], [node, second], ctx)?.id).toBe('basis');
  });

  test('a completed first lesson advances before spaced mastery', () => {
    const first = { ...node, primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] } };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const attempts: Attempt[] = [
      { ...attempt('a1/basis', 1), itemId: 'one' },
      { ...attempt('a1/basis', 2), itemId: 'two' },
    ];
    const ctx: TopicContext = { attempts, cards: {}, topics: { basis: { readAt: 1 } } };
    expect(topicTier(first, ctx)).toBe('practiced');
    expect(lessonCompleted(first, ctx)).toBe(true);
    expect(recommendedNext(['basis', 'next'], [first, second], ctx)?.id).toBe('next');
  });

  test('partial practice and pretest activity do not complete a lesson', () => {
    const first = { ...node, primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] } };
    const ctx: TopicContext = {
      attempts: [
        { ...attempt('a1/basis', 1), itemId: 'one' },
        { ...attempt('a1/basis-pretest', 2), itemId: 'two' },
      ],
      cards: {}, topics: { basis: { readAt: 1 } },
    };
    expect(lessonCompleted(first, ctx)).toBe(false);
    expect(recommendedNext(['basis'], [first], ctx)?.id).toBe('basis');
  });

  test('goal route includes every transitive prerequisite in spine order', () => {
    const grammar = { ...node, id: 'grammar', prerequisites: ['basis'] };
    const words = { ...node, id: 'words', prerequisites: [] };
    const goal = { ...node, id: 'goal', prerequisites: ['grammar', 'words'] };
    const nodes = [node, grammar, words, goal];
    expect(goalRoute('goal', ['basis', 'words', 'grammar', 'goal'], nodes).map((n) => n.id))
      .toEqual(['basis', 'words', 'grammar', 'goal']);
    const ctx: TopicContext = { attempts: [], cards: {}, topics: {} };
    expect(recommendedForGoal('goal', ['basis', 'words', 'grammar', 'goal'], nodes, ctx)?.id).toBe('basis');
  });
});
