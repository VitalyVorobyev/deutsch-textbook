import { describe, expect, test } from 'bun:test';
import { BROAD_RETRIEVAL_SHARE, buildSession, type TrainingSet } from '../src/lib/training';
import type { Attempt } from '../src/lib/store';
import type { ExerciseItem } from '../src/lib/schemas';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_780_000_000_000;

const mc = (id: string): ExerciseItem =>
  ({ id, type: 'mc', outcomes: [], preview: false, prompt: '?', options: ['a', 'b'], correct: 0 }) as ExerciseItem;

const set = (setId: string, topicId: string, ids: string[]): TrainingSet => ({
  setId,
  topicId,
  title_de: topicId,
  level: 'A1',
  role: 'practice',
  items: ids.map(mc),
});

const attempt = (setId: string, itemId: string, correct: boolean, ts: number): Attempt =>
  ({ setId, itemId, itemType: 'mc', correct, given: '', ts }) as Attempt;

describe('broad-retrieval share', () => {
  // An old topic answered correctly weeks ago is the material whose retention has decayed
  // most. The loud bands (wrong, weak, never-seen) can always fill a session on their own,
  // so without a reservation that old material is never seen again.
  const oldTopic = set('a1/old', 'old', ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']);
  const newTopic = set('a1/new', 'new', ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']);

  // everything in the old topic was answered correctly a month ago; the new topic is untouched
  const attempts = oldTopic.items.map((i, k) => attempt('a1/old', i.id, true, NOW - (30 - k) * DAY));

  test('never-seen items cannot take the whole session', () => {
    const queue = buildSession([oldTopic, newTopic], 8, attempts);
    const fromOld = queue.filter((q) => q.setId === 'a1/old');

    expect(queue).toHaveLength(8);
    expect(fromOld.length).toBe(Math.round(8 * BROAD_RETRIEVAL_SHARE));
    expect(fromOld.length).toBeGreaterThan(0);
  });

  test('the reserved slots go to the least recently answered', () => {
    const queue = buildSession([oldTopic, newTopic], 8, attempts);
    const fromOld = queue.filter((q) => q.setId === 'a1/old').map((q) => q.item.id);
    // o1 is the oldest attempt (NOW - 30d), o2 next
    expect(new Set(fromOld)).toEqual(new Set(['o1', 'o2']));
  });

  test('a wrong answer still outranks broad retrieval, but not to the exclusion of it', () => {
    const withWrong = [...attempts, attempt('a1/new', 'n1', false, NOW - DAY)];
    const queue = buildSession([oldTopic, newTopic], 8, withWrong);
    expect(queue.map((q) => q.item.id)).toContain('n1'); // the wrong one is served
    expect(queue.filter((q) => q.setId === 'a1/old')).toHaveLength(2); // and the share holds
  });

  test('the priority bands take the slack when there is little old material', () => {
    const tiny = set('a1/old', 'old', ['o1']);
    const queue = buildSession([tiny, newTopic], 8, [attempt('a1/old', 'o1', true, NOW - DAY)]);
    // only one old item exists — the session is still full, not short by a reserved slot
    expect(queue).toHaveLength(8);
    expect(queue.filter((q) => q.setId === 'a1/old')).toHaveLength(1);
  });

  test('broad retrieval takes the slack when the priority bands are short', () => {
    const queue = buildSession([oldTopic], 8, attempts);
    // nothing wrong, weak or unseen — the whole session is broad retrieval, not 25% of it
    expect(queue).toHaveLength(6);
  });

  test('interleaves as far as the composition allows', () => {
    const queue = buildSession([oldTopic, newTopic], 8, attempts);
    const conflicts = queue.filter((q, i) => i > 0 && q.setId === queue[i - 1]!.setId).length;

    // Six of the eight slots come from one set, so perfect alternation is arithmetically
    // impossible: a set holding c of n slots forces at least 2c − n − 1 adjacencies.
    // repairAdjacency is best-effort by design, and best is what it must reach.
    const dominant = Math.max(
      queue.filter((q) => q.setId === 'a1/new').length,
      queue.filter((q) => q.setId === 'a1/old').length,
    );
    const floor = Math.max(0, 2 * dominant - queue.length - 1);
    expect(conflicts).toBe(floor);
  });

  // The queue is shuffled, so one sample proves nothing: the old swap-based repair passed
  // this test two runs in three and still produced a same-topic pair in a third of real
  // sessions. Interleaving is only worth claiming if it holds every time.
  test('no two consecutive items share a set when the composition permits it', () => {
    const a = set('a1/a', 'a', ['a1', 'a2', 'a3', 'a4']);
    const b = set('a1/b', 'b', ['b1', 'b2', 'b3', 'b4']);
    for (let run = 0; run < 200; run++) {
      const queue = buildSession([a, b], 8, []);
      expect(queue).toHaveLength(8);
      for (let i = 1; i < queue.length; i++) {
        expect(queue[i]!.setId).not.toBe(queue[i - 1]!.setId);
      }
    }
  });

  test('three uneven sets still interleave, and no item is dropped', () => {
    const a = set('a1/a', 'a', ['a1', 'a2', 'a3', 'a4', 'a5']);
    const b = set('a1/b', 'b', ['b1', 'b2', 'b3']);
    const c = set('a1/c', 'c', ['c1', 'c2']);
    for (let run = 0; run < 200; run++) {
      const queue = buildSession([a, b, c], 10, []);
      expect(new Set(queue.map((q) => q.uid)).size).toBe(10);
      for (let i = 1; i < queue.length; i++) {
        expect(queue[i]!.setId).not.toBe(queue[i - 1]!.setId);
      }
    }
  });

  // The grain is the TOPIC, not the set. Two sets of the same topic back to back are two
  // items on the same rule back to back, whichever file they came from — and `dativ` alone
  // owns four sets. Grouping by set let exactly that through.
  test('two sets of the same topic are never served consecutively', () => {
    // dativ owns two sets but only half the items, so alternation is always reachable —
    // the queue may not reach for the second dativ set just because it is a different file.
    const dativA = set('a2/dativ', 'dativ', ['d1', 'd2']);
    const dativB = set('a2/drill-mir-mich', 'dativ', ['m1', 'm2']);
    const akkusativ = set('a1/akkusativ', 'akkusativ', ['k1', 'k2', 'k3', 'k4']);
    for (let run = 0; run < 200; run++) {
      const queue = buildSession([dativA, dativB, akkusativ], 8, []);
      expect(queue).toHaveLength(8);
      for (let i = 1; i < queue.length; i++) {
        expect(queue[i]!.topicId).not.toBe(queue[i - 1]!.topicId);
      }
    }
  });

  // A topic holding more than half the queue makes a same-topic pair arithmetically
  // unavoidable. The session must still be served in full, at the minimum possible
  // number of conflicts — not truncated to keep the invariant.
  test('a dominant set yields the unavoidable minimum of conflicts, never a short session', () => {
    const big = set('a1/big', 'big', ['x1', 'x2', 'x3', 'x4', 'x5', 'x6']);
    const small = set('a1/small', 'small', ['y1', 'y2']);
    const queue = buildSession([big, small], 8, []);
    expect(queue).toHaveLength(8);
    let conflicts = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.setId === queue[i - 1]!.setId) conflicts++;
    }
    expect(conflicts).toBe(2 * 6 - 8 - 1); // 3
  });
});
