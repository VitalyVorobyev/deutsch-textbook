import { describe, expect, test } from 'bun:test';
import { FOLD_MIN_RUN, foldableMasteredRun, overviewChips } from '../src/components/atlas/course';
import type { Tier, TopicEvidence } from '../src/lib/mastery';

const evidence = (over: Partial<TopicEvidence> = {}): TopicEvidence => ({
  read: false, practiced: false, spaced: false, hasVocab: false, vocab: false, ...over,
});

describe('foldableMasteredRun', () => {
  test('counts only the leading consecutive mastered run', () => {
    const tiers: Tier[] = ['mastered', 'mastered', 'mastered', 'practiced', 'mastered'];
    expect(foldableMasteredRun(tiers)).toBe(3);
  });

  test('a mastered topic after the first open one never folds', () => {
    // Folding it would break the "first visible row after a fold of n is n+1" rule.
    expect(foldableMasteredRun(['mastered', 'mastered', 'read', 'mastered', 'mastered'])).toBe(2);
  });

  test('a run below FOLD_MIN_RUN reports 0 — a one-row summary saves nothing', () => {
    expect(FOLD_MIN_RUN).toBe(2);
    expect(foldableMasteredRun([])).toBe(0);
    expect(foldableMasteredRun(['mastered'])).toBe(0);
    expect(foldableMasteredRun(['mastered', 'practiced', 'mastered', 'mastered'])).toBe(0);
  });

  test('a level with no leading mastered topic reports 0', () => {
    expect(foldableMasteredRun(['practiced', 'mastered', 'mastered'])).toBe(0);
    expect(foldableMasteredRun(['untouched', 'untouched'])).toBe(0);
  });

  test('a fully mastered level folds entirely', () => {
    expect(foldableMasteredRun(['mastered', 'mastered', 'mastered'])).toBe(3);
  });
});

describe('overviewChips', () => {
  test('a mastered row shows no chips — the badge already implies them all', () => {
    const full = evidence({ read: true, practiced: true, spaced: true, hasVocab: true, vocab: true });
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
    const full = evidence({ read: true, practiced: true, spaced: true, hasVocab: true, vocab: true });
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
