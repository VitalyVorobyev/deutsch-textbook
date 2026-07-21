/**
 * P6-4/P6-5's instrument check: a drill authored against a weak focus is only worth
 * shipping if the training loop actually serves it. `dativ-artikel` stayed the worst
 * weak focus *while a drill for it sat in rotation*, so these tests pin — against the
 * real shipped YAML, not fixtures — that when the drilled tags are weak, the drill
 * items enter `buildSession`'s weak-focus band, production items among them, and that
 * the sets are eligible exactly when their topic is opened.
 *
 * The verb-form cluster ships as two sets split by tag ownership: `modal-konjugation`
 * lives on `modalverben` (a2/drill-verbformen), `verb-endungen` on the topic that
 * introduces it, `praesens-wortstellung` (a1/drill-verbendungen). Probes arm from the
 * earliest verified attempt on ANY of a topic's practice/drill sets, so a set may only
 * contain items that practise its own topic's competence — the split is what keeps a
 * mixed-training draw of an ich-helfe item from arming the modal probe.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { buildSession, eligibleTrainingSets, type TrainingSet } from '../src/lib/training';
import { weakFocuses } from '../src/lib/weakness';
import { exerciseSetSchema } from '../src/lib/schemas';
import type { ExerciseItem, Level } from '../src/lib/schemas';
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
    level: rel.split('/')[0]!.toUpperCase() as Level,
    role: data.role,
    items: data.items,
  };
};

const dativDrill = load('a2/drill-dativ-ausloeser.yaml');
const verbDrill = load('a2/drill-verbformen.yaml');
const endungenDrill = load('a1/drill-verbendungen.yaml');
// The 2026-07-16 triage's drills: wo-wohin (worst post-triage signal, no drill existed)
// and modal-satzklammer (the zu-after-modal confusion, unattributed by design so it can
// never surface in the weak-focus table — the ruling drill notes are its evidence).
const woWohinDrill = load('a2/drill-wo-wohin.yaml');
const satzklammerDrill = load('a1/drill-modal-satzklammer.yaml');
const drills = [dativDrill, verbDrill, endungenDrill, woWohinDrill, satzklammerDrill];

const WEAK_TAGS = ['dativ-artikel', 'modal-konjugation', 'verb-endungen', 'wo-wohin', 'modal-satzklammer'];

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
const weakEvidence: Attempt[] = WEAK_TAGS.flatMap((focus, n) =>
  [1, 2, 3, 4].map((k) => attempt(`a2/evidence-${n}`, `e${k}`, false, NOW - k * HOUR, focus)),
);

const weakTagged = (set: TrainingSet, tag: string) => set.items.filter((i) => i.focus === tag);

describe('P6-4/P6-5 drills are served through the weak-focus band', () => {
  test('the drilled tags come out weak from the evidence', () => {
    const weak = weakFocuses(weakEvidence).map((w) => w.focus).sort();
    expect(weak).toEqual([...WEAK_TAGS].sort());
  });

  test('the shipped sets actually carry the tags the evidence names', () => {
    // A drill for a weak tag that mostly grades *other* tags is how the previous one
    // failed to move the needle — pin the supply, not just the mechanism.
    expect(weakTagged(dativDrill, 'dativ-artikel').length).toBeGreaterThanOrEqual(3);
    expect(weakTagged(verbDrill, 'modal-konjugation').length).toBeGreaterThanOrEqual(3);
    expect(weakTagged(endungenDrill, 'verb-endungen').length).toBeGreaterThanOrEqual(3);
    expect(weakTagged(woWohinDrill, 'wo-wohin').length).toBeGreaterThanOrEqual(3);
    expect(weakTagged(satzklammerDrill, 'modal-satzklammer').length).toBeGreaterThanOrEqual(3);
    for (const drill of drills) expect(drill.role).toBe('drill');
  });

  test('a set carries only tags its own topic can honestly arm probes for', () => {
    // Probe-arming hygiene, pinned on the shipped content: probes arm from the earliest
    // attempt on any of the topic's practice/drill sets, so the modal drill must stay
    // modal-only and the verb-endungen items must live with the tag's owning A1 topic.
    expect(new Set(verbDrill.items.map((i) => i.focus))).toEqual(new Set(['modal-konjugation']));
    expect(new Set(endungenDrill.items.map((i) => i.focus))).toEqual(new Set(['verb-endungen']));
    expect(endungenDrill.topicId).toBe('praesens-wortstellung');
    expect(new Set(woWohinDrill.items.map((i) => i.focus))).toEqual(new Set(['wo-wohin']));
    expect(woWohinDrill.topicId).toBe('wohnen-umzug');
    expect(new Set(satzklammerDrill.items.map((i) => i.focus))).toEqual(new Set(['modal-satzklammer']));
    expect(satzklammerDrill.topicId).toBe('freizeit-koennen');
  });

  test('eligible exactly when the owning topic is opened', () => {
    const closed: TopicContext = { attempts: [], cards: {}, topics: {} };
    const opened: TopicContext = {
      attempts: [],
      cards: {},
      topics: {
        dativ: { readAt: 1 },
        modalverben: { readAt: 1 },
        'praesens-wortstellung': { readAt: 1 },
        'wohnen-umzug': { readAt: 1 },
        'freizeit-koennen': { readAt: 1 },
      },
    };
    expect(eligibleTrainingSets(drills, [], [], closed)).toEqual([]);
    expect(eligibleTrainingSets(drills, [], [], opened)).toEqual(drills);
  });

  test('with the tags weak, the new items fill the weak-focus band ahead of untried material', () => {
    const wanted =
      weakTagged(dativDrill, 'dativ-artikel').length +
      weakTagged(verbDrill, 'modal-konjugation').length +
      weakTagged(endungenDrill, 'verb-endungen').length +
      weakTagged(woWohinDrill, 'wo-wohin').length +
      weakTagged(satzklammerDrill, 'modal-satzklammer').length;
    const queue = buildSession([...drills, distractor], wanted, weakEvidence);

    // Band 1 (last answered wrong) is empty — no pool item was ever attempted — and the
    // broad-retrieval reservation has nothing to reserve, so a session of exactly this
    // size must be the weak-focus band and nothing else: every slot goes to an item
    // carrying a weak tag, and the 20 untried distractors take none of them.
    expect(queue).toHaveLength(wanted);
    for (const entry of queue) {
      expect(WEAK_TAGS).toContain(entry.item.focus ?? '');
    }
    for (const drill of drills) {
      expect(queue.some((entry) => entry.setId === drill.setId)).toBe(true);
    }

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

/**
 * A pretest is answered *before* the lesson, so its result says nothing about a persistent
 * confusion — which is why it is already excluded from mastery, `Geübt`, mixed training,
 * outcome measurement and both coverage figures. It was still reaching the weakness signal,
 * and that was not harmless: every pretest item in this repo is `mc`, the format the pilot
 * learner scores ~93% on, so those attempts diluted the denominators of a signal that exists
 * to find production confusion.
 */
describe('pretest attempts are not weakness evidence', () => {
  const attempt = (setId: string, id: string, correct: boolean, ts: number): Attempt => ({
    setId, itemId: id, itemType: 'mc', correct, given: 'x', ts, focus: 'dativ-artikel',
  });

  test('easy pretest passes cannot dilute a weak tag below the threshold', () => {
    // Four real errors out of four graded attempts: unambiguously weak.
    const real = [0, 1, 2, 3].map((n) => attempt('a2/dativ', `i${n}`, false, NOW + n));
    expect(weakFocuses(real).map((w) => w.focus)).toEqual(['dativ-artikel']);

    // Twelve correct pretest answers alongside would drop the rate to 4/16 = 25%, under the
    // 35% bar, and the tag would silently stop being weak while nothing about the learner
    // changed. They are excluded, so it stays weak.
    const padded = [
      ...real,
      ...Array.from({ length: 12 }, (_, n) => attempt('a2/dativ-pretest', `p${n}`, true, NOW + 10 + n)),
    ];
    expect(weakFocuses(padded).map((w) => w.focus)).toEqual(['dativ-artikel']);
  });

  test('and pretest errors cannot make a tag weak on their own', () => {
    const preOnly = [0, 1, 2, 3].map((n) => attempt('a2/dativ-pretest', `p${n}`, false, NOW + n));
    expect(weakFocuses(preOnly)).toEqual([]);
  });

  test('the suffix is the whole test — an ordinary set is unaffected', () => {
    const ordinary = [0, 1, 2, 3].map((n) => attempt('a2/dativ-pretests', `i${n}`, false, NOW + n));
    expect(weakFocuses(ordinary).map((w) => w.focus)).toEqual(['dativ-artikel']);
  });
});
