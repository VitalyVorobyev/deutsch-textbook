/**
 * Übersicht — the registry, which is the whole argument for this app.
 *
 * `GET /api/registry` joins four sources that no one of them can check: what was commissioned, what
 * is published, what the studio is working on, and what the exercises actually use. Three findings
 * only exist in that join, and all three are given their own panel here rather than being left as a
 * number in a summary:
 *
 * * **`stale`** — published audio the studio has moved past. Off the Pegel's scale, where it belongs.
 * * **Aufnahmen ohne Aufgabe** — a planned recording nothing asks a question about. Not a defect by
 *   itself (`model-input` artifacts exist to be listened to), but it is the list the next exercise
 *   wave is chosen from.
 * * **Aufgaben ohne Aufnahme** — an `audio-comprehension` item that plays browser TTS. Two ways to
 *   get there and they need different fixes, so `reason` is shown rather than folded away.
 *
 * The Pegel's legend *is* the status filter — clicking a tick scopes the table, clicking it again
 * clears it — so there is no separate status dropdown. Filter state lives in the hash, which is what
 * makes "every stale B1 row" a link rather than a set of instructions.
 */
import { useMemo } from 'react';
import { Platte, Marke, Zustand } from '../components/Platte';
import { Pegel } from '../components/Pegel';
import { Statuslampe } from '../components/Statuslampe';
import { kurzSha, zahl, zeitpunkt } from '../format';
import { ANY, levelsOf, overCount, rowContext, selectRows, statusCounts } from '../registry-filter';
import { useQueryState } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import type { RegistryRow } from '../contracts';
import { fehlerText } from './fehler';

export function Uebersicht(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.registry(signal), [api]);
  const [ebene, setEbene] = useQueryState('ebene', ANY);
  const [status, setStatus] = useQueryState('status', ANY);
  const [art, setArt] = useQueryState('art', ANY);

  const filter = useMemo(() => ({ ebene, status, art }), [ebene, status, art]);
  // Memoised rather than written inline: `data?.rows ?? []` is a fresh array on every render, which
  // would make both selections below recompute the sort over 130 rows on every keystroke.
  const alle = useMemo(() => data?.rows ?? [], [data]);
  // The Pegel describes the table beneath it, so it counts the rows the *other two* filters leave —
  // a scale that only ever showed the selected status would always read as one segment.
  const imBereich = useMemo(() => selectRows(alle, { ...filter, status: ANY }), [alle, filter]);
  const zeilen = useMemo(() => selectRows(alle, filter), [alle, filter]);

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Register</span>
        <h1>Übersicht</h1>
        <p>
          Jede geplante Aufnahme, verbunden mit dem, was veröffentlicht ist, was im Studio liegt und
          welche Aufgabe sie benutzt. Die Lücken zwischen diesen vier Quellen sind der Grund für
          diese Seite.
        </p>
      </header>

      {laedt ? <Zustand art="laedt" text="Register wird gelesen …" /> : null}
      {error ? <p className="hinweis hinweis-alarm" role="alert">{fehlerText(error)}</p> : null}

      {data ? (
        <>
          <Platte
            titel="Pegel"
            zaehler={`${zahl(imBereich.length)} Zeilen`}
            erklaerung="Der Weg von geplant bis veröffentlicht als Skala. „Überholt“ steht hinter der Lücke — das ist kein späterer Stand, sondern ein Rückschritt aus dem letzten. Ein Klick auf einen Strich filtert die Tabelle."
          >
            <Pegel
              segments={statusCounts(imBereich)}
              over={overCount(imBereich)}
              active={status}
              onSelect={setStatus}
            />
          </Platte>

          <div className="gitter-2">
            <Platte
              titel="Aufnahmen ohne Aufgabe"
              zaehler={zahl(data.recordings_without_exercises.length)}
              erklaerung="Geplantes Audio, zu dem keine Aufgabe eine Frage stellt. Kein Fehler an sich — aber die Liste, aus der die nächste Aufgabenwelle gewählt wird."
              randlos
            >
              {data.recordings_without_exercises.length === 0 ? (
                <Zustand art="leer" text="Jede geplante Aufnahme wird von mindestens einer Aufgabe benutzt." />
              ) : (
                <ul className="platte-leib stapel-eng">
                  {data.recordings_without_exercises.map((id) => (
                    <li key={id} className="zahl leise">
                      {id}
                    </li>
                  ))}
                </ul>
              )}
            </Platte>

            <Platte
              titel="Aufgaben ohne Aufnahme"
              zaehler={zahl(data.exercises_without_recordings.length)}
              erklaerung="Hörverstehens-Aufgaben, die im Kurs auf Browser-Sprachausgabe zurückfallen. Zwei Ursachen, ein Aussehen: keine Aufnahme genannt, oder eine genannt, die der Plan nicht kennt."
              randlos
            >
              {data.exercises_without_recordings.length === 0 ? (
                <Zustand art="leer" text="Jede Hörverstehens-Aufgabe nennt eine geplante Aufnahme." />
              ) : (
                <div className="tabelle-rahmen">
                  <table className="tabelle">
                    <thead>
                      <tr>
                        <th scope="col">Aufgabensatz</th>
                        <th scope="col">Item</th>
                        <th scope="col">Aufnahme</th>
                        <th scope="col">Ursache</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exercises_without_recordings.map((row) => (
                        <tr key={`${row.set}:${row.item}`}>
                          <td className="zahl">
                            {row.level.toLowerCase()}/{row.set}
                          </td>
                          <td className="zahl leise">{row.item}</td>
                          <td className="zahl">{row.recording ?? <span className="leer" />}</td>
                          <td>
                            {row.reason === 'no-recording' ? (
                              <Marke ton="ruhig">keine genannt</Marke>
                            ) : (
                              <Marke ton="alarm">unbekannt</Marke>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Platte>
          </div>

          <Platte
            titel="Register"
            zaehler={`${zahl(zeilen.length)} von ${zahl(alle.length)}`}
            randlos
          >
            <div className="platte-leib reihe" style={{ paddingBottom: 0 }}>
              <label className="tafel" style={{ display: 'inline-flex', gap: 'var(--ton-mass-2)', alignItems: 'center' }}>
                Ebene
                <select className="wahl" value={ebene} onChange={(event) => setEbene(event.target.value)}>
                  <option value={ANY}>alle</option>
                  {levelsOf(alle).map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tafel" style={{ display: 'inline-flex', gap: 'var(--ton-mass-2)', alignItems: 'center' }}>
                Art
                <select className="wahl" value={art} onChange={(event) => setArt(event.target.value)}>
                  <option value={ANY}>alle</option>
                  <option value="listening">Hörszene</option>
                  <option value="reading">Lesetext</option>
                </select>
              </label>
              {status === ANY ? null : (
                <button type="button" className="knopf" onClick={() => setStatus(ANY)}>
                  Statusfilter lösen
                </button>
              )}
            </div>

            <div className="tabelle-rahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Ebene</th>
                    <th scope="col">Einheit</th>
                    <th scope="col">Kennung</th>
                    <th scope="col">Status</th>
                    <th scope="col">Projekt</th>
                    <th scope="col" className="zahl-rechts">Aufgaben</th>
                    <th scope="col" className="zahl-rechts">Umfang</th>
                    <th scope="col">Stand</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((row) => (
                    <Zeile key={`${row.kind}:${row.id}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            {zeilen.length === 0 ? (
              <Zustand art="leer" text="Keine Zeile passt zu diesem Filter." />
            ) : null}
          </Platte>
        </>
      ) : null}
    </>
  );
}

function Zeile({ row }: { row: RegistryRow }): React.JSX.Element {
  const kontext = rowContext(row);
  return (
    <tr>
      <td className="zahl">{row.level.toUpperCase()}</td>
      <td className="leise">{kontext || <span className="leer" />}</td>
      <td>
        <div className="zahl">{row.id}</div>
        {row.title ? <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>{row.title}</div> : null}
        <div className="reihe" style={{ gap: 'var(--ton-mass-1)', marginTop: 'var(--ton-mass-1)' }}>
          <Marke ton={row.kind === 'listening' ? 'messung' : 'ruhig'}>
            {row.kind === 'listening' ? 'Hörszene' : 'Lesetext'}
          </Marke>
          {row.superseded_by_scene ? (
            <Marke ton="messung" titel="Es gibt sowohl ein altes Dialogprojekt als auch eine Szene mit dieser Kennung; bearbeitet wird die Szene.">
              Szene löst Dialog ab
            </Marke>
          ) : null}
          {row.source_drift ? (
            <Marke ton="alarm" titel="Das Projekt vertont eine ältere Fassung des Lesetexts, als das Repository jetzt hält.">
              Quelle abgewichen
            </Marke>
          ) : null}
          {row.audio && !row.artifact ? (
            <Marke ton="alarm" titel="Es gibt eine MP3, aber keine YAML-Beschreibung daneben.">
              Audio ohne Datensatz
            </Marke>
          ) : null}
        </div>
      </td>
      <td>
        <Statuslampe status={row.status} />
      </td>
      <td className="zahl leise">
        {row.project ? (
          <span title={`${row.project.kind} · Stufe ${row.project.stage}`}>
            R{row.project.revision ?? '?'} · {kurzSha(row.project.revision_sha256)}
          </span>
        ) : (
          <span className="leer" />
        )}
      </td>
      <td className="zahl-rechts zahl">
        {row.kind === 'listening' ? zahl(row.exercise_items ?? 0) : <span className="leer" />}
      </td>
      <td className="zahl-rechts zahl leise">
        {row.word_count ? `${zahl(row.word_count)} W` : <span className="leer" />}
      </td>
      <td className="zahl entfernt">{row.project?.updated ? zeitpunkt(row.project.updated) : <span className="leer" />}</td>
    </tr>
  );
}
