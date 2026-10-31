/**
 * Die Zeitleiste — the rendered scene, lane by lane, with its waveform and a way to hear it.
 *
 * **Measured, never planned.** Lanes and spans come from the render manifest's own `timeline`, and
 * the waveform inside each span comes from the stem that render wrote (`GET …/peaks`). The
 * authored `at_ms` is a request, and drawing it would make the picture agree with the document
 * exactly when the render disagrees with both. When the peaks do not arrive, the spans are still
 * drawn as bars: a lane is a fact of the timeline, and a waveform only adds its shape.
 *
 * **Drawn in shape, not in a new colour.** A turn is lit (`--ton-messung`), a bed is graphite, an
 * event is a tick with a cap. The only hue that enters is red, around a turn whose transcript
 * check failed: a verdict, which is what hue is for.
 *
 * **Listening is part of reading it.** A click on the scale or an empty stretch plays the master
 * from that moment; a click on a span (or Enter on it) plays that entry's stem alone from where it
 * starts, because a masked syllable is audible on its own take and inaudible under a bed. One
 * playhead shows where whichever of the two is playing has got to, and the transport joins the
 * page's `Spielbereich`, so Space pauses it like any other player here.
 */
import { Button } from '@vitavision/ui';
import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { transport as transportKlasse, useSpielbereich } from '../../components/Spieler';
import { dauer, sekunden } from '../../format';
import { useEngineBlob } from '../../useEngine';
import type { Api } from '../../api';
import type { PeaksTrack, RenderPeaks, Span } from '../../contracts';

const SPUR_HOEHE = 30;
const LEISTE = 150;
const BREITE = 1000;
const KOPF = 22;
const RAND = 8;

/** The plate's drawable width, in viewBox units. A waveform needs about one level per unit. */
const ZEICHENBREITE = BREITE - LEISTE - RAND;

/**
 * The peak window for a scene this long: about one level per drawable unit, rounded up to 5 ms so
 * that scenes of similar length share the engine's cached file, and kept inside the engine's
 * 5–1000 ms bounds.
 */
export function aufloesung(dauerMs: number): number {
  const roh = Math.ceil(dauerMs / ZEICHENBREITE / 5) * 5;
  return Math.min(1000, Math.max(5, roh));
}

/**
 * A filled, mirrored envelope from `x0` to `x1` around `mitte`, `halbe` high at full scale.
 *
 * One point per level at the centre of its window, the top contour left to right and the bottom
 * contour back, so the path closes on itself. A silent window still has a hairline, because a gap
 * would read as missing data rather than as silence.
 */
export function umriss(
  peaks: readonly number[],
  stufen: number,
  x0: number,
  x1: number,
  mitte: number,
  halbe: number,
): string {
  if (peaks.length === 0) return '';
  const schritt = (x1 - x0) / peaks.length;
  const punkte = peaks.map((wert, index) => {
    const x = x0 + (index + 0.5) * schritt;
    const a = Math.max(0.5, (wert / stufen) * halbe);
    return [x, a] as const;
  });
  const oben = punkte.map(([x, a]) => `${x.toFixed(1)},${(mitte - a).toFixed(1)}`);
  const unten = [...punkte].reverse().map(([x, a]) => `${x.toFixed(1)},${(mitte + a).toFixed(1)}`);
  return `M${x0.toFixed(1)},${mitte.toFixed(1)}L${oben.join('L')}L${x1.toFixed(1)},${mitte.toFixed(1)}L${unten.join('L')}Z`;
}

/** A tick every 1, 2, 5, 10, 15, 30 or 60 s — whichever puts roughly eight marks on the plate. */
export function tickSchritt(gesamt: number): number {
  for (const schritt of [1000, 2000, 5000, 10000, 15000, 30000, 60000]) {
    if (gesamt / schritt <= 10) return schritt;
  }
  return 60000;
}

interface Quelle {
  /** The engine path of the audio: the master, or one declared stem. */
  pfad: string;
  name: string;
  /** Where in the scene to start, in milliseconds. */
  abMs: number;
}

export function Zeitleiste({
  api,
  slug,
  variante,
  spans,
  dauerMs,
  stand,
  rollen,
  reihenfolge,
  urteile,
}: {
  api: Api;
  slug: string;
  variante: string;
  spans: Span[];
  dauerMs: number;
  /** Changes whenever the render does, so a new render's waveform is fetched and not reused. */
  stand: string;
  rollen: Map<string, string>;
  reihenfolge: string[];
  urteile: Map<string, boolean>;
}): React.JSX.Element {
  const gesamt = Math.max(dauerMs, ...spans.map((span) => span.end_ms), 1);
  // Keyed by the render it belongs to, so a waveform of the previous render is never drawn over
  // this one's spans while the new one is on its way.
  const schluessel = `${slug}/${variante}/${stand}/${aufloesung(gesamt)}`;
  const [geladen, setGeladen] = useState<{ schluessel: string; peaks: RenderPeaks } | null>(null);
  const peaks = geladen?.schluessel === schluessel ? geladen.peaks : null;

  useEffect(() => {
    const controller = new AbortController();
    api.peaks(slug, variante, aufloesung(gesamt), controller.signal).then(
      (antwort) => {
        if (!controller.signal.aborted) setGeladen({ schluessel, peaks: antwort });
      },
      // No waveform is an empty state, not an error: the lanes are drawn from the timeline.
      () => undefined,
    );
    return () => controller.abort();
  }, [api, slug, variante, gesamt, schluessel]);

  const basis = `/api/scenes/${encodeURIComponent(slug)}/renders/${encodeURIComponent(variante)}`;
  const { anbinden, ...transport } = useTransport();

  const wellen = new Map((peaks?.tracks ?? []).map((track) => [track.entry_id, track] as const));
  const spuren: { name: string; art: 'speech' | 'ambience' | 'sfx'; spans: Span[] }[] =
    reihenfolge.map((rolle) => ({
      name: rolle,
      art: 'speech' as const,
      spans: spans.filter((span) => span.type === 'speech' && rollen.get(span.entry_id) === rolle),
    }));
  const betten = spans.filter((span) => span.type === 'ambience');
  const ereignisse = spans.filter((span) => span.type === 'sfx');
  if (betten.length) spuren.push({ name: 'Umgebung', art: 'ambience', spans: betten });
  if (ereignisse.length) spuren.push({ name: 'Ereignisse', art: 'sfx', spans: ereignisse });

  const hoehe = KOPF + spuren.length * SPUR_HOEHE + 6;
  const x = (ms: number) => LEISTE + (ms / gesamt) * ZEICHENBREITE;
  const schritt = tickSchritt(gesamt);

  const master = (abMs: number): Quelle => ({
    pfad: `${basis}/master`,
    name: `Master ${variante}`,
    abMs,
  });
  const stem = (span: Span): Quelle => ({
    pfad: `${basis}/artifact/stems/${encodeURIComponent(span.entry_id)}.wav`,
    name: span.entry_id,
    abMs: span.start_ms,
  });

  // A click on the plate is a time: the viewBox maps to the drawn width, so the click's offset
  // inside the SVG, scaled back, is the millisecond under the pointer.
  const anDerStelle = (event: React.MouseEvent<SVGSVGElement>) => {
    const rahmen = event.currentTarget.getBoundingClientRect();
    if (rahmen.width === 0) return;
    const einheit = ((event.clientX - rahmen.left) / rahmen.width) * BREITE;
    if (einheit < LEISTE) return;
    const ms = Math.min(gesamt, Math.max(0, ((einheit - LEISTE) / ZEICHENBREITE) * gesamt));
    transport.spielen(master(ms));
  };

  return (
    <div className="spuren">
      <div className="reihe zeitleiste-transport">
        <Button
          size="sm"
          className={transportKlasse()}
          aria-label={transport.laeuft ? 'Zeitleiste anhalten' : 'Zeitleiste abspielen'}
          onClick={() =>
            transport.laeuft ? transport.anhalten() : transport.spielen(master(transport.stelleMs))
          }
        >
          {transport.laeuft ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <span className="zahl" aria-live="off">
          {sekunden(transport.stelleMs)} / {sekunden(gesamt)}
        </span>
        <span className="entfernt">
          {transport.quelle
            ? `spielt: ${transport.quelle.name}`
            : 'Klick auf die Skala spielt den Master ab dort, Klick auf ein Stück nur dieses.'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${BREITE} ${hoehe}`}
        width="100%"
        height={hoehe}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Gerenderte Zeitleiste, ${spuren.length} Spuren, Länge ${dauer(gesamt)}`}
        onClick={anDerStelle}
      >
        {Array.from(
          { length: Math.floor(gesamt / schritt) + 1 },
          (_, index) => index * schritt,
        ).map((ms) => (
          <g key={ms}>
            <line
              x1={x(ms)}
              x2={x(ms)}
              y1={KOPF - 6}
              y2={hoehe - 4}
              stroke="var(--ton-kante)"
              strokeWidth={1}
            />
            <text
              x={x(ms) + 3}
              y={KOPF - 10}
              className="spur-skala"
              fill="var(--ton-schrift-weg)"
              fontSize={10}
            >
              {sekunden(ms)}
            </text>
          </g>
        ))}

        {spuren.map((spur, index) => {
          const y = KOPF + index * SPUR_HOEHE;
          return (
            <g key={`${spur.art}-${spur.name}`}>
              <line x1={0} x2={BREITE} y1={y} y2={y} stroke="var(--ton-kante)" strokeWidth={1} />
              <text
                x={0}
                y={y + 18}
                className="spur-name"
                fill={spur.art === 'speech' ? 'var(--ton-signal)' : 'var(--ton-schrift-weg)'}
                fontSize={10}
              >
                {spur.name}
              </text>
              {spur.spans.map((span) => (
                <Stueck
                  key={span.entry_id}
                  span={span}
                  art={spur.art}
                  y={y}
                  x={x}
                  welle={wellen.get(span.entry_id)}
                  stufen={peaks?.levels ?? 255}
                  durchgefallen={urteile.get(span.entry_id) === false}
                  hoeren={() => transport.spielen(stem(span))}
                />
              ))}
            </g>
          );
        })}

        {transport.quelle ? (
          <line
            className="zeitleiste-kopf"
            x1={x(transport.stelleMs)}
            x2={x(transport.stelleMs)}
            y1={KOPF - 6}
            y2={hoehe - 2}
            stroke="var(--ton-schrift)"
            strokeWidth={1.5}
          />
        ) : null}
      </svg>
      <audio
        ref={anbinden}
        src={transport.blob ?? undefined}
        preload="auto"
        hidden
        data-testid="zeitleiste-audio"
      />
    </div>
  );
}

function Stueck({
  span,
  art,
  y,
  x,
  welle,
  stufen,
  durchgefallen,
  hoeren,
}: {
  span: Span;
  art: 'speech' | 'ambience' | 'sfx';
  y: number;
  x(ms: number): number;
  welle: PeaksTrack | undefined;
  stufen: number;
  durchgefallen: boolean;
  hoeren(): void;
}): React.JSX.Element {
  const links = x(span.start_ms);
  const rechts = Math.max(links + 2, x(span.end_ms));
  const bett = art === 'ambience';
  const farbe = bett ? 'var(--ton-ruhe)' : 'var(--ton-messung)';
  const mitte = y + SPUR_HOEHE / 2;
  const halbe = bett ? 7 : 11;
  const titel = `${span.entry_id} · ${dauer(span.start_ms)} – ${dauer(span.end_ms)} · einzeln hören`;
  return (
    <g
      className="zeitleiste-stueck"
      role="button"
      tabIndex={0}
      aria-label={`${span.entry_id} einzeln hören`}
      onClick={(event) => {
        // The plate's own click plays the master; a click on a piece means this piece.
        event.stopPropagation();
        hoeren();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') hoeren();
      }}
    >
      <title>{titel}</title>
      {/* The hit area, and the bar a lane falls back to when no waveform arrived. */}
      <rect
        x={links}
        y={y + 4}
        width={rechts - links}
        height={SPUR_HOEHE - 8}
        rx={1}
        fill={welle ? 'transparent' : farbe}
        fillOpacity={bett ? 0.55 : 1}
        stroke={durchgefallen ? 'var(--ton-alarm)' : 'none'}
        strokeWidth={durchgefallen ? 1.5 : 0}
      />
      {welle ? (
        <path
          d={umriss(welle.peaks, stufen, links, rechts, mitte, halbe)}
          fill={farbe}
          fillOpacity={bett ? 0.55 : 1}
        />
      ) : null}
      {art === 'sfx' ? (
        <circle cx={links + 1} cy={y + 4} r={2.5} fill="var(--ton-messung)" />
      ) : null}
    </g>
  );
}

/** Start playback; a refusal (autoplay policy, a revoked blob) leaves the transport paused. */
function abspielen(audio: HTMLAudioElement): void {
  void Promise.resolve(audio.play()).catch(() => undefined);
}

/**
 * One audio element for the whole plate, and the source it is playing.
 *
 * The bytes are fetched on the first press, as everywhere in this app (`Spieler`): a blob URL only
 * exists after a full fetch, and a timeline that downloaded every stem on mount would pull a dozen
 * WAVs over the socket the synthesis model is using.
 */
function useTransport() {
  const element = useRef<HTMLAudioElement | null>(null);
  // A callback ref, so the element is handed in rather than read off a ref object during render.
  const anbinden = useCallback((node: HTMLAudioElement | null) => {
    element.current = node;
  }, []);
  const bereich = useSpielbereich();
  const [quelle, setQuelle] = useState<Quelle | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [stelleMs, setStelleMs] = useState(0);
  const blob = useEngineBlob(quelle?.pfad ?? null);

  useEffect(() => {
    const audio = element.current;
    if (!audio || !bereich) return;
    return bereich.anmelden(audio);
  }, [bereich]);

  // A new source starts where the press asked, once its bytes are here.
  useEffect(() => {
    const audio = element.current;
    if (!audio || !blob || !quelle) return;
    audio.currentTime = quelle.abMs / 1000;
    bereich?.waehlen(audio);
    abspielen(audio);
  }, [blob, quelle, bereich]);

  useEffect(() => {
    const audio = element.current;
    if (!audio) return;
    let rahmen = 0;
    const folgen = () => {
      setStelleMs(audio.currentTime * 1000);
      rahmen = requestAnimationFrame(folgen);
    };
    const an = () => {
      setLaeuft(true);
      rahmen = requestAnimationFrame(folgen);
    };
    const aus = () => {
      setLaeuft(false);
      cancelAnimationFrame(rahmen);
      setStelleMs(audio.currentTime * 1000);
    };
    audio.addEventListener('play', an);
    audio.addEventListener('pause', aus);
    audio.addEventListener('ended', aus);
    return () => {
      cancelAnimationFrame(rahmen);
      audio.removeEventListener('play', an);
      audio.removeEventListener('pause', aus);
      audio.removeEventListener('ended', aus);
    };
  }, []);

  return {
    anbinden,
    blob,
    quelle,
    laeuft,
    stelleMs,
    spielen(next: Quelle) {
      const audio = element.current;
      setStelleMs(next.abMs);
      if (audio && blob && quelle?.pfad === next.pfad) {
        // Same bytes already loaded: a seek, not a refetch.
        audio.currentTime = next.abMs / 1000;
        bereich?.waehlen(audio);
        abspielen(audio);
        return;
      }
      setQuelle(next);
    },
    anhalten() {
      element.current?.pause();
    },
  };
}
