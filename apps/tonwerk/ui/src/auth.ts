/**
 * The bearer token: where it comes from, where it is kept, and how the app learns it stopped working.
 *
 * `atlas-listening serve` mints the token per run and **never writes it to disk**. It reaches this
 * app one of three ways, in this order:
 *
 * 1. **The desktop shell** starts the engine, reads the token from its handshake and puts it on
 *    `window.__TONWERK_SESSION__` before any script of this page runs. Nothing to type, nothing in
 *    an address bar.
 * 2. **A launch code.** `serve` opens the browser at `/#code=…`; the code is traded once at
 *    `POST /api/session` for the token and stripped from the address before anything renders. The
 *    engine refuses it the second time, so a copy in history or scrollback is spent.
 * 3. **Pasting**, on the token screen, when neither of the others happened.
 *
 * Kept in `sessionStorage`: it survives a reload of this tab and dies with it, which is as long as
 * a token minted for one engine run can be any use. A token that outlives the tab would be a token
 * on disk.
 */

const KEY = 'tonwerk:token';

declare global {
  interface Window {
    /** Set by the desktop shell's initialisation script, on the engine's own origin only. */
    __TONWERK_SESSION__?: { token?: string };
  }
}

const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? '';
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
    if (current) window.sessionStorage.setItem(KEY, current);
    else window.sessionStorage.removeItem(KEY);
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

/** The desktop shell's token, when this page is running inside it. */
export function shellToken(): string | null {
  const token = window.__TONWERK_SESSION__?.token;
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

/**
 * The launch code in the address, removed from it on the way out.
 *
 * Called once, before the first render: the router reads the hash too, and `#code=…` is not a
 * route. Stripped with `replaceState` so the code leaves no history entry of its own.
 */
export function takeLaunchCode(): string | null {
  const match = /^#code=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return match[1] ?? null;
}

export type Anmeldeergebnis = { token: string } | { grund: string };

/** Trade a launch code for the token. A refusal is a reason for the token screen, never a throw. */
export async function redeemLaunchCode(
  code: string,
  fetchImpl: (path: string, init: RequestInit) => Promise<Response> = (path, init) =>
    fetch(path, init),
): Promise<Anmeldeergebnis> {
  let response: Response;
  try {
    response = await fetchImpl('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { grund: 'Die Engine hat auf den Startlink nicht geantwortet.' };
  }
  if (!response.ok) {
    return {
      grund:
        'Der Startlink gilt nur einmal und ist schon benutzt oder falsch. Starte Tonwerk neu oder füge den Token ein.',
    };
  }
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== 'string' || !body.token) {
    return { grund: 'Die Engine hat auf den Startlink keinen Token geantwortet.' };
  }
  return { token: body.token };
}

/** Test seam: reset module state between specs without touching `sessionStorage` semantics. */
export function __resetTokenForTests(token = ''): void {
  current = token;
  listeners.clear();
}
