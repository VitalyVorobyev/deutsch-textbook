import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { visualDocumentSchema } from '../src/lib/schemas';

const root = resolve(import.meta.dir, '..');

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('semantic learning visuals', () => {
  test('the pronominal-adverb flow keeps the governed preposition across both branches', () => {
    const component = source('src/components/visuals/PronominalAdverbFlow.astro');

    expect(component).toContain('<strong>warten <b>auf</b></strong>');
    expect(component).toContain('<strong>worauf?</strong>');
    expect(component).toContain('<strong>darauf</strong>');
    expect(component).toContain('<small>Wen?</small><strong>Person</strong>');
    expect(component).toContain('<strong>auf wen?</strong>');
    expect(component).toContain('<strong>auf sie</strong>');
    expect(component).toContain('nur vor einem Vokal');
    expect(component).toContain('@media (max-width: 560px)');
  });

  test('the nachdem timeline preserves chronological order and written tense labels', () => {
    const component = source('src/components/visuals/NarrativeTimelineFigure.astro');

    expect(component.indexOf('zuerst · früher')).toBeLessThan(component.indexOf('danach · später'));
    expect(component).toContain('Nachdem ich die Prüfung <b>bestanden hatte</b>');
    expect(component).toContain('<strong>Plusquamperfekt</strong>');
    expect(component).toContain('<strong>Präteritum</strong>');
    expect(component).toContain('transform: rotate(90deg)');
  });

  test('the job-ad extraction task uses the simulated document instead of quoting it', () => {
    const exercise = YAML.parse(
      source('content/exercises/b1/arbeit-bewerbung-produktion.yaml'),
    ) as {
      stimulus?: string;
      items: Array<{ id: string; revision?: number; prompt?: string }>;
    };
    const item = exercise.items.find((candidate) => candidate.id === 'lesen-stellenanzeige');
    const document = visualDocumentSchema.parse(
      YAML.parse(source('content/documents/b1/arbeit-bewerbung-stellenanzeige.yaml')),
    );

    expect(exercise.stimulus).toBe('b1/arbeit-bewerbung-stellenanzeige');
    // 3, not 2: the correct option was rewritten to name all three
    // Voraussetzungen the stimulus actually lists, which changes the accepted
    // answer and therefore owes a revision bump.
    expect(item?.revision).toBe(3);
    expect(item?.prompt).toBe('Was verlangt die Firma, und was bietet sie?');
    expect(item?.prompt).not.toContain('In der Anzeige steht');
    expect(document.sourceClass).toBe('simulated');
    expect(document.transcript).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Voraussetzungen: Erfahrung im Verkauf · gute Deutschkenntnisse'),
        expect.stringContaining('Wir bieten: eine Stelle in Teilzeit · jedes Jahr eine Weiterbildung'),
      ]),
    );
  });
});
