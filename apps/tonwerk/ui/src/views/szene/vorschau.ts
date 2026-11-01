/**
 * Hearing a draft before it is rendered: the last render's stems, played at the draft's planned
 * times through Web Audio.
 *
 * **Every stem is already in place.** A render writes each stem as a track of the whole scene, the
 * entry delayed to where it landed, so a stem's audio for an entry is the stretch the render
 * measured for it. Moving an entry is therefore playing that stretch somewhere else: no
 * resynthesis, no mix, no file written.
 *
 * **It is a preview of timing, and it says what it leaves out.** There is no room, no loudness
 * normalisation and no ducking against the new speech positions, and a bed made longer than it was
 * rendered plays only as long as it was rendered. The render is the result; this is a way to hear
 * whether a dragged turn overlaps the way it was meant to before paying for one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from '../../api';
import type { Span } from '../../contracts';

/** One stretch of one stem, placed on the preview's clock. */
export interface Einsatz {
  entryId: string;
  /** When it starts, in ms after the press. */
  wannMs: number;
  /** Where in the stem it starts, in ms. */
  abMs: number;
  dauerMs: number;
}

/**
 * The stretches to play from `abMs` on: each planned span takes its measured stretch, cut to the
 * shorter of the two lengths and to what is left after `abMs`. A planned entry the render never
 * measured has no audio to play and is left out.
 */
export function einsaetze(
  geplant: readonly Span[],
  gemessen: readonly Span[],
  abMs: number,
): Einsatz[] {
  const gerendert = new Map(gemessen.map((span) => [span.entry_id, span] as const));
  return geplant.flatMap((plan) => {
    const mess = gerendert.get(plan.entry_id);
    if (!mess) return [];
    const laenge = Math.min(plan.end_ms - plan.start_ms, mess.end_ms - mess.start_ms);
    const ende = plan.start_ms + laenge;
    if (laenge <= 0 || ende <= abMs) return [];
    const schon = Math.max(0, abMs - plan.start_ms);
    return [
      {
        entryId: plan.entry_id,
        wannMs: Math.max(0, plan.start_ms - abMs),
        abMs: mess.start_ms + schon,
        dauerMs: laenge - schon,
      },
    ];
  });
}

/** Whether this browser can play a preview at all. */
export function vorschauMoeglich(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
}

/**
 * The preview's transport. Stems are fetched and decoded on the first press and kept for the
 * render they belong to (`stand`), so a second press after another drag costs nothing.
 */
export function useVorschau(api: Api, stand: string) {
  const kontext = useRef<AudioContext | null>(null);
  const puffer = useRef(new Map<string, Promise<AudioBuffer>>());
  const quellen = useRef<AudioBufferSourceNode[]>([]);
  const rahmen = useRef(0);
  const [laeuft, setLaeuft] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [stelleMs, setStelleMs] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);

  // A new render is other bytes: the decoded stems of the previous one must not be played for it.
  const [fuer, setFuer] = useState(stand);
  if (fuer !== stand) {
    setFuer(stand);
    puffer.current = new Map();
  }

  const anhalten = useCallback(() => {
    for (const quelle of quellen.current) {
      try {
        quelle.stop();
      } catch {
        // A source that already ended cannot be stopped twice; there is nothing left to do.
      }
    }
    quellen.current = [];
    cancelAnimationFrame(rahmen.current);
    setLaeuft(false);
  }, []);

  useEffect(() => anhalten, [anhalten]);

  const laden = (ctx: AudioContext, pfad: string): Promise<AudioBuffer> => {
    let geladen = puffer.current.get(pfad);
    if (!geladen) {
      geladen = api.audioBytes(pfad).then((bytes) => ctx.decodeAudioData(bytes));
      puffer.current.set(pfad, geladen);
    }
    return geladen;
  };

  const spielen = useCallback(
    async (liste: Einsatz[], pfadVon: (entryId: string) => string, abMs: number) => {
      anhalten();
      if (!vorschauMoeglich() || liste.length === 0) return;
      const ctx = kontext.current ?? new AudioContext();
      kontext.current = ctx;
      setFehler(null);
      setLaedt(true);
      let geladen: AudioBuffer[];
      try {
        await ctx.resume();
        geladen = await Promise.all(liste.map((einsatz) => laden(ctx, pfadVon(einsatz.entryId))));
      } catch (grund) {
        setLaedt(false);
        setFehler(grund instanceof Error ? grund.message : String(grund));
        return;
      }
      setLaedt(false);
      const start = ctx.currentTime + 0.05;
      quellen.current = liste.map((einsatz, index) => {
        const quelle = ctx.createBufferSource();
        quelle.buffer = geladen[index] ?? null;
        quelle.connect(ctx.destination);
        quelle.start(start + einsatz.wannMs / 1000, einsatz.abMs / 1000, einsatz.dauerMs / 1000);
        return quelle;
      });
      const ende = Math.max(...liste.map((einsatz) => einsatz.wannMs + einsatz.dauerMs));
      setLaeuft(true);
      const folgen = () => {
        const vergangen = (ctx.currentTime - start) * 1000;
        setStelleMs(abMs + Math.max(0, vergangen));
        if (vergangen >= ende) {
          setLaeuft(false);
          quellen.current = [];
          return;
        }
        rahmen.current = requestAnimationFrame(folgen);
      };
      rahmen.current = requestAnimationFrame(folgen);
    },
    // `laden` reads refs only; listing it would rebuild this on every render for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anhalten, api],
  );

  return { laeuft, laedt, stelleMs, fehler, spielen, anhalten };
}
