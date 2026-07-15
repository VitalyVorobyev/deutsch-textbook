import { describe, expect, test } from 'bun:test';
import {
  armedAt,
  dueProbe,
  dueProbes,
  MAX_PROBES_PER_CATCHUP,
  MAX_PROBES_PER_SESSION,
  nextVariant,
  probeFamilies,
  probeResults,
  probesTakenToday,
  PROBE_INTERVALS_DAYS,
  remainingProbeBudget,
  servedProbes,
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

describe('visit caps — the serving is bounded, the debt is not', () => {
  const HOUR = 60 * 60 * 1000;
  // Seven families armed an hour apart → seven due probes with strictly increasing dueAt,
  // so "most overdue first" has one right answer.
  const topics = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
  const families: ProbeFamily[] = topics.map((topic) => ({
    setId: `a1/probe-${topic}`,
    topicId: topic,
    outcomes: [`${topic}-o1`],
    armingSetIds: [`a1/${topic}`],
    items: [{ id: 'v1', outcomes: [`${topic}-o1`] }],
  }));
  const log = topics.map((topic, i) =>
    attempt({ setId: `a1/${topic}`, ts: T0 + i * HOUR, outcomes: [`${topic}-o1`] }));
  // all seven 2-day probes are due; none of the 7-day ones is anywhere near
  const now = T0 + 2 * DAY + 8 * HOUR;

  test('an ordinary session serves at most 3, a catch-up visit at most 5', () => {
    expect(MAX_PROBES_PER_SESSION).toBe(3);
    expect(MAX_PROBES_PER_CATCHUP).toBe(5);
    const due = dueProbes(families, log, now);
    expect(due).toHaveLength(7);
    expect(servedProbes(due, MAX_PROBES_PER_SESSION)).toHaveLength(3);
    expect(servedProbes(due, MAX_PROBES_PER_CATCHUP)).toHaveLength(5);
    expect(servedProbes(due, 99)).toHaveLength(7); // the cap never invents probes
  });

  test('a catch-up visit drains the most overdue probes first', () => {
    const served = servedProbes(dueProbes(families, log, now), MAX_PROBES_PER_CATCHUP);
    expect(served.map((d) => d.family.topicId)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    const dueAts = served.map((d) => d.dueAt);
    expect([...dueAts].sort((a, b) => a - b)).toEqual(dueAts);
  });

  test('what the cap leaves unserved stays due — debt is deferred, never discarded', () => {
    const due = dueProbes(families, log, now);
    const served = servedProbes(due, MAX_PROBES_PER_CATCHUP);
    // derivation is pure: serving consumed nothing
    expect(dueProbes(families, log, now)).toHaveLength(7);
    // answering the served five leaves exactly the two unserved probes due
    const answered = [
      ...log,
      ...served.map((d) => attempt({ setId: d.family.setId, itemId: d.itemId, ts: now })),
    ];
    expect(dueProbes(families, answered, now).map((d) => d.family.topicId))
      .toEqual(['t6', 't7']);
  });
});

describe('daily probe budget — derived from the attempt log, never stored', () => {
  const wohnen: ProbeFamily = {
    setId: 'a1/probe-wohnen',
    topicId: 'wohnen',
    outcomes: ['wohnen-beschreiben'],
    armingSetIds: ['a1/wohnen'],
    items: [
      { id: 'v1', outcomes: ['wohnen-beschreiben'] },
      { id: 'v2', outcomes: ['wohnen-beschreiben'] },
    ],
  };
  const budgetFamilies = [family, wohnen];
  // Local-time constructors on purpose: the budget rolls over at *local* midnight — the
  // same day convention as sessions and the heatmap (localDateString in store.ts).
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 5, day, hour, minute).getTime();

  test('a full catch-up spends the budget — the card gate closes, the route serves nothing', () => {
    const catchUp = [
      attempt({ setId: family.setId, itemId: 'variant-a', ts: at(15, 9) }),
      attempt({ setId: family.setId, itemId: 'variant-b', ts: at(15, 9, 5) }),
      attempt({ setId: family.setId, itemId: 'variant-c', ts: at(15, 9, 10) }),
      attempt({ setId: wohnen.setId, itemId: 'v1', ts: at(15, 9, 15) }),
      attempt({ setId: wohnen.setId, itemId: 'v2', ts: at(15, 9, 20) }),
    ];
    expect(probesTakenToday(budgetFamilies, catchUp, at(15, 21))).toBe(5);
    expect(remainingProbeBudget(budgetFamilies, catchUp, at(15, 21))).toBe(0);
  });

  test('an ordinary session’s three probes leave a two-probe catch-up, never five more', () => {
    const session = [
      attempt({ setId: family.setId, itemId: 'variant-a', ts: at(15, 8) }),
      attempt({ setId: wohnen.setId, itemId: 'v1', ts: at(15, 8, 5) }),
      attempt({ setId: wohnen.setId, itemId: 'v2', ts: at(15, 8, 10) }),
    ];
    expect(remainingProbeBudget(budgetFamilies, session, at(15, 21))).toBe(2);
  });

  test('the budget reopens past local midnight — remaining debt drains tomorrow', () => {
    const lateNight = [
      attempt({ setId: family.setId, itemId: 'variant-a', ts: at(15, 22) }),
      attempt({ setId: family.setId, itemId: 'variant-b', ts: at(15, 22, 30) }),
      attempt({ setId: family.setId, itemId: 'variant-c', ts: at(15, 23) }),
      attempt({ setId: wohnen.setId, itemId: 'v1', ts: at(15, 23, 15) }),
      attempt({ setId: wohnen.setId, itemId: 'v2', ts: at(15, 23, 30) }),
    ];
    // 23:45 the same day: spent
    expect(remainingProbeBudget(budgetFamilies, lateNight, at(15, 23, 45))).toBe(0);
    // 00:30 the next day: a fresh budget, one hour later
    expect(probesTakenToday(budgetFamilies, lateNight, at(16, 0, 30))).toBe(0);
    expect(remainingProbeBudget(budgetFamilies, lateNight, at(16, 0, 30))).toBe(5);
  });

  test('only probe attempts spend the budget — practice and review never do', () => {
    const practiceDay = [
      attempt({ setId: 'a1/akkusativ', ts: at(15, 9) }),
      attempt({ setId: 'a1/wohnen', ts: at(15, 10), outcomes: ['wohnen-beschreiben'] }),
    ];
    expect(probesTakenToday(budgetFamilies, practiceDay, at(15, 21))).toBe(0);
    expect(remainingProbeBudget(budgetFamilies, practiceDay, at(15, 21))).toBe(5);
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

  test('presents every stage and exposes the next due timestamp without erasing a failure', () => {
    const log = [
      practised,
      attempt({ setId: family.setId, itemId: 'variant-a', ts: T0 + 4 * DAY, correct: false }),
    ];
    const [result] = probeResults([family], log, T0 + 6 * DAY);
    expect(result!.nextStage).toBe(1);
    expect(result!.nextDueAt).toBe(T0 + 7 * DAY);
    expect(result!.stages.map((stage) => stage.status)).toEqual(['failed', 'scheduled', 'later']);
    expect(result!.stages[0]!.actualDays).toBe(4);
  });

  test('marks only the next untaken stage due; later stages cannot be retried early', () => {
    const [result] = probeResults([family], [practised], T0 + 3 * DAY);
    expect(result!.stages.map((stage) => stage.status)).toEqual(['due', 'later', 'later']);
    expect(result!.nextDueAt).toBe(T0 + 2 * DAY);
  });
});
