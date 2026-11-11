/**
 * A practised topic arms its probe families — the `topicFocusItemKeys` fallback in
 * `probeFamilies` and `armedAt` (`src/lib/probes.ts`).
 *
 * Fixtures are inline and state every field the assertions read: one topic (`akkusativ`) with a
 * practice set, a drill, a pretest and a second probe family, a neighbouring topic (`dativ`)
 * with an item under the same tag, and the family under test, whose authored arming item sits
 * in the drill.
 */
import { describe, expect, test } from 'bun:test';
import { armedAt, probeFamilies } from '../src/lib/probes';
import type { Attempt } from '../src/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_780_000_000_000;

const sets = [
  {
    setId: 'a1/akkusativ',
    topicId: 'akkusativ',
    role: 'practice',
    items: [
      { id: 'tagged', outcomes: ['akk'], focus: 'akkusativ-artikel', type: 'cloze' },
      { id: 'untagged', outcomes: ['akk'], type: 'cloze' },
      { id: 'other-tag', outcomes: ['akk'], focus: 'verb-endungen', type: 'cloze' },
      { id: 'tagged-write', outcomes: ['akk'], focus: 'akkusativ-artikel', type: 'write' },
    ],
  },
  {
    setId: 'a1/drill-akkusativ',
    topicId: 'akkusativ',
    role: 'drill',
    items: [{ id: 'authored', outcomes: ['akk'], focus: 'akkusativ-artikel', type: 'translate' }],
  },
  {
    setId: 'a1/akkusativ-pretest',
    topicId: 'akkusativ',
    role: 'pretest',
    items: [{ id: 'pre', outcomes: ['akk'], focus: 'akkusativ-artikel', type: 'mc' }],
  },
  {
    setId: 'a1/probe-akkusativ-zwei',
    topicId: 'akkusativ',
    role: 'probe',
    arming: ['a1/drill-akkusativ::authored'],
    items: [{ id: 'variant-a', outcomes: ['akk'], focus: 'akkusativ-artikel' }],
  },
  {
    setId: 'a1/dativ',
    topicId: 'dativ',
    role: 'practice',
    items: [{ id: 'tagged', outcomes: ['dat'], focus: 'akkusativ-artikel', type: 'cloze' }],
  },
  {
    setId: 'a1/probe-akkusativ',
    topicId: 'akkusativ',
    role: 'probe',
    arming: ['a1/drill-akkusativ::authored'],
    items: [{ id: 'variant-a', outcomes: ['akk'], focus: 'akkusativ-artikel' }],
  },
  {
    setId: 'a1/probe-akkusativ-ohne-tag',
    topicId: 'akkusativ',
    role: 'probe',
    arming: ['a1/drill-akkusativ::authored'],
    items: [{ id: 'variant-a', outcomes: ['akk'] }],
  },
];

const families = probeFamilies(sets);
const family = families.find((f) => f.setId === 'a1/probe-akkusativ')!;
const untaggedFamily = families.find((f) => f.setId === 'a1/probe-akkusativ-ohne-tag')!;

const attempt = (setId: string, itemId: string, ts: number, over: Partial<Attempt> = {}) =>
  ({ setId, itemId, itemType: 'cloze', correct: true, given: '', ts, ...over }) as Attempt;

describe('probeFamilies collects the topic’s items under the family’s tag', () => {
  test('practice and drill items of its own topic, scorable only', () => {
    expect(family.topicFocusItemKeys).toEqual([
      'a1/akkusativ::tagged',
      'a1/drill-akkusativ::authored',
    ]);
  });

  test('an untagged family gets none', () => {
    expect(untaggedFamily.topicFocusItemKeys).toEqual([]);
  });
});

describe('armedAt falls back to a practised topic', () => {
  test('a tagged item in the family’s topic arms it', () => {
    expect(armedAt(family, [attempt('a1/akkusativ', 'tagged', T0)])).toBe(T0);
  });

  test('an untagged item does not', () => {
    expect(armedAt(family, [attempt('a1/akkusativ', 'untagged', T0)])).toBeUndefined();
  });

  test('an item under another tag does not', () => {
    expect(armedAt(family, [attempt('a1/akkusativ', 'other-tag', T0)])).toBeUndefined();
  });

  test('the same tag in another topic does not', () => {
    expect(armedAt(family, [attempt('a1/dativ', 'tagged', T0)])).toBeUndefined();
  });

  test('a pretest does not', () => {
    expect(armedAt(family, [attempt('a1/akkusativ-pretest', 'pre', T0)])).toBeUndefined();
  });

  test('another family’s probe does not', () => {
    expect(armedAt(family, [attempt('a1/probe-akkusativ-zwei', 'variant-a', T0)])).toBeUndefined();
  });

  test('unverified open production does not', () => {
    const log = [attempt('a1/akkusativ', 'tagged-write', T0, { evidence: 'practice' })];
    expect(armedAt(family, log)).toBeUndefined();
  });

  test('the untagged family is armed by its authored list only', () => {
    expect(armedAt(untaggedFamily, [attempt('a1/akkusativ', 'tagged', T0)])).toBeUndefined();
    expect(armedAt(untaggedFamily, [attempt('a1/drill-akkusativ', 'authored', T0)])).toBe(T0);
  });
});

describe('the authored list and the fallback are one clock', () => {
  test('an earlier authored attempt wins', () => {
    const log = [
      attempt('a1/drill-akkusativ', 'authored', T0),
      attempt('a1/akkusativ', 'tagged', T0 + DAY),
    ];
    expect(armedAt(family, log)).toBe(T0);
  });

  test('answering an authored item later does not restart a running clock', () => {
    const log = [
      attempt('a1/akkusativ', 'tagged', T0),
      attempt('a1/drill-akkusativ', 'authored', T0 + 30 * DAY),
    ];
    expect(armedAt(family, log)).toBe(T0);
  });
});
