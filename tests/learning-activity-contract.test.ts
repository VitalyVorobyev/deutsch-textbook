import { describe, expect, test } from 'bun:test';
import { exerciseSetSchema } from '@da/schema';
import { learningMedium } from '@da/content/elements';

const item = {
  id: 'fixture-item',
  type: 'translate' as const,
  revision: 1,
  outcomes: ['fixture-outcome'],
  prompt_en: 'I am here.',
  prompt_ru: 'Я здесь.',
  answer: 'Ich bin hier.',
  key_tokens: ['bin'],
};

const base = {
  topic: 'fixture-topic',
  role: 'practice' as const,
  stage: 'geruest' as const,
  activity: 'core' as const,
  title_de: 'Grundübung — Fixture',
  title: { en: 'Core practice', ru: 'Основная практика' },
  items: [item],
};

describe('learning-activity contract', () => {
  test('a teaching set must state purpose, stage and a German activity title', () => {
    for (const key of ['activity', 'stage', 'title_de'] as const) {
      const candidate = { ...base } as Record<string, unknown>;
      delete candidate[key];
      expect(exerciseSetSchema.safeParse(candidate).success).toBe(false);
    }
  });

  test('purpose constrains role and stage instead of acting as a decorative label', () => {
    expect(exerciseSetSchema.safeParse(base).success).toBe(true);
    expect(exerciseSetSchema.safeParse({ ...base, activity: 'application' }).success).toBe(false);
    expect(exerciseSetSchema.safeParse({ ...base, role: 'drill', activity: 'remediation', stage: 'ausblenden' }).success).toBe(true);
    expect(exerciseSetSchema.safeParse({ ...base, role: 'drill', activity: 'core' }).success).toBe(false);
  });

  test('medium is derived independently from pedagogical purpose', () => {
    const listening = exerciseSetSchema.parse({
      ...base,
      activity: 'application',
      stage: 'transfer',
      items: [{
        id: 'listen-item',
        type: 'listen',
        revision: 1,
        outcomes: ['fixture-outcome'],
        text: 'Ich bin hier.',
        translation: { en: 'I am here.', ru: 'Я здесь.' },
      }],
    });
    expect(learningMedium(listening)).toBe('listening');
    expect(learningMedium(exerciseSetSchema.parse({ ...base, stimulus: 'fixture-document' }))).toBe('document');
    expect(learningMedium(exerciseSetSchema.parse(base))).toBe('mixed');
  });
});
