/**
 * How `buildSession` shares its priority slots out, and how a failed translation comes back.
 *
 * On a real log the band of items last answered wrong held far more items than a session has
 * slots, and filling the bands one after another gave it every slot: weak-focus items, drills
 * and never-attempted items were never dealt. `allocatePrioritySlots` caps that band at half
 * and guarantees the other two a slot each. Within the never-attempted band, what an unarmed
 * probe family waits on comes first, then sets never opened.
 *
 * Every fixture states the fields the assertions read: item type and focus, set and topic ids,
 * and each attempt's set, item, result and time.
 */
import { describe, expect, test } from 'bun:test';
import type { ExerciseItem } from '@da/schema';
import {
  RETRY_SUFFIX,
  allocatePrioritySlots,
  buildSession,
  withRetry,
  type SessionItem,
  type TopicOwnedSet,
} from '../src/lib/training';
import { AGAIN_GAP_UNFAMILIAR } from '../src/lib/requeue';
import type { Attempt } from '../src/lib/store';

const NOW = 1_780_000_000_000;
const HOUR = 3_600_000;

const mc = (id: string, focus?: string): ExerciseItem =>
  ({
    id,
    type: 'mc',
    outcomes: [],
    preview: false,
    prompt: '?',
    options: ['a', 'b'],
    correct: 0,
    focus,
  }) as ExerciseItem;

const translate = (id: string): ExerciseItem =>
  ({
    id,
    type: 'translate',
    outcomes: [],
    preview: false,
    prompt_en: id,
    prompt_ru: id,
    answer: 'Ja.',
    accept: [],
    key_tokens: ['Ja'],
  }) as ExerciseItem;

const set = (setId: string, topicId: string, items: ExerciseItem[]): TopicOwnedSet => ({
  setId,
  topicId,
  title_de: topicId,
  level: 'A2',
  role: 'practice',
  items,
});

const attempt = (
  setId: string,
  itemId: string,
  correct: boolean,
  ts: number,
  focus?: string,
): Attempt => ({ setId, itemId, itemType: 'mc', correct, given: '', ts, focus }) as Attempt;

const none = new Set<string>();

describe('allocatePrioritySlots', () => {
  test('the daily session: band 1 takes half, bands 2 and 3 are not starved', () => {
    // The real log's proportions: 80 last-wrong items, 11 weak-focus items, 547 untried.
    const take = allocatePrioritySlots(6, {
      lastWrong: 80,
      weakFocus: 11,
      untried: 547,
      fossilized: 88,
    });
    expect(take).toEqual({ lastWrong: 3, weakFocus: 2, untried: 1, fossilized: 0 });
  });

  test('the 15-item run follows the same rule, in proportion', () => {
    const take = allocatePrioritySlots(11, {
      lastWrong: 80,
      weakFocus: 11,
      untried: 547,
      fossilized: 88,
    });
    expect(take).toEqual({ lastWrong: 5, weakFocus: 5, untried: 1, fossilized: 0 });
  });

  test('a slot a band cannot fill flows on: band 3, then band 1 past its half, then band 4', () => {
    expect(
      allocatePrioritySlots(6, { lastWrong: 80, weakFocus: 0, untried: 2, fossilized: 5 }),
    ).toEqual({ lastWrong: 4, weakFocus: 0, untried: 2, fossilized: 0 });
    expect(
      allocatePrioritySlots(6, { lastWrong: 1, weakFocus: 0, untried: 2, fossilized: 5 }),
    ).toEqual({ lastWrong: 1, weakFocus: 0, untried: 2, fossilized: 3 });
    // nothing but band 1: it takes every slot, as before
    expect(
      allocatePrioritySlots(6, { lastWrong: 80, weakFocus: 0, untried: 0, fossilized: 0 }),
    ).toEqual({ lastWrong: 6, weakFocus: 0, untried: 0, fossilized: 0 });
  });

  test('never more than the slots, never more than a band has', () => {
    expect(
      allocatePrioritySlots(1, { lastWrong: 9, weakFocus: 9, untried: 9, fossilized: 9 }),
    ).toEqual({ lastWrong: 0, weakFocus: 1, untried: 0, fossilized: 0 });
    expect(
      allocatePrioritySlots(0, { lastWrong: 9, weakFocus: 9, untried: 9, fossilized: 9 }),
    ).toEqual({ lastWrong: 0, weakFocus: 0, untried: 0, fossilized: 0 });
  });
});

describe('buildSession shares the priority slots', () => {
  // 10 items answered wrong last (each once, so none is fossilizing), 4 items under a tag
  // that is weak (4 wrong attempts logged under another set), 10 never-attempted items.
  const wrong = set(
    'a2/wrong',
    'wrong',
    Array.from({ length: 10 }, (_, i) => mc(`w${i}`, 'x')),
  );
  const weak = set(
    'a2/weak',
    'weak',
    Array.from({ length: 4 }, (_, i) => mc(`k${i}`, 'schwach')),
  );
  const fresh = set(
    'a2/fresh',
    'fresh',
    Array.from({ length: 10 }, (_, i) => mc(`f${i}`)),
  );
  const log = [
    ...wrong.items.map((it, i) => attempt('a2/wrong', it.id, false, NOW - (i + 1) * HOUR)),
    ...[1, 2, 3, 4].map((k) => attempt('a2/elsewhere', `e${k}`, false, NOW - k * HOUR, 'schwach')),
  ];

  test('an 8-item session deals 3 last-wrong, 2 weak-focus and 1 never-attempted item', () => {
    // No item was answered right, so the broad-retrieval reservation has nothing to hold and
    // all 8 slots are priority slots: 4 for band 1, then the rest to bands 2 and 3.
    const queue = buildSession([wrong, weak, fresh], 8, log, {
      current: undefined,
      unarmedArmingKeys: none,
    });
    const from = (setId: string) => queue.filter((q) => q.setId === setId).length;
    expect(queue).toHaveLength(8);
    expect(from('a2/wrong')).toBe(4);
    expect(from('a2/weak')).toBe(3);
    expect(from('a2/fresh')).toBe(1);
  });
});

describe('band 3 deals what an unarmed probe family waits on first', () => {
  // Three never-attempted items, one slot each time. `opened` has an attempt on an item that
  // is no longer in the pool, so the set counts as attempted without adding a seen item.
  const opened = set('a2/opened', 'opened', [mc('plain'), mc('arming')]);
  const unopened = set('a2/unopened', 'unopened', [mc('never')]);
  const log = [attempt('a2/opened', 'gone', true, NOW - HOUR)];

  test('an item that arms a waiting family comes before everything else in band 3', () => {
    for (let run = 0; run < 20; run++) {
      const [first] = buildSession([opened, unopened], 1, log, {
        current: undefined,
        unarmedArmingKeys: new Set(['a2/opened::arming']),
      });
      expect(first!.uid).toBe('a2/opened::arming');
    }
  });

  test('then an item of a set never attempted, then the rest', () => {
    for (let run = 0; run < 20; run++) {
      const [first] = buildSession([opened, unopened], 1, log, {
        current: undefined,
        unarmedArmingKeys: none,
      });
      expect(first!.uid).toBe('a2/unopened::never');
    }
  });
});

describe('a failed translate comes back once in the same run', () => {
  const entry = (id: string, item: ExerciseItem = translate(id)): SessionItem => ({
    uid: `a2/s::${id}`,
    setId: 'a2/s',
    topicId: 't',
    title_de: 't',
    level: 'A2',
    item,
  });
  const queue = Array.from({ length: 12 }, (_, i) => entry(`i${i}`));

  test('inserted once, the flashcard gap later', () => {
    const next = withRetry(queue, 1, false);
    expect(next).toHaveLength(13);
    const at = next.findIndex((e) => e.retry);
    expect(at).toBe(1 + 1 + AGAIN_GAP_UNFAMILIAR);
    expect(next[at]!.uid).toBe(`a2/s::i1${RETRY_SUFFIX}`);
    expect(next[at]!.item).toBe(queue[1]!.item);
  });

  test('last when fewer items remain than the gap', () => {
    const next = withRetry(queue, 9, false);
    expect(next.at(-1)!.retry).toBe(true);
    expect(next.at(-1)!.uid).toBe(`a2/s::i9${RETRY_SUFFIX}`);
  });

  test('never for a right answer, another item type, a retry, or a second time', () => {
    expect(withRetry(queue, 1, true)).toBe(queue);
    const withMc = [entry('m', mc('m')), ...queue];
    expect(withRetry(withMc, 0, false)).toBe(withMc);
    const once = withRetry(queue, 1, false);
    const retryAt = once.findIndex((e) => e.retry);
    expect(withRetry(once, retryAt, false)).toBe(once);
    expect(withRetry(once, 1, false)).toBe(once);
  });
});
