/**
 * Prüfung — everything the machine has measured and nobody has judged, oldest first.
 *
 * This is the app's own thesis as a screen. QA is automatic and approval is not, so there is
 * exactly one stage where the studio stops and waits for a person: `automatically_checked`. Every
 * scene at it is here, and nothing else is.
 *
 * **Oldest first, and the waiting is a column.** A queue sorted by name asks the reviewer to do
 * the choosing; a queue sorted by how long something has waited has already made the only decision
 * there is. The timestamp is the head revision's — the closest thing the engine records to "when
 * the machine finished", since a scene project carries no updated-at of its own — and the column
 * says so rather than implying a measurement nobody took.
 *
 * **A failed check is still a person's move, and it is drawn as itself.** `automatically_checked`
 * splits: passed means a signature is what is missing, failed means a rewrite is. Both wait for a
 * human and both belong here, but conflating them would have the reviewer open twenty pages to
 * find out which twenty minutes of listening are pointless.
 */
import { useMemo } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Statuslampe } from '../components/Statuslampe';
import { Warteschlange, Zeile } from '../components/Warteschlange';
import { STUFE_WARTET, stufeStatus } from '../contracts';
import { kurzSha, zahl, zeitpunkt } from '../format';
import { href, navigate, useQueryState } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import { gewaehlt as auswahlAus } from '../warteschlange';
import { fehlerText } from './fehler';

export function Pruefung(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.scenes(signal), [api]);
  const [zeile, setZeile] = useQueryState('zeile', '');

  const zeilen = useMemo(
    () =>
      (data ?? [])
        .filter((row) => row.stage === STUFE_WARTET)
        // Ascending: the head of the queue is what has waited longest. `localeCompare` on ISO
        // strings is a byte comparison and correct — the engine writes them all in UTC.
        .sort((a, b) => String(a.updated ?? '').localeCompare(String(b.updated ?? ''))),
    [data],
  );
  const ids = useMemo(() => zeilen.map((row) => row.slug), [zeilen]);
  const auswahl = auswahlAus(ids, zeile);

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Freigabe</span>
        <h1>Prüfung</h1>
        <p>
          Die Maschine hat diese Aufnahmen gemessen. Ein Urteil darüber kann sie nicht fällen — das
          ist der einzige Schritt im ganzen Studio, den ein Mensch tun muss.
        </p>
      </header>

      {laedt ? <Zustand art="laedt" text="Warteschlange wird gelesen …" /> : null}
      {error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
      ) : null}

      {data ? (
        <Platte
          titel="Wartet auf einen Menschen"
          zaehler={`${zahl(zeilen.length)}`}
          erklaerung="Älteste zuerst. „Seit“ ist der Zeitstempel der Revision — näher kommt die Engine dem Zeitpunkt nicht, an dem die Maschine fertig wurde. J/K wählt, Enter öffnet."
          randlos
        >
          {zeilen.length === 0 ? (
            <Zustand
              art="leer"
              text="Nichts wartet auf einen Menschen. Jede automatisch geprüfte Szene hat ein Urteil."
            />
          ) : (
            <Warteschlange
              ids={ids}
              gewaehlt={auswahl}
              onWahl={setZeile}
              onOeffnen={(slug) => navigate(href('pruefung', slug))}
              beschriftung="Szenen, die auf eine Freigabe warten"
            >
              <thead>
                <tr>
                  <th scope="col">Seit</th>
                  <th scope="col">Kennung</th>
                  <th scope="col">Art</th>
                  <th scope="col">Ebene</th>
                  <th scope="col">Maschine</th>
                  <th scope="col">Aufgabe</th>
                  <th scope="col">Revision</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((row) => (
                  <Zeile
                    key={row.slug}
                    id={row.slug}
                    gewaehlt={row.slug === auswahl}
                    onWahl={() => setZeile(row.slug)}
                  >
                    <td className="zahl entfernt">{zeitpunkt(row.updated)}</td>
                    <td>
                      <a
                        className="zahl"
                        href={href('pruefung', row.slug)}
                        style={{ color: 'var(--ton-messung)' }}
                      >
                        {row.slug}
                      </a>
                      <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                        {row.title.en}
                      </div>
                    </td>
                    <td>
                      <Marke ton={row.kind === 'narration' ? 'ruhig' : 'messung'}>
                        {row.kind === 'narration' ? 'Narration' : 'Dialog'}
                      </Marke>
                    </td>
                    <td className="zahl">{row.level ?? <span className="leer" />}</td>
                    <td>
                      <Statuslampe status={stufeStatus(row.stage, row.qa_passed)} />
                    </td>
                    <td>
                      {row.has_exercise ? (
                        <Marke ton="signal" titel="An dieser Szene hängt eine Hörverstehens-Aufgabe; dann ist auch der Punkt „questions“ zu bestätigen.">
                          vorhanden
                        </Marke>
                      ) : (
                        <span className="leer" />
                      )}
                    </td>
                    <td className="zahl entfernt" title={row.scene_sha256}>
                      R{zahl(row.revision)} · {kurzSha(row.scene_sha256)}
                    </td>
                  </Zeile>
                ))}
              </tbody>
            </Warteschlange>
          )}
        </Platte>
      ) : null}
    </>
  );
}
