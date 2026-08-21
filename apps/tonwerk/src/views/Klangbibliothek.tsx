/**
 * Klangbibliothek — every sound the studio can place, and the one way to make a new one.
 *
 * **Two origins, one list, and the difference is never hidden.** An import is somebody else's
 * recording: it has an uploader, a licence, a page it came from and a reviewed rights note, and
 * those are the fields a person needs before putting it in a course. A generated sound has none of
 * that and instead has a prompt, a seed and a model revision — the record of *why these bytes*.
 * The engine keeps the two in separate schemas for that reason, and so does this page: the row
 * shows what its origin actually knows, and never a blank column pretending the other half exists.
 *
 * **Erzeugen runs a model, so it behaves like one.** The button carries its elapsed second and
 * refuses re-entry, and the answer says whether the node was already in the cache — the same
 * prompt at the same seed is one asset, whether it was made here or by a render.
 *
 * Space plays and pauses inside the list (`Spielbereich`), because comparing two beds is the thing
 * this page is for and reaching for the mouse between each one is the thing that stops people
 * doing it.
 */
import { useMemo, useState } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Feld, Feldreihe, SkriptFeld, WahlFeld, ZahlFeld } from '../components/Feld';
import { Spielbereich, Spieler } from '../components/Spieler';
import { Welle } from '../components/Welle';
import { kurzSha, sekunden, zahl } from '../format';
import { useQueryState } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import { useVorgang } from '../vorgang';
import { klangSha, type SoundRow } from '../contracts';
import { fehlerText } from './fehler';

const ALLE = 'alle';

const HERKUNFT: Record<string, string> = {
  freesound: 'Import',
  generated: 'erzeugt',
};

export function Klangbibliothek(): React.JSX.Element {
  const api = useApi();
  const [stand, setStand] = useState(0);
  const { data, error, laedt } = useEngineRead((signal) => api.sounds(signal), [api, stand]);
  const [herkunft, setHerkunft] = useQueryState('herkunft', ALLE);
  const [kategorie, setKategorie] = useQueryState('kategorie', ALLE);

  const alle = useMemo(() => data ?? [], [data]);
  const kategorien = useMemo(
    () => [...new Set(alle.map(kategorieVon))].sort((a, b) => a.localeCompare(b, 'de')),
    [alle],
  );
  const zeilen = useMemo(
    () =>
      alle.filter(
        (row) =>
          (herkunft === ALLE || row.origin === herkunft) &&
          (kategorie === ALLE || kategorieVon(row) === kategorie),
      ),
    [alle, herkunft, kategorie],
  );

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Bibliothek</span>
        <h1>Klangbibliothek</h1>
        <p>
          Was eine Szene unter die Stimmen legen kann: importierte Aufnahmen mit ihrer Lizenz und
          erzeugte Klänge mit ihrem Prompt. Beide werden über denselben Digest referenziert.
        </p>
      </header>

      <Erzeugen
        api={api}
        neuLaden={() => setStand((wert) => wert + 1)}
      />

      {laedt ? <Zustand art="laedt" text="Bibliothek wird gelesen …" /> : null}
      {error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
      ) : null}

      {data ? (
        <Spielbereich>
          <Platte
            titel="Klänge"
            zaehler={`${zahl(zeilen.length)} von ${zahl(alle.length)}`}
            erklaerung="Leertaste spielt und hält an, sobald in dieser Liste zuletzt etwas lief."
          >
            <div className="reihe">
              <WahlFeld
                legende="Herkunft"
                wert={herkunft}
                optionen={[
                  { wert: ALLE, name: 'alle' },
                  { wert: 'freesound', name: 'Import' },
                  { wert: 'generated', name: 'erzeugt' },
                ]}
                onWert={setHerkunft}
              />
              <WahlFeld
                legende="Kategorie"
                wert={kategorie}
                optionen={[
                  { wert: ALLE, name: 'alle' },
                  ...kategorien.map((name) => ({ wert: name, name })),
                ]}
                onWert={setKategorie}
              />
            </div>
          </Platte>

          {zeilen.length === 0 ? (
            <Platte titel="Klänge">
              <Zustand
                art="leer"
                text={
                  alle.length === 0
                    ? 'Die Bibliothek ist leer. Importiere eine Aufnahme oder erzeuge einen Klang.'
                    : 'Kein Klang passt zu dieser Auswahl.'
                }
              />
            </Platte>
          ) : (
            <div className="klaenge">
              {zeilen.map((row) => (
                <Klang key={klangSha(row)} row={row} />
              ))}
            </div>
          )}
        </Spielbereich>
      ) : null}
    </>
  );
}

function kategorieVon(row: SoundRow): string {
  if (row.origin === 'generated') return 'erzeugt';
  return row.editorial?.category ?? 'uncategorized';
}

function Klang({ row }: { row: SoundRow }): React.JSX.Element {
  const sha = klangSha(row);
  const erzeugt = row.origin === 'generated';
  return (
    <article className="platte klang">
      <div className="klang-titel">
        <div style={{ minWidth: 0 }}>
          <p className="skript klang-name">
            {erzeugt ? row.prompt : (row.title ?? kurzSha(sha))}
          </p>
          <p className="zahl entfernt klang-kennung" title={sha}>
            {kurzSha(sha)}
            {row.duration_seconds ? ` · ${sekunden(row.duration_seconds * 1000)}` : ''}
          </p>
        </div>
        <Marke ton={erzeugt ? 'messung' : 'ruhig'}>{HERKUNFT[row.origin] ?? row.origin}</Marke>
      </div>

      <div className="klang-welle">
        <Welle peaks={row.peaks} titel={`Wellenform ${kurzSha(sha)}`} />
      </div>

      <div className="klang-fuss">
        <Spieler pfad={`/api/sounds/${encodeURIComponent(sha)}/audio`} name={kurzSha(sha)} kompakt />
      </div>

      <dl className="werte platte-leib klang-werte">
        {erzeugt ? (
          <>
            <div className="wert">
              <dt>Engine</dt>
              <dd className="zahl">{row.engine ?? '–'}</dd>
            </div>
            <div className="wert">
              <dt>Seed</dt>
              <dd className="zahl">{zahl(row.seed)}</dd>
            </div>
            <div className="wert">
              <dt>Modell</dt>
              <dd className="zahl entfernt" title={row.model_revision}>
                {row.model_id ?? '–'}
              </dd>
            </div>
            <div className="wert">
              <dt>Lizenz</dt>
              <dd>{row.license ?? '–'}</dd>
            </div>
            {row.negative_prompt ? (
              <div className="wert">
                <dt>Ausschluss</dt>
                <dd className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                  {row.negative_prompt}
                </dd>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="wert">
              <dt>Hochgeladen von</dt>
              <dd>{row.uploader ?? '–'}</dd>
            </div>
            <div className="wert">
              <dt>Lizenz</dt>
              <dd>
                {row.license_url ? (
                  <a href={row.license_url} target="_blank" rel="noreferrer" className="zahl">
                    {row.license ?? '–'}
                  </a>
                ) : (
                  (row.license ?? '–')
                )}
              </dd>
            </div>
            <div className="wert">
              <dt>Kategorie</dt>
              <dd>{row.editorial?.category ?? '–'}</dd>
            </div>
            <div className="wert">
              <dt>Benutzt in</dt>
              <dd className="zahl">{zahl(row.usage_count ?? 0)}</dd>
            </div>
          </>
        )}
      </dl>

      {!erzeugt && row.editorial ? (
        <div className="platte-leib reihe klang-marken">
          {row.editorial.allowed_roles.map((rolle) => (
            <Marke key={rolle}>{rolle === 'bed' ? 'als Bett' : 'als Ereignis'}</Marke>
          ))}
          {row.editorial.loop_quality ? <Marke>Schleife {row.editorial.loop_quality}</Marke> : null}
          <Marke ton={row.editorial.review_status === 'reviewed' ? 'signal' : 'ruhig'}>
            {row.editorial.review_status === 'reviewed' ? 'geprüft' : (row.editorial.review_status ?? '–')}
          </Marke>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Erzeugen — one generation, in the fields the scene contract already uses.
 *
 * The same four values a `SoundSpec` holds, deliberately: what is auditioned here and what a
 * timeline entry asks for have to be one request, or the take that was approved by ear is not the
 * take the render produces.
 */
function Erzeugen({
  api,
  neuLaden,
}: {
  api: ReturnType<typeof useApi>;
  neuLaden(): void;
}): React.JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [negativ, setNegativ] = useState('');
  const [seed, setSeed] = useState(0);
  const [laenge, setLaenge] = useState(5);
  const [engine, setEngine] = useState('stable_audio_sfx');

  const vorgang = useVorgang(() =>
    api
      .generateSound({
        prompt,
        negative_prompt: negativ.trim() ? negativ : null,
        seed,
        duration_seconds: laenge,
        engine,
      })
      .then((row) => {
        neuLaden();
        return row;
      }),
  );

  return (
    <Platte
      titel="Erzeugen"
      erklaerung="Der Klang landet im selben Speicher wie ein gerenderter: derselbe Knoten, derselbe Hash. Ein Prompt mit demselben Seed kostet das Modell genau einmal."
    >
      <SkriptFeld
        legende="Beschreibung"
        wert={prompt}
        zeilen={2}
        platzhalter="z. B. Bahnhofshalle, entfernte Schritte, keine Stimmen"
        onWert={setPrompt}
      />
      <Feldreihe spalten="10rem">
        <Feld
          legende="Ausschluss"
          hinweis="Was nicht drin sein darf."
          wert={negativ}
          onWert={setNegativ}
        />
        <ZahlFeld legende="Seed" wert={seed} min={0} onWert={(wert) => setSeed(wert ?? 0)} />
        <ZahlFeld
          legende="Länge"
          einheit="s"
          wert={laenge}
          min={0.1}
          schritt={0.5}
          onWert={(wert) => setLaenge(wert ?? 1)}
        />
        <WahlFeld
          legende="Engine"
          wert={engine}
          optionen={[
            { wert: 'stable_audio_sfx', name: 'Stable Audio SFX' },
            { wert: 'fake', name: 'Testton' },
          ]}
          onWert={setEngine}
        />
      </Feldreihe>

      <div className="reihe" style={{ marginTop: 'var(--ton-mass-4)' }}>
        <button
          type="button"
          className="knopf knopf-signal"
          disabled={vorgang.laeuft || prompt.trim().length === 0}
          onClick={vorgang.starten}
        >
          {vorgang.laeuft ? (
            <>
              Erzeugt … <span className="zahl">{vorgang.sekunden} s</span>
            </>
          ) : (
            'Klang erzeugen'
          )}
        </button>
        {vorgang.ergebnis ? (
          <span className="zahl leise" role="status">
            {kurzSha(klangSha(vorgang.ergebnis))}
            {vorgang.ergebnis.cached ? ' · lag schon im Cache' : ' · neu erzeugt'}
          </span>
        ) : null}
      </div>

      {vorgang.fehler ? (
        <p className="hinweis hinweis-alarm" role="alert" style={{ marginTop: 'var(--ton-mass-3)' }}>
          {fehlerText(vorgang.fehler)}
        </p>
      ) : null}
    </Platte>
  );
}
