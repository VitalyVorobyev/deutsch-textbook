/**
 * Cloud snapshot sync — the third backend, beside the dev writer and the
 * desktop sync folder (src/lib/autosync.ts has the other two).
 *
 * Local-first is unchanged by everything in this file. With no account, every
 * function here returns `off` and the app behaves exactly as it did before
 * accounts existed; with a *pending* account it still does, because approval —
 * not sign-in — is what grants storage.
 *
 * **The merge is here, never on the server.** `/api/sync/snapshot` stores
 * opaque gzip bytes (worker/routes/sync.ts). Reconciling two devices is
 * `mergeSnapshot` (src/lib/store.ts), the same non-destructive union that has
 * always backed Import — so a snapshot version the server has never heard of
 * still syncs.
 *
 * Transport differs by shell, for one concrete reason: the Tauri webview is a
 * different origin (`tauri://localhost`), so the HttpOnly session cookie cannot
 * reach it. The desktop therefore carries a device token issued from /konto and
 * goes through the Tauri HTTP plugin, which is Rust-side and exempt from CORS.
 */
import { getActiveProfile, getActiveProfileId } from './profile';
import { isTauri } from './syncdir';
import { withBase } from './url';

/** Absolute origin the desktop app talks to. The web app uses same-origin paths and ignores this. */
export const SYNC_ORIGIN =
  import.meta.env.PUBLIC_SYNC_ORIGIN ?? 'https://deutsch.vitavision.dev';

export const SYNC_STATE_KEY = 'da:sync';
export const DEVICE_TOKEN_KEY = 'da:sync:token';

export type AccountStatus = 'pending' | 'approved' | 'blocked';

export interface RemoteUser {
  /** Also the R2 prefix — /konto shows it so `bun run progress:pull` can be pointed at it. */
  id: string;
  email: string;
  displayName: string | null;
  status: AccountStatus;
  role: 'learner' | 'owner';
  linked: string[];
}

export interface RemoteSession {
  signedIn: boolean;
  /** Providers this deployment has secrets for — the sign-in buttons to offer. */
  providers: string[];
  via?: 'cookie' | 'token';
  user?: RemoteUser;
}

/**
 * What the last sync did, for the status line. `off` is not a failure: it is
 * the ordinary state of an app nobody has signed into.
 */
export type SyncOutcome =
  | { state: 'off'; reason: 'unsupported' | 'signed-out' | 'unbound' | 'no-token' }
  | { state: 'pending' }
  | { state: 'blocked' }
  | { state: 'error'; reason: string }
  | { state: 'ok'; at: number; pulled: boolean; pushed: boolean };

interface SyncState {
  /** Account the etag/hash below belong to; a different account resets both. */
  accountId?: string;
  /** The local profile bound to the account. Binding is an explicit act on /konto. */
  profileId?: string;
  etag?: string;
  /** sha256 of the last body actually accepted, so an unchanged snapshot is not re-uploaded. */
  hash?: string;
  at?: number;
}

// ---------------------------------------------------------------------------
// Persisted state
// ---------------------------------------------------------------------------

export function readSyncState(): SyncState {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as SyncState) : {};
  } catch {
    return {};
  }
}

function writeSyncState(state: SyncState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}

export function getDeviceToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_TOKEN_KEY) : null;
}

export function setDeviceToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(DEVICE_TOKEN_KEY, token);
  else localStorage.removeItem(DEVICE_TOKEN_KEY);
}

/** Bind the active profile to the account. Clears any etag/hash from a previous binding. */
export function bindActiveProfile(accountId: string): void {
  writeSyncState({ accountId, profileId: getActiveProfileId() });
}

export function unbindProfile(): void {
  writeSyncState({});
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** True when this browser can gzip. Every shipping target can; a shell that cannot syncs nothing rather than uploading 10x the bytes. */
export function compressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function gunzip(bytes: ArrayBuffer): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

type Transport = (path: string, init?: RequestInit) => Promise<Response>;

async function tauriTransport(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getDeviceToken();
  if (!token) throw new NoTokenError();
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return tauriFetch(`${SYNC_ORIGIN}${path}`, { ...init, headers });
}

class NoTokenError extends Error {}

function webTransport(path: string, init: RequestInit = {}): Promise<Response> {
  // same-origin: the session cookie rides along, and nothing else does.
  return fetch(withBase(path), { ...init, credentials: 'same-origin' });
}

/**
 * The same transport minus the credential.
 *
 * Pairing happens *before* the desktop has a device token — that is the whole
 * point of it — so `tauriTransport`'s NoTokenError would refuse the one call
 * that fixes the missing token. On the web this is identical to the normal
 * path: the cookie rides along on same-origin requests either way.
 */
async function anonTransport(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isTauri()) return webTransport(path, init);
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  return tauriFetch(`${SYNC_ORIGIN}${path}`, init);
}

function transport(): Transport {
  return isTauri() ? tauriTransport : webTransport;
}

/** Endpoint helper for the UI, which needs the same transport for the account routes. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return transport()(path, init);
}

// ---------------------------------------------------------------------------
// Device pairing
// ---------------------------------------------------------------------------

export interface PairingStart {
  deviceCode: string;
  userCode: string;
  label: string;
  expiresAt: number;
  interval: number;
}

export type PairingPoll =
  | { state: 'pending'; interval: number }
  | { state: 'slow-down'; interval: number }
  | { state: 'expired' }
  | { state: 'approved'; token: string; label: string }
  | { state: 'error'; detail: string };

/** Desktop: open a pairing request. Returns the short code to show the learner. */
export async function startPairing(label: string): Promise<PairingStart | null> {
  const response = await anonTransport('/api/pair/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!response.ok) return null;
  return (await response.json()) as PairingStart;
}

/**
 * Desktop: ask whether the learner has approved yet.
 *
 * On `approved` the token is stored here rather than handed to the caller, so
 * there is exactly one place in the client that writes it, and the forgotten
 * session probe is cleared so the next sync re-reads who we now are.
 */
export async function pollPairing(deviceCode: string): Promise<PairingPoll> {
  let response: Response;
  try {
    response = await anonTransport('/api/pair/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceCode }),
    });
  } catch {
    // Offline mid-pairing is not a failed pairing: the request is still valid
    // server-side until it expires, so report it as pending and keep polling.
    return { state: 'pending', interval: 3 };
  }
  const body = (await response.json().catch(() => null)) as PairingPoll | null;
  if (!body) return { state: 'error', detail: 'bad-response' };
  if (body.state === 'approved') {
    setDeviceToken(body.token);
    forgetSession();
  }
  return body;
}

/** Browser: what a code is about to grant, so the learner can check it matches the app. */
export async function describePairing(
  userCode: string,
): Promise<{ userCode: string; label: string; expiresAt: number } | null> {
  const response = await apiFetch(`/api/pair/request?code=${encodeURIComponent(userCode)}`);
  if (!response.ok) return null;
  return (await response.json()) as { userCode: string; label: string; expiresAt: number };
}

/** Browser: grant the pairing. Cookie-authenticated; a device token is refused server-side. */
export async function approvePairing(userCode: string): Promise<boolean> {
  const response = await apiFetch('/api/pair/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userCode }),
  });
  return response.ok;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const SIGNED_OUT: RemoteSession = { signedIn: false, providers: [] };

let sessionCache: Promise<RemoteSession> | undefined;

/**
 * Who is signed in, memoized per page load.
 *
 * Anything that is not a 2xx JSON body means signed out — including Astro's
 * 404 HTML under `astro dev`, where no Worker is running. That is why remote
 * sync needs no environment flag: where there is no API, there is no session.
 *
 * **A probe that failed on the network is not cached.** The answer "signed out"
 * is a fact about the account; "the request did not complete" is a fact about
 * the moment. Caching the second one would strand a device that opened offline
 * — and in the desktop app a "page load" lasts as long as the app is open, so a
 * laptop started on a train would never sync again until it was restarted.
 */
export function getSession(force = false): Promise<RemoteSession> {
  if (force) sessionCache = undefined;
  return (sessionCache ??= fetchSession().catch(() => SIGNED_OUT));
}

async function fetchSession(): Promise<RemoteSession> {
  let response: Response;
  try {
    response = await transport()('/api/auth/session', { headers: { accept: 'application/json' } });
  } catch (error) {
    // Offline, or no device token yet: forget this attempt so the next write retries.
    sessionCache = undefined;
    throw error;
  }
  if (!response.ok) return SIGNED_OUT;
  try {
    const data = (await response.json()) as RemoteSession;
    return typeof data?.signedIn === 'boolean' ? data : SIGNED_OUT;
  } catch {
    return SIGNED_OUT;
  }
}

export function forgetSession(): void {
  sessionCache = undefined;
}

// ---------------------------------------------------------------------------
// The sync itself
// ---------------------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Local date, matching `localDateString()` — the R2 per-day copy is filed under the learner's day, not UTC's. */
function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const MAX_CONFLICT_RETRIES = 3;

/**
 * One full reconciliation: pull what changed, merge it locally, push what the
 * remote does not have.
 *
 * The order matters. Pulling first means a conflicting write is merged before
 * it is overwritten, and the conditional PUT means the merge cannot be raced —
 * the loser of a simultaneous write gets 412 and starts the loop again rather
 * than clobbering a day of work.
 */
export async function syncNow(): Promise<SyncOutcome> {
  if (typeof window === 'undefined') return { state: 'off', reason: 'signed-out' };
  if (!compressionSupported()) return { state: 'off', reason: 'unsupported' };

  const session = await getSession();
  if (!session.signedIn || !session.user) return { state: 'off', reason: 'signed-out' };
  if (session.user.status === 'blocked') return { state: 'blocked' };
  if (session.user.status !== 'approved') return { state: 'pending' };

  let state = readSyncState();
  // A different account must not inherit the previous one's etag or hash.
  if (state.accountId !== session.user.id) {
    state = { accountId: session.user.id, profileId: state.profileId };
  }
  if (!state.profileId || state.profileId !== getActiveProfileId()) {
    return { state: 'off', reason: 'unbound' };
  }

  // Deferred: store.ts imports autosync.ts, which imports this module.
  const { exportSnapshot, mergeSnapshot } = await import('./store');

  let pulled = false;

  try {
    for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
      // 1. Pull. `If-None-Match` makes the no-change case a 304 with no body,
      //    so asking on every sync costs almost nothing.
      const remote = await transport()('/api/sync/snapshot', {
        headers: state.etag ? { 'if-none-match': state.etag } : {},
      });

      if (remote.status === 200) {
        const text = await gunzip(await remote.arrayBuffer());
        await mergeSnapshot(JSON.parse(text));
        state.etag = remote.headers.get('etag') ?? state.etag;
        pulled = true;
      } else if (remote.status === 304) {
        // unchanged
      } else if (remote.status === 404) {
        state.etag = undefined;
      } else if (remote.status === 401 || remote.status === 403) {
        return outcomeFor(remote.status, await readError(remote));
      } else {
        return { state: 'error', reason: `pull-${remote.status}` };
      }

      // 2. Export what we now hold and see whether it is news.
      //
      // The hash deliberately excludes `exportedAt` and `profile`. `exportSnapshot`
      // stamps a fresh timestamp on every call (src/lib/store.ts), so hashing the
      // body itself would make this check never fire and re-upload ~114 KB on
      // every sync, forever, for a learner who changed nothing.
      const snapshot = await exportSnapshot(getActiveProfile().label);
      const body = JSON.stringify(snapshot, null, 2);
      const { exportedAt: _exportedAt, profile: _profile, ...content } = snapshot;
      const hash = await sha256Hex(JSON.stringify(content));
      if (hash === state.hash && !pulled) {
        state.at = Date.now();
        writeSyncState(state);
        return { state: 'ok', at: state.at, pulled, pushed: false };
      }

      // 3. Push, conditionally. No etag means "only if nothing is there yet".
      const push = await transport()('/api/sync/snapshot', {
        method: 'PUT',
        headers: {
          'content-type': 'application/gzip',
          'x-snapshot-date': localDate(),
          ...(state.etag ? { 'if-match': state.etag } : { 'if-none-match': '*' }),
        },
        body: await gzip(body),
      });

      if (push.status === 204) {
        state.etag = push.headers.get('etag') ?? undefined;
        state.hash = hash;
        state.at = Date.now();
        writeSyncState(state);
        return { state: 'ok', at: state.at, pulled, pushed: true };
      }

      if (push.status === 412) {
        // Someone wrote between our pull and our push.
        //
        // **Forget the etag rather than adopting the one the 412 carries.** The
        // next pull sends `If-None-Match`, so adopting the current etag would
        // make that pull a 304 — we would learn nothing, then overwrite the
        // other device with `If-Match: <their etag>` and succeed. That is
        // exactly the lost update the conditional write exists to prevent.
        // Unconditional, we get the body back, merge it, and take the fresh
        // etag from the GET.
        state.etag = undefined;
        continue;
      }

      if (push.status === 401 || push.status === 403) {
        return outcomeFor(push.status, await readError(push));
      }

      return { state: 'error', reason: `push-${push.status}` };
    }

    return { state: 'error', reason: 'conflict-retries-exhausted' };
  } catch (error) {
    if (error instanceof NoTokenError) return { state: 'off', reason: 'no-token' };
    return { state: 'error', reason: 'network' };
  } finally {
    writeSyncState(state);
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? String(response.status);
  } catch {
    return String(response.status);
  }
}

function outcomeFor(status: number, code: string): SyncOutcome {
  if (status === 401) {
    forgetSession();
    return { state: 'off', reason: 'signed-out' };
  }
  if (code === 'pending') return { state: 'pending' };
  if (code === 'blocked') return { state: 'blocked' };
  return { state: 'error', reason: code };
}

/**
 * A sync that cannot decide it has nothing to say.
 *
 * Dropping the stored hash is the whole difference: after uploading an exported
 * snapshot on /konto, or after binding a profile, the learner is entitled to see
 * the push happen even if the merge turned out to be a no-op. The write itself
 * is still the ordinary conditional PUT — nothing here can overwrite another
 * device blindly.
 */
export async function forceSync(): Promise<SyncOutcome> {
  const state = readSyncState();
  state.hash = undefined;
  writeSyncState(state);
  return syncNow();
}
