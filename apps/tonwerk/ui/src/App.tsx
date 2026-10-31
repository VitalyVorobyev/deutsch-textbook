/**
 * The shell: the rail, the route table, and the one place a rejected token is handled.
 *
 * **Auth is a shell concern, not a view concern.** `createApi` reports the first 401 through
 * `onUnauthorized`; the shell clears the stored token and renders `Anmeldung` with the engine's own
 * reason. No view needs an auth branch, and there is no state in which a screen is half-signed-in.
 * A launch code being redeemed is a state of its own, so the token field never flashes up in a
 * tab that is about to sign itself in.
 *
 * **The frame is `@vitavision/workbench`'s `AppShell`.** The six sections are a `NavRail` of links
 * (the hash is the route, so an item is an `<a>`, never a button), the wordmark and the engine
 * sit in the header, and the page scrolls inside `main`, never the window: the shell is fixed to
 * the viewport, which is what keeps the rail and the key legend in place while a QA table scrolls.
 *
 * **The nav lists six sections and nothing else.** There is no *Folgt* group naming surfaces that
 * have not arrived: an empty "coming" list is not a statement, so it is not kept as a heading over
 * nothing.
 *
 * **Tasten** is the status line at the foot, and not a help page. Four keys, and every one of them
 * is something this tool does all day — save, play, and the two that walk a review queue — so they
 * are printed where the operator can see them without leaving what they are doing, the way a key
 * legend is silkscreened on a desk.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@vitavision/ui';
import { AppShell, NavRail, NavRailItem, StatusBar } from '@vitavision/workbench';
import { AudioLines, BookOpenText, ClipboardCheck, Gauge, Library, Users } from 'lucide-react';
import { createApi } from './api';
import { clearToken, getToken, setToken, type Anmeldeergebnis } from './auth';
import { Wortmarke } from './components/Wortmarke';
import { ApiContext } from './useEngine';
import { BUEHNE_ID, href, navigate, useRoute, useScrollReset } from './router';
import { Anmeldung } from './views/Anmeldung';
import { Bibliothek } from './views/Bibliothek';
import { Figuren } from './views/Figuren';
import { Freigabe } from './views/Freigabe';
import { Klangbibliothek } from './views/Klangbibliothek';
import { Lesetexte } from './views/Lesetexte';
import { Pruefung } from './views/Pruefung';
import { Szene } from './views/Szene';
import { Uebersicht } from './views/Uebersicht';

/**
 * The rail, in the order the work runs: what exists, what is being made, what is waiting for a
 * person, and the two catalogues everything is made out of.
 */
const WEGE = [
  { view: 'uebersicht', name: 'Übersicht', icon: <Gauge /> },
  { view: 'bibliothek', name: 'Bibliothek', icon: <Library /> },
  { view: 'lesetexte', name: 'Lesetexte', icon: <BookOpenText /> },
  { view: 'pruefung', name: 'Prüfung', icon: <ClipboardCheck /> },
  { view: 'klangbibliothek', name: 'Klangbibliothek', icon: <AudioLines /> },
  { view: 'figuren', name: 'Figuren', icon: <Users /> },
] as const;

/**
 * Four shortcuts, printed on the status line.
 *
 * The first two are what the editor does all day. The last two are what a *queue* does all day,
 * and they say where they work: a legend listing a key that is inert on the screen you are looking
 * at is worse than no legend, and a silkscreen that changes per screen is not a silkscreen.
 */
const TASTEN = [
  { taste: '⌘/Strg + S', tut: 'Szene speichern' },
  { taste: 'Leertaste', tut: 'abspielen / anhalten' },
  { taste: 'J / K', tut: 'Zeile weiter / zurück' },
  { taste: 'Enter', tut: 'Zeile öffnen' },
] as const;

export interface AppProps {
  /** A launch code already on its way to the engine, started once by `main.tsx`. */
  anmeldung?: Promise<Anmeldeergebnis>;
}

export function App({ anmeldung }: AppProps): React.JSX.Element {
  const [token, setTokenState] = useState(getToken);
  const [abgelehnt, setAbgelehnt] = useState<string | undefined>(undefined);
  const [verbindet, setVerbindet] = useState(anmeldung !== undefined);
  const route = useRoute();
  useScrollReset(`${route.view}/${route.id ?? ''}`);

  useEffect(() => {
    if (!anmeldung) return;
    let aktiv = true;
    void anmeldung.then((ergebnis) => {
      if (!aktiv) return;
      if ('token' in ergebnis) {
        setToken(ergebnis.token);
        setTokenState(ergebnis.token);
        setAbgelehnt(undefined);
      } else {
        setAbgelehnt(ergebnis.grund);
      }
      setVerbindet(false);
    });
    return () => {
      aktiv = false;
    };
  }, [anmeldung]);

  const onUnauthorized = useCallback((reason: string) => {
    clearToken();
    setTokenState('');
    setAbgelehnt(reason);
  }, []);

  // The client reads the token from this state and is rebuilt when it changes. Reading the module
  // store instead would leave the dependency invisible: the old client would keep sending the
  // rejected string, and its own `reportedUnauthorized` latch would swallow the next report of it.
  const api = useMemo(
    () => createApi({ token: () => token, onUnauthorized }),
    [onUnauthorized, token],
  );

  const annehmen = useCallback((next: string) => {
    setToken(next);
    setTokenState(next);
    setAbgelehnt(undefined);
  }, []);

  if (verbindet) {
    return (
      <main className="anmeldung" aria-busy="true">
        <div className="anmeldung-platte">
          <Wortmarke />
          <p className="leise">Verbinde mit der Engine …</p>
        </div>
      </main>
    );
  }
  if (!token) return <Anmeldung grund={abgelehnt} onToken={annehmen} />;

  const aktiv = WEGE.find((weg) => istAktiv(route.view, weg.view))?.view ?? null;

  return (
    <ApiContext.Provider value={api}>
      <AppShell
        className="werk"
        header={
          <div className="kopfleiste">
            <a href={href('uebersicht')} aria-label="Tonwerk · Übersicht">
              <Wortmarke />
            </a>
            <div className="kopfleiste-engine">
              <span className="tafel">Engine</span>
              {/* Same-origin, always: in development Vite proxies `/api`, and in production the
                  engine serves this bundle itself. So the host is read rather than written down —
                  the port is a `--port` flag, and a hardcoded 8765 was wrong on any other one. */}
              <span className="zahl entfernt">{window.location.host}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearToken();
                  setTokenState('');
                  setAbgelehnt(undefined);
                }}
              >
                Token verwerfen
              </Button>
            </div>
          </div>
        }
        railLabel="Bereiche"
        rail={
          <NavRail value={aktiv}>
            {WEGE.map((weg) => (
              <NavRailItem
                key={weg.view}
                value={weg.view}
                label={weg.name}
                icon={weg.icon}
                className="w-24"
                asChild
              >
                <a href={href(weg.view)} />
              </NavRailItem>
            ))}
          </NavRail>
        }
        main={
          <div id={BUEHNE_ID} className="buehne">
            <div className="bahn">{render(route.view, route.id)}</div>
          </div>
        }
        bottom={
          <StatusBar
            aria-label="Tasten"
            start={TASTEN.map((eintrag) => ({ label: eintrag.taste, value: eintrag.tut }))}
          />
        }
      />
    </ApiContext.Provider>
  );
}

/** A detail is a place inside its list, not a section of its own: `szene/<slug>` keeps it lit. */
function istAktiv(view: string, weg: string): boolean {
  if (weg === 'bibliothek') return view === 'bibliothek' || view === 'szenen' || view === 'szene';
  return view === weg;
}

function render(view: string, id?: string): React.JSX.Element {
  switch (view) {
    // `szenen` is the list this one replaced, so an address saved before the move still opens it.
    case 'bibliothek':
    case 'szenen':
      return <Bibliothek />;
    case 'szene':
      return id ? <Szene slug={id} /> : <Bibliothek />;
    case 'lesetexte':
      return <Lesetexte />;
    case 'pruefung':
      // The queue and one review under one route: a Freigabe is a place inside the queue, and
      // `#/pruefung/<slug>` is the address a reviewer sends to themselves for tomorrow.
      return id ? <Freigabe slug={id} /> : <Pruefung />;
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
            <Button size="sm" onClick={() => navigate(href('uebersicht'))}>
              Zur Übersicht
            </Button>
          </div>
        </>
      );
  }
}
