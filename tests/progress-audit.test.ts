import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildAudit,
  readSnapshot,
  renderMarkdown,
  resolveSnapshotPath,
  type AuditAttempt,
  type AuditSnapshot,
  type CatalogItem,
} from '../scripts/progress-audit';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'deutsch-atlas-audit-'));
  roots.push(root);
  return root;
}

const ts = (day: number) => Date.UTC(2026, 6, day, 12);

function snapshot(over: Partial<AuditSnapshot> = {}): AuditSnapshot {
  return {
    version: 4,
    exportedAt: new Date(ts(13)).toISOString(),
    profile: 'Vitaly',
    attempts: [],
    cards: {},
    sessions: [],
    topics: {},
    ...over,
  };
}

function catalog(...items: CatalogItem[]) {
  return new Map(items.map((item) => [`${item.setId}:${item.id}`, item]));
}

describe('progress audit', () => {
  test('selects the newest snapshot or an explicit path', () => {
    const root = tempRoot();
    const dir = join(root, 'progress', 'vitaly');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-07-10.json'), '{}');
    writeFileSync(join(dir, '2026-07-13.json'), '{}');
    expect(resolveSnapshotPath(root, 'vitaly')).toBe(join(dir, '2026-07-13.json'));
    expect(resolveSnapshotPath(root, undefined, 'progress/vitaly/2026-07-10.json'))
      .toBe(join(dir, '2026-07-10.json'));
  });

  test('reads v1-v4 and supplies fields missing from legacy snapshots', () => {
    const root = tempRoot();
    for (const version of [1, 2, 3, 4]) {
      const path = join(root, `${version}.json`);
      writeFileSync(path, JSON.stringify({
        version,
        exportedAt: new Date(ts(13)).toISOString(),
        attempts: [],
        cards: {},
      }));
      const parsed = readSnapshot(path);
      expect(parsed.version).toBe(version);
      expect(parsed.sessions).toEqual([]);
      expect(parsed.topics).toEqual({});
    }
  });

  test('aggregates partial credit, response modes, cards, probes and delayed evidence', () => {
    const audit = buildAudit(snapshot({
      attempts: [
        { setId: 'a1/x', itemId: 'table', itemType: 'table', correct: false,
          correctParts: 3, totalParts: 4, given: '', responseMode: 'writing', ts: ts(1) },
        { setId: 'a1/x', itemId: 'table', itemType: 'table', correct: true,
          given: '', responseMode: 'writing', ts: ts(4) },
        { setId: 'a1/probe-x', itemId: 'variant-a', itemType: 'translate', correct: true,
          given: 'Gut.', responseMode: 'writing', ts: ts(4) },
        { setId: 'a1/x', itemId: 'speak', itemType: 'speak', correct: true,
          evidence: 'practice', given: '', responseMode: 'spoken-production', ts: ts(4) },
      ],
      cards: {
        'deck::wort::de-x': { lapses: 1 },
        'deck::wort::x-de': { lapses: 2 },
      },
    }), { snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13) });

    const table = audit.byItemType.find((row) => row.name === 'table')!;
    expect(table.score).toBe(1.75);
    expect(table.possible).toBe(2);
    expect(audit.byResponseMode.find((row) => row.name === 'spoken-production')?.verified).toBe(0);
    expect(audit.byTopic.find((row) => row.name === 'a1/x')?.attempts).toBe(3);
    expect(audit.cards.lapses).toBe(3);
    expect(audit.cards.byDirection).toEqual([
      { direction: 'de-x', cards: 1, lapses: 1 },
      { direction: 'x-de', cards: 1, lapses: 2 },
    ]);
    expect(renderMarkdown(audit)).toContain('Deck (top 10 by lapses)');
    expect(audit.delayed).toEqual({
      attempts: 1,
      correct: 1,
      probes: {
        attempts: 1,
        loggedCorrect: 1,
        currentCorrect: 1,
        focusRetained: 0,
        focusFailed: 0,
      },
    });
  });

  test('queues intact-focus and repeated rejected renderings without declaring them valid', () => {
    const item: CatalogItem = {
      setId: 'a2/perfekt',
      id: 'pizza',
      type: 'translate',
      focus: 'haben-sein',
      prompt_en: 'Yesterday we ate a pizza.',
      answer: 'Gestern haben wir eine Pizza gegessen.',
      key_tokens: ['haben', 'gegessen'],
    };
    const rejected = {
      setId: item.setId,
      itemId: item.id,
      itemType: 'translate',
      correct: false,
      given: 'Gestern haben wir die Pizza gegessen.',
      focus: 'haben-sein',
    };
    const audit = buildAudit(snapshot({ attempts: [
      { ...rejected, ts: ts(10) },
      { ...rejected, ts: ts(11) },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.gradingCandidates).toHaveLength(1);
    expect(audit.gradingCandidates[0]?.rejected[0]?.count).toBe(2);
    expect(audit.gradingCandidates[0]?.rejected[0]?.reasons).toContain(
      'all graded key tokens remain intact in the closest authored rendering',
    );
    expect(audit.counts.gradingReviewExcluded).toBe(2);
    expect(audit.focusSignals).toEqual([]);
    expect(renderMarkdown(audit)).toContain('needs linguistic review');
    expect(renderMarkdown(audit)).not.toContain('valid answer');
  });

  test('keeps review reasons on the rendering that earned them', () => {
    const item: CatalogItem = {
      setId: 'a2/perfekt', id: 'pizza', type: 'translate', focus: 'haben-sein',
      answer: 'Gestern haben wir eine Pizza gegessen.', key_tokens: ['haben', 'gegessen'],
    };
    const audit = buildAudit(snapshot({ attempts: [
      { setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
        given: 'Gestern haben wir die Pizza gegessen.', focus: 'haben-sein', ts: ts(10) },
      { setId: item.setId, itemId: item.id, itemType: 'translate', correct: false,
        given: 'Gestern sind wir eine Pizza gegessen.', focus: 'haben-sein', ts: ts(11) },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    const rows = audit.gradingCandidates[0]!.rejected;
    const queued = rows.find((row) => row.given.includes('haben'));
    expect(queued?.reasons).toContain(
      'all graded key tokens remain intact in the closest authored rendering',
    );
    expect(rows.some((row) => row.given.includes('sind'))).toBe(false);
    expect(audit.counts.gradingReviewExcluded).toBe(1);
  });

  test('mirrors grader casing when a sentence-initial key token moves', () => {
    const item: CatalogItem = {
      setId: 'a2/probe-time',
      id: 'wrong-preposition',
      type: 'translate',
      focus: 'um-am-zeit',
      answer: 'Am Donnerstag mache ich um sechs Uhr Sport.',
      accept: ['Ich mache am Donnerstag um sechs Uhr Sport.'],
      key_tokens: ['Am', 'um'],
    };
    const audit = buildAudit(snapshot({ attempts: [
      {
        setId: item.setId,
        itemId: item.id,
        itemType: 'translate',
        correct: false,
        given: 'Ich mache im Donnerstag um sechs Uhr Sport.',
        focus: item.focus,
        ts: ts(12),
      },
    ] }), { snapshotPath: 'snapshot.json', catalog: catalog(item), now: ts(13) });

    expect(audit.gradingCandidates).toEqual([]);
    expect(audit.counts.gradingReviewExcluded).toBe(0);
    expect(audit.focusSignals).toContainEqual(expect.objectContaining({
      focus: 'um-am-zeit',
      wrong: 1,
      distinctWrongItems: 1,
    }));
  });

  test('replays probe translations against the current grading contract', () => {
    const items: CatalogItem[] = [
      { setId: 'a2/probe-time', id: 'accepted', type: 'translate', focus: 'um-am-zeit',
        answer: 'Am Donnerstag mache ich um sechs Uhr Sport.',
        accept: ['Am Donnerstag um sechs Uhr mache ich Sport.'], key_tokens: ['Am', 'um'] },
      { setId: 'a2/probe-case', id: 'retained', type: 'translate',
        focus: 'trennbar-wortstellung', answer: 'Am Samstag bringt meine Freundin ihre Kinder mit.',
        key_tokens: ['bringt', 'mit'] },
      { setId: 'a2/probe-case', id: 'failed', type: 'translate', focus: 'dativ-artikel',
        answer: 'Am Samstag spreche ich mit meinen Freunden.',
        key_tokens: ['meinen', 'Freunden'] },
    ];
    const attempts: AuditAttempt[] = [
      { setId: items[0]!.setId, itemId: 'accepted', itemType: 'translate', correct: false,
        given: 'Am Donnerstag um sechs Uhr mache ich Sport.', focus: 'um-am-zeit', ts: ts(10) },
      { setId: items[1]!.setId, itemId: 'retained', itemType: 'translate', correct: false,
        given: 'Am Samstag bringt meine Freundin den Kindern mit.', ts: ts(10) },
      { setId: items[2]!.setId, itemId: 'failed', itemType: 'translate', correct: false,
        given: 'Am Samstag spreche ich mit meine Freunde.', focus: 'dativ-artikel', ts: ts(10) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(...items), now: ts(13),
    });

    expect(audit.delayed.probes).toEqual({
      attempts: 3,
      loggedCorrect: 0,
      currentCorrect: 1,
      focusRetained: 1,
      focusFailed: 1,
    });
    expect(renderMarkdown(audit)).toContain('1 correct under the current contract');
  });

  test('requires distinct items plus recency or a probe for a persistent focus', () => {
    const attempts: AuditAttempt[] = [
      { setId: 'a2/x', itemId: 'one', itemType: 'cloze', correct: false,
        given: '', focus: 'dativ-artikel', ts: ts(10) },
      { setId: 'a2/x', itemId: 'two', itemType: 'translate', correct: false,
        given: '', focus: 'dativ-artikel', ts: ts(11) },
      { setId: 'a2/x', itemId: 'two', itemType: 'translate', correct: true,
        given: '', focus: 'dativ-artikel', ts: ts(12) },
      { setId: 'a1/y', itemId: 'one', itemType: 'mc', correct: false,
        given: '', focus: 'genus', ts: ts(1) },
    ];
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13),
    });
    expect(audit.focusSignals[0]).toMatchObject({
      focus: 'dativ-artikel', status: 'persistent', distinctWrongItems: 2, recovered: true,
    });
    expect(audit.focusSignals.find((row) => row.focus === 'genus')?.status).toBe('historical');
  });

  test('is deterministic when snapshot attempts arrive in a different order', () => {
    const attempts: AuditAttempt[] = [
      { setId: 'a2/z', itemId: 'two', itemType: 'cloze', correct: false,
        given: 'z', focus: 'dativ-artikel', ts: ts(10) },
      { setId: 'a2/a', itemId: 'one', itemType: 'cloze', correct: true,
        given: 'a', focus: 'dativ-artikel', ts: ts(10) },
    ];
    const options = { snapshotPath: 'snapshot.json', catalog: catalog(), now: ts(13) };
    const forward = buildAudit(snapshot({ attempts }), options);
    const reverse = buildAudit(snapshot({ attempts: [...attempts].reverse() }), options);
    expect(reverse).toEqual(forward);
  });

  test('caps review candidates and focus signals and renders item detail on demand', () => {
    const items: CatalogItem[] = [];
    const attempts: AuditAttempt[] = [];
    for (let index = 0; index < 12; index++) {
      items.push({
        setId: 'a2/x', id: `i${index}`, type: 'translate', answer: 'Ich bin hier.',
        focus: `focus-${index}`, key_tokens: ['bin'],
      });
      attempts.push({
        setId: 'a2/x', itemId: `i${index}`, itemType: 'translate', correct: false,
        given: 'Ich bin dort.', focus: `focus-${index}`, ts: ts(10) + index,
      });
      attempts.push({
        setId: 'a2/y', itemId: `i${index}`, itemType: 'translate', correct: false,
        given: 'Ich bin dort.', focus: `focus-${index}`, ts: ts(11) + index,
      });
    }
    const audit = buildAudit(snapshot({ attempts }), {
      snapshotPath: 'snapshot.json',
      catalog: catalog(...items),
      now: ts(13),
      itemRef: 'a2/x:i0',
    });
    expect(audit.gradingCandidates).toHaveLength(10);
    expect(audit.focusSignals).toHaveLength(10);
    expect(audit.detail?.attempts).toHaveLength(1);
    expect(renderMarkdown(audit)).toContain('Item detail');
  });
});
