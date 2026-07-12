import { describe, expect, test } from 'bun:test';
import { State } from 'ts-fsrs';
import { goalRoute, lessonCompleted, masteryGaps, pathDone, recommendedForGoal, recommendedNext, topicCompletion, topicTier, type TopicContext, type TopicNode } from '../src/lib/mastery';
import type { Attempt, StoredCard } from '../src/lib/store';

const node: TopicNode = {
  id: 'basis', path: '/topics/a1/basis', level: 'A1', kind: 'grammar',
  title_de: 'Basis', title_en: 'Basics', title_ru: 'База', prerequisites: [],
  exerciseSets: ['a1/basis'], vocabIds: [], readingIds: [], pretestId: 'a1/basis-pretest',
};

const attempt = (setId: string, ts: number, correct = true): Attempt => ({
  setId, itemId: `i-${ts}`, itemType: 'mc', correct, given: 'x', ts,
});

const reviewedCard = (): StoredCard => ({
  due: '2026-01-05T00:00:00.000Z', stability: 10, difficulty: 5,
  elapsed_days: 1, scheduled_days: 7, learning_steps: 0, reps: 3,
  lapses: 0, state: State.Review, last_review: '2026-01-02T00:00:00.000Z',
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

  test('full primary practice completes a lesson even without readAt (legacy snapshots)', () => {
    const first = { ...node, primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] } };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const attempts: Attempt[] = [
      { ...attempt('a1/basis', 1), itemId: 'one' },
      { ...attempt('a1/basis', 2), itemId: 'two' },
    ];
    const ctx: TopicContext = { attempts, cards: {}, topics: {} };
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

  // Regression: a deepened topic grows its practice set, so a lesson the learner
  // finished against the old, shorter set stops being "complete" — and used to
  // fall back onto the path while still badged Gemeistert.
  test('a mastered topic stays behind the learner when its practice set grows', () => {
    const day1 = new Date(2026, 0, 1, 10).getTime();
    const day2 = new Date(2026, 0, 2, 10).getTime();
    // five verified attempts across two days on the items that existed back then …
    const attempts = [0, 1, 2, 3].map((n) => ({ ...attempt('a1/basis', day1 + n), itemId: `old-${n}` }));
    attempts.push({ ...attempt('a1/basis', day2), itemId: 'old-4' });
    // … while the set has since gained "new-1", which the learner never saw.
    const first: TopicNode = {
      ...node,
      vocabIds: ['basis'],
      primaryPractice: { setId: 'a1/basis', itemIds: [...attempts.map((a) => a.itemId), 'new-1'] },
    };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const ctx: TopicContext = {
      attempts,
      cards: { 'basis::Brot::de-en': reviewedCard() },
      topics: { basis: { readAt: day1 } },
    };

    expect(topicTier(first, ctx)).toBe('mastered');
    expect(lessonCompleted(first, ctx)).toBe(false); // the grown set is genuinely unfinished …
    expect(pathDone(first, ctx)).toBe(true); // … but mastery already settled it
    expect(recommendedNext(['basis', 'next'], [first, second], ctx)?.id).toBe('next');
  });

  // Reopening must mean "let me work through this again", not "block the path
  // forever": the reopened tier is capped at practiced, so a topic that only
  // cleared itself through mastery could never clear itself again — it would
  // hide every later topic, and the level checkpoint, behind it.
  test('a reopened topic is recommended again until the lesson is redone', () => {
    const day1 = new Date(2026, 0, 1, 10).getTime();
    const day2 = new Date(2026, 0, 2, 10).getTime();
    const reopenedAt = new Date(2026, 0, 3, 10).getTime();
    const first: TopicNode = {
      ...node,
      primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] },
    };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const mastered: Attempt[] = [
      { ...attempt('a1/basis', day1), itemId: 'one' },
      { ...attempt('a1/basis', day1 + 1), itemId: 'two' },
      { ...attempt('a1/basis', day1 + 2), itemId: 'one' },
      { ...attempt('a1/basis', day1 + 3), itemId: 'two' },
      { ...attempt('a1/basis', day2), itemId: 'one' },
    ];
    const ctx: TopicContext = {
      attempts: mastered,
      cards: {},
      topics: { basis: { readAt: day1, manual: 'reopened', manualAt: reopenedAt } },
    };

    expect(topicCompletion(first, ctx).tier).toBe('practiced'); // reopening caps the badge
    expect(pathDone(first, ctx)).toBe(false);
    expect(recommendedNext(['basis', 'next'], [first, second], ctx)?.id).toBe('basis');

    // Working through the set again — after the reopen — clears it and the path moves on.
    const redone: TopicContext = {
      ...ctx,
      attempts: [
        ...mastered,
        { ...attempt('a1/basis', reopenedAt + 1), itemId: 'one' },
        { ...attempt('a1/basis', reopenedAt + 2), itemId: 'two' },
      ],
    };
    expect(pathDone(first, redone)).toBe(true);
    expect(recommendedNext(['basis', 'next'], [first, second], redone)?.id).toBe('next');
  });

  test('a legacy reopened topic with no manualAt does not wedge the path', () => {
    const first: TopicNode = {
      ...node,
      primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] },
    };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const ctx: TopicContext = {
      attempts: [
        { ...attempt('a1/basis', 1), itemId: 'one' },
        { ...attempt('a1/basis', 2), itemId: 'two' },
      ],
      cards: {},
      topics: { basis: { readAt: 1, manual: 'reopened' } }, // no manualAt (v1/v2 snapshot)
    };

    expect(pathDone(first, ctx)).toBe(true);
    expect(recommendedNext(['basis', 'next'], [first, second], ctx)?.id).toBe('next');
  });

  test('a self-assessed "learned" topic advances the path without being badged mastered', () => {
    const first = { ...node, primaryPractice: { setId: 'a1/basis', itemIds: ['one', 'two'] } };
    const second = { ...node, id: 'next', path: '/topics/a1/next', exerciseSets: ['a1/next'] };
    const ctx: TopicContext = {
      attempts: [{ ...attempt('a1/basis', 1), itemId: 'one' }],
      cards: {},
      topics: { basis: { readAt: 1, manual: 'learned' } },
    };

    expect(lessonCompleted(first, ctx)).toBe(false);
    expect(topicCompletion(first, ctx).tier).toBe('practiced'); // the badge stays honest
    expect(pathDone(first, ctx)).toBe(true); // navigation takes the learner at their word
    expect(recommendedNext(['basis', 'next'], [first, second], ctx)?.id).toBe('next');
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
