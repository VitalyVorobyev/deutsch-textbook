/**
 * P6-4/P6-5's instrument check: a drill authored against a weak focus is only worth
 * shipping if the training loop actually serves it. `dativ-artikel` stayed the worst
 * weak focus *while a drill for it sat in rotation*, so these tests pin — against the
 * real shipped YAML, not fixtures — that when the drilled tags are weak, the new sets'
 * items enter `buildSession`'s weak-focus band, production items among them, and that
 * the sets are eligible exactly when their topic is opened.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { buildSession, eligibleTrainingSets, type TrainingSet } from '../src/lib/training';
import { weakFocuses } from '../src/lib/weakness';
import { exerciseSetSchema } from '../src/lib/schemas';
import type { ExerciseItem } from '../src/lib/schemas';
import type { Attempt } from '../src/lib/store';
import type { TopicContext } from '../src/lib/mastery';

const NOW = 1_780_000_000_000;
const HOUR = 3_600_000;

const load = (rel: string): TrainingSet => {
  const data = exerciseSetSchema.parse(
    YAML.parse(readFileSync(join(process.cwd(), 'content', 'exercises', rel), 'utf8')),
  );
  return {
    setId: rel.replace(/\.yaml$/, ''),
    topicId: data.topic,
    title_de: data.topic,
    level: 'A2',
    role: data.role,
    items: data.items,
  };
};

const dativDrill = load('a2/drill-dativ-ausloeser.yaml');
const verbDrill = load('a2/drill-verbformen.yaml');

const mc = (id: string): ExerciseItem =>
  ({ id, type: 'mc', outcomes: [], preview: false, prompt: '?', options: ['a', 'b'], correct: 0 }) as ExerciseItem;

/** A big untagged pool: without the weak-focus band these would flood the session. */
const distractor: TrainingSet = {
  setId: 'a2/other', topicId: 'other', title_de: 'Other', level: 'A2', role: 'practice',
  items: Array.from({ length: 20 }, (_, i) => mc(`f${i}`)),
};

const attempt = (setId: string, itemId: string, correct: boolean, ts: number, focus?: string): Attempt =>
  ({ setId, itemId, itemType: 'mc', correct, given: '', ts, focus }) as Attempt;

// The evidence that armed P6-4/P6-5: repeated errors on the drilled tags. Logged under
// sets that are NOT in this pool — weakness is aggregated per tag and is blind to the
// topic (or set) an attempt came from, which is exactly what lets a new drill be pulled
// in by errors made elsewhere.
const weakEvidence: Attempt[] = [
  ...[1, 2, 3, 4].map((k) => attempt('a2/dativ', `d${k}`, false, NOW - k * HOUR, 'dativ-artikel')),
  ...[1, 2, 3, 4].map((k) => attempt('a2/modalverben', `m${k}`, false, NOW - k * HOUR, 'modal-konjugation')),
];

const weakTagged = (set: TrainingSet, tag: string) => set.items.filter((i) => i.focus === tag);

describe('P6-4/P6-5 drills are served through the weak-focus band', () => {
  test('the drilled tags come out weak from the evidence', () => {
    const weak = weakFocuses(weakEvidence).map((w) => w.focus).sort();
    expect(weak).toEqual(['dativ-artikel', 'modal-konjugation']);
  });

  test('the shipped sets actually carry the tags the evidence names', () => {
    // A drill for a weak tag that mostly grades *other* tags is how the previous one
    // failed to move the needle — pin the supply, not just the mechanism.
    expect(weakTagged(dativDrill, 'dativ-artikel').length).toBeGreaterThanOrEqual(3);
    expect(weakTagged(verbDrill, 'modal-konjugation').length).toBeGreaterThanOrEqual(3);
    expect(dativDrill.role).toBe('drill');
    expect(verbDrill.role).toBe('drill');
  });

  test('eligible exactly when the owning topic is opened', () => {
    const sets = [dativDrill, verbDrill];
    const closed: TopicContext = { attempts: [], cards: {}, topics: {} };
    const opened: TopicContext = {
      attempts: [],
      cards: {},
      topics: { dativ: { readAt: 1 }, modalverben: { readAt: 1 } },
    };
    expect(eligibleTrainingSets(sets, [], [], closed)).toEqual([]);
    expect(eligibleTrainingSets(sets, [], [], opened)).toEqual(sets);
  });

  test('with the tags weak, the new items fill the weak-focus band ahead of untried material', () => {
    const wanted = weakTagged(dativDrill, 'dativ-artikel').length + weakTagged(verbDrill, 'modal-konjugation').length;
    const queue = buildSession([dativDrill, verbDrill, distractor], wanted, weakEvidence);

    // Band 1 (last answered wrong) is empty — no pool item was ever attempted — and the
    // broad-retrieval reservation has nothing to reserve, so a session of exactly this
    // size must be the weak-focus band and nothing else: every slot goes to an item
    // carrying a weak tag, and the 20 untried distractors take none of them.
    expect(queue).toHaveLength(wanted);
    for (const entry of queue) {
      expect(['dativ-artikel', 'modal-konjugation']).toContain(entry.item.focus ?? '');
    }
    expect(queue.some((entry) => entry.setId === 'a2/drill-dativ-ausloeser')).toBe(true);
    expect(queue.some((entry) => entry.setId === 'a2/drill-verbformen')).toBe(true);

    // …and the served material is production-shaped, not another recognition pass:
    // free production (translate) and dictation (listen) both reach the queue.
    const types = new Set(queue.map((entry) => entry.item.type));
    expect(types).toContain('translate');
    expect(types).toContain('listen');
  });

  test('without the errors, nothing is weak and no band exists to pull the drills in', () => {
    const passed = weakEvidence.map((a) => ({ ...a, correct: true }));
    expect(weakFocuses(passed)).toEqual([]);
  });
});
