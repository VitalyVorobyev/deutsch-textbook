/**
 * Editing a scene document, as pure functions over the document.
 *
 * **The scene document is the truth and the editor edits a copy of it.** Nothing here touches the
 * network, React or the DOM: every operation takes a `Scene` and returns a new one, so the
 * editor's whole model is "a draft, an original, and the difference between them". That is what
 * makes Save a single `PUT` of the draft and Verwerfen a single assignment — and what makes the
 * rules below testable without a browser.
 *
 * Two invariants live here rather than in a view, because a view cannot hold them:
 *
 * **1 · Every utterance is placed exactly once.** `script` says what is said and `timeline` says
 * when; a scene whose script gained a line the timeline never places renders that line as silence
 * nobody hears is missing. So the script operations regenerate the timeline's speech entries from
 * script order — and only for scenes whose speech is *sequential*.
 *
 * **2 · Explicit timing is not ours to rewrite.** A speech entry with an `at_ms` is a deliberate
 * overlap: somebody decided this turn starts 220 ms before the previous one ends. Reordering the
 * script cannot preserve that decision, and silently dropping it would move audio a reviewer has
 * already approved. So `istSequentiell` gates the reordering operations and the editor shows an
 * explicitly-timed scene's placement read-only.
 *
 * `stabilesJson` is the third thing here and the least obvious: key order is not part of a
 * document, so "has this changed" cannot be `JSON.stringify(a) !== JSON.stringify(b)`. The engine
 * hashes a scene through a canonical, sorted-key encoding for exactly the same reason
 * (`gateway._canonical_json`), and the draft comparison uses one too — otherwise a round-trip
 * through a form that rebuilt an object would read as an edit and offer to save nothing.
 */
import type {
  AmbienceEntry,
  CastMember,
  Scene,
  SfxEntry,
  SpeechEntry,
  TimelineEntry,
  Utterance,
} from '@da/schema/audio-scene';

/** JSON with every object's keys in sorted order, at every depth. */
export function stabilesJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stabilesJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stabilesJson(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Whether the draft says anything the original does not. Key order is not a difference. */
export function istGeaendert(original: Scene, entwurf: Scene): boolean {
  return stabilesJson(original) !== stabilesJson(entwurf);
}

/** The reordering rules refuse rather than guess, and they say so with this. */
export class ZeitleisteFestError extends Error {
  constructor() {
    super(
      'Diese Szene setzt Sprechzeiten ausdrücklich (at_ms). Das Skript lässt sich hier nicht ' +
        'umstellen, ohne eine Überlappung zu verwerfen, die jemand bewusst gesetzt hat.',
    );
    this.name = 'ZeitleisteFestError';
  }
}

export function istSprache(entry: TimelineEntry): entry is SpeechEntry {
  return entry.type === 'speech';
}

/** True when every speech entry follows the previous one — the case the editor may reorder. */
export function istSequentiell(scene: Scene): boolean {
  return scene.timeline.filter(istSprache).every((entry) => entry.at_ms === null);
}

/**
 * The timeline with its speech entries rebuilt from script order.
 *
 * The *positions* of the speech slots are kept, not just their count: an ambience bed declared
 * between two turns stays between them, and `graph.render._entry_ids` numbers sfx and ambience by
 * their order among their own kind — so preserving non-speech positions is what keeps `sfx-2`
 * meaning the same event after a line is moved.
 *
 * An existing entry is reused when its utterance still exists, which carries its `placement`
 * (a device, a pan) across the move. New utterances get a plain sequential entry; slots left over
 * by a deleted utterance are removed.
 */
export function zeitleisteAusSkript(scene: Scene): TimelineEntry[] {
  if (!istSequentiell(scene)) throw new ZeitleisteFestError();
  const vorhanden = new Map(
    scene.timeline.filter(istSprache).map((entry) => [entry.utterance_id, entry]),
  );
  const gewuenscht: SpeechEntry[] = scene.script.map(
    (utterance) =>
      vorhanden.get(utterance.id) ?? {
        type: 'speech',
        utterance_id: utterance.id,
        at_ms: null,
        placement: null,
      },
  );
  const plaetze = scene.timeline.flatMap((entry, index) => (istSprache(entry) ? [index] : []));

  const naechste: TimelineEntry[] = [];
  let genommen = 0;
  for (const [index, entry] of scene.timeline.entries()) {
    if (!istSprache(entry)) {
      naechste.push(entry);
      continue;
    }
    // The n-th speech slot takes the n-th script line. A slot with no line left is dropped.
    const ersatz = gewuenscht[plaetze.indexOf(index)];
    if (ersatz) {
      naechste.push(ersatz);
      genommen += 1;
    }
  }
  // More lines than slots: the surplus is appended, which is where a new last line belongs.
  naechste.push(...gewuenscht.slice(genommen));
  return naechste;
}

function mitSkript(scene: Scene, script: Utterance[]): Scene {
  return { ...scene, script, timeline: zeitleisteAusSkript({ ...scene, script }) };
}

/** One utterance's fields, changed in place. Never touches the timeline: nothing moved. */
export function aeusserungAendern(scene: Scene, id: string, patch: Partial<Utterance>): Scene {
  return {
    ...scene,
    script: scene.script.map((utterance) =>
      utterance.id === id ? { ...utterance, ...patch } : utterance,
    ),
  };
}

/** The id a new line gets: `line-<n>`, skipping any the scene already uses. */
export function naechsteAeusserungsId(scene: Scene): string {
  const belegt = new Set(scene.script.map((utterance) => utterance.id));
  for (let nummer = scene.script.length + 1; ; nummer += 1) {
    const id = `line-${nummer}`;
    if (!belegt.has(id)) return id;
  }
}

/** A new line after `nachIndex` (or at the end), cast on the role the previous line used. */
export function aeusserungHinzufuegen(scene: Scene, nachIndex?: number): Scene {
  const stelle = nachIndex === undefined ? scene.script.length : nachIndex + 1;
  const vorherige = scene.script[Math.max(0, stelle - 1)];
  const neu: Utterance = {
    id: naechsteAeusserungsId(scene),
    role: vorherige?.role ?? scene.cast[0]?.role ?? '',
    display_text: '',
    synthesis_text: null,
    pace: 1,
    pause_after_ms: 600,
    pronunciation_overrides: [],
    seed_override: null,
  };
  const script = [...scene.script];
  script.splice(stelle, 0, neu);
  return mitSkript(scene, script);
}

export function aeusserungEntfernen(scene: Scene, id: string): Scene {
  return mitSkript(
    scene,
    scene.script.filter((utterance) => utterance.id !== id),
  );
}

/** Move one line by one position. `richtung` is -1 (up) or 1 (down). */
export function aeusserungVerschieben(scene: Scene, id: string, richtung: -1 | 1): Scene {
  const von = scene.script.findIndex((utterance) => utterance.id === id);
  const nach = von + richtung;
  if (von < 0 || nach < 0 || nach >= scene.script.length) return scene;
  const script = [...scene.script];
  const [bewegt] = script.splice(von, 1);
  if (bewegt) script.splice(nach, 0, bewegt);
  return mitSkript(scene, script);
}

/**
 * Rename a role in the cast, and in every line that speaks it.
 *
 * A role name is a **join key**: `Utterance.role` names a `CastMember.role` and nothing else
 * relates them. Renaming one side alone leaves lines cast on a voice that no longer exists, which
 * the render refuses — late, after the reviewer has moved on. So the two are one operation.
 */
export function rolleUmbenennen(scene: Scene, alt: string, neu: string): Scene {
  const name = neu.trim();
  if (!name || name === alt) return scene;
  if (scene.cast.some((member) => member.role === name)) return scene;
  return {
    ...scene,
    cast: scene.cast.map((member) => (member.role === alt ? { ...member, role: name } : member)),
    script: scene.script.map((utterance) =>
      utterance.role === alt ? { ...utterance, role: name } : utterance,
    ),
  };
}

export function besetzungAendern(scene: Scene, rolle: string, patch: Partial<CastMember>): Scene {
  return {
    ...scene,
    cast: scene.cast.map((member) => (member.role === rolle ? { ...member, ...patch } : member)),
  };
}

export function besetzungHinzufuegen(scene: Scene): Scene {
  const belegt = new Set(scene.cast.map((member) => member.role));
  let name = 'Rolle';
  for (let nummer = 2; belegt.has(name); nummer += 1) name = `Rolle ${nummer}`;
  const vorlage = scene.cast[0]?.voice;
  return {
    ...scene,
    cast: [
      ...scene.cast,
      {
        role: name,
        character: null,
        voice: {
          engine: vorlage?.engine ?? 'qwen_tts',
          voice: vorlage?.voice ?? '',
          seed: 0,
          style: null,
          // A new role starts on a preset voice even when the role beside it is cloned. Copying
          // the template's `voice_ref` would cast a consented person in a part nobody assigned
          // them to, which is a decision and not a default.
          voice_ref: null,
        },
      },
    ],
  };
}

/** Whether a role can go: a cast member with lines is load-bearing, and removing it is not a fix. */
export function rolleIstFrei(scene: Scene, rolle: string): boolean {
  return !scene.script.some((utterance) => utterance.role === rolle);
}

export function besetzungEntfernen(scene: Scene, rolle: string): Scene {
  if (!rolleIstFrei(scene, rolle) || scene.cast.length <= 1) return scene;
  return { ...scene, cast: scene.cast.filter((member) => member.role !== rolle) };
}

// -- the sound half of the timeline -------------------------------------------------------------

export function istBett(entry: TimelineEntry): entry is AmbienceEntry {
  return entry.type === 'ambience';
}

export function istEreignis(entry: TimelineEntry): entry is SfxEntry {
  return entry.type === 'sfx';
}

/** One timeline entry's fields, by its index in `timeline`. Speech entries are edited elsewhere. */
export function eintragAendern(
  scene: Scene,
  index: number,
  patch: Partial<AmbienceEntry> | Partial<SfxEntry>,
): Scene {
  return {
    ...scene,
    timeline: scene.timeline.map((entry, position) =>
      position === index ? ({ ...entry, ...patch } as TimelineEntry) : entry,
    ),
  };
}

export function eintragEntfernen(scene: Scene, index: number): Scene {
  return { ...scene, timeline: scene.timeline.filter((_, position) => position !== index) };
}

/**
 * A new bed or event, appended.
 *
 * It starts as a `SoundSpec` with an empty prompt rather than as a library reference, because a
 * prompt is the thing an author can write; picking an imported sound is one click away and
 * choosing it *for* them would put a sha in the document nobody chose.
 */
export function eintragHinzufuegen(scene: Scene, art: 'ambience' | 'sfx'): Scene {
  const sound = { prompt: '', negative_prompt: null, seed: 0, duration_seconds: null, params: {} };
  const neu: TimelineEntry =
    art === 'ambience'
      ? {
          type: 'ambience',
          sound,
          start_ms: 0,
          end_ms: null,
          fade_in_ms: 350,
          fade_out_ms: 450,
          gain_db: -24,
        }
      : { type: 'sfx', sound, at_ms: 0, gain_db: -18, placement: null };
  return { ...scene, timeline: [...scene.timeline, neu] };
}
