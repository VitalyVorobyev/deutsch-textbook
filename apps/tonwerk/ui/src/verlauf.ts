/**
 * Undo and redo inside one draft.
 *
 * **The history is of drafts, never of revisions.** Saving makes a revision, and a revision is
 * immutable; the editor remounts on it and the history starts again. So undo can never reach past
 * what is stored, and "Verwerfen" stays the one way back to the stored bytes.
 *
 * **A gesture is one step.** A slider sends a value per pixel and a number field one per
 * keystroke; a history that kept each would need forty presses to undo one fader move. Changes that
 * arrive within `ZUSAMMEN_MS` of the previous one replace it instead of stacking. A drag on the
 * timeline commits once, on release, so it is one step by construction.
 */
import { useCallback, useEffect, useState } from 'react';

/** Changes closer together than this are one step. */
export const ZUSAMMEN_MS = 600;

/** How many steps back the history reaches. */
export const TIEFE = 200;

export interface Verlauf<T> {
  vorher: T[];
  jetzt: T;
  nachher: T[];
  /** When `jetzt` was last set, for coalescing. */
  zuletzt: number;
}

export function verlaufStart<T>(wert: T): Verlauf<T> {
  return { vorher: [], jetzt: wert, nachher: [], zuletzt: Number.NEGATIVE_INFINITY };
}

/** A new value. Within `ZUSAMMEN_MS` of the last one it replaces it; any redo is dropped. */
export function verlaufSetzen<T>(verlauf: Verlauf<T>, wert: T, jetztMs: number): Verlauf<T> {
  if (Object.is(wert, verlauf.jetzt)) return verlauf;
  const zusammen = jetztMs - verlauf.zuletzt < ZUSAMMEN_MS && verlauf.vorher.length > 0;
  return {
    vorher: zusammen ? verlauf.vorher : [...verlauf.vorher, verlauf.jetzt].slice(-TIEFE),
    jetzt: wert,
    nachher: [],
    zuletzt: jetztMs,
  };
}

export function verlaufZurueck<T>(verlauf: Verlauf<T>): Verlauf<T> {
  const ziel = verlauf.vorher.at(-1);
  if (verlauf.vorher.length === 0 || ziel === undefined) return verlauf;
  return {
    vorher: verlauf.vorher.slice(0, -1),
    jetzt: ziel,
    nachher: [verlauf.jetzt, ...verlauf.nachher],
    // A step taken back is finished: the next change starts a new one.
    zuletzt: Number.NEGATIVE_INFINITY,
  };
}

export function verlaufVor<T>(verlauf: Verlauf<T>): Verlauf<T> {
  const [ziel, ...rest] = verlauf.nachher;
  if (verlauf.nachher.length === 0 || ziel === undefined) return verlauf;
  return {
    vorher: [...verlauf.vorher, verlauf.jetzt],
    jetzt: ziel,
    nachher: rest,
    zuletzt: Number.NEGATIVE_INFINITY,
  };
}

/** Whether a key press belongs to a text control, whose own undo must win. */
function imTextfeld(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) return false;
  if (ziel.isContentEditable) return true;
  if (ziel instanceof HTMLTextAreaElement) return true;
  return (
    ziel instanceof HTMLInputElement &&
    !['range', 'checkbox', 'radio', 'button', 'submit'].includes(ziel.type)
  );
}

/**
 * The draft with its history, and Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y bound to it — except
 * inside a text field, where the browser's own undo of the typing is what the person meant.
 */
export function useVerlauf<T>(start: T) {
  const [verlauf, setVerlauf] = useState(() => verlaufStart(start));

  const setzen = useCallback((wert: T) => {
    setVerlauf((alt) => verlaufSetzen(alt, wert, performance.now()));
  }, []);
  /** Replace the whole history — Verwerfen goes back to the stored bytes and forgets the way. */
  const zuruecksetzen = useCallback((wert: T) => setVerlauf(verlaufStart(wert)), []);
  const zurueck = useCallback(() => setVerlauf(verlaufZurueck), []);
  const vor = useCallback(() => setVerlauf(verlaufVor), []);

  useEffect(() => {
    const taste = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || imTextfeld(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        zurueck();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        vor();
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [zurueck, vor]);

  return {
    wert: verlauf.jetzt,
    setzen,
    zuruecksetzen,
    zurueck,
    vor,
    kannZurueck: verlauf.vorher.length > 0,
    kannVor: verlauf.nachher.length > 0,
  };
}
