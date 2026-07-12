import { describe, expect, test } from 'bun:test';
import {
  armedAt,
  dueProbe,
  dueProbes,
  nextVariant,
  probeFamilies,
  probeResults,
  PROBE_INTERVALS_DAYS,
  type ProbeFamily,
} from '../src/lib/probes';
import type { Attempt } from '../src/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_780_000_000_000;

const family: ProbeFamily = {
  setId: 'a1/probe-akkusativ',
  topicId: 'akkusativ',
  outcomes: ['akk-objekt-bilden'],
  armingSetIds: ['a1/akkusativ'],
  items: [
    { id: 'variant-a', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-b', outcomes: ['akk-objekt-bilden'] },
    { id: 'variant-c', outcomes: ['akk-objekt-bilden'] },
  ],
};

function attempt(over: Partial<Attempt> & { setId: string; ts: number }): Attempt {
  return {
    itemId: 'x',
    itemType: 'mc',
    correct: true,
    given: '',
    outcomes: ['akk-objekt-bilden'],
    ...over,
  } as Attempt;
}

const practised = attempt({ setId: 'a1/akkusativ', ts: T0 });

describe('arming — practice starts the retention clock', () => {
  test('an outcome never practised is never probed', () => {
    expect(armedAt(family, [])).toBeUndefined();
    expect(dueProbe(family, [], T0 + 999 * DAY)).toBeUndefined();
  });

  test('arms on the first verified attempt carrying one of its outcomes', () => {
    const later = attempt({ setId: 'a1/akkusativ', ts: T0 + 3 * DAY });
    expect(armedAt(family, [later, practised])).toBe(T0);
  });

  test('unverified production does not arm — it is not evidence', () => {
    const written = attempt({ setId: 'a1/akkusativ', ts: T0, evidence: 'practice' });
    expect(armedAt(family, [written])).toBeUndefined();
  });

  test('a probe cannot arm itself', () => {
    const own = attempt({ setId: family.setId, ts: T0 });
    expect(armedAt(family, [own])).toBeUndefined();
  });

  test('attempts on unrelated outcomes do not arm it', () => {
    const other = attempt({ setId: 'a1/wohnen', ts: T0, outcomes: ['wohnen-beschreiben'] });
    expect(armedAt(family, [other])).toBeUndefined();
  });

  test('a historical attempt with no outcomes still arms via its practice set', () => {
    // 551 of the 671 attempts in the real snapshot predate the `outcomes` field. If only
    // outcomes could arm a family, a topic practised for weeks would never be probed.
    const historical = { ...attempt({ setId: 'a1/akkusativ', ts: T0 }), outcomes: undefined };
    expect(armedAt(family, [historical])).toBe(T0);
  });

  test('a pretest never arms — it is a guess taken before the lesson', () => {
    const pretest = attempt({ setId: 'a1/akkusativ-pretest', ts: T0, outcomes: undefined });
    expect(armedAt(family, [pretest])).toBeUndefined();
  });
});

describe('deriving families from the set list', () => {
  test('arms from the topic’s practice and drill sets, never its pretest or itself', () => {
    const [derived] = probeFamilies([
      { setId: 'a1/akkusativ', topicId: 'akkusativ', role: 'practice', items: [] },
      { setId: 'a1/akkusativ-pretest', topicId: 'akkusativ', role: 'pretest', items: [] },
      { setId: 'a2/drill-der-dem-den', topicId: 'akkusativ', role: 'drill', items: [] },
      { setId: 'a1/checkpoint-a1', topicId: 'akkusativ', role: 'checkpoint', items: [] },
      { setId: 'a1/wohnen', topicId: 'wohnen', role: 'practice', items: [] },
      {
        setId: 'a1/probe-akkusativ',
        topicId: 'akkusativ',
        role: 'probe',
        items: [{ id: 'variant-a', outcomes: ['akk-objekt-bilden'] }],
      },
    ]);
    expect(derived!.armingSetIds).toEqual(['a1/akkusativ', 'a2/drill-der-dem-den']);
    expect(derived!.outcomes).toEqual(['akk-objekt-bilden']);
  });
});

describe('due dates', () => {
  test('not due before the first interval', () => {
    const justBefore = T0 + PROBE_INTERVALS_DAYS[0]! * DAY - 1;
    expect(dueProbe(family, [practised], justBefore)).toBeUndefined();
  });

  test('due exactly at the interval', () => {
    const at = T0 + PROBE_INTERVALS_DAYS[0]! * DAY;
    const due = dueProbe(family, [practised], at);
    expect(due?.stage).toBe(0);
    expect(due?.overdueDays).toBe(0);
  });

  test('each interval opens only after the previous probe is taken', () => {
    const first = attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 2 * DAY });
    const log = [practised, first];

    // stage 1 is the 7-day probe, measured from arming — not from the last probe
    expect(dueProbe(family, log, T0 + 6 * DAY)).toBeUndefined();
    expect(dueProbe(family, log, T0 + 7 * DAY)?.stage).toBe(1);
  });

  test('a skipped probe runs late rather than being lost', () => {
    const due = dueProbe(family, [practised], T0 + 30 * DAY);
    expect(due?.stage).toBe(0); // still the 2-day probe — nothing was silently dropped
    expect(due?.overdueDays).toBe(28);
  });

  test('the family completes after its last interval', () => {
    const log = [
      practised,
      attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 2 * DAY }),
      attempt({ setId: family.setId, itemId: 'variant-b', ts: T0 + 7 * DAY }),
      attempt({ setId: family.setId, itemId: 'variant-c', ts: T0 + 21 * DAY }),
    ];
    expect(dueProbe(family, log, T0 + 100 * DAY)).toBeUndefined();
  });
});

describe('parallel variants — a probe is never the item it checks', () => {
  test('hands out a fresh variant each time', () => {
    let log: Attempt[] = [practised];
    const used: string[] = [];
    for (const [i, days] of PROBE_INTERVALS_DAYS.entries()) {
      const due = dueProbe(family, log, T0 + days * DAY)!;
      expect(due.stage).toBe(i);
      used.push(due.itemId);
      log = [...log, attempt({ setId: family.setId, itemId: due.itemId, ts: T0 + days * DAY })];
    }
    expect(new Set(used).size).toBe(3); // never the same variant twice
  });

  test('never re-presents a variant the learner has already answered', () => {
    const log = [practised, attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 2 * DAY })];
    expect(nextVariant(family, log)).toBe('variant-b');
  });

  test('falls back to the least recently seen when variants run out', () => {
    const two: ProbeFamily = { ...family, items: family.items.slice(0, 2) };
    const log = [
      practised,
      attempt({ setId: family.setId, itemId: 'variant-b', ts: T0 + 2 * DAY }),
      attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 7 * DAY }),
    ];
    // b was answered longest ago, so it is the better transfer check of the two
    expect(nextVariant(two, log)).toBe('variant-b');
  });
});

describe('queueing', () => {
  test('most overdue first', () => {
    const other: ProbeFamily = {
      setId: 'a1/probe-wohnen',
      topicId: 'wohnen',
      outcomes: ['wohnen-beschreiben'],
      armingSetIds: ['a1/wohnen'],
      items: [{ id: 'v1', outcomes: ['wohnen-beschreiben'] }],
    };
    const log = [
      practised, // akkusativ armed at T0
      attempt({ setId: 'a1/wohnen', ts: T0 + 5 * DAY, outcomes: ['wohnen-beschreiben'] }),
    ];
    const due = dueProbes([other, family], log, T0 + 30 * DAY);
    expect(due.map((d) => d.family.setId)).toEqual(['a1/probe-akkusativ', 'a1/probe-wohnen']);
  });
});

describe('reporting', () => {
  test('reports the real elapsed interval, not the scheduled one', () => {
    const log = [
      practised,
      attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 9 * DAY, correct: false }),
    ];
    const [result] = probeResults([family], log);
    expect(result!.taken).toEqual([
      { stage: 0, itemId: 'variant-a', correct: false, ts: T0 + 9 * DAY, days: 9 },
    ]);
    expect(result!.remaining).toBe(2);
  });
});
