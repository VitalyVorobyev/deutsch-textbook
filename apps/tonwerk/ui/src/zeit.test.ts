import { describe, expect, test } from 'vitest';
import { sceneDocumentFixture } from './test/fixtures';
import {
  bettSetzen,
  eintragHinzufuegen,
  eintragIds,
  ereigniszeitSetzen,
  istSequentiell,
  nurZeitGeaendert,
  sprechzeitLoesen,
  sprechzeitRahmen,
  sprechzeitSetzen,
} from './scene-draft';
import { verlaufSetzen, verlaufStart, verlaufVor, verlaufZurueck, ZUSAMMEN_MS } from './verlauf';
import { einsaetze } from './views/szene/vorschau';
import { verschieben } from './views/szene/Zeitleiste';
import type { AmbienceEntry, Scene, SpeechEntry } from '@da/schema/audio-scene';

/**
 * Timing on the timeline: what a drag writes into the document, how undo walks the draft, and what
 * the preview plays. Each fixture states the fields its assertion reads.
 */

const szene = sceneDocumentFixture as unknown as Scene;
const mitBlei = (lead: number): Scene => ({
  ...szene,
  acoustics: { ...szene.acoustics, lead_in_ms: lead },
});
const sprache = (scene: Scene, index: number) => scene.timeline[index] as SpeechEntry;
const bett = (scene: Scene, index: number) => scene.timeline[index] as AmbienceEntry;

describe('entry ids', () => {
  test('a turn is its utterance, a bed or an event is numbered among its own kind', () => {
    const mehr = eintragHinzufuegen(eintragHinzufuegen(szene, 'sfx'), 'ambience');
    expect(eintragIds(mehr)).toEqual(['line-1', 'line-2', 'ambience-1', 'sfx-1', 'ambience-2']);
  });
});

describe('pinning a turn', () => {
  test('pins it, rounds to the millisecond, and makes the script unreorderable', () => {
    const fest = sprechzeitSetzen(szene, 1, 2499.6);
    expect(sprache(fest, 1).at_ms).toBe(2500);
    expect(sprache(fest, 0).at_ms).toBeNull();
    expect(istSequentiell(fest)).toBe(false);
    expect(sprechzeitLoesen(fest, 1)).toEqual(szene);
  });

  test('explicit times never move backwards: a pin is held between its pinned neighbours', () => {
    const beide = sprechzeitSetzen(sprechzeitSetzen(szene, 0, 1000), 1, 4000);
    expect(sprechzeitRahmen(beide, 1)).toEqual({ min: 1000, max: Number.POSITIVE_INFINITY });
    expect(sprache(sprechzeitSetzen(beide, 1, 200), 1).at_ms).toBe(1000);
    expect(sprache(sprechzeitSetzen(beide, 0, 9000), 0).at_ms).toBe(4000);
    expect(sprache(sprechzeitSetzen(szene, 0, -50), 0).at_ms).toBe(0);
  });

  test('a time on a bed index is refused rather than written into the wrong arm', () => {
    expect(sprechzeitSetzen(szene, 2, 100)).toBe(szene);
    expect(ereigniszeitSetzen(szene, 0, 100)).toBe(szene);
  });
});

describe('a bed', () => {
  test('keeps “to the end of the scene” and never closes its span', () => {
    expect(bett(bettSetzen(szene, 2, { start_ms: 1200 }), 2)).toMatchObject({
      start_ms: 1200,
      end_ms: null,
    });
    expect(bett(bettSetzen(szene, 2, { start_ms: 1200, end_ms: 900 }), 2).end_ms).toBe(1201);
    expect(bett(bettSetzen(szene, 2, { fade_in_ms: 20000, fade_out_ms: -5 }), 2)).toMatchObject({
      fade_in_ms: 10000,
      fade_out_ms: 0,
    });
  });
});

describe('what a drag writes', () => {
  test('a turn is stored after the speech start, an event and a bed in scene time', () => {
    const lage = { start_ms: 3570, end_ms: 5400 };
    expect(sprache(verschieben(mitBlei(800), 'line-2', lage, 'mitte', -500), 1).at_ms).toBe(2270);
    const mitEreignis = eintragHinzufuegen(szene, 'sfx');
    const ereignis = verschieben(mitEreignis, 'sfx-1', { start_ms: 0, end_ms: 400 }, 'mitte', 650);
    expect(ereignis.timeline[3]).toMatchObject({ type: 'sfx', at_ms: 650 });
  });

  test('a bed moves by its body and stretches by its edges', () => {
    const lage = { start_ms: 0, end_ms: 5400 };
    expect(bett(verschieben(szene, 'ambience-1', lage, 'mitte', 300), 2)).toMatchObject({
      start_ms: 300,
      end_ms: null,
    });
    expect(bett(verschieben(szene, 'ambience-1', lage, 'ende', -400), 2).end_ms).toBe(5000);
    expect(bett(verschieben(szene, 'ambience-1', lage, 'anfang', 250), 2)).toMatchObject({
      start_ms: 250,
      end_ms: null,
    });
  });

  test('only timing changed is told apart from a change a render must hear', () => {
    expect(nurZeitGeaendert(szene, sprechzeitSetzen(szene, 1, 100))).toBe(true);
    expect(nurZeitGeaendert(szene, bettSetzen(szene, 2, { fade_in_ms: 0 }))).toBe(true);
    const lauter = {
      ...szene,
      timeline: szene.timeline.map((e, i) => (i === 2 ? { ...e, gain_db: -12 } : e)),
    };
    expect(nurZeitGeaendert(szene, lauter as Scene)).toBe(false);
  });
});

describe('undo inside the draft', () => {
  test('steps back and forward, and a new change drops what was undone', () => {
    let verlauf = verlaufStart('a');
    verlauf = verlaufSetzen(verlauf, 'b', 0);
    verlauf = verlaufSetzen(verlauf, 'c', 10_000);
    verlauf = verlaufZurueck(verlauf);
    expect(verlauf.jetzt).toBe('b');
    verlauf = verlaufVor(verlauf);
    expect(verlauf.jetzt).toBe('c');
    verlauf = verlaufSetzen(verlaufZurueck(verlaufZurueck(verlauf)), 'x', 20_000);
    expect(verlauf).toMatchObject({ vorher: ['a'], jetzt: 'x', nachher: [] });
    expect(verlaufZurueck(verlaufStart('a')).jetzt).toBe('a');
  });

  test('a burst of changes — a fader, a typed number — is one step', () => {
    let verlauf = verlaufStart(0);
    for (let wert = 1; wert <= 40; wert += 1) verlauf = verlaufSetzen(verlauf, wert, wert * 10);
    expect(verlauf.vorher).toEqual([0]);
    expect(verlaufZurueck(verlauf).jetzt).toBe(0);
    const spaeter = verlaufSetzen(verlauf, 41, 400 + ZUSAMMEN_MS);
    expect(spaeter.vorher).toEqual([0, 40]);
  });
});

describe('the preview', () => {
  const gemessen = [
    { entry_id: 'line-1', type: 'speech', start_ms: 0, end_ms: 3000 },
    { entry_id: 'line-2', type: 'speech', start_ms: 3500, end_ms: 5000 },
    { entry_id: 'ambience-1', type: 'ambience', start_ms: 0, end_ms: 5000 },
  ];

  test('plays each measured stretch at its planned time', () => {
    const geplant = [
      gemessen[0]!,
      { ...gemessen[1]!, start_ms: 2500, end_ms: 4000 },
      { ...gemessen[2]!, end_ms: 9000 },
    ];
    expect(einsaetze(geplant, gemessen, 0)).toEqual([
      { entryId: 'line-1', wannMs: 0, abMs: 0, dauerMs: 3000 },
      { entryId: 'line-2', wannMs: 2500, abMs: 3500, dauerMs: 1500 },
      // A bed made longer than it was rendered plays only as long as it was rendered.
      { entryId: 'ambience-1', wannMs: 0, abMs: 0, dauerMs: 5000 },
    ]);
  });

  test('from a later point, what has passed is skipped and an entry under way is joined', () => {
    const geplant = [gemessen[0]!, { ...gemessen[1]!, start_ms: 2500, end_ms: 4000 }];
    expect(einsaetze(geplant, gemessen, 3000)).toEqual([
      { entryId: 'line-2', wannMs: 0, abMs: 4000, dauerMs: 1000 },
    ]);
    const neu = [{ entry_id: 'sfx-1', type: 'sfx', start_ms: 0, end_ms: 500 }];
    expect(einsaetze(neu, gemessen, 0)).toEqual([]);
  });
});
