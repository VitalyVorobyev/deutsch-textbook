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
 * The rows themselves are in the Bibliothek. A tick on the Pegel opens the library filtered to that
 * status, because filter state lives in the hash and "every stale row" is therefore a link.
 */
import { useMemo } from 'react';
import { Platte, Marke, Zustand } from '../components/Platte';
import { Pegel } from '../components/Pegel';
import { zahl } from '../format';
import { ANY, NO_FILTER, overCount, selectRows, statusCounts } from '../registry-filter';
import { href, navigate } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import type { DoctorCheck } from '../contracts';
import { fehlerText } from './fehler';

export function Uebersicht(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.registry(signal), [api]);
  // Archived studio scenes are out of every count here, as they are out of the library's default
  // view: the Pegel describes the work, and an archived trial is no longer part of it.
  const alle = useMemo(() => selectRows(data?.rows ?? [], NO_FILTER), [data]);

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
      {error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
      ) : null}

      <Werkzeugkette />

      {data ? (
        <>
          <Platte
            titel="Pegel"
            zaehler={`${zahl(alle.length)} Zeilen`}
            erklaerung="Der Weg von geplant bis veröffentlicht als Skala. „Überholt“ steht hinter der Lücke — das ist kein späterer Stand, sondern ein Rückschritt aus dem letzten. Ein Klick auf einen Strich öffnet diese Zeilen in der Bibliothek."
          >
            <Pegel
              segments={statusCounts(alle)}
              over={overCount(alle)}
              active={ANY}
              onSelect={(status) => navigate(href('bibliothek', undefined, { status }))}
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
                <Zustand
                  art="leer"
                  text="Jede geplante Aufnahme wird von mindestens einer Aufgabe benutzt."
                />
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
                <Zustand
                  art="leer"
                  text="Jede Hörverstehens-Aufgabe nennt eine geplante Aufnahme."
                />
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

          <p className="leise">
            Jede Zeile einzeln, mit Suche und Sammlungen:{' '}
            <a href={href('bibliothek')}>Bibliothek</a>.
          </p>
        </>
      ) : null}
    </>
  );
}

/**
 * What this machine lacks, with the command that fixes it — shown only when something does.
 *
 * The desktop app opens no terminal, so a missing ffmpeg or a speech runtime that `uv sync`
 * removed would otherwise surface as a render failing minutes later. A healthy machine gets no
 * panel: a list of green ticks is a panel to learn to skip, and then it is skipped on the day it
 * turns red. A failed read is left to the registry's own error above.
 */
function Werkzeugkette(): React.JSX.Element | null {
  const api = useApi();
  const { data } = useEngineRead((signal) => api.doctor(signal), [api]);
  const fehlend: DoctorCheck[] = data ? data.checks.filter((check) => !check.ok) : [];
  if (fehlend.length === 0) return null;
  return (
    <Platte
      titel="Werkzeugkette"
      zaehler={`${zahl(fehlend.length)} fehlt`}
      erklaerung="Was diesem Rechner zum Rendern fehlt, mit dem Befehl, der es behebt, im Wurzelverzeichnis des Repositorys auszuführen. Ohne ffmpeg rendert nichts; ein fehlendes Modell hält nur die Stufe auf, die es lädt."
      randlos
    >
      <div className="tabelle-rahmen">
        <table className="tabelle">
          <thead>
            <tr>
              <th scope="col">Prüfung</th>
              <th scope="col">Befund</th>
              <th scope="col">Befehl</th>
            </tr>
          </thead>
          <tbody>
            {fehlend.map((check) => (
              <tr key={check.name}>
                <td>
                  <Marke ton={check.required ? 'alarm' : 'ruhig'}>{check.name}</Marke>
                </td>
                <td className="leise">{check.detail}</td>
                <td>{check.fix ? <code className="pfad">{check.fix}</code> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Platte>
  );
}
