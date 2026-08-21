/**
 * The shell: the rail, the route table, and the one place a rejected token is handled.
 *
 * **Auth is a shell concern, not a view concern.** `createApi` reports the first 401 through
 * `onUnauthorized`; the shell clears the stored token and renders `Anmeldung` with the engine's own
 * reason. No view needs an auth branch, and there is no state in which a screen is half-signed-in.
 *
 * **The nav names surfaces that do not exist yet.** Lesetexte and Prüfung are listed, disabled and
 * marked *Folgt* rather than hidden, because the shape of the tool is part of what the tool tells
 * you about itself. Klangbibliothek left that list when the editor arrived.
 *
 * **Tasten** is on the rail and not in a help page. There are two shortcuts and they are the two
 * things this tool does all day — save, and play — so they are printed where the operator can see
 * them without leaving what they are doing, the way a key legend is silkscreened on a desk.
 */
import { useCallback, useMemo, useState } from 'react';
import { createApi } from './api';
import { clearToken, getToken, setToken } from './auth';
import { Wortmarke } from './components/Wortmarke';
import { ApiContext } from './useEngine';
import { href, navigate, useRoute, useScrollReset } from './router';
import { Anmeldung } from './views/Anmeldung';
import { Figuren } from './views/Figuren';
import { Klangbibliothek } from './views/Klangbibliothek';
import { Szene } from './views/Szene';
import { Szenen } from './views/Szenen';
import { Uebersicht } from './views/Uebersicht';

const WEGE = [
  { view: 'uebersicht', name: 'Übersicht' },
  { view: 'szenen', name: 'Szenen' },
  { view: 'klangbibliothek', name: 'Klangbibliothek' },
  { view: 'figuren', name: 'Figuren' },
] as const;

const WEGE_BALD = ['Lesetexte', 'Prüfung'] as const;

/** Two shortcuts, printed on the rail. Anything a third one would do already has a button. */
const TASTEN = [
  { taste: '⌘/Strg + S', tut: 'Szene speichern' },
  { taste: 'Leertaste', tut: 'abspielen / anhalten' },
] as const;

export function App(): React.JSX.Element {
  const [token, setTokenState] = useState(getToken);
  const [abgelehnt, setAbgelehnt] = useState<string | undefined>(undefined);
  const route = useRoute();
  useScrollReset(`${route.view}/${route.id ?? ''}`);

  const onUnauthorized = useCallback((reason: string) => {
    clearToken();
    setTokenState('');
    setAbgelehnt(reason);
  }, []);

  // The client reads the token from this state and is rebuilt when it changes. Reading the module
  // store instead would leave the dependency invisible: the old client would keep sending the
  // rejected string, and its own `reportedUnauthorized` latch would swallow the next report of it.
  const api = useMemo(() => createApi({ token: () => token, onUnauthorized }), [onUnauthorized, token]);

  const annehmen = useCallback((next: string) => {
    setToken(next);
    setTokenState(next);
    setAbgelehnt(undefined);
  }, []);

  if (!token) return <Anmeldung grund={abgelehnt} onToken={annehmen} />;

  return (
    <ApiContext.Provider value={api}>
      <div className="werk">
        <nav className="schiene" aria-label="Bereiche">
          <a href={href('uebersicht')}>
            <Wortmarke />
          </a>

          <div className="wege">
            {WEGE.map((weg) => (
              <a
                key={weg.view}
                className="weg"
                href={href(weg.view)}
                aria-current={istAktiv(route.view, weg.view) ? 'page' : undefined}
              >
                {weg.name}
              </a>
            ))}
          </div>

          <div className="wege">
            <span className="tafel" style={{ padding: '0 var(--ton-mass-3)' }}>
              Folgt
            </span>
            {WEGE_BALD.map((name) => (
              <span key={name} className="weg weg-bald" aria-disabled="true">
                {name}
              </span>
            ))}
          </div>

          <div className="wege">
            <span className="tafel" style={{ padding: '0 var(--ton-mass-3)' }}>
              Tasten
            </span>
            {TASTEN.map((eintrag) => (
              <span key={eintrag.taste} className="taste">
                <span className="zahl">{eintrag.taste}</span>
                <span className="entfernt">{eintrag.tut}</span>
              </span>
            ))}
          </div>

          <div className="schiene-fuss">
            <span className="tafel">Engine</span>
            <span className="zahl entfernt">127.0.0.1:8765</span>
            <button
              type="button"
              className="knopf"
              style={{ marginTop: 'var(--ton-mass-2)' }}
              onClick={() => {
                clearToken();
                setTokenState('');
                setAbgelehnt(undefined);
              }}
            >
              Token verwerfen
            </button>
          </div>
        </nav>

        <main className="buehne">
          <div className="bahn">{render(route.view, route.id)}</div>
        </main>
      </div>
    </ApiContext.Provider>
  );
}

/** `szene/<slug>` keeps `Szenen` lit: the detail is a place inside that list, not a fourth section. */
function istAktiv(view: string, weg: string): boolean {
  if (weg === 'szenen') return view === 'szenen' || view === 'szene';
  return view === weg;
}

function render(view: string, id?: string): React.JSX.Element {
  switch (view) {
    case 'szenen':
      return <Szenen />;
    case 'szene':
      return id ? <Szene slug={id} /> : <Szenen />;
    case 'klangbibliothek':
      return <Klangbibliothek />;
    case 'figuren':
      return <Figuren />;
    case 'uebersicht':
      return <Uebersicht />;
    default:
      // An unknown hash is a typo or a stale bookmark, and a router fallback that renders the
      // overview would make it look like a working link. Say so, and offer the way back.
      return (
        <>
          <header className="kopf">
            <span className="tafel kopf-eyebrow">Unbekannte Adresse</span>
            <h1>Diese Seite gibt es nicht</h1>
            <p>
              <code className="pfad">#/{view}</code> gehört zu keinem Bereich von Tonwerk.
            </p>
          </header>
          <div>
            <button type="button" className="knopf" onClick={() => navigate(href('uebersicht'))}>
              Zur Übersicht
            </button>
          </div>
        </>
      );
  }
}
