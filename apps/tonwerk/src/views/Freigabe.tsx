/**
 * Freigabe — one scene, one reviewer, one signature bound to the bytes they heard.
 *
 * Everything else in Tonwerk reads or edits. This page is the only one where a person's judgement
 * is recorded as a fact about published material, so it is the one page whose *order* is part of
 * what it produces.
 *
 * **Listen first, and the script is behind a disclosure that says why.** Reading along makes a
 * listener hear words that were never spoken — which is precisely what the `intelligibility` check
 * is supposed to catch, so a page that shows the transcript beside the player has disabled its own
 * most important question. The legacy HTML form collapsed the script for exactly this reason and
 * printed the reason on the summary; both survive the move.
 *
 * **The checklist is eight deliberate toggles and there is no way to tick them all at once.** The
 * form this replaces made the opposite trade — one button over eight printed sentences — on the
 * argument that eight checkboxes are eight clicks and never eight decisions. That argument was
 * right about *ceremony* and is no longer available: the engine's `POST /approve` takes the
 * certified keys as data and refuses an approval that omits a required one, so the toggles are the
 * record rather than a ritual in front of it. What is kept from the old argument is everything
 * that made ticking cheap: no "alle bestätigen", no pre-checked state, the full sentence on every
 * row, two of the eight hidden entirely when the scene has nothing for them to be about, and the
 * whole panel unreachable until the listen stage has been left on purpose.
 *
 * **The signature names a sha, and a mismatch is a 409 the reviewer must act on.** The master's
 * digest is read off the render row this page played, not derived at submit time: if a re-render
 * landed mid-review, the engine refuses and this page says re-listen rather than retrying with a
 * digest it fetched a second ago. That refusal is the whole reason the field exists.
 */
import { useCallback, useMemo, useState } from 'react';
import { Feld, SkriptFeld } from '../components/Feld';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Spielbereich, Spieler } from '../components/Spieler';
import { STUFE_LABEL, STUFE_WARTET } from '../contracts';
import { dauer, kurzSha, prozent, zahl, zeitpunkt } from '../format';
import { gemerkterPruefer, merkePruefer } from '../pruefer';
import {
  PRUEFPUNKTE,
  STAND_KETTE,
  STAND_NAME,
  erforderlich,
  fehlende,
  satzFuer,
  standIndex,
  wortDiff,
  type FreigabeStand,
} from '../pruefung';
import { href, navigate } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import { useVorgang } from '../vorgang';
import { fehlerText } from './fehler';
import type { Api, SceneDocument } from '../api';
import type { QaReport, RenderRow, SceneDetail, SpeakerQa } from '../contracts';
import type { Scene } from '@da/schema/audio-scene';

export function Freigabe({ slug }: { slug: string }): React.JSX.Element {
  const api = useApi();
  const [stand, setStand] = useState(0);
  const { data, error, laedt } = useEngineRead(
    (signal) => api.scene(slug, signal),
    [api, slug, stand],
  );

  if (laedt) return <Zustand art="laedt" text={`Szene ${slug} wird gelesen …`} />;
  if (error) {
    return (
      <>
        <Kopf slug={slug} titel={null} />
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
        <Zurueck />
      </>
    );
  }
  if (!data) return <Zustand art="leer" text="Diese Szene gibt es nicht." />;

  return (
    <Ablauf
      // Remounted on every reload: the checklist, the stage and the typed reason all describe the
      // bytes that were on screen, and carrying them across a re-read would carry them onto other
      // ones. That is the same rule the approval's sha states, applied to the page's own state.
      key={`${slug}-${data.revision}-${data.stage}-${stand}`}
      api={api}
      data={data}
      neuLaden={() => setStand((wert) => wert + 1)}
    />
  );
}

function Kopf({ slug, titel }: { slug: string; titel: string | null }): React.JSX.Element {
  return (
    <header className="kopf">
      <span className="tafel kopf-eyebrow">
        <a href={href('pruefung')} style={{ color: 'inherit' }}>
          Prüfung
        </a>{' '}
        · Freigabe
      </span>
      <h1>{slug}</h1>
      {titel ? (
        <p className="skript" style={{ marginTop: 'var(--ton-mass-2)' }}>
          {titel}
        </p>
      ) : null}
    </header>
  );
}

function Zurueck(): React.JSX.Element {
  return (
    <div>
      <a className="knopf" href={href('pruefung')}>
        Zurück zur Warteschlange
      </a>
    </div>
  );
}

function Ablauf({
  api,
  data,
  neuLaden,
}: {
  api: Api;
  data: SceneDetail & { document: SceneDocument };
  neuLaden(): void;
}): React.JSX.Element {
  const scene = data.document.scene;
  // The variant under review is the one the stored QA report ran on. A page that let the reviewer
  // pick would let them listen to `challenging` and sign the `natural` report — which is what the
  // engine's own variant check refuses, and refusing it here means never composing the request.
  const variante = data.qa?.variant ?? data.renders.find((row) => row.rendered)?.variant ?? null;
  const render = data.renders.find((row) => row.variant === variante) ?? null;

  const [stand, setStand] = useState<FreigabeStand>(
    data.approval ? 'entschieden' : 'hoeren',
  );
  const [angekreuzt, setAngekreuzt] = useState<ReadonlySet<string>>(new Set());
  const [pruefer, setPruefer] = useState(gemerkterPruefer);
  const [grundOffen, setGrundOffen] = useState(false);
  const [grund, setGrund] = useState('');

  const noetig = useMemo(
    () => erforderlich(scene, data.exercise != null),
    [scene, data.exercise],
  );
  const fehlt = useMemo(() => fehlende(noetig, angekreuzt), [noetig, angekreuzt]);

  const freigeben = useVorgang(
    useCallback(async () => {
      merkePruefer(pruefer);
      return api.approveScene(data.slug, {
        editor: pruefer.trim(),
        master_sha256: render?.master_sha256 ?? '',
        checklist: [...angekreuzt],
        variant: variante ?? 'natural',
      });
    }, [angekreuzt, api, data.slug, pruefer, render?.master_sha256, variante]),
  );

  const ablehnen = useVorgang(
    useCallback(async () => {
      merkePruefer(pruefer);
      return api.declineScene(data.slug, grund.trim(), pruefer.trim() || undefined);
    }, [api, data.slug, grund, pruefer]),
  );

  const entschieden = Boolean(freigeben.ergebnis || ablehnen.ergebnis);
  const gezeigterStand: FreigabeStand = entschieden ? 'entschieden' : stand;

  // Everything that can make this page not a review, said once and in the order that matters.
  const sperre = warum(data, render, variante);

  return (
    <Spielbereich>
      <Kopf slug={data.slug} titel={scene.title.en} />

      <div className="pruefstand">
        <Kette stand={gezeigterStand} />
        <div className="pruefstand-bytes">
          <span className="tafel">Master</span>
          <span className="zahl" title={render?.master_sha256 ?? undefined}>
            {kurzSha(render?.master_sha256)}
          </span>
          <span className="entfernt">
            {variante ?? '–'} · {dauer(render?.duration_ms)}
          </span>
        </div>
        <div className="pruefstand-knoepfe">
          <button
            type="button"
            className="knopf"
            disabled={gezeigterStand === 'entschieden' || ablehnen.laeuft || freigeben.laeuft}
            onClick={() => {
              setGrundOffen(true);
              setStand('pruefen');
            }}
          >
            Ablehnen
          </button>
          <button
            type="button"
            className="knopf knopf-signal"
            disabled={
              gezeigterStand !== 'pruefen' ||
              sperre !== null ||
              fehlt.length > 0 ||
              pruefer.trim() === '' ||
              freigeben.laeuft ||
              ablehnen.laeuft
            }
            title={
              fehlt.length > 0 ? `Noch nicht bestätigt: ${fehlt.join(', ')}` : undefined
            }
            onClick={freigeben.starten}
          >
            {freigeben.laeuft ? (
              <>
                Gibt frei … <span className="zahl">{freigeben.sekunden} s</span>
              </>
            ) : (
              'Freigeben'
            )}
          </button>
        </div>
      </div>

      {sperre ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {sperre}
        </p>
      ) : null}

      {freigeben.fehler ? <Konflikt fehler={freigeben.fehler} neuLaden={neuLaden} /> : null}
      {ablehnen.fehler ? (
        <p className="hinweis hinweis-alarm" role="alert">
          Nicht abgelehnt. {fehlerText(ablehnen.fehler)}
        </p>
      ) : null}

      {gezeigterStand === 'entschieden' ? (
        <Urteil
          approval={
            freigeben.ergebnis?.approval ?? ablehnen.ergebnis?.decline ?? data.approval ?? null
          }
          slug={data.slug}
        />
      ) : null}

      <Abhoere
        slug={data.slug}
        variante={variante}
        render={render}
        stand={gezeigterStand}
        weiter={() => setStand('pruefen')}
      />

      <SkriptSchleier scene={scene} />

      {gezeigterStand === 'hoeren' ? (
        <Platte titel="Bericht und Checkliste" erklaerung="Erst hören. Der Bericht der Maschine und die acht Punkte stehen danach.">
          <Zustand
            art="leer"
            text="Verschlossen, bis das Hören bestätigt ist — mit den Zahlen vor Augen hört man, was dort steht."
          />
        </Platte>
      ) : (
        <>
          <Bericht qa={data.qa ?? null} variante={variante} />
          <Checkliste
            scene={scene}
            noetig={noetig}
            angekreuzt={angekreuzt}
            setAngekreuzt={setAngekreuzt}
            pruefer={pruefer}
            setPruefer={setPruefer}
            fehlt={fehlt}
            gesperrt={gezeigterStand === 'entschieden'}
          />
        </>
      )}

      {grundOffen && gezeigterStand !== 'entschieden' ? (
        <Platte
          titel="Ablehnen"
          erklaerung="Eine Ablehnung ist ein Schritt, kein Schließen des Tabs. Die Szene geht zurück auf Entwurf; Prüfbericht und Render bleiben, wo sie sind — die Maschine hat sich nicht geirrt, sie hat nur nicht entschieden."
        >
          <SkriptFeld
            legende="Grund"
            hinweis="Mindestens acht Zeichen. Was hier steht, ist das Einzige, was die nächste Fassung anders macht."
            zeilen={3}
            wert={grund}
            onWert={setGrund}
          />
          <div className="reihe" style={{ marginTop: 'var(--ton-mass-4)' }}>
            <button
              type="button"
              className="knopf knopf-signal"
              disabled={grund.trim().length < 8 || ablehnen.laeuft}
              onClick={ablehnen.starten}
            >
              {ablehnen.laeuft ? 'Lehnt ab …' : 'Ablehnung senden'}
            </button>
            <button type="button" className="knopf" onClick={() => setGrundOffen(false)}>
              Doch nicht
            </button>
          </div>
        </Platte>
      ) : null}

      <div className="reihe">
        <a className="knopf" href={href('pruefung')}>
          Zurück zur Warteschlange
        </a>
        <a className="knopf" href={href('szene', data.slug)}>
          Szene öffnen
        </a>
        {entschieden ? (
          <button type="button" className="knopf" onClick={() => navigate(href('pruefung'))}>
            Nächste Szene
          </button>
        ) : null}
      </div>
    </Spielbereich>
  );
}

/**
 * Why this scene cannot be signed, or `null`.
 *
 * The engine refuses all four, and it is right to. Saying them here as well is not a second gate:
 * it is the difference between a disabled button with a reason and a 409 after eight toggles.
 */
function warum(
  data: SceneDetail,
  render: RenderRow | null,
  variante: string | null,
): string | null {
  if (data.stage === 'human_approved' || data.stage === 'exported') {
    return `Diese Revision ist bereits ${STUFE_LABEL[data.stage] ?? data.stage}. Eine zweite Freigabe derselben Bytes gibt es nicht.`;
  }
  if (data.stage !== STUFE_WARTET) {
    return `Diese Szene steht auf „${STUFE_LABEL[data.stage] ?? data.stage}“. Eine Freigabe folgt auf die automatische Prüfung — rendern und prüfen Sie sie in der Szene.`;
  }
  if (data.qa?.passed !== true) {
    return 'Die automatische Prüfung ist durchgefallen. Freigeben ist hier nicht möglich; ablehnen schon, und der Grund geht an die nächste Fassung.';
  }
  if (variante === null || render?.has_master !== true) {
    return 'Zu diesen Bytes gibt es keinen Master. Ohne die Datei, die gehört wird, kann keine Freigabe an sie gebunden werden.';
  }
  if (!render.master_sha256) {
    return 'Der Renderbericht nennt keinen Master-Hash. Eine Freigabe ohne ihn würde für unbestimmte Bytes gelten.';
  }
  return null;
}

/** The chain: three words, one lit. Not a selector — the order is the discipline, not a choice. */
function Kette({ stand }: { stand: FreigabeStand }): React.JSX.Element {
  const jetzt = standIndex(stand);
  return (
    <ol className="kette" aria-label="Ablauf der Freigabe">
      {STAND_KETTE.map((eintrag, index) => (
        <li
          key={eintrag}
          className="kette-glied"
          data-lage={index < jetzt ? 'vorbei' : index === jetzt ? 'jetzt' : 'kommt'}
          aria-current={index === jetzt ? 'step' : undefined}
        >
          {STAND_NAME[eintrag]}
        </li>
      ))}
    </ol>
  );
}

function Abhoere({
  slug,
  variante,
  render,
  stand,
  weiter,
}: {
  slug: string;
  variante: string | null;
  render: RenderRow | null;
  stand: FreigabeStand;
  weiter(): void;
}): React.JSX.Element {
  return (
    <Platte
      titel="Master"
      zaehler={render?.rendered ? dauer(render.duration_ms) : undefined}
      erklaerung="Genau die Bytes, an die eine Freigabe gebunden wird. Leertaste spielt und hält an."
    >
      {variante && render?.has_master ? (
        <div className="abhoere">
          <Spieler
            gross
            pfad={`/api/scenes/${encodeURIComponent(slug)}/renders/${encodeURIComponent(variante)}/master`}
            name={`Master ${variante}`}
          />
          {stand === 'hoeren' ? (
            // A plain button: brass is the verdict's, and leaving the listen stage is a step, not
            // a decision. It is also deliberately quieter than the transport beside it — the
            // primary action here is to press play.
            <button type="button" className="knopf" onClick={weiter}>
              Gehört — weiter zum Bericht
            </button>
          ) : null}
        </div>
      ) : (
        <Zustand art="leer" text="Kein Master dieser Bytes." />
      )}
    </Platte>
  );
}

/**
 * The script, closed, with the reason on the summary rather than inside it.
 *
 * A reason a reader only sees after opening is a reason that arrives after the damage: the whole
 * point is to be read while deciding whether to open.
 */
function SkriptSchleier({ scene }: { scene: Scene }): React.JSX.Element {
  return (
    <details className="platte schleier">
      <summary className="platte-kopf schleier-griff">
        <span className="tafel">Skript anzeigen (nach dem Hören)</span>
        <span className="entfernt schleier-grund">
          Beim Mitlesen hört man Wörter, die nicht gesprochen wurden — und genau das soll
          „intelligibility“ finden.
        </span>
      </summary>
      <div className="platte-leib-eng">
        {scene.script.map((utterance) => (
          <div key={utterance.id} className="zeile">
            <span className="zeile-rolle">{utterance.role}</span>
            <span className="skript">{utterance.display_text}</span>
            <span className="zeile-takt">{utterance.id}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

/** The machine's report, in full and in measurement cyan. Nothing here is a verdict about people. */
function Bericht({ qa, variante }: { qa: QaReport | null; variante: string | null }): React.JSX.Element {
  const zeilen = qa?.transcripts?.lines ?? [];
  return (
    <Platte
      titel="Prüfbericht"
      zaehler={
        qa?.passed === undefined ? undefined : (
          <Marke ton={qa.passed ? 'messung' : 'alarm'}>
            {qa.passed ? 'bestanden' : 'durchgefallen'}
          </Marke>
        )
      }
      erklaerung="Was die Maschine gemessen hat, vollständig. Markiert wird der rohe Wortvergleich, gemessen wird die WER nach der Normalisierung der Engine — ein markiertes Wort bei 0 % ist eine Zahl oder eine Schreibweise, die die Prüfung als gleich behandelt. Eine bestandene Prüfung ist keine Freigabe."
      randlos
    >
      {qa === null ? (
        <Zustand art="leer" text="Für diese Revision liegt kein Prüfbericht vor." />
      ) : (
        <>
          <div className="platte-leib reihe">
            <Marke ton="messung">Variante {variante ?? '–'}</Marke>
            <Marke ton={(qa.transcripts?.full_wer ?? 0) > 0.08 ? 'alarm' : 'messung'}>
              Gesamt-WER {prozent(qa.transcripts?.full_wer)}
            </Marke>
            <Sprecher speaker={qa.speaker_qa} />
            <Klangbild qa={qa} />
          </div>

          {zeilen.length === 0 ? (
            <Zustand art="leer" text="Kein Transkript für diese Revision." />
          ) : (
            <div className="tabelle-rahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Äußerung</th>
                    <th scope="col">Erwartet gegen erkannt</th>
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
                      <td>
                        <Gegenueber erwartet={line.expected} erkannt={line.transcript} />
                        {(line.missing_protected ?? []).length > 0 ? (
                          <div className="zeile-neben">
                            Geschützte Wörter fehlen: {(line.missing_protected ?? []).join(', ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="zahl-rechts zahl">{prozent(line.wer)}</td>
                      <td>
                        {line.passed ? (
                          <Marke ton="messung">ok</Marke>
                        ) : (
                          <Marke ton="alarm">Abweichung</Marke>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(qa.transcripts?.failures ?? []).length > 0 ? (
            <ul className="platte-leib stapel-eng">
              {(qa.transcripts?.failures ?? []).map((failure) => (
                <li key={failure} className="hinweis hinweis-alarm">
                  {failure}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Platte>
  );
}

/**
 * The two transcripts, aligned, with what differs marked.
 *
 * A WER says a turn is wrong; a marked word says what to listen for again. The alignment is
 * computed here because the engine reports the strings and the percentage and not the mapping.
 */
function Gegenueber({ erwartet, erkannt }: { erwartet: string; erkannt: string }): React.JSX.Element {
  const diff = useMemo(() => wortDiff(erwartet, erkannt), [erwartet, erkannt]);
  if (erwartet === erkannt) {
    return (
      <span className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
        {erwartet}
      </span>
    );
  }
  return (
    <div className="gegenueber">
      <p className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
        <span className="tafel gegenueber-marke">Skript</span>
        {diff.erwartet.map((wort, index) => (
          <span key={`${wort.wort}-${index}`} data-diff={wort.art}>
            {wort.wort}{' '}
          </span>
        ))}
      </p>
      <p className="skript entfernt" style={{ fontSize: 'var(--ton-grad-13)' }}>
        <span className="tafel gegenueber-marke">Gehört</span>
        {diff.erkannt.map((wort, index) => (
          <span key={`${wort.wort}-${index}`} data-diff={wort.art}>
            {wort.wort}{' '}
          </span>
        ))}
      </p>
    </div>
  );
}

function Sprecher({ speaker }: { speaker: SpeakerQa | undefined }): React.JSX.Element {
  if (speaker === undefined) return <Marke>Stimmkonsistenz nicht Teil des Berichts</Marke>;
  if (typeof speaker === 'string') {
    // A check that could not run must never look like a check that passed.
    return <Marke titel="Die Prüfung konnte nicht laufen.">Stimme nicht gemessen: {speaker}</Marke>;
  }
  const werte = (speaker.characters ?? [])
    .map((character) => character.minimum_similarity)
    .filter((wert): wert is number => typeof wert === 'number');
  const fremd = (speaker.different_characters ?? []).map((paar) => paar.similarity);
  return (
    <>
      <Marke ton="messung" titel="Kleinste gemessene Ähnlichkeit einer Figur mit sich selbst.">
        Stimme min {werte.length ? Math.min(...werte).toFixed(3) : '–'}
      </Marke>
      <Marke ton="messung" titel="Größte gemessene Ähnlichkeit zwischen zwei verschiedenen Figuren.">
        Figuren max {fremd.length ? Math.max(...fremd).toFixed(3) : '–'}
      </Marke>
    </>
  );
}

function Klangbild({ qa }: { qa: QaReport }): React.JSX.Element | null {
  const klang = qa.soundscape;
  if (!klang) return null;
  return (
    <>
      <Marke ton="messung" titel="Betten und Ereignisse im fertigen Mix.">
        Umgebung {zahl(klang.bed_count)} / {zahl(klang.event_count)}
      </Marke>
      <Marke
        ton="messung"
        titel="Gemessener Effektivpegel des Hintergrunds — die Zahl hinter „überdeckt keine Silbe“."
      >
        Grundpegel{' '}
        {klang.measured_ambience_rms_dbfs === null || klang.measured_ambience_rms_dbfs === undefined
          ? '–'
          : `${klang.measured_ambience_rms_dbfs.toFixed(1)} dBFS`}
      </Marke>
    </>
  );
}

function Checkliste({
  scene,
  noetig,
  angekreuzt,
  setAngekreuzt,
  pruefer,
  setPruefer,
  fehlt,
  gesperrt,
}: {
  scene: Scene;
  noetig: Set<string>;
  angekreuzt: ReadonlySet<string>;
  setAngekreuzt(next: ReadonlySet<string>): void;
  pruefer: string;
  setPruefer(next: string): void;
  fehlt: string[];
  gesperrt: boolean;
}): React.JSX.Element {
  const level = scene.brief?.level ?? null;
  const punkte = PRUEFPUNKTE.filter((punkt) => noetig.has(punkt.key));
  const weggelassen = PRUEFPUNKTE.filter((punkt) => !noetig.has(punkt.key));

  return (
    <Platte
      titel="Mit der Freigabe bestätigen Sie"
      zaehler={`${zahl(angekreuzt.size)} von ${zahl(punkte.length)}`}
      erklaerung="Jeder Punkt einzeln, und keiner vorangekreuzt. Was hier bestätigt wird, steht wörtlich im veröffentlichten Provenienz-Manifest."
      randlos
    >
      <ul className="punkte">
        {punkte.map((punkt) => {
          const an = angekreuzt.has(punkt.key);
          return (
            <li key={punkt.key} className="punkt">
              <button
                type="button"
                className="punkt-schalter"
                role="switch"
                aria-checked={an}
                disabled={gesperrt}
                onClick={() => {
                  const naechste = new Set(angekreuzt);
                  if (an) naechste.delete(punkt.key);
                  else naechste.add(punkt.key);
                  setAngekreuzt(naechste);
                }}
              >
                <span className="punkt-lampe" aria-hidden="true" />
                <span className="punkt-text">
                  <span className="zahl punkt-key">{punkt.key}</span>
                  <span>{satzFuer(punkt, level)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {weggelassen.length > 0 ? (
        <p className="platte-leib entfernt" style={{ fontSize: 'var(--ton-grad-12)' }}>
          Nicht gefragt, weil diese Szene nichts hat, worauf es sich bezieht:{' '}
          <span className="zahl">{weggelassen.map((punkt) => punkt.key).join(', ')}</span>. Eine
          Bestätigung über etwas, das es nicht gibt, ist eine Unterschrift über nichts.
        </p>
      ) : null}

      <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
        <div style={{ maxWidth: '26rem' }}>
          <Feld
            legende="Name der freigebenden Person"
            hinweis="Wird lokal gemerkt und für die nächste Szene vorausgefüllt. Ohne Namen keine Freigabe — der Name ist der Provenienzeintrag."
            wert={pruefer}
            onWert={setPruefer}
            disabled={gesperrt}
          />
        </div>
        {fehlt.length > 0 && !gesperrt ? (
          <p className="hinweis" role="status" style={{ marginTop: 'var(--ton-mass-4)' }}>
            Noch nicht bestätigt: <span className="zahl">{fehlt.join(', ')}</span>
          </p>
        ) : null}
      </div>
    </Platte>
  );
}

/** The 409 the sha binding exists to produce, said as the instruction it is. */
function Konflikt({ fehler, neuLaden }: { fehler: Error; neuLaden(): void }): React.JSX.Element {
  const text = fehlerText(fehler);
  const bytes = text.includes('re-listen') || text.includes('master of');
  return (
    <div className="hinweis hinweis-alarm" role="alert">
      <p>
        {bytes
          ? 'Der Master hat sich geändert, seit diese Seite geladen wurde. Die Freigabe wurde nicht gespeichert — sie hätte für Bytes gegolten, die hier niemand gehört hat.'
          : 'Nicht freigegeben.'}
      </p>
      <p className="entfernt" style={{ marginTop: 'var(--ton-mass-2)' }}>
        {text}
      </p>
      {bytes ? (
        <button type="button" className="knopf" style={{ marginTop: 'var(--ton-mass-3)' }} onClick={neuLaden}>
          Neu laden und noch einmal hören
        </button>
      ) : null}
    </div>
  );
}

/**
 * What a human wrote down, in either direction.
 *
 * One shape for both, because the engine stores both in one column and distinguishes them by
 * `status`: `complete` for a signature, `declined` for a refusal. Anything that reads an approval
 * already keys on that value, so a declined revision cannot be mistaken for an approved one — and
 * a second type here would be a second place to forget that.
 */
export interface Urteilssatz {
  status?: string;
  editor?: string | null;
  reviewed_at?: string;
  checklist?: string[];
  audio_sha256?: string | null;
  scene_sha256?: string | null;
  reason?: string;
}

/** The record, in brass: a person acted, and this is what was written down. */
function Urteil({ approval, slug }: { approval: Urteilssatz | null; slug: string }): React.JSX.Element {
  const abgelehnt = approval?.status === 'declined';
  return (
    <Platte
      titel={abgelehnt ? 'Abgelehnt' : 'Freigegeben'}
      zaehler={<Marke ton="signal">{abgelehnt ? 'zurück auf Entwurf' : 'unterschrieben'}</Marke>}
      randlos
    >
      <dl className="werte platte-leib">
        <div className="wert">
          <dt>{abgelehnt ? 'Abgelehnt von' : 'Freigegeben von'}</dt>
          <dd>{approval?.editor || <span className="leer" />}</dd>
        </div>
        <div className="wert">
          <dt>Wann</dt>
          <dd className="zahl">{zeitpunkt(approval?.reviewed_at)}</dd>
        </div>
        <div className="wert">
          <dt>Szene</dt>
          <dd className="zahl">{slug}</dd>
        </div>
        <div className="wert">
          <dt>{abgelehnt ? 'Szenen-Sha' : 'Audio-Sha'}</dt>
          <dd className="zahl" title={(abgelehnt ? approval?.scene_sha256 : approval?.audio_sha256) ?? undefined}>
            {kurzSha(abgelehnt ? approval?.scene_sha256 : approval?.audio_sha256)}
          </dd>
        </div>
      </dl>
      {abgelehnt ? (
        <p className="platte-leib skript" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          {approval?.reason ?? ''}
        </p>
      ) : (approval?.checklist ?? []).length > 0 ? (
        <div className="platte-leib reihe" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          {(approval?.checklist ?? []).map((key) => (
            <Marke key={key} ton="signal">
              {key}
            </Marke>
          ))}
        </div>
      ) : null}
    </Platte>
  );
}
