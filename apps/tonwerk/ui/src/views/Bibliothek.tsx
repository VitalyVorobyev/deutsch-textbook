/**
 * Bibliothek — everything the studio has made or was asked to make, in one table.
 *
 * The rows are the registry's: every planned recording (owned by a unit, or by an exam practice
 * set), every Lesetext's narration, and every studio scene nothing plans — a fork, a variant, a
 * trial. One table rather than one per kind, because the questions asked of it cut across kinds:
 * *what is in Übungssatz 2*, *which takes say „Gleis drei“*, *what is waiting on me at A2*.
 *
 * Every filter is in the address, including the search, so a slice of the library is a link. The
 * search reads what a row *says* — the published transcript, else the studio's script, else the
 * script the exercise items were written with — so a recording can be found by a line from it.
 *
 * Two operations live here because they are about the library rather than one scene: **forking**
 * (a new draft from a take's head revision) and **archiving** a studio scene out of sight. Neither
 * deletes anything. The disk panel is the third: it shows what the studio holds and offers to
 * remove the renders it can make again.
 */
import { FELD, WAHL } from '../components/steuerung';
import { Button } from '@vitavision/ui';
import { useEffect, useMemo, useState } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Pegel } from '../components/Pegel';
import { Statuslampe } from '../components/Statuslampe';
import { kurzSha, zahl, zeitpunkt } from '../format';
import { lesetextSlug } from '../lesetexte';
import {
  ANY,
  STUDIO,
  laengeImFenster,
  levelsOf,
  overCount,
  rowContext,
  sammlungen,
  selectRows,
  snippet,
  statusCounts,
} from '../registry-filter';
import { href, navigate, useQueryState } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import type { RegistryRow } from '../contracts';
import { fehlerText } from './fehler';

const ART_LABEL: Record<string, string> = {
  listening: 'Hörszene',
  reading: 'Lesetext',
  scene: 'Studio',
};

export function Bibliothek(): React.JSX.Element {
  const api = useApi();
  const [stand, setStand] = useState(0);
  const { data, error, laedt } = useEngineRead((signal) => api.registry(signal), [api, stand]);
  const [ebene, setEbene] = useQueryState('ebene', ANY);
  const [status, setStatus] = useQueryState('status', ANY);
  const [art, setArt] = useQueryState('art', ANY);
  const [sammlung, setSammlung] = useQueryState('sammlung', ANY);
  const [suche, setSuche] = useQueryState('suche', '');
  const [archiv, setArchiv] = useQueryState('archiv', '');
  const [problem, setProblem] = useState<Error | null>(null);

  const filter = useMemo(
    () => ({ ebene, status, art, sammlung, suche, archiv: archiv === 'ja' }),
    [ebene, status, art, sammlung, suche, archiv],
  );
  const alle = useMemo(() => data?.rows ?? [], [data]);
  const imBereich = useMemo(() => selectRows(alle, { ...filter, status: ANY }), [alle, filter]);
  const zeilen = useMemo(() => selectRows(alle, filter), [alle, filter]);

  async function abzweigen(slug: string): Promise<void> {
    const neu = window.prompt(`Neue Kennung für die Abzweigung von ${slug}:`, `${slug}-v2`);
    if (!neu) return;
    setProblem(null);
    try {
      const fork = await api.forkScene(slug, neu.trim());
      navigate(href('szene', fork.slug));
    } catch (failure) {
      setProblem(failure as Error);
    }
  }

  async function archivieren(slug: string, archived: boolean): Promise<void> {
    setProblem(null);
    try {
      await api.archiveScene(slug, archived);
      setStand((value) => value + 1);
    } catch (failure) {
      setProblem(failure as Error);
    }
  }

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Studio</span>
        <h1>Bibliothek</h1>
        <p>
          Jede geplante Aufnahme, jede Narration und jede Szene im Studio, mit dem, was sie benutzt.
          Die Suche liest mit, was eine Zeile sagt: das veröffentlichte Transkript, sonst das Skript
          der Szene, sonst den Text der Aufgabe.
        </p>
      </header>

      {laedt ? <Zustand art="laedt" text="Bibliothek wird gelesen …" /> : null}
      {error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
      ) : null}
      {problem ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(problem)}
        </p>
      ) : null}

      {data ? (
        <>
          <Platte
            titel="Pegel"
            zaehler={`${zahl(imBereich.length)} Zeilen`}
            erklaerung="Der Stand der Zeilen, die die übrigen Filter übrig lassen. Ein Klick auf einen Strich filtert die Tabelle."
          >
            <Pegel
              segments={statusCounts(imBereich)}
              over={overCount(imBereich)}
              active={status}
              onSelect={setStatus}
            />
          </Platte>

          <Platte
            titel="Bestand"
            zaehler={`${zahl(zeilen.length)} von ${zahl(alle.length)}`}
            randlos
          >
            <div className="platte-leib reihe" style={{ paddingBottom: 0 }}>
              <Suche wert={suche} onChange={setSuche} />
              <Wahl titel="Ebene" wert={ebene} onChange={setEbene}>
                <option value={ANY}>alle</option>
                {levelsOf(alle).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Wahl>
              <Wahl titel="Art" wert={art} onChange={setArt}>
                <option value={ANY}>alle</option>
                <option value="listening">Hörszene</option>
                <option value="reading">Lesetext</option>
                <option value="scene">Studio</option>
              </Wahl>
              <Wahl titel="Sammlung" wert={sammlung} onChange={setSammlung}>
                <option value={ANY}>alle</option>
                {sammlungen(alle).map((name) => (
                  <option key={name} value={name}>
                    {name === STUDIO ? 'Studio (ungeplant)' : name}
                  </option>
                ))}
              </Wahl>
              <label className="tafel" style={{ display: 'inline-flex', gap: 'var(--ton-mass-2)' }}>
                <input
                  type="checkbox"
                  checked={archiv === 'ja'}
                  onChange={(event) => setArchiv(event.target.checked ? 'ja' : '')}
                />
                Archiv zeigen
              </label>
              {status === ANY ? null : (
                <Button size="sm" onClick={() => setStatus(ANY)}>
                  Statusfilter lösen
                </Button>
              )}
            </div>

            <div className="tabelle-rahmen">
              <table className="tabelle">
                <thead>
                  <tr>
                    <th scope="col">Ebene</th>
                    <th scope="col">Sammlung</th>
                    <th scope="col">Kennung</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="zahl-rechts">
                      Länge
                    </th>
                    <th scope="col" className="zahl-rechts">
                      Aufgaben
                    </th>
                    <th scope="col">Projekt</th>
                    <th scope="col">Stand</th>
                    <th scope="col" aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((row) => (
                    <Zeile
                      key={`${row.kind}:${row.id}`}
                      row={row}
                      suche={suche}
                      onFork={abzweigen}
                      onArchive={archivieren}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {zeilen.length === 0 ? (
              <Zustand art="leer" text="Keine Zeile passt zu diesem Filter." />
            ) : null}
          </Platte>

          <Speicher />
        </>
      ) : null}
    </>
  );
}

/** The search box, written to the address once typing pauses rather than on every key. */
function Suche({
  wert,
  onChange,
}: {
  wert: string;
  onChange: (next: string) => void;
}): React.JSX.Element {
  const [entwurf, setEntwurf] = useState(wert);
  // The address changed under the box (back button, a link): adopt it, during render rather than
  // in an effect, so the box never paints one frame of the old text.
  const [gesehen, setGesehen] = useState(wert);
  if (wert !== gesehen) {
    setGesehen(wert);
    setEntwurf(wert);
  }
  useEffect(() => {
    if (entwurf === wert) return;
    const timer = window.setTimeout(() => onChange(entwurf.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [entwurf, wert, onChange]);
  return (
    <label className="tafel" style={{ display: 'inline-flex', gap: 'var(--ton-mass-2)' }}>
      Suche
      <input
        className={FELD}
        type="search"
        value={entwurf}
        placeholder="Kennung, Szenario oder ein Satz"
        onChange={(event) => setEntwurf(event.target.value)}
      />
    </label>
  );
}

function Wahl({
  titel,
  wert,
  onChange,
  children,
}: {
  titel: string;
  wert: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label
      className="tafel"
      style={{ display: 'inline-flex', gap: 'var(--ton-mass-2)', alignItems: 'center' }}
    >
      {titel}
      <select className={WAHL} value={wert} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

/** The scene project a row is edited in: its own id, or the Lesetext's flattened slug. */
function szeneVon(row: RegistryRow): string | null {
  if (!row.project) return null;
  return row.kind === 'reading' ? lesetextSlug(row.id) : row.id;
}

function Zeile({
  row,
  suche,
  onFork,
  onArchive,
}: {
  row: RegistryRow;
  suche: string;
  onFork: (slug: string) => void;
  onArchive: (slug: string, archived: boolean) => void;
}): React.JSX.Element {
  const szene = szeneVon(row);
  const treffer = suche ? snippet(row, suche) : null;
  const laenge = laengeImFenster(row);
  const archiviert = row.project?.archived === true;
  return (
    <tr>
      <td className="zahl">{row.level ? row.level.toUpperCase() : <span className="leer" />}</td>
      <td className="leise">{rowContext(row) || <span className="leer" />}</td>
      <td>
        {szene ? (
          <a className="zahl" href={href('szene', szene)} style={{ color: 'var(--ton-messung)' }}>
            {row.id}
          </a>
        ) : (
          <div className="zahl">{row.id}</div>
        )}
        {row.title || row.scenario ? (
          <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
            {row.title ?? row.scenario}
          </div>
        ) : null}
        {treffer ? (
          <div className="leise" style={{ fontSize: 'var(--ton-grad-13)' }}>
            {treffer}
          </div>
        ) : null}
        <div className="reihe" style={{ gap: 'var(--ton-mass-1)', marginTop: 'var(--ton-mass-1)' }}>
          <Marke ton={row.kind === 'reading' ? 'ruhig' : 'messung'}>
            {ART_LABEL[row.kind] ?? row.kind}
          </Marke>
          {row.project?.forked_from ? (
            <Marke ton="ruhig" titel="Die Revision, aus der diese Szene abgezweigt wurde.">
              aus {row.project.forked_from}
            </Marke>
          ) : null}
          {archiviert ? <Marke ton="ruhig">archiviert</Marke> : null}
          {row.source_drift ? (
            <Marke
              ton="alarm"
              titel="Das Projekt vertont eine ältere Fassung des Lesetexts, als das Repository jetzt hält."
            >
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
      <td className="zahl-rechts zahl">
        <Laenge row={row} urteil={laenge} />
      </td>
      <td className="zahl-rechts zahl">
        <Aufgaben row={row} />
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
      <td className="zahl entfernt">
        {row.project?.updated ? zeitpunkt(row.project.updated) : <span className="leer" />}
      </td>
      <td>
        {szene ? (
          <div className="stapel-eng">
            <Button size="sm" onClick={() => onFork(szene)}>
              Abzweigen
            </Button>
            {row.kind === 'scene' ? (
              <Button size="sm" onClick={() => onArchive(szene, !archiviert)}>
                {archiviert ? 'Zurückholen' : 'Archivieren'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/** Published length against the plan's window; the window alone while nothing is published. */
function Laenge({
  row,
  urteil,
}: {
  row: RegistryRow;
  urteil: ReturnType<typeof laengeImFenster>;
}): React.JSX.Element {
  if (row.word_count) return <span className="leise">{zahl(row.word_count)} W</span>;
  const fenster = row.window ? `${row.window[0]}–${row.window[1]} s` : null;
  if (row.duration_seconds == null)
    return fenster ? <span className="entfernt">{fenster}</span> : <span className="leer" />;
  return (
    <span title={fenster ? `Plan: ${fenster}` : undefined}>
      {row.duration_seconds} s {urteil === 'kurz' ? <Marke ton="alarm">zu kurz</Marke> : null}
      {urteil === 'lang' ? <Marke ton="alarm">zu lang</Marke> : null}
    </span>
  );
}

/**
 * How many exercise items play this recording — or, for an exam recording not yet published, how
 * many it is planned for. The two are different facts and the second is marked as a plan.
 */
function Aufgaben({ row }: { row: RegistryRow }): React.JSX.Element {
  if (row.kind !== 'listening') return <span className="leer" />;
  const benutzt = row.exercise_items ?? 0;
  const geplant = row.serves?.length ?? 0;
  if (benutzt === 0 && geplant > 0)
    return (
      <span className="entfernt" title={`Geplant für: ${row.serves?.join(', ')}`}>
        für {zahl(geplant)}
      </span>
    );
  return <>{zahl(benutzt)}</>;
}

/**
 * What the studio holds on disk, and the one button that frees any of it.
 *
 * Only renders are removed, and only those of revisions nobody can still need: a project's newest
 * two, every signed revision and every published one stay. Synthesised lines live in `assets` and
 * are kept, which is why a removed render costs a mix and not a synthesis to make again.
 */
function Speicher(): React.JSX.Element {
  const api = useApi();
  const [stand, setStand] = useState(0);
  const keep = 2;
  const { data, error } = useEngineRead((signal) => api.disk(keep, signal), [api, stand]);
  const [laeuft, setLaeuft] = useState(false);
  const [problem, setProblem] = useState<Error | null>(null);

  async function aufraeumen(): Promise<void> {
    if (!data) return;
    const frage = `${zahl(data.reapable.renders)} Renders (${megabyte(data.reapable.bytes)}) entfernen? Sie lassen sich aus ihren Revisionen neu rendern.`;
    if (!window.confirm(frage)) return;
    setLaeuft(true);
    setProblem(null);
    try {
      await api.reap(keep);
      setStand((value) => value + 1);
    } catch (failure) {
      setProblem(failure as Error);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Platte
      titel="Speicher"
      zaehler={data ? megabyte(Object.values(data.areas).reduce((a, b) => a + b, 0)) : undefined}
      erklaerung="Was das Studio neben der Datenbank hält. Entfernt werden nur Renders älterer Revisionen: die zwei neuesten jedes Projekts, jede unterschriebene und jede veröffentlichte bleiben."
    >
      {error ? <p className="hinweis hinweis-alarm">{fehlerText(error)}</p> : null}
      {problem ? <p className="hinweis hinweis-alarm">{fehlerText(problem)}</p> : null}
      {data ? (
        <div className="stapel-eng">
          <dl className="reihe" style={{ gap: 'var(--ton-mass-4)' }}>
            {Object.entries(data.areas).map(([area, bytes]) => (
              <div key={area}>
                <dt className="tafel">{area}</dt>
                <dd className="zahl">{megabyte(bytes)}</dd>
              </div>
            ))}
          </dl>
          <p className="leise">
            {zahl(data.renders)} Renders, davon {zahl(data.reapable.renders)} entbehrlich (
            {megabyte(data.reapable.bytes)}).
          </p>
          <div>
            <Button
              size="sm"
              disabled={laeuft || data.reapable.renders === 0}
              onClick={() => void aufraeumen()}
            >
              {laeuft ? 'Räumt auf …' : 'Alte Renders entfernen'}
            </Button>
          </div>
        </div>
      ) : null}
    </Platte>
  );
}

function megabyte(bytes: number): string {
  return `${(bytes / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}
