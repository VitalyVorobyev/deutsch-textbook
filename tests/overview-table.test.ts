import { describe, expect, test } from 'bun:test';
import { FOLD_MIN_RUN, foldableMastered, overviewChips } from '../src/components/atlas/course';
import type { Tier, TopicEvidence } from '../src/lib/mastery';

const evidence = (over: Partial<TopicEvidence> = {}): TopicEvidence => ({
  read: false,
  practiced: false,
  spaced: false,
  hasVocab: false,
  vocab: false,
  ...over,
});

describe('foldableMastered', () => {
  const positions = (tiers: Tier[]) => [...foldableMastered(tiers)];

  test('folds every mastered row, not only a leading run', () => {
    expect(positions(['mastered', 'mastered', 'mastered', 'practiced', 'mastered'])).toEqual([
      0, 1, 2, 4,
    ]);
  });

  test('a mastered topic after an open one folds too', () => {
    expect(positions(['practiced', 'mastered', 'mastered'])).toEqual([1, 2]);
    expect(positions(['mastered', 'read', 'mastered'])).toEqual([0, 2]);
  });

  test('fewer than FOLD_MIN_RUN mastered rows fold nothing — a one-row summary saves nothing', () => {
    expect(FOLD_MIN_RUN).toBe(2);
    expect(positions([])).toEqual([]);
    expect(positions(['mastered'])).toEqual([]);
    expect(positions(['practiced', 'mastered', 'read'])).toEqual([]);
    expect(positions(['untouched', 'untouched'])).toEqual([]);
  });

  test('a fully mastered level folds entirely', () => {
    expect(positions(['mastered', 'mastered', 'mastered'])).toEqual([0, 1, 2]);
  });
});

describe('overviewChips', () => {
  test('a mastered row shows no chips — the badge already implies them all', () => {
    const full = evidence({
      read: true,
      practiced: true,
      spaced: true,
      hasVocab: true,
      vocab: true,
    });
    expect(overviewChips('mastered', full)).toEqual([]);
  });

  test('a practiced row shows only the missing metrics, as open chips', () => {
    const ev = evidence({ read: true, practiced: true, hasVocab: true });
    expect(overviewChips('practiced', ev)).toEqual([
      { label: 'evidence.spaced', state: 'open' },
      { label: 'evidence.vocab', state: 'open' },
    ]);
  });

  test('a practiced row with nothing left shows no chips (the reopened cap)', () => {
    // effectiveTier caps a reopened mastered topic at practiced; every metric
    // is earned, so there is nothing "left to do" to chip.
    const full = evidence({
      read: true,
      practiced: true,
      spaced: true,
      hasVocab: true,
      vocab: true,
    });
    expect(overviewChips('practiced', full)).toEqual([]);
  });

  test('read and untouched rows keep the full earned/missing rendering', () => {
    expect(overviewChips('read', evidence({ read: true }))).toEqual([
      { label: 'evidence.read', state: 'earned' },
      { label: 'evidence.practiced', state: 'missing' },
      { label: 'evidence.spaced', state: 'missing' },
    ]);
    expect(overviewChips('untouched', evidence())).toEqual([
      { label: 'evidence.read', state: 'missing' },
      { label: 'evidence.practiced', state: 'missing' },
      { label: 'evidence.spaced', state: 'missing' },
    ]);
  });

  test('the vocab chip exists only when the topic owns a deck', () => {
    const noDeck = overviewChips('practiced', evidence({ read: true, practiced: true }));
    expect(noDeck).toEqual([{ label: 'evidence.spaced', state: 'open' }]);
    const withDeck = overviewChips('read', evidence({ read: true, hasVocab: true, vocab: true }));
    expect(withDeck).toContainEqual({ label: 'evidence.vocab', state: 'earned' });
  });
});
