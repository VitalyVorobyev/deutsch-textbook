import { describe, expect, test } from 'bun:test';
import { eligibleTrainingSets, resumedQueueIsEligible } from '../src/lib/training';
import { eligibleFreshCards } from '../src/lib/decks';
import type { TopicContext, TopicNode } from '../src/lib/mastery';
import type { CardDef } from '../src/lib/srs';

const topic: TopicNode = {
  id: 'basis', path: '/topics/a1/basis', level: 'A1', kind: 'grammar',
  title_de: 'Basis', title_en: 'Basics', title_ru: 'База', prerequisites: [],
  exerciseSets: ['a1/basis'], vocabIds: ['basis-deck'], readingIds: [], pretestId: 'a1/basis-pretest',
};
const empty: TopicContext = { attempts: [], cards: {}, topics: {} };

describe('automatic content eligibility', () => {
  test('unread recommended topics and non-training roles stay out', () => {
    const sets = [
      { setId: 'a1/basis', topicId: 'basis', role: 'practice' },
      { setId: 'a1/basis-pretest', topicId: 'basis', role: 'pretest' },
      { setId: 'a1/basis-check', topicId: 'basis', role: 'checkpoint' },
    ];
    expect(eligibleTrainingSets(sets, ['basis'], [topic], empty)).toEqual([]);
    expect(eligibleTrainingSets(sets, ['basis'], [topic], { ...empty, topics: { basis: { readAt: 1 } } }))
      .toEqual([sets[0]]);
  });

  test('historically practiced topics remain eligible without readAt', () => {
    const sets = [{ setId: 'a1/basis', topicId: 'basis', role: 'practice' }];
    const ctx: TopicContext = {
      ...empty,
      attempts: [{ setId: 'a1/basis', itemId: 'i', itemType: 'mc', correct: true, given: 'x', ts: 1 }],
    };
    expect(eligibleTrainingSets(sets, ['basis'], [topic], ctx)).toEqual(sets);
  });

  test('a restored queue is rejected when any set is no longer eligible', () => {
    expect(resumedQueueIsEligible([{ setId: 'a' }], [{ setId: 'a' }])).toBe(true);
    expect(resumedQueueIsEligible([{ setId: 'a' }, { setId: 'b' }], [{ setId: 'a' }])).toBe(false);
  });

  test('fresh cards require an opened owner while due history stays irrelevant', () => {
    const card = (deckId: string): CardDef => ({
      id: `${deckId}::Wort::de-x`, deckId, dir: 'de-x', de: 'Wort', en: 'word', ru: 'слово',
      exampleDe: 'Ein Wort.', exampleEn: 'A word.', exampleRu: 'Слово.', pos: 'noun',
    });
    expect(eligibleFreshCards([card('basis-deck')], ['basis'], [topic], { 'basis-deck': 'A1' }, empty)).toEqual([]);
    expect(eligibleFreshCards([card('basis-deck')], ['basis'], [topic], { 'basis-deck': 'A1' }, { ...empty, topics: { basis: { readAt: 1 } } })).toHaveLength(1);
    expect(eligibleFreshCards([card('unowned')], ['basis'], [topic], { unowned: 'A1' }, { ...empty, topics: { basis: { readAt: 1 } } })).toHaveLength(1);
  });
});
