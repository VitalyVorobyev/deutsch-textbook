/**
 * `probeFailuresOn` and `exhaustedFailed` (src/lib/probes.ts) are R1/R3 of PR-8
 * (docs/adrs/0010-probe-failure-remediation.md): the session-end remediation card's
 * "failed today" derivation, and the named state for a family with no rungs left and
 * at least one failure among the stages it took. Neither touches `dueProbe`,
 * `armedAt`, `nextVariant` or the interval ladder — this file only exercises the two
 * new pure functions, and does not modify `tests/probes.test.ts`.
 */
import { describe, expect, test } from 'bun:test';
import { exhaustedFailed, probeFailuresOn, type ProbeFamily } from '../src/lib/probes';
import type { Attempt } from '../src/lib/store';

// Local-time constructors on purpose: "today" is a *local* calendar day, the same
// convention probesTakenToday/sameLocalDay already use (see tests/probes.test.ts).
const at = (day: number, hour: number, minute = 0) => new Date(2026, 5, day, hour, minute).getTime();

const family: ProbeFamily = {
  setId: 'a1/probe-akkusativ',
  topicId: 'akkusativ',
  outcomes: ['akk-objekt-bilden'],
  focus: 'akkusativ-artikel',
  armingItemKeys: ['a1/akkusativ::x'],
  items: [
    { id: 'variant-a', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-b', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-c', outcomes: ['akk-objekt-bilden'] },
  ],
};

const other: ProbeFamily = {
  setId: 'a1/probe-dativ',
  topicId: 'dativ',
  outcomes: ['dativ-objekt-bilden'],
  focus: 'dativ-artikel',
  armingItemKeys: ['a1/dativ::x'],
  items: [
    { id: 'variant-a', outcomes: ['dativ-objekt-bilden'] },
    { id: 'variant-b', outcomes: ['dativ-objekt-bilden'] },
    { id: 'variant-c', outcomes: ['dativ-objekt-bilden'] },
  ],
};

function attempt(over: Partial<Attempt> & { setId: string; itemId: string; ts: number; correct: boolean }): Attempt {
  return {
    itemType: 'translate',
    given: '',
    outcomes: family.outcomes,
    ...over,
  };
}

describe('probeFailuresOn', () => {
  test('a probe failed today appears, with the ladder still owing more stages', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: false, ts: at(15, 10) }),
    ];
    const failures = probeFailuresOn([family], attempts, at(15, 21));
    expect(failures).toHaveLength(1);
    expect(failures[0]!.family.setId).toBe(family.setId);
    expect(failures[0]!.failedStages).toEqual([0]);
    expect(failures[0]!.exhausted).toBe(false);
  });

  test('a wrong attempt on an earlier day does not count as failed today', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: false, ts: at(14, 10) }),
    ];
    expect(probeFailuresOn([family], attempts, at(15, 21))).toEqual([]);
  });

  test('a family with an older failure but a correct attempt today is absent — today is what matters', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: false, ts: at(14, 10) }),
      attempt({ setId: family.setId, itemId: 'variant-b', correct: true, ts: at(15, 10) }),
    ];
    expect(probeFailuresOn([family], attempts, at(15, 21))).toEqual([]);
  });

  test('a correct attempt today never appears', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: true, ts: at(15, 10) }),
    ];
    expect(probeFailuresOn([family], attempts, at(15, 21))).toEqual([]);
  });

  test("today's failure on the family's last stage is reported exhausted — the state R3 names", () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: true, ts: at(10, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-b', correct: true, ts: at(12, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-c', correct: false, ts: at(15, 10) }),
    ];
    const failures = probeFailuresOn([family], attempts, at(15, 21));
    expect(failures).toHaveLength(1);
    expect(failures[0]!.failedStages).toEqual([2]);
    expect(failures[0]!.exhausted).toBe(true);
  });

  test('only families with a wrong attempt today are reported, in the order given', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: false, ts: at(15, 9) }),
      attempt({ setId: other.setId, itemId: 'variant-a', correct: true, ts: at(15, 10) }),
    ];
    const failures = probeFailuresOn([other, family], attempts, at(15, 21));
    expect(failures.map((f) => f.family.setId)).toEqual([family.setId]);
  });
});

describe('exhaustedFailed', () => {
  test('true once every scheduled stage is taken and any one of them was wrong', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: true, ts: at(10, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-b', correct: false, ts: at(12, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-c', correct: true, ts: at(15, 9) }),
    ];
    expect(exhaustedFailed(family, attempts)).toBe(true);
  });

  test('false when every taken stage passed', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: true, ts: at(10, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-b', correct: true, ts: at(12, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-c', correct: true, ts: at(15, 9) }),
    ];
    expect(exhaustedFailed(family, attempts)).toBe(false);
  });

  test('false while stages remain, even with a wrong attempt among the ones taken', () => {
    const attempts = [
      attempt({ setId: family.setId, itemId: 'variant-a', correct: false, ts: at(10, 9) }),
    ];
    expect(exhaustedFailed(family, attempts)).toBe(false);
  });
});
