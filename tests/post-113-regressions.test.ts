import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { exerciseSetSchema, type ExerciseSet } from '@da/schema';

const root = resolve(import.meta.dir, '..');

function exercise(path: string): ExerciseSet {
  return exerciseSetSchema.parse(YAML.parse(readFileSync(join(root, path), 'utf8')));
}

describe('late PR #113 regressions', () => {
  test('the floor-plan task asks for only relations visible in the plan', () => {
    const set = exercise('content/exercises/a2/wohnen-umzug-dokument.yaml');
    const item = set.items.find((candidate) => candidate.id === 'dokument-wohnung-grundriss');
    if (!item || item.type !== 'write') throw new Error('missing floor-plan writing item');

    expect(item.revision).toBe(4);
    expect(item.min_words).toBe(12);
    expect(item.model_answer).toBe(
      'Das Wohnzimmer liegt neben dem Schlafzimmer. Die Küche befindet sich zwischen dem Bad und dem Flur.',
    );
    expect(item.model_answer).not.toContain('Balkon');
    expect(item.requirements.map((requirement) => requirement.en)).toEqual([
      'Place the living room next to the bedroom.',
      'Place the kitchen between the bathroom and the hall.',
      'Use dative forms after neben and zwischen because both relations answer Wo?.',
    ]);
  });

  test('the participant caption preserves a grammatical dative recipient', () => {
    const source = readFileSync(
      join(root, 'src/components/visuals/ParticipantRoleFigure.astro'),
      'utf8',
    );
    const givingView = source.slice(source.indexOf('id="participant-giving"'));
    expect(source).toContain(
      'Nina gibt dem Nachbarn den Schlüssel: Sie handelt, er empfängt, und der Schlüssel',
    );
    expect(source).not.toContain('dem Nachbarn</strong> erreicht');
    expect(givingView).toContain('class="avatar-icon"');
    expect(givingView).toContain('class="key-icon"');
    expect(givingView).not.toContain('●');
    expect(givingView).not.toContain('○');
    expect(givingView).not.toContain('▰');
  });

  test('the product comparison evaluates the facts, not one exact sentence', () => {
    const set = exercise('content/exercises/a2/einkaufen-reklamation-dokument.yaml');
    const item = set.items.find((candidate) => candidate.id === 'dokument-produkte-vergleichen');
    if (!item || item.type !== 'write') throw new Error('missing product-comparison writing item');

    expect(item.revision).toBe(3);
    expect(item.min_words).toBe(13);
    expect(item.model_answer).toContain('schwerer und teurer als');
    expect(item.model_answer).toContain('zehn Stunden länger');
    expect(item.requirements.map((requirement) => requirement.en)).toEqual([
      'Compare both weight and price with comparative + als.',
      'State the ten-hour battery advantage.',
      'Use the product names so every comparison has an unambiguous referent.',
    ]);
  });
});
