/**
 * Szenen — every scene project in the studio database, newest edit first.
 *
 * A *scene* is the artifact model everything is converging on: dialogue and narration are two kinds
 * of one document, so they are one list here rather than the two tabs the old dashboard had.
 *
 * The list deliberately does **not** show render availability. That answer lives on the scene's own
 * bytes — `renders` on the detail endpoint is keyed by `scene.sha256()`, so it is only true of one
 * revision — and the list endpoint does not carry it. Showing it would mean one request per row and
 * a number that is right until the scene is revised. It is on the detail view instead, beside the
 * sha it belongs to.
 */
import { useMemo } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { kurzSha, zahl, zeitpunkt } from '../format';
import { href } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import { fehlerText } from './fehler';

/** The engine's stage vocabulary, in German. Same five words the workflow endpoints move between. */
const STUFE: Record<string, string> = {
  draft: 'Entwurf',
  automatically_checked: 'automatisch geprüft',
  human_approved: 'freigegeben',
  exported: 'veröffentlicht',
  declined: 'abgelehnt',
};

export function Szenen(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.scenes(signal), [api]);

  const zeilen = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) => String(b.updated ?? '').localeCompare(String(a.updated ?? ''))),
    [data],
  );

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Studio</span>
        <h1>Szenen</h1>
        <p>
          Dialoge und Narrationen sind zwei Arten desselben Dokuments. Jede Zeile ist ein Projekt in
          der Studio-Datenbank, mit der Revision, aus der gerade gerendert würde.
        </p>
      </header>

      {laedt ? <Zustand art="laedt" text="Szenen werden gelesen …" /> : null}
      {error ? <p className="hinweis hinweis-alarm" role="alert">{fehlerText(error)}</p> : null}

      {data ? (
        <Platte titel="Szenenprojekte" zaehler={`${zahl(zeilen.length)}`} randlos>
          {zeilen.length === 0 ? (
            <Zustand art="leer" text="Die Studio-Datenbank hält noch kein Szenenprojekt." />
          ) : (
            <div className="tabelle-rahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Kennung</th>
                    <th scope="col">Art</th>
                    <th scope="col">Ebene</th>
                    <th scope="col">Stufe</th>
                    <th scope="col" className="zahl-rechts">Revision</th>
                    <th scope="col">Szenen-Sha</th>
                    <th scope="col">Aufgabe</th>
                    <th scope="col">Zuletzt bearbeitet</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((row) => (
                    <tr key={row.project_id}>
                      <td>
                        <a className="zahl" href={href('szene', row.slug)} style={{ color: 'var(--ton-messung)' }}>
                          {row.slug}
                        </a>
                        <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                          {row.title.en}
                        </div>
                      </td>
                      <td>
                        <Marke ton={row.kind === 'narration' ? 'ruhig' : 'messung'}>
                          {row.kind === 'narration' ? 'Narration' : row.kind === 'dialogue' ? 'Dialog' : row.kind}
                        </Marke>
                      </td>
                      <td className="zahl">{row.level ?? <span className="leer" />}</td>
                      <td className="leise">{STUFE[row.stage] ?? row.stage}</td>
                      <td className="zahl-rechts zahl">{row.revision}</td>
                      <td className="zahl entfernt" title={row.scene_sha256}>
                        {kurzSha(row.scene_sha256)}
                      </td>
                      <td>
                        {row.has_exercise ? (
                          <Marke ton="signal" titel="An dieser Szene hängt eine Hörverstehens-Aufgabe.">
                            vorhanden
                          </Marke>
                        ) : (
                          <span className="leer" />
                        )}
                      </td>
                      <td className="zahl entfernt">{zeitpunkt(row.updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Platte>
      ) : null}
    </>
  );
}
