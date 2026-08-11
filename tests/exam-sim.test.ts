/**
 * Exam simulator contract (ADR 0009): the manifest instance lives outside the repo, so this
 * file is the only committed proof the schema, the half-point scaling and the local result
 * history behave — everything here runs against constructed fixtures, no copyrighted byte.
 */
import { describe, expect, test } from 'bun:test';
import {
  loadExamHistory,
  moduleItems,
  parseExamManifest,
  priorRuns,
  recordExamRun,
  scoreModule,
  type ExamManifest,
  type ExamModuleSpec,
  type ExamRunRecord,
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

const manifest: ExamManifest = {
  version: 1,
  sets: [{ id: 'demo', title: 'Demo', level: 'a1', modules: [hoeren] }],
};

describe('parseExamManifest', () => {
  test('accepts a well-formed manifest', () => {
    expect(parseExamManifest(JSON.parse(JSON.stringify(manifest)))).not.toBeNull();
  });

  test('rejects a key outside its shape — rf item cannot key on a letter option', () => {
    const bad = JSON.parse(JSON.stringify(manifest)) as ExamManifest;
    bad.sets[0]!.modules[0]!.teile[1]!.items[0]!.key = 'b';
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
    const full = Object.fromEntries(moduleItems(hoeren).map((item) => [item.nr, item.key]));
    expect(scoreModule(hoeren, full)).toMatchObject({ raw: 6, scaled: 25 });
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
});
