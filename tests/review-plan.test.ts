import { describe, expect, test } from 'bun:test';
import { planReview, type ReviewContext, type ReviewGate } from '../src/lib/decks';
import type { TopicNode } from '../src/lib/mastery';
import type { CardDef } from '../src/lib/srs';
import type { StoredCard } from '../src/lib/store';

const topicNode = (id: string, deckId: string): TopicNode => ({
  id, path: `/topics/a1/${id}`, level: 'A1', kind: 'grammar',
  title_de: id, title_en: id, title_ru: id, prerequisites: [],
  exerciseSets: [`a1/${id}`], vocabIds: [deckId], readingIds: [], pretestId: `a1/${id}-pretest`,
});

const basis = topicNode('basis', 'basis-deck');
const zweit = topicNode('zweit', 'zweit-deck');
const gate: ReviewGate = {
  spine: ['basis', 'zweit'],
  nodes: [basis, zweit],
  deckLevels: { 'basis-deck': 'A1', 'zweit-deck': 'A1' },
};

const card = (deckId: string, de: string, dir: 'de-x' | 'x-de' = 'de-x'): CardDef => ({
  id: `${deckId}::${de}::${dir}`, deckId, dir, de, en: 'word', ru: 'слово',
  exampleDe: 'Ein Wort.', exampleEn: 'A word.', exampleRu: 'Слово.', pos: 'noun',
});

/** Both flashcards a vocabulary entry produces — recognition and production. */
const bothDirections = (deckId: string, de: string): CardDef[] =>
  [card(deckId, de, 'de-x'), card(deckId, de, 'x-de')];

/** a graded card whose review fell due `daysAgo` days ago */
const dueState = (daysAgo: number): StoredCard => ({
  due: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  stability: 1, difficulty: 5, elapsed_days: 1, scheduled_days: 1,
  learning_steps: 0, reps: 2, lapses: 0, state: 2,
});

/** ctx with the basis topic opened, so basis-deck fresh cards are eligible */
const ctx = (cards: Record<string, StoredCard>): ReviewContext => ({
  attempts: [], cards, topics: { basis: { readAt: 1 } },
});

const fresh = (n: number, deckId = 'basis-deck') =>
  Array.from({ length: n }, (_, i) => card(deckId, `Neu${i}`));

describe('planReview', () => {
  test('counts always agree: total === queue.length === dueCount + freshCount', () => {
    const dueCards = [card('basis-deck', 'Alt0'), card('basis-deck', 'Alt1')];
    const states = { [dueCards[0].id]: dueState(2), [dueCards[1].id]: dueState(1) };
    const plan = planReview([...dueCards, ...fresh(4)], gate, ctx(states), { newLimit: 3 });
    expect(plan.total).toBe(plan.queue.length);
    expect(plan.total).toBe(plan.dueCount + plan.freshCount);
    expect(plan.dueCount).toBe(2);
    expect(plan.freshCount).toBe(3);
    expect(plan.dueRemaining).toBe(0);
  });

  test('due cards come first, most overdue first', () => {
    const older = card('basis-deck', 'Uralt');
    const newer = card('basis-deck', 'Neulich');
    const states = { [older.id]: dueState(5), [newer.id]: dueState(1) };
    const plan = planReview([newer, older, ...fresh(1)], gate, ctx(states), { newLimit: 1 });
    expect(plan.queue.map((c) => c.de)).toEqual(['Uralt', 'Neulich', 'Neu0']);
  });

  // Showing "Brot → bread" and then "bread → Brot" hands the learner the answer
  // to the card they are about to be asked to produce.
  test('the two directions of a word never sit next to each other', () => {
    const cards = ['Brot', 'Milch', 'Apfel', 'Wasser', 'Käse', 'Butter'].flatMap((de) =>
      bothDirections('basis-deck', de),
    );
    for (let run = 0; run < 20; run++) {
      const queue = planReview(cards, gate, ctx({}), { newLimit: 12 }).queue;
      expect(queue.length).toBe(12);
      for (let i = 1; i < queue.length; i++) {
        const previous = queue[i - 1]!;
        const current = queue[i]!;
        expect(`${current.deckId}::${current.de}`).not.toBe(`${previous.deckId}::${previous.de}`);
      }
    }
  });

  test('a due card and a fresh card of the same word are separated too', () => {
    const [recognition, production] = bothDirections('basis-deck', 'Brot');
    // recognition is graded and due; production has never been seen — they would
    // otherwise meet exactly at the due/fresh seam.
    const filler = ['Milch', 'Apfel', 'Wasser'].flatMap((de) => bothDirections('basis-deck', de));
    const plan = planReview(
      [recognition!, production!, ...filler],
      gate,
      ctx({ [recognition!.id]: dueState(3) }),
      { newLimit: 7 },
    );
    const positions = plan.queue.map((c) => c.id);
    expect(Math.abs(positions.indexOf(recognition!.id) - positions.indexOf(production!.id))).toBeGreaterThan(1);
  });

  test('a queue too small to separate a word still keeps both cards', () => {
    const cards = bothDirections('basis-deck', 'Brot');
    const plan = planReview(cards, gate, ctx({}), { newLimit: 2 });
    expect(plan.queue.length).toBe(2);
    expect(plan.total).toBe(2);
  });

  test('the fresh order is not the same every session', () => {
    const cards = Array.from({ length: 12 }, (_, i) => card('basis-deck', `Neu${i}`));
    const orders = new Set(
      Array.from({ length: 25 }, () =>
        planReview(cards, gate, ctx({}), { newLimit: 12 }).queue.map((c) => c.de).join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  test('random ties never disturb the overdue ranking', () => {
    const cards = ['Alt', 'Mittel', 'Frisch'].map((de) => card('basis-deck', de));
    const states = {
      [cards[0]!.id]: dueState(9), [cards[1]!.id]: dueState(5), [cards[2]!.id]: dueState(1),
    };
    for (let run = 0; run < 10; run++) {
      const plan = planReview(cards, gate, ctx(states), { newLimit: 0 });
      expect(plan.queue.map((c) => c.de)).toEqual(['Alt', 'Mittel', 'Frisch']);
    }
  });

  test('always policy fills fresh up to newLimit', () => {
    const plan = planReview(fresh(10), gate, ctx({}), { newLimit: 4 });
    expect(plan.freshCount).toBe(4);
    expect(plan.dueCount).toBe(0);
    expect(plan.total).toBe(4);
  });

  test('top-up with nothing due adds no fresh cards (SessionFlow skips to training)', () => {
    const plan = planReview(fresh(10), gate, ctx({}), {
      newLimit: 15, maxDue: 15, maxTotal: 15, freshPolicy: { kind: 'top-up', minDue: 5 },
    });
    expect(plan.total).toBe(0);
    expect(plan.queue).toEqual([]);
  });

  test('top-up below minDue tops the queue up with fresh cards', () => {
    const dueCards = [card('basis-deck', 'Alt0'), card('basis-deck', 'Alt1')];
    const states = { [dueCards[0].id]: dueState(1), [dueCards[1].id]: dueState(1) };
    const plan = planReview([...dueCards, ...fresh(20)], gate, ctx(states), {
      newLimit: 15, maxDue: 15, maxTotal: 15, freshPolicy: { kind: 'top-up', minDue: 5 },
    });
    expect(plan.dueCount).toBe(2);
    expect(plan.freshCount).toBe(13); // maxTotal − dueCount
    expect(plan.total).toBe(15);
  });

  test('top-up at or above minDue adds no fresh cards', () => {
    const dueCards = Array.from({ length: 5 }, (_, i) => card('basis-deck', `Alt${i}`));
    const states = Object.fromEntries(dueCards.map((c) => [c.id, dueState(1)]));
    const plan = planReview([...dueCards, ...fresh(20)], gate, ctx(states), {
      newLimit: 15, maxDue: 15, maxTotal: 15, freshPolicy: { kind: 'top-up', minDue: 5 },
    });
    expect(plan.dueCount).toBe(5);
    expect(plan.freshCount).toBe(0);
    expect(plan.total).toBe(5);
  });

  test('maxTotal caps the due queue and dueRemaining counts the cutoff', () => {
    const dueCards = Array.from({ length: 8 }, (_, i) => card('basis-deck', `Alt${i}`));
    const states = Object.fromEntries(dueCards.map((c) => [c.id, dueState(1)]));
    const plan = planReview([...dueCards, ...fresh(5)], gate, ctx(states), {
      newLimit: 15, maxDue: 6, maxTotal: 6,
    });
    expect(plan.dueCount).toBe(6);
    expect(plan.freshCount).toBe(0); // 'always', but maxTotal is already spent on due
    expect(plan.dueRemaining).toBe(2);
    expect(plan.total).toBe(6);
  });

  test('gate excludes fresh cards from unopened decks', () => {
    const dueBasis = card('basis-deck', 'Alt');
    const states = { [dueBasis.id]: dueState(1) };
    const plan = planReview(
      [dueBasis, ...fresh(2, 'basis-deck'), ...fresh(2, 'zweit-deck')],
      gate,
      ctx(states),
      { newLimit: 15 },
    );
    expect(plan.dueCount).toBe(1);
    // zweit is unopened and has no graded cards → only basis-deck fresh is eligible
    expect(plan.freshCount).toBe(2);
    expect(plan.queue.slice(1).every((c) => c.deckId === 'basis-deck')).toBe(true);
  });
});
