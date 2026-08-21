/**
 * The bearer token: where it is kept, and how the app learns it stopped working.
 *
 * `atlas-listening serve` generates the token per run and **never writes it to disk** — the CLI
 * prints it once and that is the only copy. So the token in `localStorage` is a convenience for
 * the current run and is expected to go stale every time the engine restarts. That expectation
 * shapes the whole flow: a rejected token is not an error state to recover from, it is the normal
 * end of a session, and the token screen says so rather than apologising.
 *
 * `localStorage` and not a cookie, deliberately. The engine still accepts a session cookie for its
 * legacy HTML pages and its own docstring says nothing new may be built on that path; Tonwerk only
 * ever sends `Authorization: Bearer`, which is also the only presentation the engine checks
 * without an Origin guard.
 */

const KEY = 'tonwerk:token';

const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    // A browser with site data blocked. The app still works for the length of one page view.
    return '';
  }
}

let current = typeof window === 'undefined' ? '' : read();

export function getToken(): string {
  return current;
}

export function setToken(token: string): void {
  current = token.trim();
  try {
    if (current) window.localStorage.setItem(KEY, current);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* nothing persisted; the in-memory copy still serves this session */
  }
  for (const listener of listeners) listener();
}

export function clearToken(): void {
  setToken('');
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: reset module state between specs without touching `localStorage` semantics. */
export function __resetTokenForTests(token = ''): void {
  current = token;
  listeners.clear();
}
