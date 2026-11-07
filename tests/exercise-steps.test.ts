/**
 * A topic's exercises are three steps (ADR 0019): the `task` activity and its `skill`, the page
 * grouping, and the one-kind-of-work rules with the pending list that drains them.
 */
import { describe, expect, test } from 'bun:test';
import { exerciseSetSchema, type ExerciseSet } from '@da/schema';
import {
  applicationIntruders,
  exerciseStepProblems,
  exerciseSteps,
  MIXED_APPLICATION_PENDING,
  skillMisfits,
} from '@da/content/exercise-steps';
import { loadTaskSetCorpus } from '@da/content/task-sets';

const translate = (id: string) => ({
  id,
  type: 'translate' as const,
  revision: 1,
  outcomes: ['fixture-outcome'],
  prompt_en: 'I am here.',
  prompt_ru: 'Я здесь.',
  answer: 'Ich bin hier.',
  key_tokens: ['bin'],
});
const listen = (id: string) => ({
  id,
  type: 'listen' as const,
  revision: 1,
  outcomes: ['fixture-outcome'],
  text: 'Ich bin hier.',
  translation: { en: 'I am here.', ru: 'Я здесь.' },
});
const speak = (id: string) => ({
  id,
  type: 'speak' as const,
  revision: 1,
  outcomes: ['fixture-outcome'],
  mode: 'spoken-production' as const,
  prompt: { en: 'Say where you are.', ru: 'Скажите, где вы.' },
  goal: { en: 'Say where you are.', ru: 'Сказать, где вы.' },
  checklist: [
    { en: 'You say where.', ru: 'Вы говорите где.' },
    { en: 'You use sein.', ru: 'Вы используете sein.' },
  ],
  model_answer: 'Ich bin hier.',
});

const base = {
  topic: 'fixture-topic',
  role: 'practice' as const,
  stage: 'transfer' as const,
  title_de: 'Fixture',
  items: [translate('t1')],
};
const parse = (raw: Record<string, unknown>): ExerciseSet => exerciseSetSchema.parse(raw);

describe('the task activity', () => {
  test('a task set names its skill, and no other set has one', () => {
    expect(
      exerciseSetSchema.safeParse({ ...base, activity: 'task', skill: 'hoeren' }).success,
    ).toBe(true);
    expect(exerciseSetSchema.safeParse({ ...base, activity: 'task' }).success).toBe(false);
    expect(exerciseSetSchema.safeParse({ ...base, activity: 'task', skill: 'malen' }).success).toBe(
      false,
    );
    expect(
      exerciseSetSchema.safeParse({ ...base, activity: 'application', skill: 'lesen' }).success,
    ).toBe(false);
  });

  test('a task set is role: practice, stage: transfer', () => {
    const task = { ...base, activity: 'task', skill: 'sprechen' };
    expect(exerciseSetSchema.safeParse({ ...task, stage: 'geruest' }).success).toBe(false);
    expect(exerciseSetSchema.safeParse({ ...task, role: 'drill' }).success).toBe(false);
  });
});

describe('the steps of a topic page', () => {
  const at = (id: string, activity: string, skill?: string) => ({
    id,
    data: { activity, ...(skill ? { skill } : {}) } as Pick<ExerciseSet, 'activity' | 'skill'>,
  });

  test('Üben opens on the Grundübung, Aufgaben lists by skill, drills come last', () => {
    const steps = exerciseSteps([
      at('ext', 'extension'),
      at('drill', 'remediation'),
      at('spr', 'task', 'sprechen'),
      at('core', 'core'),
      at('app', 'application'),
      at('hoe-2', 'task', 'hoeren'),
      at('les', 'task', 'lesen'),
      at('hoe-1', 'task', 'hoeren'),
    ]);
    expect(steps.map((step) => [step.id, step.sets.map((set) => set.id)])).toEqual([
      ['ueben', ['core', 'ext']],
      ['anwenden', ['app']],
      ['aufgaben', ['hoe-2', 'hoe-1', 'les', 'spr']],
      ['wiederholen', ['drill']],
    ]);
    expect(steps[2]!.skills!.map((group) => group.skill)).toEqual(['hoeren', 'lesen', 'sprechen']);
  });

  test('a step with no sets is not rendered', () => {
    expect(
      exerciseSteps([at('core', 'core'), at('app', 'application')]).map((step) => step.id),
    ).toEqual(['ueben', 'anwenden']);
  });

  test('every shipped topic opens on Üben and has Anwenden', () => {
    const corpus = loadTaskSetCorpus(process.cwd());
    for (const [topicId, { data }] of corpus.topics) {
      const sets = data.elements.exercises.flatMap((id) => {
        const set = corpus.sets.get(id);
        return set ? [{ id, data: set.data }] : [];
      });
      const ids = exerciseSteps(sets).map((step) => step.id);
      expect({ topicId, first: ids.slice(0, 2) }).toEqual({
        topicId,
        first: ['ueben', 'anwenden'],
      });
    }
  });
});

describe('one kind of work per set', () => {
  const application = (items: unknown[], extra: Record<string, unknown> = {}) =>
    parse({ ...base, activity: 'application', items, ...extra });
  const corpus = (sets: Record<string, ExerciseSet>) =>
    new Map(Object.entries(sets).map(([id, data]) => [id, { file: `${id}.yaml`, data }]));

  test('an application set names every listening, speaking and document item it holds', () => {
    expect(applicationIntruders(application([translate('t1')]))).toEqual([]);
    expect(
      applicationIntruders(
        application([translate('t1'), listen('l1'), speak('s1')], { stimulus: 'a2/doc' }),
      ),
    ).toEqual(['(stimulus)', 'l1 (listen)', 's1 (speak)']);
  });

  test('a new mixed application set fails, and a pending one waits', () => {
    const mixed = corpus({ 'a2/x-produktion': application([translate('t1'), speak('s1')]) });
    expect(exerciseStepProblems(mixed, [])[0]).toContain('move s1 (speak) to a task');
    expect(exerciseStepProblems(mixed, ['a2/x-produktion'])).toEqual([]);
  });

  test('a pending entry that no longer mixes, or names nothing, fails', () => {
    const clean = corpus({ 'a2/x-produktion': application([translate('t1')]) });
    expect(exerciseStepProblems(clean, ['a2/x-produktion'])[0]).toContain('no longer mixes');
    expect(exerciseStepProblems(clean, ['a2/gone'])[0]).toContain('which is not a set');
  });

  test("a task set's items fit its skill", () => {
    const task = (skill: string, items: unknown[], extra: Record<string, unknown> = {}) =>
      parse({ ...base, activity: 'task', skill, items, ...extra });
    expect(skillMisfits(task('hoeren', [listen('l1')]))).toEqual([]);
    expect(skillMisfits(task('hoeren', [listen('l1'), translate('t1')]))).toHaveLength(1);
    expect(skillMisfits(task('lesen', [translate('t1')], { stimulus: 'a2/doc' }))).toEqual([]);
    expect(skillMisfits(task('lesen', [translate('t1')]))).toHaveLength(1);
    expect(skillMisfits(task('lesen', [listen('l1')], { stimulus: 'a2/doc' }))).toHaveLength(1);
    expect(skillMisfits(task('sprechen', [speak('s1')]))).toEqual([]);
    expect(skillMisfits(task('sprechen', [speak('s1'), translate('t1')]))).toHaveLength(1);
    expect(skillMisfits(task('schreiben', [translate('t1')]))).toHaveLength(1);
  });

  test('the corpus holds, and the pending list only shrinks', () => {
    const { sets } = loadTaskSetCorpus(process.cwd());
    expect(exerciseStepProblems(sets)).toEqual([]);
    // Today's count. Splitting a mixed set lowers it, in the change that splits it; nothing raises it.
    expect(MIXED_APPLICATION_PENDING.length).toBe(54);
  });
});
