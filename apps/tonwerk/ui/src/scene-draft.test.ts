import { describe, expect, test } from 'vitest';
import { sceneDocumentFixture } from './test/fixtures';
import {
  ZeitleisteFestError,
  abweichungSetzen,
  geraetWechseln,
  raumAbweichungSetzen,
  raumWechseln,
  aeusserungAendern,
  aeusserungEntfernen,
  aeusserungHinzufuegen,
  aeusserungVerschieben,
  besetzungEntfernen,
  eintragHinzufuegen,
  istGeaendert,
  istSequentiell,
  katalogStimmeUebernehmen,
  INSERT_START,
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

  test('an insert is whole or absent, and the last one switched off removes the chain', () => {
    const index = ersteZeile(szene);
    const mitKompressor = mischungSetzen(szene, index, {
      compression: { ...INSERT_START.compression },
    });
    const effekte = (mitKompressor.timeline[index] as SpeechEntry).effects;
    expect(effekte?.compression).toEqual(INSERT_START.compression);
    expect(effekte?.eq).toBeNull();
    const mitCrusher = mischungSetzen(mitKompressor, index, { crush: { bits: 8, mix: 0.5 } });
    expect((mitCrusher.timeline[index] as SpeechEntry).effects?.compression).toEqual(
      INSERT_START.compression,
    );
    const ohne = mischungSetzen(mischungSetzen(mitCrusher, index, { compression: null }), index, {
      crush: null,
    });
    expect(Object.keys(ohne.timeline[index]!)).not.toContain('effects');
    expect(istGeaendert(szene, ohne)).toBe(false);
  });

  test('a band never passes nothing: the edge being moved stops short of the other', () => {
    const index = ersteZeile(szene);
    const band = mischungSetzen(szene, index, {
      highpass: { hz: 300, sections: 3 },
      lowpass: { hz: 3400, sections: 3 },
    });
    const hoch = mischungSetzen(band, index, { highpass: { hz: 5000, sections: 3 } });
    expect((hoch.timeline[index] as SpeechEntry).effects?.highpass?.hz).toBe(3399);
    const tief = mischungSetzen(band, index, { lowpass: { hz: 100, sections: 3 } });
    expect((tief.timeline[index] as SpeechEntry).effects?.lowpass?.hz).toBe(301);
  });

  test('the engine spells neutral out, the pult leaves it out, and that is no edit', () => {
    const index = ersteZeile(szene);
    // What the engine returns for a line nobody has mixed.
    const vomEngine = {
      ...szene,
      timeline: szene.timeline.map((entry, position) =>
        position === index ? ({ ...entry, gain_db: 0, effects: null } as SpeechEntry) : entry,
      ),
    };
    const hinUndZurueck = mischungSetzen(
      mischungSetzen(vomEngine, index, { gain_db: -6, highpass: { hz: 200, sections: 1 } }),
      index,
      { gain_db: 0, highpass: null },
    );
    expect(Object.keys(hinUndZurueck.timeline[index]!)).not.toContain('effects');
    expect(istGeaendert(vomEngine, hinUndZurueck)).toBe(false);
    expect(istGeaendert(vomEngine, mischungSetzen(vomEngine, index, { gain_db: -6 }))).toBe(true);
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

describe('device overrides on a placement', () => {
  const pa = { highpass_hz: 180, lowpass_hz: 5600, gain_db: -1, room_send_db: 5 };
  const ort = { device: 'pa', distance: 1, pan: 0 };

  test('an override is written whole, and one back at the device or emptied leaves nothing', () => {
    const tiefer = abweichungSetzen(ort, 'lowpass_hz', 4200, pa);
    expect(tiefer.device_overrides).toEqual({
      gain_db: null,
      highpass_hz: null,
      lowpass_hz: 4200,
      room_send_db: null,
    });
    expect(abweichungSetzen(tiefer, 'lowpass_hz', 5600, pa)).toEqual(ort);
    expect(abweichungSetzen(tiefer, 'lowpass_hz', null, pa)).toEqual(ort);
  });

  test("the band never passes nothing, the device's own edge counting", () => {
    expect(abweichungSetzen(ort, 'lowpass_hz', 100, pa).device_overrides?.lowpass_hz).toBe(181);
    expect(abweichungSetzen(ort, 'highpass_hz', 9000, pa).device_overrides?.highpass_hz).toBe(5599);
  });

  test('another device drops the overrides, which were numbers against the old one', () => {
    const tiefer = abweichungSetzen(ort, 'lowpass_hz', 4200, pa);
    expect(geraetWechseln(tiefer, 'telephone')).toEqual({ ...ort, device: 'telephone' });
  });

  test('an engine-spelled null override is no edit', () => {
    const mitOrt = (device_overrides?: null): Scene => ({
      ...szene,
      timeline: szene.timeline.map((entry) =>
        entry.type === 'speech'
          ? {
              ...entry,
              placement: { ...ort, ...(device_overrides === null ? { device_overrides } : {}) },
            }
          : entry,
      ),
    });
    expect(istGeaendert(mitOrt(null), mitOrt())).toBe(false);
    expect(
      istGeaendert(mitOrt(), {
        ...mitOrt(),
        timeline: mitOrt().timeline.map((entry) =>
          entry.type === 'speech'
            ? { ...entry, placement: abweichungSetzen(ort, 'gain_db', -3, pa) }
            : entry,
        ),
      }),
    ).toBe(true);
  });
});

describe('room overrides on a scene', () => {
  const halle = { wet: 0.34, decay_s: 2.6, pre_delay_ms: 28, lowpass_hz: 4200 };
  const akustik = { lead_in_ms: 0, room: 'station-hall' };

  test('an override is written whole, and one back at the room or emptied leaves nothing', () => {
    const kuerzer = raumAbweichungSetzen(akustik, 'decay_s', 1.8, halle);
    expect(kuerzer.room_overrides).toEqual({
      decay_s: 1.8,
      lowpass_hz: null,
      pre_delay_ms: null,
      wet: null,
    });
    expect(raumAbweichungSetzen(kuerzer, 'decay_s', 2.6, halle)).toEqual(akustik);
    expect(raumAbweichungSetzen(kuerzer, 'decay_s', null, halle)).toEqual(akustik);
  });

  test('another room, or none, drops the overrides', () => {
    const kuerzer = raumAbweichungSetzen(akustik, 'wet', 0.2, halle);
    expect(raumWechseln(kuerzer, 'cafe')).toEqual({ ...akustik, room: 'cafe' });
    expect(raumWechseln(kuerzer, null)).toEqual({ ...akustik, room: null });
  });
});
