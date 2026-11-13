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
  SCAFFOLD_ORDER_MAX_WORDS,
  WORD_ORDER_FOCUS,
  allocatePrioritySlots,
  buildSession,
  scaffoldFor,
  withRetry,
  type SessionItem,
  type TopicOwnedSet,
} from '../src/lib/training';
import { AGAIN_GAP_UNFAMILIAR } from '../src/lib/requeue';
import { normalizeSentence } from '@da/grading/cloze';
import { focusIntroducedBy } from '@da/content/focus-tags';
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

  // `Ja.` is one word: too short for an order, and a gap would be the whole sentence
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

/** A translate item with exactly the fields `scaffoldFor` reads. */
const sentence = (
  answer: string,
  fields: { focus?: string; key_tokens?: string[]; accept?: string[] } = {},
): ExerciseItem =>
  ({
    id: 'x',
    type: 'translate',
    revision: 2,
    outcomes: ['o'],
    preview: false,
    prompt_en: 'meaning',
    prompt_ru: 'смысл',
    explain: { en: 'why', ru: 'почему' },
    answer,
    accept: fields.accept ?? [],
    key_tokens: fields.key_tokens ?? [],
    focus: fields.focus,
  }) as ExerciseItem;

describe('a failed translate comes back as the same sentence in a lighter form', () => {
  test('a form focus gaps the forms its key_tokens pin, punctuation outside the gap', () => {
    const scaffold = scaffoldFor(
      sentence('Ich bleibe zu Hause, weil ich keine Zeit habe.', {
        focus: 'verb-endungen',
        key_tokens: ['bleibe', 'habe'],
      }),
    );
    expect(scaffold).toMatchObject({
      type: 'cloze',
      id: 'x',
      revision: 2,
      outcomes: ['o'],
      focus: 'verb-endungen',
      text: 'Ich {{bleibe}} zu Hause, weil ich keine Zeit {{habe}}.',
      translation: { en: 'meaning', ru: 'смысл' },
      explain: { en: 'why', ru: 'почему' },
    });
    expect(scaffold!.instruction).toBeDefined();
  });

  test('a rendering that differs at one gap adds its word; a key token only a rendering has is not gapped', () => {
    const scaffold = scaffoldFor(
      sentence('Frau Winter bringt dem Arzt einen Brief.', {
        focus: 'dativ-artikel',
        key_tokens: ['dem', 'einem'],
        accept: [
          'Frau Winter bringt einem Arzt einen Brief.',
          'Dem Arzt bringt Frau Winter einen Brief.',
        ],
      }),
    );
    expect(scaffold).toMatchObject({
      type: 'cloze',
      text: 'Frau Winter bringt {{dem|einem}} Arzt einen Brief.',
    });
  });

  test('a word-order focus is an order of the sentence, and accepts every rendering its chips can build', () => {
    const scaffold = scaffoldFor(
      sentence('Gestern sind wir zu Hause geblieben.', {
        focus: 'verbzweit',
        key_tokens: ['sind'],
        accept: ['Wir sind gestern zu Hause geblieben.', 'Gestern sind wir daheim geblieben.'],
      }),
    );
    expect(scaffold).toMatchObject({
      type: 'order',
      words: ['Gestern', 'sind', 'wir', 'zu', 'Hause', 'geblieben'],
      // spelled with the chips, so the fronted `Gestern` it must use still matches; the
      // rendering with `daheim` has a word no chip carries
      accept: ['wir sind Gestern zu Hause geblieben'],
    });
    // the authored answer is what `Order` grades as its target
    if (scaffold?.type !== 'order') throw new Error('expected an order');
    expect(normalizeSentence(scaffold.words)).toBe('Gestern sind wir zu Hause geblieben');
  });

  test('no focus: a cloze where key_tokens allow one, else an order', () => {
    expect(scaffoldFor(sentence('Ich wohne in Berlin.', { key_tokens: ['wohne'] }))?.type).toBe(
      'cloze',
    );
    expect(scaffoldFor(sentence('Ich wohne in Berlin.'))?.type).toBe('order');
  });

  describe('null, so the retry is the translation itself, when', () => {
    test('a form focus has no key_tokens, or none of them is in the answer — never an order', () => {
      expect(scaffoldFor(sentence('Ich wohne in Berlin.', { focus: 'verb-endungen' }))).toBeNull();
      expect(
        scaffoldFor(
          sentence('Ich wohne in Berlin.', { focus: 'verb-endungen', key_tokens: ['wohnst'] }),
        ),
      ).toBeNull();
    });

    test('the gaps would be most of the sentence', () => {
      expect(
        scaffoldFor(
          sentence('Welche Größe brauchen Sie?', {
            focus: 'interrogativartikel',
            key_tokens: ['Welche', 'Größe', 'brauchen'],
          }),
        ),
      ).toBeNull();
    });

    test('a rendering differs at two gaps at once', () => {
      expect(
        scaffoldFor(
          sentence('Ich gebe dem Mann den Ball.', {
            focus: 'wechsel-akk-dat',
            key_tokens: ['dem', 'den'],
            accept: ['Ich gebe der Frau die Tasche.', 'Ich gebe einem Mann einen Ball.'],
          }),
        ),
      ).toBeNull();
    });

    test('a word-order sentence is longer than any authored order, or too short to order', () => {
      const long = Array.from({ length: SCAFFOLD_ORDER_MAX_WORDS + 1 }, (_, i) => `w${i}`);
      expect(
        scaffoldFor(sentence(`${long.join(' ')}.`, { focus: 'verbzweit', key_tokens: ['w1'] })),
      ).toBeNull();
      expect(scaffoldFor(sentence('Komm her!', { focus: 'verbzweit' }))).toBeNull();
    });

    test('the item is not a translate', () => {
      expect(scaffoldFor(mc('m'))).toBeNull();
    });
  });

  test('withRetry queues the lighter form, flagged as a second try that is never logged', () => {
    const failed: SessionItem = {
      uid: 'a2/s::x',
      setId: 'a2/s',
      topicId: 't',
      title_de: 't',
      level: 'A2',
      item: sentence('Ich wohne in Berlin.', { focus: 'verb-endungen', key_tokens: ['wohne'] }),
    };
    const next = withRetry([failed], 0, false);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      uid: `a2/s::x${RETRY_SUFFIX}`,
      retry: true,
      setId: 'a2/s',
      item: { type: 'cloze', id: 'x', text: 'Ich {{wohne}} in Berlin.' },
    });
    // the lighter form is never itself retried
    expect(withRetry(next, 1, false)).toBe(next);
  });

  test('every word-order focus is a registered tag', () => {
    for (const tag of WORD_ORDER_FOCUS) expect(focusIntroducedBy).toHaveProperty(tag);
  });
});

describe('training deals only what it can grade', () => {
  const open = (id: string, type: 'speak' | 'write'): ExerciseItem =>
    ({ id, type, outcomes: [], preview: false }) as unknown as ExerciseItem;

  test('a session holds no speak and no write item, however few others there are', () => {
    const mixed = set('a2/mixed', 'mixed', [
      open('s1', 'speak'),
      open('w1', 'write'),
      translate('t1'),
      open('s2', 'speak'),
    ]);
    const queue = buildSession([mixed], 8, [], { current: undefined, unarmedArmingKeys: none });
    expect(queue.map((q) => q.item.id)).toEqual(['t1']);
  });
});
