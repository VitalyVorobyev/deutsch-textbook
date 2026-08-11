/**
 * Exam simulator contract (ADR 0009): the manifest instance lives outside the repo, so this
 * file is the only committed proof the schema, the half-point scaling and the local result
 * history behave — everything here runs against constructed fixtures, no copyrighted byte.
 */
import { describe, expect, test } from 'bun:test';
import {
  itemCorrect,
  loadExamHistory,
  moduleItems,
  parseExamManifest,
  priorRuns,
  recordExamRun,
  scoreModule,
  updateExamRun,
  type ExamChoiceItemSpec,
  type ExamManifest,
  type ExamModuleSpec,
  type ExamRunRecord,
  type ExamTextItemSpec,
} from '../src/lib/exam-sim';

const hoeren: ExamModuleSpec = {
  module: 'hoeren',
  timeLimitMin: 20,
  pages: ['/exams/demo/pages/h1.png'],
  audio: '/exams/demo/hoeren.m4a',
  maxScaled: 25,
  teile: [
    {
      teil: 1,
      plays: 'twice',
      items: [
        { nr: 1, shape: 'abc', key: 'b' },
        { nr: 2, shape: 'abc', key: 'a' },
        { nr: 3, shape: 'abc', key: 'c' },
      ],
    },
    {
      teil: 2,
      plays: 'once',
      items: [
        { nr: 4, shape: 'rf', key: 'r' },
        { nr: 5, shape: 'rf', key: 'f' },
        { nr: 6, shape: 'rf', key: 'r' },
      ],
    },
  ],
};

/** Schreiben-shaped: typed blanks plus a free part — the share scoring cannot reach. */
const schreiben: ExamModuleSpec = {
  module: 'schreiben',
  timeLimitMin: 20,
  pages: ['/exams/demo/pages/s1.png'],
  answerPages: ['/exams/demo/pages/s-krit.png'],
  maxScaled: 15,
  teile: [
    {
      teil: 1,
      items: [
        { nr: 1, shape: 'text', answer: 'Lyon', accept: ['Lyon, Frankreich'] },
        { nr: 2, shape: 'text', answer: 'Englisch' },
        { nr: 3, shape: 'text', answer: '6 Monate', accept: ['sechs Monate'] },
        { nr: 4, shape: 'text', answer: '1. bis 28. August' },
        { nr: 5, shape: 'text', answer: '9 - 12 Uhr', accept: ['von 9 bis 12 Uhr'] },
      ],
    },
    {
      teil: 2,
      items: [],
      free: {
        label: 'Kurze Mitteilung, ca. 30 Wörter',
        points: 10,
        criteria: [
          { label: 'Inhaltspunkt 1', points: [3, 1.5, 0] },
          { label: 'Inhaltspunkt 2', points: [3, 1.5, 0] },
          { label: 'Inhaltspunkt 3', points: [3, 1.5, 0] },
          { label: 'Kommunikative Gestaltung', points: [1, 0.5, 0] },
        ],
      },
    },
  ],
};

/** Sprechen-shaped: pages only, nothing gradable — a practice module, not a sheet. */
const sprechen: ExamModuleSpec = {
  module: 'sprechen',
  timeLimitMin: 15,
  pages: ['/exams/demo/pages/sp1.png'],
  answerPages: ['/exams/demo/pages/sp-hinweise.png'],
  maxScaled: 15,
  teile: [],
};

const manifest: ExamManifest = {
  version: 1,
  sets: [{ id: 'demo', title: 'Demo', level: 'a1', modules: [hoeren, schreiben, sprechen] }],
};

describe('parseExamManifest', () => {
  test('accepts a well-formed manifest', () => {
    expect(parseExamManifest(JSON.parse(JSON.stringify(manifest)))).not.toBeNull();
  });

  test('rejects a key outside its shape — rf item cannot key on a letter option', () => {
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    (bad.sets[0]!.modules[0]!.teile[1]!.items[0] as ExamChoiceItemSpec).key = 'b';
    expect(parseExamManifest(bad)).toBeNull();
  });

  test('the two-option ab shape (Lesen Teil 2) admits a and b but never c', () => {
    const two = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    const item = two.sets[0]!.modules[0]!.teile[0]!.items[0] as ExamChoiceItemSpec;
    item.shape = 'ab';
    item.key = 'a';
    expect(parseExamManifest(two)).not.toBeNull();
    item.key = 'c';
    expect(parseExamManifest(two)).toBeNull();
  });

  test('text items need an answer; empty accept entries are rejected', () => {
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    (bad.sets[0]!.modules[1]!.teile[0]!.items[0] as ExamTextItemSpec).answer = '';
    expect(parseExamManifest(bad)).toBeNull();
    const badAccept = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    (badAccept.sets[0]!.modules[1]!.teile[0]!.items[0] as ExamTextItemSpec).accept = [''];
    expect(parseExamManifest(badAccept)).toBeNull();
  });

  test('a Teil with neither items nor a free part asks nothing and is rejected', () => {
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    delete bad.sets[0]!.modules[1]!.teile[1]!.free;
    expect(parseExamManifest(bad)).toBeNull();
  });

  test('a practice module with empty teile (Sprechen) is a legitimate shape', () => {
    expect(parseExamManifest(JSON.parse(JSON.stringify(manifest)))).not.toBeNull();
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    bad.sets[0]!.modules[1]!.teile[1]!.free!.points = 0;
    expect(parseExamManifest(bad)).toBeNull();
  });

  test('rejects a duplicate item number within a module — result identity would collide', () => {
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    bad.sets[0]!.modules[0]!.teile[1]!.items[0]!.nr = 1;
    expect(parseExamManifest(bad)).toBeNull();
  });

  test('rejects the wrong version and non-object input', () => {
    expect(parseExamManifest({ ...manifest, version: 2 })).toBeNull();
    expect(parseExamManifest(null)).toBeNull();
    expect(parseExamManifest('[]')).toBeNull();
  });
});

describe('scoreModule', () => {
  test('scales raw points to the official maximum in half points', () => {
    // 4 of 6 at max 25 → 16.666… → 16.5, the Prüferblätter's half-point grid.
    const score = scoreModule(hoeren, { 1: 'b', 2: 'a', 3: 'a', 4: 'r', 5: 'r', 6: 'r' });
    expect(score.raw).toBe(4);
    expect(score.rawMax).toBe(6);
    expect(score.scaled).toBe(16.5);
    expect(score.scaledMax).toBe(25);
  });

  test('unanswered items score zero, full sheet scores the maximum', () => {
    expect(scoreModule(hoeren, {}).raw).toBe(0);
    const full = Object.fromEntries(
      moduleItems(hoeren).map((item) => [item.nr, (item as ExamChoiceItemSpec).key]),
    );
    expect(scoreModule(hoeren, full)).toMatchObject({ raw: 6, scaled: 25 });
  });

  test('a free part stays outside the automatic score — its share never inflates it', () => {
    // Schreiben: maxScaled 15 with a 10-point free part → the 5 blanks scale to 5, not 15.
    const score = scoreModule(schreiben, { 1: 'lyon, frankreich', 2: 'Spanisch', 3: 'sechs Monate' });
    expect(score).toEqual({ raw: 2, rawMax: 5, scaled: 2, scaledMax: 5 });
  });
});

describe('itemCorrect', () => {
  const blank: ExamTextItemSpec = { nr: 5, shape: 'text', answer: '9 - 12 Uhr', accept: ['von 9 bis 12 Uhr'] };

  test('typed blanks compare case-insensitively, over hyphen spacing and trailing punctuation', () => {
    expect(itemCorrect(blank, '9-12 uhr.')).toBe(true);
    expect(itemCorrect(blank, ' von  9 bis 12 Uhr ')).toBe(true);
    expect(itemCorrect(blank, '9 bis 12')).toBe(false);
    expect(itemCorrect(blank, '   ')).toBe(false);
    expect(itemCorrect(blank, null)).toBe(false);
  });

  test('letter items still compare exactly', () => {
    const rf: ExamChoiceItemSpec = { nr: 1, shape: 'rf', key: 'r' };
    expect(itemCorrect(rf, 'r')).toBe(true);
    expect(itemCorrect(rf, 'f')).toBe(false);
    expect(itemCorrect(rf, undefined)).toBe(false);
  });
});

describe('exam history', () => {
  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    };
  };

  const run = (overrides: Partial<ExamRunRecord>): ExamRunRecord => ({
    setId: 'demo',
    module: 'hoeren',
    mode: 'pruefung',
    startedAt: '2026-08-11T10:00:00.000Z',
    finishedAt: '2026-08-11T10:20:00.000Z',
    raw: 4,
    rawMax: 6,
    scaled: 16.5,
    scaledMax: 25,
    answers: { 1: 'b', 2: 'a', 3: 'a', 4: 'r', 5: 'r', 6: null },
    ...overrides,
  });

  test('round-trips through storage and filters repeats by set and module', () => {
    const storage = memoryStorage();
    recordExamRun(run({}), storage);
    recordExamRun(run({ module: 'lesen' }), storage);
    const history = loadExamHistory(storage);
    expect(history).toHaveLength(2);
    expect(priorRuns(history, 'demo', 'hoeren')).toHaveLength(1);
    expect(priorRuns(history, 'demo', 'sprechen')).toHaveLength(0);
  });

  test('absent or corrupt storage reads as empty, never throws', () => {
    expect(loadExamHistory(null)).toEqual([]);
    const storage = memoryStorage();
    storage.setItem('da:exam-history:v1', '{not json');
    expect(loadExamHistory(storage)).toEqual([]);
  });

  test('updateExamRun patches exactly the identified run — the self-assessment stays put', () => {
    const storage = memoryStorage();
    recordExamRun(run({ module: 'schreiben' }), storage);
    // Same timestamps, different module: identity must include the module.
    recordExamRun(run({ module: 'lesen' }), storage);
    updateExamRun(run({ module: 'schreiben' }), { selfScore: 5.5, selfScoreMax: 10 }, storage);
    const history = loadExamHistory(storage);
    expect(history[0]).toMatchObject({ module: 'schreiben', selfScore: 5.5, selfScoreMax: 10 });
    expect(history[1]!.selfScore).toBeUndefined();
  });
});
