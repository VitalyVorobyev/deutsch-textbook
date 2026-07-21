import { describe, expect, test } from 'bun:test';
import { placementResults, PLACEMENT_PASS_RATIO } from '../src/lib/placement';
import type { CheckpointItemRef } from '../src/lib/checkpoint';
import {
  MASTERY_ACCURACY,
  pathDone,
  topicCompletion,
  topicEvidence,
  topicTier,
  levelPathDone,
  type TopicContext,
  type TopicNode,
} from '../src/lib/mastery';
import { barColor, GOOD_RATIO } from '../src/lib/bars';
import { eligibleFreshCards } from '../src/lib/decks';
import type { Attempt, TopicsState } from '../src/lib/store';
import type { CardDef } from '../src/lib/srs';

const SET = 'a1/placement-a1';

const item = (id: string, outcome: string, type = 'cloze'): CheckpointItemRef => ({
  id,
  type,
  outcomes: [outcome],
});

const attempt = (itemId: string, correct: boolean, ts = 1): Attempt => ({
  setId: SET,
  itemId,
  itemType: 'cloze',
  correct,
  given: 'x',
  ts,
});

// two items each for two topics — the validator's minimum
const ITEMS = [
  item('a1', 'greet'),
  item('a2', 'greet'),
  item('b1', 'conjugate'),
  item('b2', 'conjugate'),
];
const OUTCOME_TOPICS = { greet: 'erste-schritte', conjugate: 'praesens' };

const results = (attempts: Attempt[]) =>
  placementResults(ITEMS, attempts, SET, 'A1', OUTCOME_TOPICS);

const rowFor = (attempts: Attempt[], topicId: string) =>
  results(attempts)?.topics.find((row) => row.topicId === topicId);

describe('placementResults — the per-topic verdict', () => {
  test('is null until the set has been attempted at all', () => {
    expect(results([])).toBeNull();
    // …and distinguishes that from "taken and failed everything"
    const failed = results([
      attempt('a1', false), attempt('a2', false),
      attempt('b1', false), attempt('b2', false),
    ]);
    expect(failed).not.toBeNull();
    expect(failed!.topics.every((row) => !row.placed)).toBe(true);
  });

  test('places a topic only when every one of its items was answered', () => {
    // 1/1 correct but the topic's second item never answered: the sample the verdict
    // would rest on is one item the learner happened to know, which is the abandoned-
    // halfway hole. ratio divides by items, not by answered, so it reads 0.5.
    const half = rowFor([attempt('a1', true)], 'erste-schritte')!;
    expect(half.answered).toBe(1);
    expect(half.items).toBe(2);
    expect(half.ratio).toBe(0.5);
    expect(half.placed).toBe(false);

    const whole = rowFor([attempt('a1', true), attempt('a2', true)], 'erste-schritte')!;
    expect(whole.placed).toBe(true);
  });

  test('at the two-item minimum, passing means both right', () => {
    const one = rowFor([attempt('a1', true), attempt('a2', false)], 'erste-schritte')!;
    expect(one.ratio).toBe(0.5);
    expect(one.placed).toBe(false);
  });

  test('the placement bar, the mastery bar and the green bar are one number', () => {
    // Three surfaces render green off this threshold. If they ever disagree, a learner sees
    // a green bar next to a topic the same screen refuses to place, and neither is wrong.
    expect(PLACEMENT_PASS_RATIO).toBe(GOOD_RATIO);
    expect(MASTERY_ACCURACY).toBe(GOOD_RATIO);
    expect(barColor(GOOD_RATIO)).toBe('bg-emerald-500');
    expect(barColor(GOOD_RATIO - 0.01)).not.toBe('bg-emerald-500');
  });

  test('scores each topic independently — one placed, one not', () => {
    const taken = results([
      attempt('a1', true), attempt('a2', true),
      attempt('b1', true), attempt('b2', false),
    ])!;
    expect(taken.topics.find((r) => r.topicId === 'erste-schritte')!.placed).toBe(true);
    expect(taken.topics.find((r) => r.topicId === 'praesens')!.placed).toBe(false);
    expect(taken.answered).toBe(4);
    expect(taken.total).toBe(4);
  });

  test('a retake replaces the earlier answer, it never averages', () => {
    const attempts = [
      attempt('a1', false, 1), attempt('a2', false, 1),
      attempt('a1', true, 2), attempt('a2', true, 2),
    ];
    expect(rowFor(attempts, 'erste-schritte')!.placed).toBe(true);
  });

  test('unverified practice evidence never counts toward a verdict', () => {
    const practice: Attempt[] = [
      { ...attempt('a1', true), evidence: 'practice' },
      { ...attempt('a2', true), evidence: 'practice' },
    ];
    const row = rowFor(practice, 'erste-schritte')!;
    expect(row.answered).toBe(0);
    expect(row.placed).toBe(false);
  });

  test('write/speak items are excluded rather than left permanently unanswered', () => {
    // The validator rejects them, but an imported snapshot or a set authored before that
    // rule must not be able to wedge a topic at "can never be fully answered".
    const withWrite = [...ITEMS, item('a3', 'greet', 'write')];
    const summary = placementResults(
      withWrite,
      [attempt('a1', true), attempt('a2', true)],
      SET,
      'A1',
      OUTCOME_TOPICS,
    )!;
    expect(summary.total).toBe(4);
    expect(summary.topics.find((r) => r.topicId === 'erste-schritte')!.placed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Placement is a third evidence class: green on the path, invisible to the badge.
// ---------------------------------------------------------------------------

const node: TopicNode = {
  id: 'basis', path: '/topics/a1/basis', level: 'A1', kind: 'grammar',
  title_de: 'Basis', title_en: 'Basics', title_ru: 'База', prerequisites: [],
  exerciseSets: ['a1/basis'], vocabIds: ['basis-deck'], readingIds: [],
  pretestId: 'a1/basis-pretest',
};

const placed = { setId: SET, at: 10, score: 1 };

describe('placement as evidence', () => {
  const ctx: TopicContext = { attempts: [], cards: {}, topics: { basis: { placement: placed } } };

  test('takes the topic off the recommended path', () => {
    expect(pathDone(node, { attempts: [], cards: {}, topics: {} })).toBe(false);
    expect(pathDone(node, ctx)).toBe(true);
    expect(levelPathDone('A1', [node], ctx)).toBe(true);
  });

  test('never raises the measured tier', () => {
    // Structural, not a special case: a role: placement set is in no topic's exercises,
    // so topicPracticeSetIds cannot see its attempts at all.
    expect(topicTier(node, ctx)).toBe('untouched');
    expect(topicCompletion(node, ctx).tier).toBe('untouched');
    expect(topicCompletion(node, ctx).placement).toEqual(placed);
    expect(topicEvidence(node, ctx).placed).toBe(true);
    // and it is not one of the four mastery chips
    const evidence = topicEvidence(node, ctx);
    expect([evidence.read, evidence.practiced, evidence.spaced, evidence.vocab]).toEqual(
      [false, false, false, false],
    );
  });

  test('a retake that goes better is still applicable; one that goes worse changes nothing', () => {
    // The results panel offers "apply" for exactly the rows this filter keeps, so this is the
    // rule that decides whether a learner who studied and came back can bank the improvement.
    // Latching an "already applied" flag instead would strand the very result they returned for.
    const applicable = (row: { topicId: string; ratio: number }, topics: TopicsState) => {
      const previous = topics[row.topicId]?.placement;
      return !previous || previous.score < row.ratio;
    };
    const half = { setId: SET, at: 1, score: 0.5 };
    const topics: TopicsState = { basis: { placement: half } };

    expect(applicable({ topicId: 'basis', ratio: 1 }, topics)).toBe(true);
    expect(applicable({ topicId: 'basis', ratio: 0.5 }, topics)).toBe(false);
    expect(applicable({ topicId: 'basis', ratio: 0.4 }, topics)).toBe(false);
    expect(applicable({ topicId: 'neu', ratio: 0.8 }, topics)).toBe(true);
  });

  test('an explicitly reopened topic comes back onto the path despite the placement', () => {
    const reopened: TopicContext = {
      ...ctx,
      topics: { basis: { placement: placed, manual: 'reopened', manualAt: 20 } },
    };
    expect(pathDone(node, reopened)).toBe(false);
  });
});

describe('fresh cards for a learner who placed out', () => {
  const card: CardDef = {
    id: 'basis-deck::Haus::de-x', deckId: 'basis-deck', de: 'Haus',
    front: 'Haus', back: 'house', direction: 'de-x', pos: 'noun',
  } as CardDef;

  test('a placed topic opens its deck, exactly as reading it would', () => {
    const closed: TopicContext = { attempts: [], cards: {}, topics: {} };
    expect(eligibleFreshCards([card], [], [node], { 'basis-deck': 'A1' }, closed)).toHaveLength(0);

    const byPlacement: TopicContext = { attempts: [], cards: {}, topics: { basis: { placement: placed } } };
    expect(
      eligibleFreshCards([card], [], [node], { 'basis-deck': 'A1' }, byPlacement),
    ).toHaveLength(1);
  });

  test('and opens the level, so unowned Wortliste decks are dealt too', () => {
    // The bug this guards: with a readAt-only gate, a learner who placed out of everything
    // had no opened level, so openedLevels was empty and the completion decks — which no
    // topic owns — dealt nothing, forever.
    const unowned: CardDef = { ...card, id: 'wortliste::Tag::de-x', deckId: 'wortliste' };
    const byPlacement: TopicContext = { attempts: [], cards: {}, topics: { basis: { placement: placed } } };
    expect(
      eligibleFreshCards([unowned], [], [node], { wortliste: 'A1' }, byPlacement),
    ).toHaveLength(1);
  });
});
