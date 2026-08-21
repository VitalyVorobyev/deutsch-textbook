/**
 * Playing engine audio, and the one keyboard rule that goes with it.
 *
 * **The bytes are fetched, never linked.** An `<audio src="/api/…">` cannot carry a bearer header
 * and the engine's cookie path is legacy, so every player points at a blob URL `useEngineBlob`
 * made — the same rule the character demos already follow.
 *
 * **Space plays and pauses, inside a region.** A studio tool where the transport key is a mouse
 * target is a tool that gets used with one hand on the mouse all session. But a global Space
 * handler would fight every button and every text field, so the key is scoped: a `Spielbereich`
 * listens for Space, and toggles the player that was last started inside it (or its only one).
 * When the focus is in a control that means something by Space itself — a button, a checkbox, a
 * text field — the key is left alone, because a control that stops doing what it says is worse
 * than no shortcut.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useEngineBlob } from '../useEngine';
import { dauer } from '../format';

interface Bereich {
  anmelden(element: HTMLAudioElement): () => void;
  waehlen(element: HTMLAudioElement): void;
}

const BereichContext = createContext<Bereich | null>(null);

/** Keys a control already owns. Space inside one of these is that control's, not the transport's. */
const EIGENE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'AUDIO']);

export function Spielbereich({ children }: { children: ReactNode }): React.JSX.Element {
  const spieler = useRef<HTMLAudioElement[]>([]);
  const aktiv = useRef<HTMLAudioElement | null>(null);

  const bereich = useMemo<Bereich>(
    () => ({
      anmelden(element) {
        spieler.current = [...spieler.current, element];
        return () => {
          spieler.current = spieler.current.filter((row) => row !== element);
          if (aktiv.current === element) aktiv.current = null;
        };
      },
      waehlen(element) {
        // Only one thing plays at a time in a region: two takes at once is not a comparison.
        for (const anderer of spieler.current) if (anderer !== element) anderer.pause();
        aktiv.current = element;
      },
    }),
    [],
  );

  const taste = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== ' ' && event.key !== 'Spacebar') return;
    const ziel = event.target;
    if (ziel instanceof HTMLElement && EIGENE.has(ziel.tagName)) return;
    const element = aktiv.current ?? spieler.current[0];
    if (!element) return;
    event.preventDefault();
    if (element.paused) void element.play();
    else element.pause();
  }, []);

  return (
    <BereichContext.Provider value={bereich}>
      {/* tabIndex so the region itself can hold focus: a click on the panel background is how a
          reader gets Space back after using a field. */}
      <div className="spielbereich" tabIndex={-1} onKeyDown={taste}>
        {children}
      </div>
    </BereichContext.Provider>
  );
}

/**
 * One player: a transport button, a position readout and the native control beside it.
 *
 * The native `<audio controls>` stays — it carries scrubbing, volume and the accessibility the
 * platform already implements — and the button exists because the transport is the thing this
 * tool does a hundred times an hour and it should be one target, not three.
 *
 * **The bytes are not fetched until somebody asks for them.** `preload="none"` cannot help here:
 * the blob URL only exists *after* a full `fetch`, so a mounted player has already downloaded its
 * audio. On a page of a hundred library rows that is a hundred WAVs on load, over a local socket
 * that is also running a synthesis model. So the first press is what starts the fetch, and the
 * player begins playing when it lands.
 */
export function Spieler({
  pfad,
  name,
  kompakt,
  gross,
}: {
  /** An engine path, or null when there is nothing to play yet. */
  pfad: string | null;
  name: string;
  kompakt?: boolean;
  /**
   * The full-width transport. Exactly one player on a page may be this: the master under review,
   * on the Freigabe page, where it is not a control beside the work but the work itself.
   */
  gross?: boolean;
}): React.JSX.Element {
  const [geweckt, setGeweckt] = useState(false);
  const blob = useEngineBlob(geweckt ? pfad : null);
  const bereich = useContext(BereichContext);
  const element = useRef<HTMLAudioElement | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [stelle, setStelle] = useState(0);

  useEffect(() => {
    const audio = element.current;
    if (!audio || !bereich) return;
    return bereich.anmelden(audio);
  }, [bereich, blob]);

  // The press that fetched the audio was a press of the play button, so playing when it arrives
  // is what that press meant. Without this the first press only ever loads.
  useEffect(() => {
    const audio = element.current;
    if (!blob || !audio || !audio.paused || audio.currentTime > 0) return;
    bereich?.waehlen(audio);
    void audio.play().catch(() => undefined);
  }, [bereich, blob]);

  if (!pfad) {
    return <span className="entfernt spieler-leer">nichts zu hören</span>;
  }

  const klasse = `spieler${kompakt ? ' spieler-kompakt' : ''}${gross ? ' spieler-gross' : ''}`;

  if (!geweckt) {
    return (
      <span className={klasse}>
        <button
          type="button"
          className="knopf knopf-transport"
          aria-label={`${name} abspielen`}
          onClick={() => setGeweckt(true)}
        >
          ▶
        </button>
      </span>
    );
  }

  if (!blob) {
    return <span className="entfernt spieler-leer">wird geladen …</span>;
  }

  return (
    <span className={klasse}>
      <button
        type="button"
        className="knopf knopf-transport"
        aria-label={laeuft ? `${name} anhalten` : `${name} abspielen`}
        onClick={() => {
          const audio = element.current;
          if (!audio) return;
          if (audio.paused) {
            bereich?.waehlen(audio);
            void audio.play();
          } else audio.pause();
        }}
      >
        {laeuft ? '❙❙' : '▶'}
      </button>
      <span className="zahl spieler-stelle">{dauer(stelle * 1000)}</span>
      <audio
        ref={element}
        controls
        preload="none"
        src={blob}
        aria-label={name}
        onPlay={() => {
          setLaeuft(true);
          if (element.current) bereich?.waehlen(element.current);
        }}
        onPause={() => setLaeuft(false)}
        onTimeUpdate={(event) => setStelle(event.currentTarget.currentTime)}
      />
    </span>
  );
}
