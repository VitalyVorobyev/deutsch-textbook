/**
 * Response shapes, cookie plumbing and the two request guards every API route
 * shares.
 *
 * `no-store` on every API response is load-bearing twice over: the service
 * worker already refuses to cache `/api/` (src/integrations/service-worker.js),
 * and this stops Cloudflare's edge cache doing what the service worker was
 * stopped from doing. A cached snapshot response would be merged into a
 * learner's live state as if it were current.
 */

export interface ApiError {
  error: string;
  message: string;
}

function baseHeaders(): Headers {
  return new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    // The same URL answers differently per learner. Say so, even behind no-store.
    vary: 'Cookie, Authorization',
  });
}

/**
 * Cookies are **appended after construction**, never passed in the `init`.
 *
 * `Set-Cookie` is a forbidden response header in a browser realm, so a Response
 * built with one in its init silently loses it there — and a header that
 * silently disappears in one realm and not another is the kind of difference
 * that only ever surfaces as "sign-in does nothing". Appending works in every
 * realm, so there is one behaviour to reason about.
 */
function withCookies(response: Response, cookies: string[]): Response {
  for (const cookie of cookies) response.headers.append('set-cookie', cookie);
  return response;
}

export interface ApiInit extends ResponseInit {
  cookies?: string[];
}

export function json(data: unknown, init: ApiInit = {}): Response {
  const headers = baseHeaders();
  for (const [key, value] of new Headers(init.headers).entries()) headers.set(key, value);
  return withCookies(
    new Response(JSON.stringify(data), { status: init.status, headers }),
    init.cookies ?? [],
  );
}

/** A machine-readable failure. `error` is the stable code; `message` is for a human. */
export function problem(status: number, error: string, message: string): Response {
  return json({ error, message } satisfies ApiError, { status });
}

export function noContent(headers: HeadersInit = {}): Response {
  const merged = baseHeaders();
  merged.delete('content-type');
  for (const [key, value] of new Headers(headers).entries()) merged.set(key, value);
  return new Response(null, { status: 204, headers: merged });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json(
    { error: 'method-not-allowed', message: `Allowed: ${allowed.join(', ')}` } satisfies ApiError,
    { status: 405, headers: { allow: allowed.join(', ') } },
  );
}

/** A 302 that also carries cookie mutations. */
export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  return withCookies(new Response(null, { status: 302, headers }), cookies);
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (name) out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export interface CookieOptions {
  maxAge?: number;
  secure: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? '/'}`];
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join('; ');
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { secure, maxAge: 0 });
}

/**
 * Whether this request arrived over a connection a `__Host-` cookie may be set on.
 *
 * The `__Host-` prefix REQUIRES the `Secure` attribute, and a browser drops a
 * `__Host-` cookie that lacks it — which would make `bunx wrangler dev` on
 * http://localhost silently unable to hold a session. So the cookie name itself
 * varies with the scheme (see `cookieName`); the client never reads either.
 */
export function isSecureRequest(url: URL): boolean {
  return url.protocol === 'https:';
}

/** `__Host-`-prefixed over https, plain over http. */
export function cookieName(base: string, secure: boolean): string {
  return secure ? `__Host-${base}` : base;
}

/** Read a cookie under whichever of the two names this scheme uses. */
export function readCookie(
  cookies: Record<string, string>,
  base: string,
  secure: boolean,
): string | undefined {
  return cookies[cookieName(base, secure)];
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Reject a cross-site state-changing request that carries the session cookie.
 *
 * SameSite=Lax already blocks cross-site POST/PUT/DELETE with cookies, so this
 * is defence in depth against a browser that does not enforce it. A request
 * with no `Origin` header at all is allowed: non-browser clients (the desktop
 * app, curl) do not send one, and they authenticate with a Bearer token, which
 * is not an ambient credential and therefore not forgeable cross-site.
 */
export function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

/**
 * Read a body, refusing anything over `maxBytes`.
 *
 * Checks `Content-Length` first (cheap, and catches the honest case) and then
 * counts while streaming, because Content-Length is client-supplied and a
 * chunked upload has none.
 */
export async function readCappedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | 'too-large'> {
  const declared = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) return 'too-large';

  const body = request.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return 'too-large';
    }
    chunks.push(value);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Parse a JSON request body, returning undefined rather than throwing. */
export async function readJson<T>(request: Request, maxBytes = 16 * 1024): Promise<T | undefined> {
  const body = await readCappedBody(request, maxBytes);
  if (body === 'too-large' || body.byteLength === 0) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    return undefined;
  }
}
