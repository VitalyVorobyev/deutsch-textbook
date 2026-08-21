import { describe, expect, test } from 'vitest';
import {
  PRUEFPUNKTE,
  erforderlich,
  fehlende,
  satzFuer,
  standIndex,
  wortDiff,
} from './pruefung';
import { sceneDocumentFixture } from './test/fixtures';
import type { Scene } from '@da/schema/audio-scene';

/**
 * The checklist rules, held here because none of them is visible when it breaks.
 *
 * A checklist that quietly stops requiring `context` still renders tidy rows and still produces a
 * signature; the manifest it writes just no longer says what it claims to say. That is the failure
 * `docs/authoring/product-protection.md` exists to prevent, and it has no other gate.
 */

const scene = sceneDocumentFixture as unknown as Scene;

describe('what a scene requires', () => {
  test('the six unconditional points are always required', () => {
    const noetig = erforderlich(scene, false);
    for (const key of ['accent', 'naturalness', 'intelligibility', 'identity', 'speakers', 'pace']) {
      expect(noetig.has(key)).toBe(true);
    }
  });

  test('`context` is required exactly when the scene has non-speech material', () => {
    // The fixture carries an ambience bed.
    expect(erforderlich(scene, false).has('context')).toBe(true);

    const still: Scene = {
      ...scene,
      timeline: scene.timeline.filter((entry) => entry.type === 'speech'),
    };
    // Nothing to mask a syllable, so nothing to certify about one. A point nobody can answer
    // honestly is the fastest way to teach ticking without reading.
    expect(erforderlich(still, false).has('context')).toBe(false);
  });

  test('`questions` is required exactly when an exercise hangs on the scene', () => {
    expect(erforderlich(scene, false).has('questions')).toBe(false);
    expect(erforderlich(scene, true).has('questions')).toBe(true);
  });

  test('the eight keys are the engine’s vocabulary, spelled the way it spells them', () => {
    // The engine refuses an unknown key by name. This is the list it will accept.
    expect(PRUEFPUNKTE.map((punkt) => punkt.key)).toEqual([
      'accent',
      'naturalness',
      'intelligibility',
      'identity',
      'speakers',
      'pace',
      'questions',
      'context',
    ]);
  });

  test('nothing is certified by default: an empty set is missing everything required', () => {
    const noetig = erforderlich(scene, true);
    expect(fehlende(noetig, new Set()).length).toBe(noetig.size);
    expect(fehlende(noetig, noetig)).toEqual([]);
  });

  test('the missing list keeps the order the points are shown in', () => {
    const noetig = erforderlich(scene, true);
    expect(fehlende(noetig, new Set(['accent', 'pace']))).toEqual([
      'naturalness',
      'intelligibility',
      'identity',
      'speakers',
      'questions',
      'context',
    ]);
  });
});

describe('the sentences', () => {
  test('the level is filled in, because A1 and B1 do not mean the same by “not rushed”', () => {
    const tempo = PRUEFPUNKTE.find((punkt) => punkt.key === 'pace');
    expect(tempo).toBeDefined();
    expect(satzFuer(tempo!, 'A2')).toContain('Das Tempo passt zu A2');
    // A scene with no brief still gets a readable sentence rather than a literal `{level}`.
    expect(satzFuer(tempo!, null)).not.toContain('{level}');
  });
});

describe('the flow', () => {
  test('the stages are ordered, so a stage knows what is behind it', () => {
    expect(standIndex('hoeren')).toBeLessThan(standIndex('pruefen'));
    expect(standIndex('pruefen')).toBeLessThan(standIndex('entschieden'));
  });
});

describe('the transcript alignment', () => {
  test('an identical pair marks nothing', () => {
    const diff = wortDiff('Mit Milch, bitte.', 'Mit Milch, bitte.');
    expect(diff.erwartet.every((wort) => wort.art === 'gleich')).toBe(true);
    expect(diff.erkannt.every((wort) => wort.art === 'gleich')).toBe(true);
  });

  test('a dropped word is marked on the script side and nowhere else', () => {
    const diff = wortDiff('Sie hat drei Zimmer', 'Sie hat Zimmer');
    expect(diff.erwartet.filter((wort) => wort.art === 'fehlt').map((wort) => wort.wort)).toEqual([
      'drei',
    ]);
    expect(diff.erkannt.filter((wort) => wort.art !== 'gleich')).toEqual([]);
  });

  test('an invented word is marked on the heard side', () => {
    const diff = wortDiff('Guten Tag', 'Guten schönen Tag');
    expect(
      diff.erkannt.filter((wort) => wort.art === 'zusätzlich').map((wort) => wort.wort),
    ).toEqual(['schönen']);
  });

  test('punctuation and case are not defects: the ASR produces neither reliably', () => {
    const diff = wortDiff('Und wo ist die Küche?', 'und wo ist die küche');
    expect(diff.erwartet.every((wort) => wort.art === 'gleich')).toBe(true);
    // The words are shown as they were written, only compared without their decoration.
    expect(diff.erwartet.at(-1)?.wort).toBe('Küche?');
  });

  test('a substitution shows both halves, one on each side', () => {
    const diff = wortDiff('Der Termin ist am Freitag', 'Der Termin ist am Freitagabend');
    expect(diff.erwartet.filter((wort) => wort.art === 'fehlt').map((wort) => wort.wort)).toEqual([
      'Freitag',
    ]);
    expect(
      diff.erkannt.filter((wort) => wort.art === 'zusätzlich').map((wort) => wort.wort),
    ).toEqual(['Freitagabend']);
  });
});
