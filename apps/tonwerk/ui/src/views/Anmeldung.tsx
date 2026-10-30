/**
 * The token screen — the fallback when Tonwerk could not sign itself in.
 *
 * The desktop app and `bun run tonwerk:start` both arrive signed in, so this screen means one of
 * three things: the page was opened without its launch link, the link was already spent, or the
 * engine restarted under a tab still holding the last run's token. When a request comes back 401,
 * the shell returns here carrying the engine's own reason — the reader learns the token was
 * *refused* rather than watching a table quietly fail to load.
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
          <h1
            className="tafel"
            style={{ fontSize: 'var(--ton-grad-13)', color: 'var(--ton-schrift)' }}
          >
            Mit der Engine verbinden
          </h1>
          <p className="leise">
            Gestartet mit <code className="pfad">bun run tonwerk:start</code> oder als App meldet
            sich Tonwerk selbst an. Hier geht es weiter mit dem Token, den{' '}
            <code className="pfad">atlas-listening serve</code> ausgibt. Er gilt nur für diesen
            Lauf.
          </p>
        </div>

        {grund ? (
          <p className="hinweis hinweis-alarm" role="alert">
            {grund} Der Token wird bei jedem Start der Engine neu erzeugt — starte Tonwerk neu oder
            hol dir den aktuellen aus der Ausgabe von{' '}
            <code className="pfad">atlas-listening serve</code>.
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
