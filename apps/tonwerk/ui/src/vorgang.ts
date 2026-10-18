/**
 * A long operation, and the four things a button doing one has to say.
 *
 * Render and QA are not requests, they are **runs**: a cold render synthesises every line through
 * a local model and takes about half a minute; a warm one is a cache walk and takes under three
 * seconds; QA transcribes the master and takes about ten. A button that only greys out for all
 * three looks identical to a button that is broken.
 *
 * So a `Vorgang` carries: whether it is running, **how long it has been running**, what it
 * answered, and what it refused with. The elapsed second is the whole point — it is the only
 * signal that separates "this is a cold render" from "this has hung", and it costs one interval.
 *
 * Re-entry is refused rather than queued. Two renders of one scene race on one directory, and the
 * second would report node counts that describe neither run.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Vorgang<T> {
  laeuft: boolean;
  /** Whole seconds since the run started. Zero when nothing is running. */
  sekunden: number;
  ergebnis: T | null;
  fehler: Error | null;
  starten(): void;
  /** Drop the last answer, e.g. when the thing it described has been superseded. */
  vergessen(): void;
}

export function useVorgang<T>(lauf: () => Promise<T>): Vorgang<T> {
  // **The start time is the state, not a boolean.** "Running" and "for how long" are one fact, and
  // keeping them apart is what forced a `setSekunden(0)` into the effect that started the clock —
  // a cascading render, and an extra place the two could disagree.
  const [begonnen, setBegonnen] = useState<number | null>(null);
  const [sekunden, setSekunden] = useState(0);
  const [ergebnis, setErgebnis] = useState<T | null>(null);
  const [fehler, setFehler] = useState<Error | null>(null);
  // Written only inside handlers and promise callbacks, never during render: two clicks in one
  // tick both see the pre-render `begonnen`, and two renders of one scene race on one directory.
  const aktiv = useRef(false);

  useEffect(() => {
    if (begonnen === null) return;
    // A quarter of a second, so the first tick lands when it looks like it should rather than a
    // full second after the button was pressed.
    const timer = window.setInterval(
      () => setSekunden(Math.floor((Date.now() - begonnen) / 1000)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [begonnen]);

  const starten = useCallback(() => {
    if (aktiv.current) return;
    aktiv.current = true;
    setBegonnen(Date.now());
    setSekunden(0);
    setFehler(null);
    setErgebnis(null);
    lauf().then(
      (antwort) => {
        aktiv.current = false;
        setBegonnen(null);
        setErgebnis(antwort);
      },
      (grund: unknown) => {
        aktiv.current = false;
        setBegonnen(null);
        setFehler(grund instanceof Error ? grund : new Error(String(grund)));
      },
    );
  }, [lauf]);

  const vergessen = useCallback(() => {
    setErgebnis(null);
    setFehler(null);
  }, []);

  return { laeuft: begonnen !== null, sekunden, ergebnis, fehler, starten, vergessen };
}
