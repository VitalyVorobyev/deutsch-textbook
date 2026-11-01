/**
 * A topic's review is derived from its files' ledger statuses (ADR 0014). Every fixture states the
 * statuses its assertion depends on; nothing here reads the live ledger.
 */
import { describe, expect, test } from 'bun:test';
import { topicFiles, topicReviews, type FileStatusInput } from '@da/content/topic-review';

const TOPIC = { id: 't', file: 'content/topics/a1/t.topic.yaml' };
const ELEMENTS = [
  { topic: 't', file: 'content/topics/a1/t.mdx' },
  { topic: 't', file: 'content/exercises/a1/t-praxis.yaml' },
  // Two elements in one file: the file is read once, so it counts once.
  { topic: 't', file: 'content/exercises/a1/t-praxis.yaml' },
  // An absence has no file of its own to read.
  { topic: 't', file: 'data/listening-plan.yaml', planned: true as const },
  { topic: 'other', file: 'content/exercises/a1/other.yaml' },
];

const all = (status: FileStatusInput['status']): FileStatusInput[] =>
  topicFiles(TOPIC, ELEMENTS).map((file) => ({ file, status }));

describe('topic review from the ledger', () => {
  test('a topic owns its manifest and each file of its own elements, once, planned ones excluded', () => {
    expect(topicFiles(TOPIC, ELEMENTS)).toEqual([
      'content/topics/a1/t.topic.yaml',
      'content/topics/a1/t.mdx',
      'content/exercises/a1/t-praxis.yaml',
    ]);
  });

  test('reviewed only when every file is owner-reviewed', () => {
    expect(topicReviews([TOPIC], ELEMENTS, all('owner-reviewed')).get('t')).toMatchObject({
      reviewed: true,
      ownerReviewed: 3,
    });
  });

  test('one file changed since review, or merely handed over by Claude, keeps the topic a draft', () => {
    for (const status of ['geaendert', 'claude-reviewed', 'entwurf'] as const) {
      const statuses = all('owner-reviewed').map((row) =>
        row.file.endsWith('t-praxis.yaml') ? { ...row, status } : row,
      );
      expect(topicReviews([TOPIC], ELEMENTS, statuses).get('t')).toMatchObject({
        reviewed: false,
        ownerReviewed: 2,
      });
    }
  });

  test('a file the ledger has never seen is a draft', () => {
    expect(topicReviews([TOPIC], ELEMENTS, []).get('t')?.reviewed).toBe(false);
  });
});
