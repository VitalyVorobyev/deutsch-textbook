import { describe, expect, test } from 'vitest';
import { sceneDocumentFixture } from './test/fixtures';
import {
  ZeitleisteFestError,
  aeusserungAendern,
  aeusserungEntfernen,
  aeusserungHinzufuegen,
  aeusserungVerschieben,
  besetzungEntfernen,
  eintragHinzufuegen,
  istGeaendert,
  istSequentiell,
  katalogStimmeUebernehmen,
  mischungSetzen,
  rolleUmbenennen,
  stabilesJson,
  zeitleisteAusSkript,
} from './scene-draft';
import type { Scene, SpeechEntry } from '@da/schema/audio-scene';

/**
 * The rules that hold the document together, tested where they live.
 *
 * These are the assertions a component test cannot make honestly: "the timeline still places every
 * utterance exactly once" is a property of the document, and checking it through rendered DOM
 * would be checking whether a list happened to be drawn in the right order.
 */

const szene = sceneDocumentFixture as unknown as Scene;

function sprache(scene: Scene): SpeechEntry[] {
  return scene.timeline.filter((entry): entry is SpeechEntry => entry.type === 'speech');
}

describe('stabilesJson', () => {
  test('key order is not a difference', () => {
    // The engine hashes a scene through a sorted-key encoding for the same reason. Without this,
    // a form that rebuilt an object would read as an edit and offer to save nothing.
    expect(stabilesJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(
      stabilesJson({ a: [2, { c: 4, d: 3 }], b: 1 }),
    );
    expect(istGeaendert(szene, { ...szene })).toBe(false);
  });

  test('a changed field is a difference', () => {
    expect(istGeaendert(szene, aeusserungAendern(szene, 'line-1', { pace: 1.1 }))).toBe(true);
  });
});

describe('every utterance stays placed exactly once', () => {
  test('an edit round-trips to exactly the field that was edited', () => {
    const nachher = aeusserungAendern(szene, 'line-2', { display_text: 'Und wo ist das Bad?' });

    // The diff, taken over the serialised document: one field, and nothing else moved.
    expect(unterschiede(szene, nachher)).toEqual(['script.1.display_text']);
    expect(nachher.script[1]?.display_text).toBe('Und wo ist das Bad?');
    expect(stabilesJson(nachher.timeline)).toBe(stabilesJson(szene.timeline));
  });

  test('reordering the script reorders the sequential timeline with it', () => {
    const nachher = aeusserungVerschieben(szene, 'line-2', -1);

    expect(nachher.script.map((row) => row.id)).toEqual(['line-2', 'line-1']);
    expect(sprache(nachher).map((entry) => entry.utterance_id)).toEqual(['line-2', 'line-1']);
    // The bed did not move: a non-speech entry holds its position, which is what keeps
    // `ambience-1` naming the same bed after a line is moved.
    expect(nachher.timeline[2]).toEqual(szene.timeline[2]);
  });

  test('a new utterance is appended to the timeline, and a removed one leaves no slot', () => {
    const mehr = aeusserungHinzufuegen(szene);
    expect(mehr.script).toHaveLength(3);
    expect(sprache(mehr).map((entry) => entry.utterance_id)).toEqual([
      'line-1',
      'line-2',
      'line-3',
    ]);

    const weniger = aeusserungEntfernen(mehr, 'line-1');
    expect(sprache(weniger).map((entry) => entry.utterance_id)).toEqual(['line-2', 'line-3']);
    expect(weniger.timeline.filter((entry) => entry.type === 'ambience')).toHaveLength(1);
  });

  test('an inserted utterance lands where it was asked for, not at the end', () => {
    const nachher = aeusserungHinzufuegen(szene, 0);
    expect(nachher.script.map((row) => row.id)).toEqual(['line-1', 'line-3', 'line-2']);
    expect(sprache(nachher).map((entry) => entry.utterance_id)).toEqual([
      'line-1',
      'line-3',
      'line-2',
    ]);
  });

  test('an explicitly timed scene refuses rather than dropping the overlap', () => {
    // A speech entry with an `at_ms` is a deliberate overlap somebody set. Reordering cannot
    // preserve it, and quietly dropping it would move audio a reviewer has already approved.
    const ueberlappt: Scene = {
      ...szene,
      timeline: szene.timeline.map((entry) =>
        entry.type === 'speech' && entry.utterance_id === 'line-2'
          ? { ...entry, at_ms: 2900 }
          : entry,
      ),
    };

    expect(istSequentiell(ueberlappt)).toBe(false);
    expect(() => zeitleisteAusSkript(ueberlappt)).toThrow(ZeitleisteFestError);
  });
});

describe('a role name is a join key, so renaming is one operation over both sides', () => {
  test('the cast and every line that speaks it move together', () => {
    const nachher = rolleUmbenennen(szene, 'Maklerin', 'Vermieterin');

    expect(nachher.cast.map((member) => member.role)).toEqual(['Vermieterin', 'Mieter']);
    expect(nachher.script.map((row) => row.role)).toEqual(['Vermieterin', 'Mieter']);
    expect(unterschiede(szene, nachher)).toEqual(['cast.0.role', 'script.0.role']);
  });

  test('a name another role already holds is refused, not merged', () => {
    expect(rolleUmbenennen(szene, 'Maklerin', 'Mieter')).toBe(szene);
    expect(rolleUmbenennen(szene, 'Maklerin', '  ')).toBe(szene);
  });

  test('a role that still speaks cannot be removed', () => {
    expect(besetzungEntfernen(szene, 'Mieter')).toBe(szene);

    const stumm = aeusserungEntfernen(szene, 'line-2');
    expect(besetzungEntfernen(stumm, 'Mieter').cast.map((member) => member.role)).toEqual([
      'Maklerin',
    ]);
  });
});

describe('a new sound entry', () => {
  test('starts as a description rather than as a reference to bytes nobody chose', () => {
    const nachher = eintragHinzufuegen(szene, 'sfx');
    const letzter = nachher.timeline.at(-1);

    expect(letzter?.type).toBe('sfx');
    expect(letzter && 'sound' in letzter && 'prompt' in letzter.sound).toBe(true);
  });
});

/** Every leaf path whose value differs, so an assertion can name the edit exactly. */
function unterschiede(a: unknown, b: unknown, pfad = ''): string[] {
  if (stabilesJson(a) === stabilesJson(b)) return [];
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return [pfad];
  }
  const schluessel = new Set([
    ...Object.keys(a as Record<string, unknown>),
    ...Object.keys(b as Record<string, unknown>),
  ]);
  return [...schluessel]
    .sort()
    .flatMap((key) =>
      unterschiede(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        pfad ? `${pfad}.${key}` : key,
      ),
    );
}

describe('mischungSetzen', () => {
  const ersteZeile = (scene: Scene): number => scene.timeline.findIndex((e) => e.type === 'speech');

  test('a level returned to zero leaves the document, so the hash does not move', () => {
    const index = ersteZeile(szene);
    const leiser = mischungSetzen(szene, index, { gain_db: -6 });
    expect((leiser.timeline[index] as SpeechEntry).gain_db).toBe(-6);
    const zurueck = mischungSetzen(leiser, index, { gain_db: 0 });
    expect(Object.keys(zurueck.timeline[index]!)).not.toContain('gain_db');
    expect(istGeaendert(szene, zurueck)).toBe(false);
  });

  test('an equalizer back at flat removes the whole effects object', () => {
    const index = ersteZeile(szene);
    const hell = mischungSetzen(szene, index, { eq: { high_db: 3 } });
    const effekte = (hell.timeline[index] as SpeechEntry).effects;
    expect(effekte?.eq).toEqual({ low_db: 0, mid_db: 0, high_db: 3 });
    expect(effekte?.room_send_db).toBe(0);
    const flach = mischungSetzen(hell, index, { eq: { high_db: 0 } });
    expect(Object.keys(flach.timeline[index]!)).not.toContain('effects');
  });

  test('a room send keeps a flat equalizer out, and the band filters it found', () => {
    const index = ersteZeile(szene);
    const mitFilter = {
      ...szene,
      timeline: szene.timeline.map((entry, position) =>
        position === index
          ? ({
              ...entry,
              effects: {
                highpass: { hz: 120, sections: 1 },
                room_send_db: 0,
                eq: null,
                lowpass: null,
                compression: null,
                crush: null,
              },
            } as SpeechEntry)
          : entry,
      ),
    };
    const nass = mischungSetzen(mitFilter, index, { room_send_db: 4 });
    const effekte = (nass.timeline[index] as SpeechEntry).effects;
    expect(effekte?.room_send_db).toBe(4);
    expect(effekte?.eq).toBeNull();
    expect(effekte?.highpass).toEqual({ hz: 120, sections: 1 });
  });

  test('a bed’s ducking is set and cleared the same way', () => {
    const mitBett = eintragHinzufuegen(szene, 'ambience');
    const index = mitBett.timeline.length - 1;
    const geduckt = mischungSetzen(mitBett, index, { duck_db: -12 });
    expect((geduckt.timeline[index] as { duck_db?: number }).duck_db).toBe(-12);
    expect(
      Object.keys(mischungSetzen(geduckt, index, { duck_db: 0 }).timeline[index]!),
    ).not.toContain('duck_db');
  });
});

describe('katalogStimmeUebernehmen', () => {
  const rolle = (scene: Scene): string => scene.cast[0]!.role;
  const designt = {
    id: 'lena',
    version: 2,
    voice_profile: { engine: 'qwen_tts_designed', voice: 'a'.repeat(64), seed: 100, pace: 0.83 },
  };

  test('a designed profile brings its engine, drops the style and paces the role’s lines', () => {
    const neu = katalogStimmeUebernehmen(szene, rolle(szene), designt);
    const member = neu.cast[0]!;
    expect(member.voice.engine).toBe('qwen_tts_designed');
    expect(member.voice.voice).toBe('a'.repeat(64));
    expect(member.voice.style).toBeNull();
    expect(member.character).toEqual({ id: 'lena', version: 2 });
    for (const zeile of neu.script) {
      const vorher = szene.script.find((alt) => alt.id === zeile.id)!;
      expect(zeile.pace).toBe(zeile.role === rolle(szene) ? 0.83 : vorher.pace);
    }
  });

  test('adopting the same profile twice gives the same scene', () => {
    const einmal = katalogStimmeUebernehmen(szene, rolle(szene), designt);
    expect(istGeaendert(einmal, katalogStimmeUebernehmen(einmal, rolle(szene), designt))).toBe(
      false,
    );
  });

  test('a preset profile keeps its style and defaults to the preset engine', () => {
    const preset = {
      id: 'klara',
      version: 1,
      voice_profile: { voice: 'Vivian', seed: 200, style: 'Ruhig.', pace: 0.95 },
    };
    const member = katalogStimmeUebernehmen(szene, rolle(szene), preset).cast[0]!;
    expect(member.voice.engine).toBe('qwen_tts');
    expect(member.voice.style).toBe('Ruhig.');
  });
});
