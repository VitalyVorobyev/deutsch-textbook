/**
 * The placement tests as *shipped content*, driven through the real library functions.
 *
 * `tests/placement.test.ts` pins the rules on fixtures; this file asks the question those
 * fixtures cannot: does taking the actual A1 test actually move the actual course? It is
 * the end-to-end check for a feature whose whole job is to change what the learner is
 * shown next, and every claim below would otherwise rest on reading the code.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { exerciseSetSchema } from '../src/lib/schemas';
import { getCurriculum } from '../src/lib/curriculum';
import { placementResults } from '../src/lib/placement';
import { eligibleFreshCards } from '../src/lib/decks';
import {
  levelPathDone,
  levelRemaining,
  recommendedNext,
  topicTier,
  pathDone,
  type TopicContext,
  type TopicNode,
} from '../src/lib/mastery';
import type { Attempt, TopicsState } from '../src/lib/store';
import type { CardDef } from '../src/lib/srs';

const curriculum = getCurriculum();
const outcomeTopics = Object.fromEntries(
  curriculum.nodes.flatMap((n) => n.outcomes.map((o) => [o.id, n.id])),
);

const nodes: TopicNode[] = curriculum.nodes.map((n) => ({
  id: n.id,
  path: `/topics/${n.level.toLowerCase()}/${n.id}`,
  level: n.level,
  kind: n.kind,
  title_de: n.id,
  title_en: n.id,
  title_ru: n.id,
  prerequisites: n.prerequisites,
  exerciseSets: [],
  vocabIds: [`deck-${n.id}`],
  readingIds: [],
}));
const spine = curriculum.spine;

function loadPlacement(level: string) {
  const setId = `${level}/placement-${level}`;
  const file = join(process.cwd(), 'content', 'exercises', `${setId}.yaml`);
  const set = exerciseSetSchema.parse(YAML.parse(readFileSync(file, 'utf8')));
  return {
    setId,
    level: level.toUpperCase(),
    items: set.items.map((i) => ({ id: i.id, type: i.type, outcomes: i.outcomes })),
  };
}

/** Answer every item, `wrongTopics` getting a wrong answer on every one of their items. */
function take(
  p: ReturnType<typeof loadPlacement>,
  wrongTopics: string[] = [],
): Attempt[] {
  const wrong = new Set(wrongTopics);
  return p.items.map((item, n) => ({
    setId: p.setId,
    itemId: item.id,
    itemType: item.type,
    correct: !wrong.has(outcomeTopics[item.outcomes[0]!]!),
    given: 'x',
    ts: 1000 + n,
  }));
}

const apply = (summary: ReturnType<typeof placementResults>, setId: string): TopicsState =>
  Object.fromEntries(
    (summary?.topics ?? [])
      .filter((row) => row.placed)
      .map((row) => [row.topicId, { placement: { setId, at: 2000, score: row.ratio } }]),
  );

describe('the shipped A1 placement test, end to end', () => {
  const p = loadPlacement('a1');
  const a1Topics = nodes.filter((n) => n.level === 'A1').map((n) => n.id);

  test('covers every A1 topic at least twice and nothing outside A1', () => {
    const perTopic = new Map<string, number>();
    for (const item of p.items) {
      const topicId = outcomeTopics[item.outcomes[0]!];
      expect(topicId).toBeDefined();
      perTopic.set(topicId!, (perTopic.get(topicId!) ?? 0) + 1);
    }
    expect([...perTopic.keys()].sort()).toEqual([...a1Topics].sort());
    for (const [topicId, count] of perTopic) expect([topicId, count >= 2]).toEqual([topicId, true]);
  });

  test('a perfect run places all ten topics and hands the learner to A2', () => {
    const attempts = take(p);
    const summary = placementResults(p.items, attempts, p.setId, 'A1', outcomeTopics)!;
    expect(summary.topics.filter((r) => r.placed)).toHaveLength(a1Topics.length);

    const ctx: TopicContext = { attempts, cards: {}, topics: apply(summary, p.setId) };
    expect(levelPathDone('A1', nodes, ctx)).toBe(true);
    expect(levelRemaining('A1', nodes, ctx)).toBe(0);
    // The next lesson is the first A2 topic in the spine, not "nothing" and not an A1 one.
    const next = recommendedNext(spine, nodes, ctx);
    expect(next?.level).toBe('A2');
    expect(next?.id).toBe(spine.find((id) => nodes.find((n) => n.id === id)?.level === 'A2'));
  });

  test('…while the measured badge stays untouched for every one of them', () => {
    const attempts = take(p);
    const summary = placementResults(p.items, attempts, p.setId, 'A1', outcomeTopics)!;
    const ctx: TopicContext = { attempts, cards: {}, topics: apply(summary, p.setId) };
    // The whole "green but never a tier" contract, checked against real content: not one
    // of the ten topics gained a tier, so no mastery counter can move.
    for (const node of nodes.filter((n) => n.level === 'A1')) {
      expect([node.id, topicTier(node, ctx)]).toEqual([node.id, 'untouched']);
    }
  });

  test('a topic that is failed stays on the path and becomes the next lesson', () => {
    // Fail exactly the topics before and including `akkusativ`, pass the rest.
    const failed = 'akkusativ';
    const attempts = take(p, [failed]);
    const summary = placementResults(p.items, attempts, p.setId, 'A1', outcomeTopics)!;
    const placed = summary.topics.filter((r) => r.placed).map((r) => r.topicId);
    expect(placed).not.toContain(failed);
    expect(placed).toHaveLength(a1Topics.length - 1);

    const ctx: TopicContext = { attempts, cards: {}, topics: apply(summary, p.setId) };
    expect(levelPathDone('A1', nodes, ctx)).toBe(false);
    expect(pathDone(nodes.find((n) => n.id === failed)!, ctx)).toBe(false);
    expect(recommendedNext(spine, nodes, ctx)?.id).toBe(failed);
  });

  test('abandoning the test places only the topics that were finished', () => {
    // Completeness is asked per TOPIC, not per set — so stopping partway through is not
    // all-or-nothing. The first two items are the whole of erste-schritte, so that topic
    // is genuinely decided and does place; the third opens praesens-wortstellung without
    // finishing it, and a topic with an unanswered item can never place however well the
    // answered ones went.
    const partial = take(p).slice(0, 3);
    const summary = placementResults(p.items, partial, p.setId, 'A1', outcomeTopics)!;
    const placed = summary.topics.filter((r) => r.placed).map((r) => r.topicId);
    expect(placed).toEqual(['erste-schritte']);

    const started = summary.topics.find((r) => r.topicId === 'praesens-wortstellung')!;
    expect(started.answered).toBe(1);
    expect(started.answered).toBeLessThan(started.items);
    expect(started.placed).toBe(false);
  });

  test('placing out of A1 releases fresh cards, which readAt alone would have frozen', () => {
    const attempts = take(p);
    const summary = placementResults(p.items, attempts, p.setId, 'A1', outcomeTopics)!;
    const ctx: TopicContext = { attempts, cards: {}, topics: apply(summary, p.setId) };

    const owned: CardDef = { id: 'deck-akkusativ::x::de-x', deckId: 'deck-akkusativ' } as CardDef;
    const unowned: CardDef = { id: 'wortliste-a1::y::de-x', deckId: 'wortliste-a1' } as CardDef;
    const levels = { 'deck-akkusativ': 'A1', 'wortliste-a1': 'A1' };

    const empty: TopicContext = { attempts: [], cards: {}, topics: {} };
    expect(eligibleFreshCards([owned, unowned], spine, nodes, levels, empty)).toHaveLength(0);
    expect(eligibleFreshCards([owned, unowned], spine, nodes, levels, ctx)).toHaveLength(2);
  });
});

describe('the shipped A2 placement test, end to end', () => {
  const p = loadPlacement('a2');
  const a2Topics = nodes.filter((n) => n.level === 'A2').map((n) => n.id);

  test('covers every A2 topic at least twice and nothing outside A2', () => {
    const perTopic = new Map<string, number>();
    for (const item of p.items) {
      const topicId = outcomeTopics[item.outcomes[0]!];
      perTopic.set(topicId!, (perTopic.get(topicId!) ?? 0) + 1);
    }
    expect([...perTopic.keys()].sort()).toEqual([...a2Topics].sort());
    for (const [topicId, count] of perTopic) expect([topicId, count >= 2]).toEqual([topicId, true]);
  });

  test('passing both levels leaves no lesson on the path at all', () => {
    const a1 = loadPlacement('a1');
    const attempts = [...take(a1), ...take(p)];
    const topics: TopicsState = {
      ...apply(placementResults(a1.items, attempts, a1.setId, 'A1', outcomeTopics), a1.setId),
      ...apply(placementResults(p.items, attempts, p.setId, 'A2', outcomeTopics), p.setId),
    };
    const ctx: TopicContext = { attempts, cards: {}, topics };
    expect(levelPathDone('A1', nodes, ctx)).toBe(true);
    expect(levelPathDone('A2', nodes, ctx)).toBe(true);
    expect(recommendedNext(spine, nodes, ctx)).toBeUndefined();
  });
});
