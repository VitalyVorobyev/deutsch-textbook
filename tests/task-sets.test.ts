/**
 * Task sets (ADR 0016): one exercise set on one shared recording. A clean fixture checkout passes;
 * each rule fails on the break it exists for, with the message an author acts on. The schema's
 * own half — `source` omitted inside a task set, required outside one — is tested on the schema.
 * Retired sets are served nowhere: training, remediation and probes leave them out, while
 * `revisionLookup` still resolves their items.
 *
 * Fixtures state every field the assertions read.
 */
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';
import { exerciseSetSchema } from '@da/schema';
import { loadTaskSetCorpus, taskSetProblems } from '@da/content/task-sets';
import { probeFamilies } from '../src/lib/probes';
import {
  buildSession,
  eligibleTrainingSets,
  remediationSetFor,
  revisionLookup,
  type TopicOwnedSet,
  type TrainingSet,
} from '../src/lib/training';
import type { TopicContext, TopicNode } from '../src/lib/mastery';

/** No probe family is waiting on any item here; the band-3 ordering is tested on its own. */
const NO_PROBES = { current: undefined, unarmedArmingKeys: new Set<string>() };

type Files = Record<string, string>;
type Item = Record<string, unknown>;

const BI = { en: 'Listen.', ru: 'Послушайте.' };
const SPEAKERS = ['Lena', 'Jonas', 'Frau Kern'];

const recording = (level: string, id = 'ls-wohnen-aufgabe-01') =>
  YAML.stringify({
    id,
    level,
    title: { en: 'At the door', ru: 'У двери' },
    scenario: 'neighbours at the door',
    duration_seconds: 20,
    speakers: SPEAKERS,
    transcript: [
      { speaker: 'Lena', text: 'Hallo, Jonas!' },
      { speaker: 'Jonas', text: 'Hallo, Lena. Frau Kern kommt auch.' },
      { speaker: 'Frau Kern', text: 'Guten Tag!' },
    ],
    provenance: 'data/audio-provenance/a2/x.json',
  });

const question = (id: string, rung: string, options: string[]): Item => ({
  id,
  type: 'audio-comprehension',
  rung,
  question: 'Worum geht es?',
  options,
  correct: 0,
});

const GIST = question('gist', 'gist', ['Besuch', 'Arbeit', 'Urlaub', 'Sport']);
const DETAIL = question('detail', 'detail', ['Frau Kern', 'Herr Bauer', 'Mira', 'Niemand']);
const WHO = question('who', 'who', SPEAKERS);
const FORM: Item = { id: 'form', type: 'cloze', rung: 'form', text: 'Frau Kern {{kommt}} auch.' };
const REPLY: Item = {
  id: 'reply',
  type: 'write',
  rung: 'reply',
  prompt: BI,
  goal: BI,
  requirements: [BI],
  model_answer: 'Hallo Lena, ich komme gern.',
};
const LADDER = [GIST, DETAIL, WHO, FORM, REPLY];

const taskSet = (items: Item[] = LADDER, extra: Record<string, unknown> = {}) =>
  YAML.stringify({
    topic: 'wohnen',
    role: 'practice',
    stage: 'transfer',
    activity: 'application',
    title_de: 'Aufgabe: An der Tür',
    recording: 'ls-wohnen-aufgabe-01',
    items,
    ...extra,
  });

const coreSet = YAML.stringify({
  topic: 'wohnen',
  role: 'practice',
  stage: 'geruest',
  activity: 'core',
  title_de: 'Grundübung',
  items: [{ id: 'c1', type: 'cloze', text: 'Ich {{wohne}} hier.' }],
});

const scriptedQuestion = {
  id: 'h1',
  type: 'audio-comprehension',
  source: { kind: 'tts', turns: [{ speaker: 'Lena', text: 'Hallo!' }] },
  question: 'Wer spricht?',
  options: ['Lena', 'Jonas'],
  correct: 0,
};

const hoerenSet = (extra: Record<string, unknown> = {}) =>
  YAML.stringify({
    topic: 'wohnen',
    role: 'practice',
    stage: 'transfer',
    activity: 'application',
    title_de: 'Hören',
    items: [scriptedQuestion],
    ...extra,
  });

const manifest = (elements: Record<string, unknown>) =>
  YAML.stringify({ id: 'wohnen', elements: { article: 'wohnen.mdx', ...elements } });

/** A converted topic whose only listening is its task set; a probe asks a scripted question. */
const CLEAN: Files = {
  'content/listening/a2/ls-wohnen-aufgabe-01.yaml': recording('A2'),
  'content/exercises/a2/wohnen.yaml': coreSet,
  'content/exercises/a2/wohnen-aufgabe.yaml': taskSet(),
  'content/exercises/a2/probe-wohnen.yaml': YAML.stringify({
    topic: 'wohnen',
    role: 'probe',
    arming: ['a2/wohnen::c1'],
    items: [scriptedQuestion],
  }),
  'content/topics/a2/wohnen.topic.yaml': manifest({
    exercises: ['a2/wohnen', 'a2/wohnen-aufgabe'],
    primary_practice: 'a2/wohnen',
    probes: ['a2/probe-wohnen'],
  }),
};

function checkout(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'task-sets-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const problems = (overrides: Files = {}) =>
  taskSetProblems(loadTaskSetCorpus(checkout({ ...CLEAN, ...overrides })));
const withTaskSet = (items: Item[], extra?: Record<string, unknown>) =>
  problems({ 'content/exercises/a2/wohnen-aufgabe.yaml': taskSet(items, extra) });
const SET_FILE = 'content/exercises/a2/wohnen-aufgabe.yaml';

describe('a clean task set', () => {
  test('passes every rule', () => {
    expect(problems()).toEqual([]);
  });

  test('a numbered task set and an unconverted topic with a scripted -hoeren set pass', () => {
    expect(
      problems({
        'content/exercises/a2/wohnen-aufgabe.yaml': '',
        'content/exercises/a2/wohnen-aufgabe-2.yaml': taskSet(),
        'content/exercises/a2/wohnen-hoeren.yaml': hoerenSet(),
        'content/topics/a2/wohnen.topic.yaml': manifest({
          exercises: ['a2/wohnen', 'a2/wohnen-hoeren'],
          primary_practice: 'a2/wohnen',
        }),
      }),
    ).toEqual([]);
  });
});

describe('a. the recording', () => {
  test('must resolve', () => {
    expect(problems({ 'content/listening/a2/ls-wohnen-aufgabe-01.yaml': '' })).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": recording "ls-wohnen-aufgabe-01" does not resolve to content/listening/<level>/<id>.yaml`,
    ]);
  });

  test('must have the set level', () => {
    expect(problems({ 'content/listening/a2/ls-wohnen-aufgabe-01.yaml': recording('B1') })).toEqual(
      [
        `${SET_FILE}: task set "a2/wohnen-aufgabe": recording "ls-wohnen-aufgabe-01" is B1, but the set is A2`,
      ],
    );
  });
});

describe('b. the ladder', () => {
  test('4–6 items', () => {
    expect(withTaskSet([GIST, WHO, REPLY])).toContain(
      `${SET_FILE}: task set "a2/wohnen-aufgabe" has 3 items — a task climbs its ladder in 4–6`,
    );
  });

  test('every item on a rung', () => {
    const { rung: _, ...unranked } = FORM;
    expect(withTaskSet([GIST, DETAIL, WHO, unranked, REPLY])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": items form have no rung: — give each one`,
    ]);
  });

  test('rungs never go back', () => {
    expect(withTaskSet([GIST, WHO, DETAIL, FORM, REPLY])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": item "detail" (detail) comes after "who" (who) — rungs climb gist → detail → who → form → reply and never go back`,
    ]);
  });

  test('a rung may repeat', () => {
    expect(withTaskSet([GIST, DETAIL, { ...DETAIL, id: 'detail-2' }, FORM, REPLY])).toEqual([]);
  });

  test('gist first, reply last', () => {
    expect(withTaskSet([DETAIL, { ...DETAIL, id: 'detail-2' }, WHO, FORM, REPLY])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe" opens on detail — the first item is the gist`,
    ]);
    expect(withTaskSet([GIST, DETAIL, WHO, FORM])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe" ends on form — the last item is the reply`,
    ]);
  });

  test('at least four scored items', () => {
    expect(withTaskSet([GIST, DETAIL, WHO, REPLY, { ...REPLY, id: 'reply-2' }])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe" scores 3 items — a recording carries at least 4 scored items (write and speak are not scored)`,
    ]);
  });
});

describe('c. what each rung may be', () => {
  test('gist and detail offer four options', () => {
    expect(
      withTaskSet([{ ...GIST, options: ['Besuch', 'Arbeit', 'Urlaub'] }, ...LADDER.slice(1)]),
    ).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": item "gist" (gist) offers 3 options — a gist item offers at least 4`,
    ]);
  });

  test("a who item's options are the recording's speakers, at least three", () => {
    expect(
      withTaskSet([GIST, DETAIL, { ...WHO, options: ['Lena', 'Mira', 'Jonas'] }, FORM, REPLY]),
    ).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": item "who" (who) offers "Mira", not a speaker of "ls-wohnen-aufgabe-01" — a who item's options are the recording's speakers`,
    ]);
    expect(
      withTaskSet([GIST, DETAIL, { ...WHO, options: ['Lena', 'Jonas'] }, FORM, REPLY]),
    ).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": item "who" (who) offers 2 names — a who item offers at least 3`,
    ]);
  });

  test('a rung holds only its item types', () => {
    const mc = {
      id: 'form',
      type: 'mc',
      rung: 'form',
      prompt: 'Sie ___ auch.',
      options: ['kommt', 'kommen'],
      correct: 0,
    };
    expect(withTaskSet([GIST, DETAIL, WHO, mc, REPLY])).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe": item "form" (form) is mc — a form item is cloze or translate`,
    ]);
  });
});

describe('d. the name, role and stage', () => {
  test('a set with a recording is named -aufgabe', () => {
    expect(
      problems({
        'content/exercises/a2/wohnen-aufgabe.yaml': '',
        'content/exercises/a2/wohnen-gespraech.yaml': taskSet(),
        'content/topics/a2/wohnen.topic.yaml': manifest({
          exercises: ['a2/wohnen', 'a2/wohnen-gespraech'],
          primary_practice: 'a2/wohnen',
        }),
      }),
    ).toEqual([
      'content/exercises/a2/wohnen-gespraech.yaml: task set "a2/wohnen-gespraech" must be named <topic>-aufgabe or <topic>-aufgabe-<n>',
    ]);
  });

  test('-aufgabe names a task set only', () => {
    expect(problems({ [SET_FILE]: hoerenSet() })).toEqual([
      `${SET_FILE}: "a2/wohnen-aufgabe" is named like a task set but has no recording: — add the set recording it is built on, or rename it`,
    ]);
  });

  test('a task set is a transfer practice set', () => {
    expect(withTaskSet(LADDER, { stage: 'ausblenden', activity: 'extension' })).toEqual([
      `${SET_FILE}: task set "a2/wohnen-aufgabe" has stage: ausblenden — a task set is stage: transfer`,
    ]);
  });
});

describe('e. a converted topic asks no listening question outside a task set', () => {
  const hoeren = 'content/exercises/a2/wohnen-hoeren.yaml';

  test('a scripted -hoeren set beside the task set fails', () => {
    expect(problems({ [hoeren]: hoerenSet() })).toEqual([
      `${hoeren}: "a2/wohnen-hoeren" asks the listening question "h1" outside a task set, but topic "wohnen" is converted — a recording carries a task, not a question: move it into a task set or retire this set`,
    ]);
  });

  test('retiring it is the conversion', () => {
    expect(problems({ [hoeren]: hoerenSet({ retired: true }) })).toEqual([]);
  });
});

describe('f. a retired set is served nowhere', () => {
  const retiredCore = YAML.stringify({ ...YAML.parse(coreSet), retired: true });

  test('no manifest lists it', () => {
    expect(problems({ 'content/exercises/a2/wohnen.yaml': retiredCore })).toEqual([
      'content/topics/a2/wohnen.topic.yaml: lists "a2/wohnen", which is retired — a retired set is served nowhere; remove it from elements',
      'content/topics/a2/wohnen.topic.yaml: elements.primary_practice "a2/wohnen" is retired — name a live core set',
      'content/exercises/a2/probe-wohnen.yaml: "a2/probe-wohnen" is armed by "a2/wohnen::c1", but "a2/wohnen" is retired — arm the family from a live set',
    ]);
  });
});

describe('the schema half', () => {
  const parse = (set: Record<string, unknown>) => exerciseSetSchema.safeParse(set);
  const messages = (set: Record<string, unknown>) => {
    const result = parse(set);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };
  const base = YAML.parse(taskSet()) as Record<string, unknown>;

  test('a task set item carries no source; a set without a recording needs one', () => {
    expect(parse(base).success).toBe(true);
    expect(messages({ ...base, items: [{ ...GIST, ...scriptedQuestion, id: 'gist' }] })).toEqual([
      'item "gist" is in a task set, which plays the set recording "ls-wohnen-aufgabe-01" — remove its source: and recording:',
    ]);
    const { recording: _, ...plain } = base;
    expect(messages({ ...plain, items: [GIST] })).toEqual([
      'item "gist" needs its source: turns — only a set with a recording: may omit them',
    ]);
  });

  test('one stimulus, and max_replays only with a recording', () => {
    expect(messages({ ...base, stimulus: 'a2/mietvertrag' })).toEqual([
      'a set is built on one stimulus — a recording or a document, not both',
    ]);
    const { recording: _, ...plain } = YAML.parse(hoerenSet()) as Record<string, unknown>;
    expect(messages({ ...plain, max_replays: 2 })).toEqual([
      'max_replays counts plays of the set recording — this set has no recording:',
    ]);
  });
});

describe('the learner app serves no retired set', () => {
  const node: TopicNode = {
    id: 'wohnen',
    path: '/topics/a2/wohnen',
    level: 'A2',
    kind: 'theme',
    title_de: 'Wohnen',
    title_en: 'Housing',
    title_ru: 'Жильё',
    prerequisites: [],
    exerciseSets: ['a2/wohnen'],
    vocabIds: [],
    readingIds: [],
  };
  const ctx: TopicContext = { attempts: [], cards: {}, topics: { wohnen: { readAt: 1 } } };
  const item = {
    id: 'c1',
    type: 'cloze',
    text: 'Ich {{wohne}} hier.',
    focus: 'f',
    outcomes: ['o'],
  };
  const live: TrainingSet = {
    setId: 'a2/wohnen',
    topicId: 'wohnen',
    title_de: 'Wohnen',
    level: 'A2',
    role: 'practice',
    items: [item as never],
  };
  const retired: TrainingSet = { ...live, setId: 'a2/wohnen-alt', role: 'drill', retired: true };
  const retiredProbe = {
    ...live,
    setId: 'a2/probe-wohnen',
    role: 'probe' as const,
    retired: true as const,
  };

  test('training, remediation and probes leave it out; its items still resolve', () => {
    expect(eligibleTrainingSets([live, retired], ['wohnen'], [node], ctx)).toEqual([live]);
    expect(remediationSetFor('f', 'wohnen', [retired, live])).toBe(live);
    expect(probeFamilies([retiredProbe])).toEqual([]);
    expect(revisionLookup([retired])('a2/wohnen-alt', 'c1')).toBe(1);
  });

  test('an item served alone carries its task set recording', () => {
    const script = { id: 'ls-wohnen-aufgabe-01', turns: [{ speaker: 'Lena', text: 'Hallo!' }] };
    const [served] = buildSession(
      [{ ...live, recording: script } as TopicOwnedSet],
      1,
      [],
      NO_PROBES,
    );
    expect(served?.recording).toEqual(script);
  });
});
