/**
 * Mischung — what the render actually produced, and the two buttons that produce it.
 *
 * **Everything drawn here is measured, never planned.** The lanes come from the render manifest's
 * own `timeline`: where each turn, bed and event landed after pace, overlap and the difficulty
 * deltas were applied. A scene's authored `at_ms` is a *request*, and drawing it as a time would
 * make the picture agree with the document exactly when the render disagrees with both. Before a
 * render there is no picture — which is the honest state, not an empty one.
 *
 * **The lanes are drawn in shape, not in a new colour.** Tonwerk spends hue on one distinction —
 * what a machine measured against what a person vouched for — so a bed is a dim graphite band, a
 * turn is a lit cyan bar, and an event is a tick with a cap. The only hue that enters is red, and
 * only where the transcript check failed on that turn: a verdict, which is what hue is for.
 *
 * **A run says how long it has been running.** A cold render synthesises every line through a
 * local model (~30 s); a warm one is a cache walk (under 3 s). A button that greys out identically
 * for both is a button that looks broken half the time, so the elapsed second is on it — and the
 * node counts are on the answer, because "24 of 26 nodes came from the cache" is the argument the
 * whole graph exists to make.
 *
 * This view is read-mostly on purpose: approval is PR 9b's, and the approval already recorded is
 * shown here because a reviewer must see whether it still covers these bytes.
 */
import { useMemo, useRef } from 'react';
import { Marke, Platte, Zustand } from '../../components/Platte';
import { Spielbereich, Spieler } from '../../components/Spieler';
import { dauer, kurzSha, prozent, sekunden, zahl, zeitpunkt } from '../../format';
import { useVorgang } from '../../vorgang';
import { fehlerText } from '../fehler';
import type { Api } from '../../api';
import type { Approval, QaReport, RenderRow, SpeakerQa, Span } from '../../contracts';
import type { Scene } from '@da/schema/audio-scene';

const SPUR_HOEHE = 26;
const LEISTE = 150;
const BREITE = 1000;
const KOPF = 22;

export function MischungModus({
  scene,
  slug,
  renders,
  qa,
  approval,
  sceneSha,
  variante,
  setVariante,
  geaendert,
  api,
  nachLauf,
}: {
  scene: Scene;
  slug: string;
  renders: RenderRow[];
  qa: QaReport | null;
  approval: Approval | null;
  sceneSha: string;
  variante: string;
  setVariante(next: string): void;
  /** The draft has unsaved edits, so the render on screen is of other bytes. */
  geaendert: boolean;
  api: Api;
  nachLauf(): void;
}): React.JSX.Element {
  const bericht = useRef<HTMLDivElement | null>(null);
  const stand = renders.find((row) => row.variant === variante) ?? null;

  const rendern = useVorgang(() => api.renderScene(slug, variante));
  const pruefen = useVorgang(() => api.runQa(slug, variante));

  const rollen = useMemo(
    () => new Map(scene.script.map((utterance) => [utterance.id, utterance.role])),
    [scene.script],
  );
  // A per-utterance verdict, so a failed turn can be marked in the lane it was heard in rather
  // than only in a table underneath.
  const urteile = useMemo(
    () =>
      new Map(
        (qa?.transcripts?.lines ?? []).map((line) => [line.line_id, line.passed] as const),
      ),
    [qa],
  );

  const fertig = rendern.ergebnis ?? pruefen.ergebnis;

  return (
    <Spielbereich>
      <Platte
        titel="Varianten"
        zaehler={`${zahl(renders.filter((row) => row.rendered).length)} von ${zahl(renders.length)} gerendert`}
        erklaerung="Ein Renderstand gilt für genau diese Szenen-Bytes. Nach einer Revision steht hier überall wieder „nicht gerendert“ — das alte Audio gehört zu einem anderen Text."
      >
        {renders.length === 0 ? (
          <Zustand art="leer" text="Diese Szene erklärt keine Variante, also gibt es nichts zu rendern." />
        ) : (
          <div className="variantenwahl" role="group" aria-label="Variante">
            {renders.map((row) => (
              <button
                key={row.variant}
                type="button"
                className="variantenknopf"
                aria-pressed={row.variant === variante}
                onClick={() => setVariante(row.variant)}
              >
                <span className="zahl">{row.variant}</span>
                <span className="variantenknopf-stand">
                  {row.rendered ? dauer(row.duration_ms) : 'nicht gerendert'}
                </span>
              </button>
            ))}
          </div>
        )}
      </Platte>

      <Platte
        titel="Lauf"
        erklaerung="Rendern erzeugt die Aufnahme aus diesen Bytes; die Prüfung transkribiert sie und hält sie gegen das Skript. Beides läuft örtlich und dauert."
      >
        {geaendert ? (
          <p className="hinweis" style={{ marginBottom: 'var(--ton-mass-4)' }}>
            Der Entwurf ist geändert und noch nicht gespeichert. Gerendert würde die zuletzt
            gespeicherte Fassung — nicht das, was oben im Skript steht.
          </p>
        ) : null}
        <div className="reihe">
          <button
            type="button"
            className="knopf knopf-signal"
            disabled={rendern.laeuft || pruefen.laeuft || renders.length === 0}
            onClick={() => {
              rendern.starten();
              pruefen.vergessen();
            }}
          >
            {rendern.laeuft ? (
              <>
                Rendert … <span className="zahl">{rendern.sekunden} s</span>
              </>
            ) : (
              `${variante} rendern`
            )}
          </button>
          <button
            type="button"
            className="knopf"
            disabled={rendern.laeuft || pruefen.laeuft || !stand?.rendered}
            title={stand?.rendered ? undefined : 'Erst rendern: die Prüfung braucht einen Master.'}
            onClick={() => {
              pruefen.starten();
              rendern.vergessen();
            }}
          >
            {pruefen.laeuft ? (
              <>
                Prüft … <span className="zahl">{pruefen.sekunden} s</span>
              </>
            ) : (
              'Automatisch prüfen'
            )}
          </button>
          {stand?.has_master ? (
            <Spieler
              pfad={`/api/scenes/${encodeURIComponent(slug)}/renders/${encodeURIComponent(variante)}/master`}
              name={`Master ${variante}`}
            />
          ) : (
            <span className="entfernt spieler-leer">kein Master dieser Bytes</span>
          )}
        </div>

        {rendern.ergebnis ? (
          <p className="lauf-ergebnis" role="status">
            <span className="zahl">{zahl(rendern.ergebnis.nodes_evaluated)}</span> Knoten gerechnet,{' '}
            <span className="zahl">{zahl(rendern.ergebnis.nodes_cached)}</span> aus dem Cache ·
            Länge <span className="zahl">{dauer(rendern.ergebnis.duration_ms)}</span>
          </p>
        ) : null}
        {pruefen.ergebnis ? (
          <p className="lauf-ergebnis" role="status">
            Prüfung{' '}
            {pruefen.ergebnis.passed ? (
              <Marke ton="messung">bestanden</Marke>
            ) : (
              <Marke ton="alarm">durchgefallen</Marke>
            )}
          </p>
        ) : null}
        {rendern.fehler ? (
          <p className="hinweis hinweis-alarm" role="alert">
            {fehlerText(rendern.fehler)}
          </p>
        ) : null}
        {pruefen.fehler ? (
          <p className="hinweis hinweis-alarm" role="alert">
            {fehlerText(pruefen.fehler)}
          </p>
        ) : null}
        {fertig ? (
          <button
            type="button"
            className="knopf"
            style={{ marginTop: 'var(--ton-mass-3)' }}
            onClick={nachLauf}
          >
            Szene neu lesen
          </button>
        ) : null}
      </Platte>

      <Platte
        titel="Zeitleiste"
        zaehler={stand?.rendered ? dauer(stand.duration_ms) : undefined}
        erklaerung="Wo alles im fertigen Master tatsächlich liegt — gemessen beim Rendern, nicht geplant."
        randlos
      >
        {stand?.rendered && stand.timeline.length > 0 ? (
          <Spuren
            spans={stand.timeline}
            dauerMs={stand.duration_ms ?? 0}
            rollen={rollen}
            reihenfolge={scene.cast.map((member) => member.role)}
            urteile={urteile}
          />
        ) : (
          <Zustand
            art="leer"
            text="Es gibt keinen Render dieser Bytes, also auch nichts zu zeichnen."
          />
        )}
      </Platte>

      <Platte
        titel="Prüfergebnis"
        zaehler={
          qa?.passed === undefined ? undefined : (
            <Marke ton={qa.passed ? 'messung' : 'alarm'}>
              {qa.passed ? 'bestanden' : 'durchgefallen'}
            </Marke>
          )
        }
        erklaerung="Erkannte Wörter gegen erwartete, je Äußerung. Eine bestandene Prüfung ist keine Freigabe."
      >
        {qa === null ? (
          <Zustand art="leer" text="Für diese Revision liegt keine automatische Prüfung vor." />
        ) : (
          <>
            {qa.variant && qa.variant !== variante ? (
              <p className="hinweis" style={{ marginBottom: 'var(--ton-mass-4)' }}>
                Der gespeicherte Bericht gehört zur Variante{' '}
                <span className="zahl">{qa.variant}</span>, nicht zu{' '}
                <span className="zahl">{variante}</span>. Je Revision wird ein Bericht gespeichert.
              </p>
            ) : null}
            <div className="reihe">
              <Marke ton={(qa.transcripts?.full_wer ?? 0) > 0.08 ? 'alarm' : 'ruhig'}>
                Gesamt-WER {prozent(qa.transcripts?.full_wer)}
              </Marke>
              <Sprecherchip speaker={qa.speaker_qa} />
              {(qa.transcripts?.lines ?? []).map((line) => (
                <Marke
                  key={line.line_id}
                  ton={line.passed ? 'messung' : 'alarm'}
                  titel={line.passed ? line.transcript : `erkannt: ${line.transcript}`}
                >
                  {line.line_id} {prozent(line.wer)}
                </Marke>
              ))}
            </div>
            <button
              type="button"
              className="knopf"
              style={{ marginTop: 'var(--ton-mass-4)' }}
              onClick={() => bericht.current?.scrollIntoView({ block: 'start' })}
            >
              Ganzen Bericht lesen
            </button>
          </>
        )}
      </Platte>

      <div ref={bericht}>
        <Bericht qa={qa} />
      </div>

      <Stuecke stand={stand} />
      <Freigabe approval={approval} sceneSha={sceneSha} />
    </Spielbereich>
  );
}

/**
 * The lanes.
 *
 * One lane per cast role in cast order — so the picture reads in the order the Besetzung panel
 * lists — plus a lane for beds and a lane for events. A role with no measured turn keeps its lane:
 * an empty lane says "this voice is silent in this variant", and a lane that disappears says
 * nothing at all.
 */
function Spuren({
  spans,
  dauerMs,
  rollen,
  reihenfolge,
  urteile,
}: {
  spans: Span[];
  dauerMs: number;
  rollen: Map<string, string>;
  reihenfolge: string[];
  urteile: Map<string, boolean>;
}): React.JSX.Element {
  const gesamt = Math.max(dauerMs, ...spans.map((span) => span.end_ms), 1);
  const spuren: { name: string; art: 'speech' | 'ambience' | 'sfx'; spans: Span[] }[] = [
    ...reihenfolge.map((rolle) => ({
      name: rolle,
      art: 'speech' as const,
      spans: spans.filter(
        (span) => span.type === 'speech' && rollen.get(span.entry_id) === rolle,
      ),
    })),
  ];
  const betten = spans.filter((span) => span.type === 'ambience');
  const ereignisse = spans.filter((span) => span.type === 'sfx');
  if (betten.length) spuren.push({ name: 'Umgebung', art: 'ambience', spans: betten });
  if (ereignisse.length) spuren.push({ name: 'Ereignisse', art: 'sfx', spans: ereignisse });

  const hoehe = KOPF + spuren.length * SPUR_HOEHE + 6;
  const x = (ms: number) => LEISTE + (ms / gesamt) * (BREITE - LEISTE - 8);
  const schritt = tickSchritt(gesamt);

  return (
    <div className="spuren">
      <svg
        viewBox={`0 0 ${BREITE} ${hoehe}`}
        width="100%"
        height={hoehe}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`Gerenderte Zeitleiste, ${spuren.length} Spuren, Länge ${dauer(gesamt)}`}
      >
        {/* The scale plate: engraved ticks with their seconds printed, the way a meter is ruled. */}
        {Array.from({ length: Math.floor(gesamt / schritt) + 1 }, (_, index) => index * schritt).map(
          (ms) => (
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
          ),
        )}

        {spuren.map((spur, index) => {
          const y = KOPF + index * SPUR_HOEHE;
          return (
            <g key={`${spur.art}-${spur.name}`}>
              <line
                x1={0}
                x2={BREITE}
                y1={y}
                y2={y}
                stroke="var(--ton-kante)"
                strokeWidth={1}
              />
              <text
                x={0}
                y={y + 16}
                className="spur-name"
                fill={spur.art === 'speech' ? 'var(--ton-signal)' : 'var(--ton-schrift-weg)'}
                fontSize={10}
              >
                {spur.name}
              </text>
              {spur.spans.map((span) => {
                const links = x(span.start_ms);
                const breite = Math.max(2, x(span.end_ms) - links);
                if (spur.art === 'sfx') {
                  return (
                    <g key={span.entry_id}>
                      <rect x={links} y={y + 6} width={2} height={14} fill="var(--ton-messung)" />
                      <circle cx={links + 1} cy={y + 5} r={2.5} fill="var(--ton-messung)" />
                      <title>{`${span.entry_id} · ${dauer(span.start_ms)}`}</title>
                    </g>
                  );
                }
                const bett = spur.art === 'ambience';
                const durchgefallen = urteile.get(span.entry_id) === false;
                return (
                  <rect
                    key={span.entry_id}
                    x={links}
                    y={y + (bett ? 8 : 6)}
                    width={breite}
                    height={bett ? 10 : 14}
                    rx={1}
                    fill={bett ? 'var(--ton-ruhe)' : 'var(--ton-messung)'}
                    fillOpacity={bett ? 0.55 : 1}
                    stroke={durchgefallen ? 'var(--ton-alarm)' : 'none'}
                    strokeWidth={durchgefallen ? 1.5 : 0}
                  >
                    <title>{`${span.entry_id} · ${dauer(span.start_ms)} – ${dauer(span.end_ms)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** A tick every 1, 2, 5, 10, 15, 30 or 60 s — whichever puts roughly eight marks on the plate. */
function tickSchritt(gesamt: number): number {
  for (const schritt of [1000, 2000, 5000, 10000, 15000, 30000, 60000]) {
    if (gesamt / schritt <= 10) return schritt;
  }
  return 60000;
}

function Sprecherchip({ speaker }: { speaker: SpeakerQa | undefined }): React.JSX.Element {
  if (speaker === undefined) return <Marke>Stimmkonsistenz nicht Teil des Berichts</Marke>;
  if (typeof speaker === 'string') {
    // A check that could not run must never look like a check that passed.
    return <Marke titel="Die Prüfung konnte nicht laufen.">Stimme nicht gemessen: {speaker}</Marke>;
  }
  const werte = (speaker.characters ?? [])
    .map((character) => character.minimum_similarity)
    .filter((wert): wert is number => typeof wert === 'number');
  const kleinste = werte.length ? Math.min(...werte) : null;
  return (
    <Marke ton="messung" titel="Kleinste gemessene Ähnlichkeit über alle Sprecher.">
      Stimme min {kleinste === null ? '–' : kleinste.toFixed(3)}
    </Marke>
  );
}

function Bericht({ qa }: { qa: QaReport | null }): React.JSX.Element {
  const zeilen = qa?.transcripts?.lines ?? [];
  return (
    <Platte
      titel="Prüfbericht"
      zaehler={qa?.scene_sha256 ? `Sha ${kurzSha(qa.scene_sha256)}` : undefined}
      erklaerung="Erwartet gegen erkannt, Wort für Wort. Was hier auffällt, ist eine Aussprache- oder eine Textentscheidung — selten beides."
      randlos
    >
      {zeilen.length === 0 ? (
        <Zustand art="leer" text="Kein Transkript für diese Revision." />
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Äußerung</th>
                <th scope="col">Erwartet</th>
                <th scope="col">Erkannt</th>
                <th scope="col" className="zahl-rechts">
                  WER
                </th>
                <th scope="col">Urteil</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((line) => (
                <tr key={line.line_id}>
                  <td className="zahl leise">{line.line_id}</td>
                  <td className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                    {line.expected}
                  </td>
                  <td className="skript entfernt" style={{ fontSize: 'var(--ton-grad-13)' }}>
                    {line.transcript}
                  </td>
                  <td className="zahl-rechts zahl">{prozent(line.wer)}</td>
                  <td>
                    {line.passed ? <Marke ton="messung">ok</Marke> : <Marke ton="alarm">Abweichung</Marke>}
                    {(line.missing_protected ?? []).length > 0 ? (
                      <div className="zeile-neben">
                        fehlt: {(line.missing_protected ?? []).join(', ')}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(qa?.transcripts?.failures ?? []).length > 0 ? (
        <ul className="platte-leib stapel-eng">
          {(qa?.transcripts?.failures ?? []).map((failure) => (
            <li key={failure} className="hinweis hinweis-alarm">
              {failure}
            </li>
          ))}
        </ul>
      ) : null}
    </Platte>
  );
}

/**
 * What the render wrote, beside what can be played.
 *
 * Only the master is served over HTTP today (`GET …/renders/{variant}/master`), so the stems are
 * listed with their digests and not offered a transport. A play button that did nothing would be
 * worse than the list: it would say the studio can audition one voice on its own, and it cannot.
 */
function Stuecke({ stand }: { stand: RenderRow | null }): React.JSX.Element {
  const stuecke = stand?.artifacts ?? [];
  return (
    <Platte
      titel="Renderstücke"
      zaehler={`${zahl(stuecke.length)}`}
      erklaerung="Was dieser Lauf geschrieben hat. Anhören lässt sich hier nur der Master — die Engine gibt die Einzelspuren noch über keinen Pfad heraus."
      randlos
    >
      {stuecke.length === 0 ? (
        <Zustand art="leer" text="Kein Render dieser Bytes." />
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Art</th>
                <th scope="col">Datei</th>
                <th scope="col">Sha</th>
              </tr>
            </thead>
            <tbody>
              {stuecke.map((stueck) => (
                <tr key={stueck.path}>
                  <td>
                    <Marke ton={stueck.kind === 'master' ? 'messung' : 'ruhig'}>{stueck.kind}</Marke>
                  </td>
                  <td className="zahl leise">{stueck.path}</td>
                  <td className="zahl entfernt" title={stueck.sha256}>
                    {kurzSha(stueck.sha256)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Platte>
  );
}

function Freigabe({
  approval,
  sceneSha,
}: {
  approval: Approval | null;
  sceneSha: string;
}): React.JSX.Element {
  if (!approval) {
    return (
      <Platte titel="Freigabe">
        <Zustand art="leer" text="Diese Revision ist von niemandem freigegeben." />
      </Platte>
    );
  }
  // An approval names the bytes it certifies. Naming other bytes than the ones on this page is
  // exactly what `stale` means, and it has to be visible here and not only in the registry.
  const passend = !approval.scene_sha256 || approval.scene_sha256 === sceneSha;
  return (
    <Platte
      titel="Freigabe"
      zaehler={
        <Marke ton={passend ? 'signal' : 'alarm'}>
          {passend ? 'gilt für diese Bytes' : 'gilt für andere Bytes'}
        </Marke>
      }
      randlos
    >
      <dl className="werte platte-leib">
        <div className="wert">
          <dt>Freigegeben von</dt>
          <dd>{approval.editor ?? '–'}</dd>
        </div>
        <div className="wert">
          <dt>Wann</dt>
          <dd className="zahl">{zeitpunkt(approval.reviewed_at)}</dd>
        </div>
        <div className="wert">
          <dt>Variante</dt>
          <dd className="zahl">{approval.variant ?? '–'}</dd>
        </div>
        <div className="wert">
          <dt>Audio-Sha</dt>
          <dd className="zahl" title={approval.audio_sha256 ?? undefined}>
            {kurzSha(approval.audio_sha256)}
          </dd>
        </div>
      </dl>
      {(approval.checklist ?? []).length > 0 ? (
        <div className="platte-leib reihe" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          {(approval.checklist ?? []).map((item) => (
            <Marke key={item} ton="signal">
              {item}
            </Marke>
          ))}
        </div>
      ) : null}
    </Platte>
  );
}
