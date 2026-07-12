/**
 * `deepens` (content/atlas.yaml) claims a topic revisits an earlier one. Its entire
 * runtime meaning is carried by the focus tag — see the validator's deepens check and
 * the comments in src/lib/weakness.ts and src/lib/training.ts. These tests pin the two
 * halves of that claim: that the mechanism behaves as advertised, and that the content
 * actually gives every declared edge a tag to travel on.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { buildSession, type TrainingSet } from '../src/lib/training';
import { weakFocuses } from '../src/lib/weakness';
import { getCurriculum } from '../src/lib/curriculum';
import { exerciseSetSchema } from '../src/lib/schemas';
import type { ExerciseItem } from '../src/lib/schemas';
import type { Attempt } from '../src/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_780_000_000_000;

const item = (id: string, focus?: string): ExerciseItem =>
  ({ id, type: 'mc', outcomes: [], preview: false, prompt: '?', options: ['a', 'b'], correct: 0, focus }) as ExerciseItem;

const attempt = (setId: string, itemId: string, correct: boolean, ts: number, focus?: string): Attempt =>
  ({ setId, itemId, itemType: 'mc', correct, given: '', ts, focus }) as Attempt;

describe('deepening topics resurface their base through the focus tag', () => {
  // The A2 topic deepens the A1 one: both drill `wechsel-akk-dat`, and the base also owns
  // items about a confusion the deepening topic never touches.
  const deep: TrainingSet = {
    setId: 'a2/deep', topicId: 'deep', title_de: 'Deep', level: 'A2', role: 'practice',
    items: ['d1', 'd2', 'd3', 'd4'].map((id) => item(id, 'wechsel-akk-dat')),
  };
  const base: TrainingSet = {
    setId: 'a1/base', topicId: 'base', title_de: 'Base', level: 'A1', role: 'practice',
    items: [
      item('shared1', 'wechsel-akk-dat'),
      item('shared2', 'wechsel-akk-dat'),
      ...['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id) => item(id, 'du-sie')),
    ],
  };

  // The learner worked the base topic through long ago and got everything right; the
  // unrelated `du-sie` items are the oldest thing they own, the shared ones more recent.
  const history: Attempt[] = [
    ...['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id, k) =>
      attempt('a1/base', id, true, NOW - (30 - k) * DAY, 'du-sie'),
    ),
    ...['shared1', 'shared2'].map((id) => attempt('a1/base', id, true, NOW - 2 * DAY, 'wechsel-akk-dat')),
  ];
  const errsInDeep: Attempt[] = ['d1', 'd2', 'd3', 'd4'].map((id, k) =>
    attempt('a2/deep', id, false, NOW - (4 - k) * 3600_000, 'wechsel-akk-dat'),
  );

  test('weakness is blind to the topic an error happened in', () => {
    // Every one of these attempts was logged under the *deepening* topic's set, yet the
    // confusion — not the topic — is what comes out weak. This is why the deepening
    // topic's errors reach the base at all, and why no `deepens`-aware aggregation is
    // needed to make them.
    expect(weakFocuses(errsInDeep).map((w) => w.focus)).toEqual(['wechsel-akk-dat']);
  });

  test('an error in the deepening topic resurfaces the applicable base items', () => {
    const queue = buildSession([deep, base], 8, [...history, ...errsInDeep]);
    const fromBase = queue.filter((entry) => entry.setId === 'a1/base').map((entry) => entry.item.id);

    // Both base items on the weak confusion come back, though the learner had answered
    // them correctly — a passed drill is exactly what a resurfaced drill looks like.
    expect(fromBase).toContain('shared1');
    expect(fromBase).toContain('shared2');
  });

  test('unrelated base content does not ride along', () => {
    const queue = buildSession([deep, base], 8, [...history, ...errsInDeep]);
    const unrelated = queue.filter((entry) => entry.item.focus === 'du-sie');

    // Priority is 4 wrong (band 1) + 2 shared-tag (band 2) = 6 of the 8 slots. The only
    // `du-sie` items in the queue are the two the broad-retrieval reservation would have
    // served anyway (BROAD_RETRIEVAL_SHARE of 8, oldest first) — the error pulled in none.
    expect(unrelated.map((entry) => entry.item.id).sort()).toEqual(['u1', 'u2']);
  });

  test('without the error, the base drill stays put', () => {
    // The control: the same session with the deepening topic answered correctly. Nothing
    // is weak, so the base's shared-tag items are just recently-passed material and lose
    // to the older ones — no revisit happens without evidence that one is needed.
    const passed = errsInDeep.map((a) => ({ ...a, correct: true }));
    const queue = buildSession([deep, base], 4, [...history, ...passed]);
    expect(queue.map((entry) => entry.item.id).sort()).toEqual(['u1', 'u2', 'u3', 'u4']);
  });
});

describe('every declared deepens edge has a tag to travel on', () => {
  const EXERCISES = join(process.cwd(), 'content', 'exercises');
  const sets = readdirSync(EXERCISES, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => exerciseSetSchema.parse(YAML.parse(readFileSync(join(EXERCISES, file), 'utf8'))));

  const TRAINABLE_ROLES = new Set(['practice', 'drill']);
  const tagsOf = (topic: string, trainableOnly: boolean): Set<string> =>
    new Set(
      sets
        .filter((set) => set.topic === topic && (!trainableOnly || TRAINABLE_ROLES.has(set.role)))
        .flatMap((set) => set.items.flatMap((entry) => (entry.focus ? [entry.focus] : []))),
    );

  test('the deepening topic and its base share a focus tag the base can be drilled on', () => {
    // The same rule scripts/validate.ts enforces, asserted against the shipped content:
    // an edge with no shared tag is a label in the relations pane and nothing more, since
    // the tag is the only path an error in the deepening topic has back to the base.
    const unbacked: string[] = [];
    for (const node of getCurriculum().nodes) {
      for (const base of node.deepens) {
        const shared = [...tagsOf(node.id, false)].filter((focus) => tagsOf(base, true).has(focus));
        if (shared.length === 0) unbacked.push(`${node.id} deepens ${base}`);
      }
    }
    expect(unbacked).toEqual([]);
  });
});
