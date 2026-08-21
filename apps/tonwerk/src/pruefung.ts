/**
 * What a human certifies, in what order they are allowed to do it, and how a transcript is read.
 *
 * Pure, and outside the view for the same reason `registry-filter.ts` is: every rule here is
 * invisible when it breaks. A checklist that quietly stops requiring `context` still renders eight
 * tidy rows; a flow that lets the checklist be ticked before the audio was played still shows a
 * player. Both are the difference between a signature that means something and one that does not,
 * and `docs/authoring/product-protection.md` is the reason this app exists at all.
 *
 * **The eight keys are the engine's vocabulary** (`api/workflow.APPROVAL_CHECKLIST`); the German
 * beside them is Tonwerk's, because Tonwerk is the surface that speaks German. Until PR 9b the
 * sentences lived in the engine's `ui.py` and a Python test held the two lists equal. That test is
 * gone with that file, and the seam that replaces it is the engine itself: an unknown key is
 * refused with the vocabulary named, a missing required one with the missing keys named. A drift
 * here fails at the first approval, loudly, rather than silently dropping a point.
 */
import type { Scene } from '@da/schema/audio-scene';

export interface Pruefpunkt {
  /** The engine's key. Written verbatim into the published provenance manifest; never renamed. */
  key: string;
  /** The sentence being certified. `{level}` is replaced with the scene's CEFR level. */
  satz: string;
  /** True when the point is only required for some scenes; see `erforderlich`. */
  bedingt?: boolean;
}

/**
 * The eight, in the order a reviewer meets them: voice first, then the ensemble, then the material.
 *
 * The wording is carried over from the deleted HTML form unchanged. It was rewritten once already,
 * on 2026-08-02, when the form showed the bare English keys and asked a named human to vouch for
 * them — a checklist that shows nothing it asks about is a rubber stamp.
 */
export const PRUEFPUNKTE: readonly Pruefpunkt[] = [
  {
    key: 'accent',
    satz:
      'Die Aussprache ist verständliches Standarddeutsch. Kein Wort ist so verfärbt, dass ein ' +
      'Lernender es falsch abspeichern würde.',
  },
  {
    key: 'naturalness',
    satz: 'Es klingt nach einer sprechenden Person, nicht nach einer vorlesenden Maschine.',
  },
  {
    key: 'intelligibility',
    satz: 'Auf {level} ist jedes Wort heraushörbar — beim Hören, ohne Mitlesen im Skript.',
  },
  {
    key: 'identity',
    satz:
      'Jede Figur bleibt über alle Repliken dieselbe erkennbare Person — Alter, Stimmfarbe und ' +
      'Grundenergie springen nicht mitten im Gespräch.',
  },
  {
    key: 'speakers',
    satz: 'Die verschiedenen Figuren sind durchgehend voneinander unterscheidbar.',
  },
  {
    key: 'pace',
    satz: 'Das Tempo passt zu {level}: nicht gehetzt, aber auch nicht künstlich gedehnt.',
  },
  {
    key: 'questions',
    satz:
      'Jede Frage ist allein aus dem Gehörten beantwortbar, und die markierte Antwort ist die ' +
      'einzige richtige.',
    bedingt: true,
  },
  {
    key: 'context',
    satz: 'Die Hintergrundgeräusche sind hörbar, überdecken aber keine Silbe.',
    bedingt: true,
  },
];

/**
 * Which of the eight *this* scene requires — the engine's `_required_checks`, client-side.
 *
 * Both conditionals would otherwise be a signature on something that does not exist. `context` is
 * about background sound masking a syllable, so it applies only to a scene with non-speech
 * material; `questions` is about the answer key, so only to a scene carrying an exercise.
 *
 * The engine decides this too, and refuses an approval that misses one. This copy exists so the
 * reviewer sees seven rows instead of eight rather than learning about the eighth from a 400 —
 * and because a point nobody can honestly answer is the fastest way to teach ticking without
 * reading.
 */
export function erforderlich(scene: Scene, hatAufgabe: boolean): Set<string> {
  const punkte = new Set(
    PRUEFPUNKTE.filter((punkt) => !punkt.bedingt).map((punkt) => punkt.key),
  );
  if (scene.timeline.some((eintrag) => eintrag.type === 'ambience' || eintrag.type === 'sfx')) {
    punkte.add('context');
  }
  if (hatAufgabe) punkte.add('questions');
  return punkte;
}

/** The required points not yet ticked, in the order they are shown. */
export function fehlende(noetig: Set<string>, angekreuzt: ReadonlySet<string>): string[] {
  return PRUEFPUNKTE.filter((punkt) => noetig.has(punkt.key) && !angekreuzt.has(punkt.key)).map(
    (punkt) => punkt.key,
  );
}

/** The sentence with the level filled in. A2 and B1 mean different things by "not rushed". */
export function satzFuer(punkt: Pruefpunkt, level: string | null | undefined): string {
  return punkt.satz.replaceAll('{level}', level ?? 'diesem Niveau');
}

/**
 * The three stages of one review, and the reason there are three rather than one screen.
 *
 * `hoeren` — the master, alone, with the script behind a disclosure. Reading along makes a
 * listener hear words that were never spoken, which is exactly what `intelligibility` is supposed
 * to catch. The stage ends when the reviewer says it does.
 *
 * `pruefen` — the machine's report and the checklist. Available only after `hoeren`, because a
 * checklist offered beside an unplayed player is a checklist that gets ticked.
 *
 * `entschieden` — a verdict is recorded. Nothing on the page is a control any more.
 *
 * Advancing is **explicit and not measured**. Gating on the player having actually reached the end
 * was the other option and is worse: a reviewer who listened in another application, or whose
 * audio device is busy, would be locked out of a decision they are entitled to make — and a gate
 * that can be defeated by pressing play and walking away measures nothing anyway. What the
 * explicit step buys is that skipping it is a thing the reviewer did, not a thing the layout
 * allowed.
 */
export type FreigabeStand = 'hoeren' | 'pruefen' | 'entschieden';

export const STAND_NAME: Record<FreigabeStand, string> = {
  hoeren: 'Hören',
  pruefen: 'Bericht',
  entschieden: 'Urteil',
};

export const STAND_KETTE: readonly FreigabeStand[] = ['hoeren', 'pruefen', 'entschieden'];

/** How far along the chain a stage sits. Used to draw past, present and future differently. */
export function standIndex(stand: FreigabeStand): number {
  return STAND_KETTE.indexOf(stand);
}

/** One word of a transcript comparison, and what happened to it. */
export interface DiffWort {
  wort: string;
  art: 'gleich' | 'fehlt' | 'zusätzlich';
}

/**
 * Expected against heard, word by word.
 *
 * The engine reports a WER and the two strings; it does not report *which word*. A percentage says
 * a turn is wrong and a marked word says what to fix — usually a proper name, a number or one
 * compound the model ran together — so the alignment is computed here.
 *
 * A plain LCS, on lowercased tokens with the punctuation stripped: the ASR does not produce
 * punctuation reliably and a comma the model omitted is not a pronunciation defect. Both lists are
 * short (an utterance, not a document), so the quadratic table costs nothing.
 */
export function wortDiff(erwartet: string, erkannt: string): { erwartet: DiffWort[]; erkannt: DiffWort[] } {
  const links = erwartet.split(/\s+/).filter(Boolean);
  const rechts = erkannt.split(/\s+/).filter(Boolean);
  const a = links.map(normalisieren);
  const b = rechts.map(normalisieren);

  const tabelle: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      tabelle[i]![j]! =
        a[i] === b[j] ? tabelle[i + 1]![j + 1]! + 1 : Math.max(tabelle[i + 1]![j]!, tabelle[i]![j + 1]!);
    }
  }

  const ausErwartet: DiffWort[] = [];
  const ausErkannt: DiffWort[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ausErwartet.push({ wort: links[i]!, art: 'gleich' });
      ausErkannt.push({ wort: rechts[j]!, art: 'gleich' });
      i += 1;
      j += 1;
    } else if (tabelle[i + 1]![j]! >= tabelle[i]![j + 1]!) {
      ausErwartet.push({ wort: links[i]!, art: 'fehlt' });
      i += 1;
    } else {
      ausErkannt.push({ wort: rechts[j]!, art: 'zusätzlich' });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) ausErwartet.push({ wort: links[i]!, art: 'fehlt' });
  for (; j < b.length; j += 1) ausErkannt.push({ wort: rechts[j]!, art: 'zusätzlich' });
  return { erwartet: ausErwartet, erkannt: ausErkannt };
}

function normalisieren(wort: string): string {
  return wort.toLocaleLowerCase('de-DE').replace(/[.,;:!?»«„“"'()–—]/g, '');
}
