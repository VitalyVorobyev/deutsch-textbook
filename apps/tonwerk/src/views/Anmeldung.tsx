/**
 * The token screen — first run, and every time the engine restarts.
 *
 * `atlas-listening serve` mints a token per run and prints it once; it is never written to disk. So
 * this screen is not an exception path, it is the ordinary start of a session, and the copy says
 * what to do rather than what went wrong. When a request comes back 401, the shell returns here
 * carrying the engine's own reason — the reader learns the token was *refused* rather than watching
 * a table quietly fail to load.
 */
import { useState } from 'react';
import { Wortmarke } from '../components/Wortmarke';

export interface AnmeldungProps {
  /** The reason the last token was refused, when there was one. */
  grund?: string;
  onToken(token: string): void;
}

export function Anmeldung({ grund, onToken }: AnmeldungProps): React.JSX.Element {
  const [wert, setWert] = useState('');

  return (
    <main className="anmeldung">
      <div className="anmeldung-platte">
        <Wortmarke />

        <div className="stapel-eng">
          <h1 className="tafel" style={{ fontSize: 'var(--ton-grad-13)', color: 'var(--ton-schrift)' }}>
            Mit der Engine verbinden
          </h1>
          <p className="leise">
            Tonwerk liest die lokale Render-Engine unter <code className="pfad">127.0.0.1:8765</code>.
            Starte sie mit <code className="pfad">atlas-listening serve</code> und füge den Token ein,
            den der Befehl ausgibt. Er gilt nur für diesen Lauf.
          </p>
        </div>

        {grund ? (
          <p className="hinweis hinweis-alarm" role="alert">
            {grund} Der Token wird bei jedem Start der Engine neu erzeugt — hol dir den aktuellen aus
            der Ausgabe von <code className="pfad">atlas-listening serve</code>.
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = wert.trim();
            if (trimmed) onToken(trimmed);
          }}
        >
          <label>
            <span className="tafel">API-Token</span>
            <input
              className="feld"
              type="password"
              name="token"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder="aus der Ausgabe von atlas-listening serve"
              value={wert}
              onChange={(event) => setWert(event.target.value)}
            />
          </label>
          <div>
            <button className="knopf knopf-signal" type="submit" disabled={!wert.trim()}>
              Verbinden
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
