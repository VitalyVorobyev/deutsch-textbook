/**
 * Die Zeitleiste — the rendered scene, lane by lane, with its waveform, a way to hear it, and the
 * draft's timing edited by dragging.
 *
 * **Measured, or planned by the engine — never by this view.** Lanes and spans come from the render
 * manifest's own `timeline`, and the waveform inside each span comes from the stem that render wrote
 * (`GET …/peaks`). The authored `at_ms` is a request, and drawing it would make the picture agree
 * with the document exactly when the render disagrees with both. When the draft's timing differs,
 * the engine times the draft from the takes it already holds (`POST …/plan`, the render's own
 * timing code) and the pieces are drawn where that plan puts them, with an outline left where the
 * render put them. When the peaks do not arrive, the spans are still drawn as bars: a lane is a
 * fact of the timeline, and a waveform only adds its shape.
 *
 * **Dragging writes the document's own fields.** A turn dragged is pinned (`at_ms`, after the
 * speech start), an event dragged moves its `at_ms`, a bed moves by its body and stretches by its
 * edges. A drag commits once, on release, so it is one undo step. Arrow keys move the focused piece
 * by 10 ms, with Shift by 100 ms.
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
import { Headphones, Pause, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZahlFeld } from '../../components/Feld';
import { transport as transportKlasse, useSpielbereich } from '../../components/Spieler';
import { dauer, sekunden } from '../../format';
import {
  bettSetzen,
  eintragIds,
  eintragIndex,
  ereigniszeitSetzen,
  istGeaendert,
  nurZeitGeaendert,
  sprechzeitLoesen,
  sprechzeitSetzen,
  stabilesJson,
} from '../../scene-draft';
import { useEngineBlob } from '../../useEngine';
import { fehlerText } from '../fehler';
import { einsaetze, useVorschau, vorschauMoeglich } from './vorschau';
import type { Api } from '../../api';
import type { PeaksTrack, RenderPeaks, ScenePlan, Span } from '../../contracts';
import type { Scene } from '@da/schema/audio-scene';

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

/** Which part of a piece a drag holds: the whole of it, or one edge of a bed. */
export type Griff = 'mitte' | 'anfang' | 'ende';

/** Drags move in 10 ms steps: finer than any turn-taking decision, coarse enough to land on. */
const RASTER_MS = 10;

/** A press that moved less than this many pixels is a click, not a drag. */
const ZUG_SCHWELLE_PX = 3;

/**
 * The draft after a piece was moved by `dMs`. `lage` is where the piece is drawn now — the plan's
 * span, or the render's — because a turn is dragged from where the author sees it.
 *
 * A speech time is stored after the speech start (`acoustics.lead_in_ms`) and an event's and a
 * bed's in absolute scene time; that is the engine's rule, and this is the one place it is applied.
 */
export function verschieben(
  entwurf: Scene,
  entryId: string,
  lage: { start_ms: number; end_ms: number },
  griff: Griff,
  dMs: number,
): Scene {
  const index = eintragIndex(entwurf, entryId);
  const entry = entwurf.timeline[index];
  if (!entry) return entwurf;
  if (entry.type === 'speech') {
    return sprechzeitSetzen(entwurf, index, lage.start_ms + dMs - entwurf.acoustics.lead_in_ms);
  }
  if (entry.type === 'sfx') return ereigniszeitSetzen(entwurf, index, lage.start_ms + dMs);
  if (griff === 'anfang') return bettSetzen(entwurf, index, { start_ms: entry.start_ms + dMs });
  if (griff === 'ende') return bettSetzen(entwurf, index, { end_ms: lage.end_ms + dMs });
  return bettSetzen(entwurf, index, {
    start_ms: entry.start_ms + dMs,
    end_ms: entry.end_ms === null ? null : entry.end_ms + dMs,
  });
}

/** Where a piece is drawn while a drag holds it. */
function gezogen(lage: { start_ms: number; end_ms: number }, griff: Griff, dMs: number) {
  if (griff === 'anfang') return { start_ms: lage.start_ms + dMs, end_ms: lage.end_ms };
  if (griff === 'ende') return { start_ms: lage.start_ms, end_ms: lage.end_ms + dMs };
  return { start_ms: lage.start_ms + dMs, end_ms: lage.end_ms + dMs };
}

type PlanStand =
  | { art: 'gleich' }
  | { art: 'laedt' }
  | { art: 'fertig'; plan: ScenePlan }
  | { art: 'fehler'; fehler: Error };

/**
 * The engine's plan of the draft, asked for a moment after the last edit. While the draft equals
 * the saved scene there is nothing to plan: the render on screen already is its timing.
 */
function usePlan(api: Api, slug: string, variante: string, original: Scene, entwurf: Scene) {
  const geaendert = istGeaendert(original, entwurf);
  const schluessel = geaendert ? `${variante}:${stabilesJson(entwurf)}` : '';
  const [geladen, setGeladen] = useState<{ schluessel: string; stand: PlanStand } | null>(null);

  useEffect(() => {
    if (!schluessel) return;
    const controller = new AbortController();
    const zeit = window.setTimeout(() => {
      api.planScene(slug, entwurf, variante, controller.signal).then(
        (plan) => {
          if (!controller.signal.aborted)
            setGeladen({ schluessel, stand: { art: 'fertig', plan } });
        },
        (grund: unknown) => {
          if (controller.signal.aborted) return;
          const fehler = grund instanceof Error ? grund : new Error(String(grund));
          setGeladen({ schluessel, stand: { art: 'fehler', fehler } });
        },
      );
    }, 300);
    return () => {
      window.clearTimeout(zeit);
      controller.abort();
    };
    // `schluessel` stands for the draft and the variant; listing the draft object as well would
    // re-ask on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, slug, schluessel]);

  if (!schluessel) return { art: 'gleich' } as PlanStand;
  return geladen?.schluessel === schluessel ? geladen.stand : ({ art: 'laedt' } as PlanStand);
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
  original,
  entwurf,
  setEntwurf,
  bearbeitbar = false,
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
  /** The saved revision this render belongs to. */
  original?: Scene;
  /** The draft the drags edit. Without it, or without `bearbeitbar`, the plate only plays. */
  entwurf?: Scene;
  setEntwurf?(next: Scene): void;
  bearbeitbar?: boolean;
}): React.JSX.Element {
  const gespeichert = original ?? entwurf;
  const aktuell = entwurf ?? original;
  const planStand = usePlan(
    api,
    slug,
    variante,
    gespeichert ?? LEER,
    aktuell ?? gespeichert ?? LEER,
  );
  const plan = planStand.art === 'fertig' && planStand.plan.complete ? planStand.plan : null;
  const geplant = useMemo(
    () => new Map((plan?.timeline ?? []).map((span) => [span.entry_id, span] as const)),
    [plan],
  );

  // A span names its entry by position among its kind; while the draft adds or removes a bed or an
  // event, the render's names point at other entries, so the plate stops editing until a save.
  const gleicheEintraege =
    !!gespeichert &&
    !!aktuell &&
    stabilesJson(eintragIds(gespeichert)) === stabilesJson(eintragIds(aktuell));
  const bearbeiten = bearbeitbar && !!setEntwurf && !!aktuell && gleicheEintraege;

  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [zug, setZug] = useState<{ entryId: string; griff: Griff; dMs: number } | null>(null);
  // Set when a press turned into a drag, so the click that follows the release does not also play.
  const geschoben = useRef(false);

  const gesamt = Math.max(
    dauerMs,
    plan?.duration_ms ?? 0,
    ...spans.map((span) => span.end_ms),
    ...(plan?.timeline ?? []).map((span) => span.end_ms),
    1,
  );
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
  const vorschau = useVorschau(api, stand);

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

  /** Where a piece is drawn: where the plan puts it, else where the render put it. */
  const lage = (span: Span) => geplant.get(span.entry_id) ?? span;

  const master = (abMs: number): Quelle => ({
    pfad: `${basis}/master`,
    name: `Master ${variante}`,
    abMs,
  });
  const stemPfad = (entryId: string) =>
    `${basis}/artifact/stems/${encodeURIComponent(entryId)}.wav`;
  const stem = (span: Span): Quelle => ({
    pfad: stemPfad(span.entry_id),
    name: span.entry_id,
    abMs: span.start_ms,
  });

  const uebernehmen = (entryId: string, griff: Griff, dMs: number) => {
    const span = spans.find((eintrag) => eintrag.entry_id === entryId);
    if (!bearbeiten || !aktuell || !span || dMs === 0) return;
    setEntwurf?.(verschieben(aktuell, entryId, lage(span), griff, dMs));
  };

  // A drag follows the pointer on the window, so it keeps going when the pointer leaves the plate.
  const greifen = (event: React.PointerEvent<SVGElement>, entryId: string, griff: Griff): void => {
    if (!bearbeiten || event.button !== 0) return;
    const svg = event.currentTarget.ownerSVGElement;
    const rahmen = svg?.getBoundingClientRect();
    if (!rahmen || rahmen.width === 0) return;
    event.stopPropagation();
    const x0 = event.clientX;
    const msProPx = gesamt / ((rahmen.width * ZEICHENBREITE) / BREITE);
    geschoben.current = false;
    let dMs = 0;
    const bewegen = (move: PointerEvent) => {
      const dx = move.clientX - x0;
      if (!geschoben.current && Math.abs(dx) < ZUG_SCHWELLE_PX) return;
      geschoben.current = true;
      dMs = Math.round((dx * msProPx) / RASTER_MS) * RASTER_MS;
      setZug({ entryId, griff, dMs });
    };
    const loslassen = () => {
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', loslassen);
      window.removeEventListener('pointercancel', loslassen);
      setZug(null);
      if (geschoben.current) {
        setAuswahl(entryId);
        uebernehmen(entryId, griff, dMs);
        // The click a release produces is dispatched before any timer runs; after it, the flag
        // must be down again, or a drag released off the plate would swallow the next real click.
        window.setTimeout(() => {
          geschoben.current = false;
        }, 0);
      }
    };
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', loslassen);
    window.addEventListener('pointercancel', loslassen);
  };

  // A click on the plate is a time: the viewBox maps to the drawn width, so the click's offset
  // inside the SVG, scaled back, is the millisecond under the pointer.
  const anDerStelle = (event: React.MouseEvent<SVGSVGElement>) => {
    if (geschoben.current) {
      geschoben.current = false;
      return;
    }
    const rahmen = event.currentTarget.getBoundingClientRect();
    if (rahmen.width === 0) return;
    const einheit = ((event.clientX - rahmen.left) / rahmen.width) * BREITE;
    if (einheit < LEISTE) return;
    const ms = Math.min(gesamt, Math.max(0, ((einheit - LEISTE) / ZEICHENBREITE) * gesamt));
    vorschau.anhalten();
    transport.spielen(master(ms));
  };

  const vorschauStarten = () => {
    if (!plan) return;
    transport.anhalten();
    void vorschau.spielen(einsaetze(plan.timeline, spans, 0), stemPfad, 0);
  };

  const kopfMs = vorschau.laeuft ? vorschau.stelleMs : transport.stelleMs;
  const kopfZeigen = vorschau.laeuft || transport.quelle !== null;

  return (
    <div className="spuren">
      <div className="reihe zeitleiste-transport">
        <Button
          size="sm"
          className={transportKlasse()}
          aria-label={transport.laeuft ? 'Zeitleiste anhalten' : 'Zeitleiste abspielen'}
          onClick={() => {
            vorschau.anhalten();
            if (transport.laeuft) transport.anhalten();
            else transport.spielen(master(transport.stelleMs));
          }}
        >
          {transport.laeuft ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <span className="zahl" aria-live="off">
          {sekunden(kopfMs)} / {sekunden(gesamt)}
        </span>
        <span className="entfernt">
          {vorschau.laeuft
            ? 'spielt: Entwurf (Vorschau)'
            : transport.quelle
              ? `spielt: ${transport.quelle.name}`
              : bearbeiten
                ? 'Klick spielt ab dort oder ein Stück allein; Ziehen verschiebt es.'
                : 'Klick auf die Skala spielt den Master ab dort, Klick auf ein Stück nur dieses.'}
        </span>
      </div>
      {planStand.art !== 'gleich' ? (
        <PlanZeile
          stand={planStand}
          vorschau={vorschau}
          kannVorschau={!!plan && vorschauMoeglich()}
          nurZeit={!!gespeichert && !!aktuell && nurZeitGeaendert(gespeichert, aktuell)}
          starten={vorschauStarten}
        />
      ) : null}
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
              {spur.spans.map((span) => {
                const ruhe = lage(span);
                const jetzt =
                  zug?.entryId === span.entry_id ? gezogen(ruhe, zug.griff, zug.dMs) : ruhe;
                const index = aktuell ? eintragIndex(aktuell, span.entry_id) : -1;
                const eintrag = aktuell?.timeline[index];
                return (
                  <Stueck
                    key={span.entry_id}
                    span={span}
                    lage={jetzt}
                    art={spur.art}
                    y={y}
                    x={x}
                    welle={wellen.get(span.entry_id)}
                    stufen={peaks?.levels ?? 255}
                    durchgefallen={urteile.get(span.entry_id) === false}
                    gewaehlt={auswahl === span.entry_id}
                    bearbeiten={bearbeiten}
                    blenden={
                      eintrag?.type === 'ambience'
                        ? { ein: eintrag.fade_in_ms, aus: eintrag.fade_out_ms }
                        : null
                    }
                    hoeren={() => {
                      if (geschoben.current) {
                        geschoben.current = false;
                        return;
                      }
                      setAuswahl(span.entry_id);
                      vorschau.anhalten();
                      transport.spielen(stem(span));
                    }}
                    greifen={(event, griff) => greifen(event, span.entry_id, griff)}
                    schieben={(dMs) => {
                      setAuswahl(span.entry_id);
                      uebernehmen(span.entry_id, 'mitte', dMs);
                    }}
                  />
                );
              })}
            </g>
          );
        })}

        {kopfZeigen ? (
          <line
            className="zeitleiste-kopf"
            x1={x(kopfMs)}
            x2={x(kopfMs)}
            y1={KOPF - 6}
            y2={hoehe - 2}
            stroke="var(--ton-schrift)"
            strokeWidth={1.5}
            strokeDasharray={vorschau.laeuft ? '3 2' : undefined}
          />
        ) : null}
      </svg>
      {bearbeiten && auswahl && aktuell ? (
        <Auswahl
          entwurf={aktuell}
          entryId={auswahl}
          setEntwurf={(next) => setEntwurf?.(next)}
          schliessen={() => setAuswahl(null)}
        />
      ) : null}
      {bearbeitbar && !gleicheEintraege ? (
        <p className="hinweis" role="status">
          Der Entwurf hat Klänge hinzugefügt oder entfernt. Die Stücke dieses Renders heißen dann
          andere Einträge; Ziehen geht wieder nach dem Speichern und Rendern.
        </p>
      ) : null}
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

/** A scene with nothing in it, for the read-only plate that is handed no document. */
const LEER = { timeline: [] } as unknown as Scene;

function PlanZeile({
  stand,
  vorschau,
  kannVorschau,
  nurZeit,
  starten,
}: {
  stand: PlanStand;
  vorschau: ReturnType<typeof useVorschau>;
  kannVorschau: boolean;
  nurZeit: boolean;
  starten(): void;
}): React.JSX.Element {
  let text: string;
  if (stand.art === 'laedt') text = 'Der Entwurf wird geplant …';
  else if (stand.art === 'fehler') text = `Kein Plan für den Entwurf: ${fehlerText(stand.fehler)}`;
  else if (stand.art === 'fertig' && !stand.plan.complete)
    text =
      `Für ${stand.plan.missing.join(', ')} gibt es noch keine Aufnahme dieser Fassung. ` +
      'Wo alles liegt, zeigt erst der nächste Render.';
  else
    text =
      'Entwurf: So läge die Szene nach dem nächsten Render, geplant aus den vorhandenen ' +
      'Aufnahmen. Der Umriss zeigt, wo der Render sie hingelegt hat.';
  return (
    <div className="reihe zeitleiste-plan" role="status">
      {kannVorschau ? (
        <Button
          size="sm"
          onClick={() => (vorschau.laeuft ? vorschau.anhalten() : starten())}
          disabled={vorschau.laedt}
        >
          {vorschau.laeuft ? <Square aria-hidden /> : <Headphones aria-hidden />}
          {vorschau.laedt ? 'Lädt …' : vorschau.laeuft ? 'Anhalten' : 'Entwurf hören'}
        </Button>
      ) : null}
      <span className={stand.art === 'fehler' ? 'hinweis-alarm' : 'entfernt'}>
        {text}
        {kannVorschau
          ? nurZeit
            ? ' Die Vorschau spielt die Spuren des letzten Renders an den neuen Stellen, ohne Raum und Lautheitsausgleich.'
            : ' Die Vorschau spielt die Spuren des letzten Renders an den neuen Stellen; Pegel- und Klangänderungen hört erst der Render.'
          : ''}
      </span>
      {vorschau.fehler ? <span className="hinweis-alarm">{vorschau.fehler}</span> : null}
    </div>
  );
}

/**
 * The selected piece's times as numbers — the drag's exact counterpart, and the only control for a
 * turn's `at_ms`, which no other view edits.
 */
function Auswahl({
  entwurf,
  entryId,
  setEntwurf,
  schliessen,
}: {
  entwurf: Scene;
  entryId: string;
  setEntwurf(next: Scene): void;
  schliessen(): void;
}): React.JSX.Element | null {
  const index = eintragIndex(entwurf, entryId);
  const entry = entwurf.timeline[index];
  if (!entry) return null;
  return (
    <div className="zeitleiste-auswahl" aria-label={`Auswahl ${entryId}`} role="group">
      <span className="zahl">{entryId}</span>
      {entry.type === 'speech' ? (
        <>
          <ZahlFeld
            legende="Beginn nach Sprechstart"
            einheit="ms"
            hinweis={entry.at_ms === null ? 'leer: folgt der vorigen Zeile' : undefined}
            wert={entry.at_ms}
            min={0}
            schritt={10}
            leerErlaubt
            onWert={(wert) =>
              setEntwurf(
                wert === null
                  ? sprechzeitLoesen(entwurf, index)
                  : sprechzeitSetzen(entwurf, index, wert),
              )
            }
          />
          <Button
            size="sm"
            disabled={entry.at_ms === null}
            onClick={() => setEntwurf(sprechzeitLoesen(entwurf, index))}
          >
            Zeit lösen
          </Button>
        </>
      ) : null}
      {entry.type === 'sfx' ? (
        <ZahlFeld
          legende="Zeitpunkt"
          einheit="ms"
          wert={entry.at_ms}
          min={0}
          schritt={10}
          onWert={(wert) => setEntwurf(ereigniszeitSetzen(entwurf, index, wert ?? 0))}
        />
      ) : null}
      {entry.type === 'ambience' ? (
        <>
          <ZahlFeld
            legende="Beginn"
            einheit="ms"
            wert={entry.start_ms}
            min={0}
            schritt={10}
            onWert={(wert) => setEntwurf(bettSetzen(entwurf, index, { start_ms: wert ?? 0 }))}
          />
          <ZahlFeld
            legende="Ende"
            einheit="ms"
            hinweis={entry.end_ms === null ? 'leer: bis zum Szenenende' : undefined}
            wert={entry.end_ms}
            min={0}
            schritt={10}
            leerErlaubt
            onWert={(wert) => setEntwurf(bettSetzen(entwurf, index, { end_ms: wert }))}
          />
          <ZahlFeld
            legende="Einblenden"
            einheit="ms"
            wert={entry.fade_in_ms}
            min={0}
            max={10000}
            schritt={50}
            onWert={(wert) => setEntwurf(bettSetzen(entwurf, index, { fade_in_ms: wert ?? 0 }))}
          />
          <ZahlFeld
            legende="Ausblenden"
            einheit="ms"
            wert={entry.fade_out_ms}
            min={0}
            max={10000}
            schritt={50}
            onWert={(wert) => setEntwurf(bettSetzen(entwurf, index, { fade_out_ms: wert ?? 0 }))}
          />
        </>
      ) : null}
      <Button size="sm" onClick={schliessen}>
        Schließen
      </Button>
    </div>
  );
}

function Stueck({
  span,
  lage,
  art,
  y,
  x,
  welle,
  stufen,
  durchgefallen,
  gewaehlt,
  bearbeiten,
  blenden,
  hoeren,
  greifen,
  schieben,
}: {
  span: Span;
  /** Where the piece is drawn: the render's span, the plan's, or under a drag. */
  lage: { start_ms: number; end_ms: number };
  art: 'speech' | 'ambience' | 'sfx';
  y: number;
  x(ms: number): number;
  welle: PeaksTrack | undefined;
  stufen: number;
  durchgefallen: boolean;
  gewaehlt: boolean;
  bearbeiten: boolean;
  blenden: { ein: number; aus: number } | null;
  hoeren(): void;
  greifen(event: React.PointerEvent<SVGElement>, griff: Griff): void;
  schieben(dMs: number): void;
}): React.JSX.Element {
  const links = x(lage.start_ms);
  const rechts = Math.max(links + 2, x(lage.end_ms));
  const bett = art === 'ambience';
  const farbe = bett ? 'var(--ton-ruhe)' : 'var(--ton-messung)';
  const mitte = y + SPUR_HOEHE / 2;
  const halbe = bett ? 7 : 11;
  const verschoben = lage.start_ms !== span.start_ms || lage.end_ms !== span.end_ms;
  // The waveform belongs to the rendered span. Moved whole it moves with the piece; a bed whose
  // length changed has no waveform of that length yet, so it is drawn as its bar.
  const gleicheLaenge = lage.end_ms - lage.start_ms === span.end_ms - span.start_ms;
  const titel =
    `${span.entry_id} · ${dauer(lage.start_ms)} – ${dauer(lage.end_ms)}` +
    (verschoben ? ` (gerendert ${dauer(span.start_ms)} – ${dauer(span.end_ms)})` : '') +
    (bearbeiten ? ' · Klick hört, Ziehen verschiebt' : ' · einzeln hören');
  return (
    <g
      className={`zeitleiste-stueck${bearbeiten ? ' zeitleiste-stueck-beweglich' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${span.entry_id} einzeln hören`}
      aria-pressed={gewaehlt}
      onClick={(event) => {
        // The plate's own click plays the master; a click on a piece means this piece.
        event.stopPropagation();
        hoeren();
      }}
      onPointerDown={(event) => greifen(event, 'mitte')}
      onKeyDown={(event) => {
        if (event.key === 'Enter') hoeren();
        if (bearbeiten && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          const betrag = event.shiftKey ? 100 : RASTER_MS;
          schieben(event.key === 'ArrowLeft' ? -betrag : betrag);
        }
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
        fill={welle && gleicheLaenge ? 'transparent' : farbe}
        fillOpacity={bett ? 0.55 : 1}
        stroke={durchgefallen ? 'var(--ton-alarm)' : gewaehlt ? 'var(--ton-schrift)' : 'none'}
        strokeWidth={durchgefallen || gewaehlt ? 1.5 : 0}
      />
      {welle && gleicheLaenge ? (
        <path
          d={umriss(welle.peaks, stufen, links, rechts, mitte, halbe)}
          fill={farbe}
          fillOpacity={bett ? 0.55 : 1}
        />
      ) : null}
      {verschoben ? (
        // Where the render put it: an outline, because it is a fact about the old bytes.
        <rect
          className="zeitleiste-gerendert"
          x={x(span.start_ms)}
          y={y + 4}
          width={Math.max(2, x(span.end_ms) - x(span.start_ms))}
          height={SPUR_HOEHE - 8}
          rx={1}
          fill="none"
          stroke="var(--ton-schrift-weg)"
          strokeDasharray="3 2"
          strokeWidth={1}
          pointerEvents="none"
        />
      ) : null}
      {blenden ? (
        <polyline
          className="zeitleiste-blende"
          points={[
            [links, y + SPUR_HOEHE - 4],
            [Math.min(rechts, x(lage.start_ms + blenden.ein)), y + 4],
            [Math.max(links, x(lage.end_ms - blenden.aus)), y + 4],
            [rechts, y + SPUR_HOEHE - 4],
          ]
            .map(([px, py]) => `${(px ?? 0).toFixed(1)},${(py ?? 0).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke="var(--ton-schrift-weg)"
          strokeWidth={1}
          pointerEvents="none"
        />
      ) : null}
      {art === 'sfx' ? (
        <circle cx={links + 1} cy={y + 4} r={2.5} fill="var(--ton-messung)" />
      ) : null}
      {bett && bearbeiten ? (
        <>
          <rect
            className="zeitleiste-kante"
            aria-hidden
            x={links - 3}
            y={y + 4}
            width={6}
            height={SPUR_HOEHE - 8}
            fill="transparent"
            onPointerDown={(event) => greifen(event, 'anfang')}
          />
          <rect
            className="zeitleiste-kante"
            aria-hidden
            x={rechts - 3}
            y={y + 4}
            width={6}
            height={SPUR_HOEHE - 8}
            fill="transparent"
            onPointerDown={(event) => greifen(event, 'ende')}
          />
        </>
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
