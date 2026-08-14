import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { gradeTranslation, verdictIsCorrect } from '@da/grading/production';
import { exerciseSetSchema, type ExerciseSet } from '@da/schema';

const root = resolve(import.meta.dir, '..');

function exercise(path: string): ExerciseSet {
  return exerciseSetSchema.parse(YAML.parse(readFileSync(join(root, path), 'utf8')));
}

describe('late PR #113 regressions', () => {
  test('the floor-plan task grades only relations visible in the plan', () => {
    const set = exercise('content/exercises/a2/wohnen-umzug-dokument.yaml');
    const item = set.items.find((candidate) => candidate.id === 'dokument-wohnung-grundriss');
    if (!item || item.type !== 'translate') throw new Error('missing floor-plan translation item');

    expect(item.revision).toBe(3);
    expect(item.prompt_en).toBe(
      'The living room is next to the bedroom. The kitchen is between the bathroom and the hall.',
    );
    expect(item.answer).toContain('Das Wohnzimmer ist neben dem Schlafzimmer.');
    expect([item.answer, ...item.accept].join(' ')).not.toContain('Balkon');
    for (const mixed of [
      'Das Wohnzimmer liegt neben dem Schlafzimmer. Die Küche ist zwischen dem Bad und dem Flur.',
      'Das Wohnzimmer ist neben dem Schlafzimmer. Die Küche liegt zwischen dem Bad und dem Flur.',
    ]) {
      expect(item.accept).toContain(mixed);
      expect(
        verdictIsCorrect(
          gradeTranslation(mixed, {
            answer: item.answer,
            accept: item.accept,
            focus: item.focus,
            keyTokens: item.key_tokens,
          }),
        ),
      ).toBe(true);
    }
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

  test('independently accepted comparison choices compose', () => {
    const set = exercise('content/exercises/a2/einkaufen-reklamation-dokument.yaml');
    const item = set.items.find((candidate) => candidate.id === 'dokument-produkte-vergleichen');
    if (!item || item.type !== 'translate') throw new Error('missing product-comparison translation item');
    const combined =
      'SoundPro ist schwerer und kostet mehr als SoundGo, aber sein Akku hält zehn Stunden länger.';

    expect(item.revision).toBe(2);
    expect(item.accept).toContain(combined);
    expect(
      verdictIsCorrect(
        gradeTranslation(combined, {
          answer: item.answer,
          accept: item.accept,
          focus: item.focus,
          keyTokens: item.key_tokens,
        }),
      ),
    ).toBe(true);
  });
});
