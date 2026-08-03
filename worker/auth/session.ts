/**
 * Turning a request into a person.
 *
 * Two credentials reach this file, and the difference between them is
 * load-bearing rather than cosmetic:
 *
 * - **The session cookie** (`__Host-da_session`) is an *ambient* credential: the
 *   browser attaches it to any request to this origin, which is what makes CSRF
 *   a category of attack at all. HttpOnly keeps it out of JS, SameSite=Lax keeps
 *   it off cross-site writes, and only sha256(token) is stored.
 * - **A device token** is carried explicitly in `Authorization`, because the
 *   Tauri webview is a different origin and no cookie can reach it. Nothing
 *   attaches it automatically, so it is not forgeable cross-site — and it is
 *   deliberately **sync-only**: `via` is checked before every admin route.
 */
import {
  cookieName,
  parseCookies,
  readCookie,
  serializeCookie,
  clearCookie,
} from '../http';
import {
  SESSION_REFRESH_MS,
  SESSION_TTL_MS,
  findDeviceTokenUser,
  findSession,
  touchSession,
  type UserRow,
} from '../db';
import type { Env } from '../env';

export const SESSION_COOKIE = 'da_session';
/** Prefix so a token is recognisable in a log or a paste, and greppable if one leaks. */
export const DEVICE_TOKEN_PREFIX = 'dat_';

export interface Principal {
  user: UserRow;
  via: 'cookie' | 'token';
  /** Set when the rolling session was extended and the cookie must be re-sent. */
  refreshedCookie?: string;
}

export function sessionCookie(token: string, secure: boolean): string {
  return serializeCookie(cookieName(SESSION_COOKIE, secure), token, {
    secure,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    sameSite: 'Lax',
  });
}

export function clearedSessionCookie(secure: boolean): string {
  return clearCookie(cookieName(SESSION_COOKIE, secure), secure);
}

export function readSessionToken(request: Request, secure: boolean): string | undefined {
  return readCookie(parseCookies(request.headers.get('cookie')), SESSION_COOKIE, secure);
}

function readBearer(request: Request): string | undefined {
  const header = request.headers.get('authorization');
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return undefined;
  return value.startsWith(DEVICE_TOKEN_PREFIX) ? value : undefined;
}

/**
 * Resolve the caller, or null.
 *
 * The cookie is tried first so that a browser session always wins over a stale
 * `Authorization` header a proxy might have added.
 */
export async function authenticate(
  request: Request,
  env: Env,
  secure: boolean,
  now: number,
): Promise<Principal | null> {
  const token = readSessionToken(request, secure);
  if (token) {
    const found = await findSession(env.DB, token, now);
    if (found) {
      // Rolling expiry: a learner who opens the app weekly is never signed out,
      // and one who stops is forgotten on schedule.
      if (found.expiresAt - now < SESSION_REFRESH_MS) {
        await touchSession(env.DB, token, now);
        return { user: found.user, via: 'cookie', refreshedCookie: sessionCookie(token, secure) };
      }
      return { user: found.user, via: 'cookie' };
    }
  }

  const bearer = readBearer(request);
  if (bearer) {
    const user = await findDeviceTokenUser(env.DB, bearer);
    if (user) return { user, via: 'token' };
  }

  return null;
}
