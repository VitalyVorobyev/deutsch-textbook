/**
 * Sign-in: the signed state cookie, the cookie attributes, and the rule that
 * decides which account a callback lands on.
 *
 * The provider round-trip is driven through the real `worker/index.ts` with
 * `fetch` stubbed at the provider hosts, so the state cookie, the PKCE verifier,
 * the `state` echo and the account-resolution order are all exercised as one
 * flow rather than asserted piecemeal.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import worker from '../worker/index';
import { pkceChallenge, timingSafeEqual } from '../worker/crypto';
import { safeReturnTo, signState, verifyState } from '../worker/auth/state';
import { cookieName, isSecureRequest, serializeCookie } from '../worker/http';
import { cookieJar, makeEnv, makeRequest } from './worker-fakes';

const SECRET = 'test-secret-not-a-real-one';
const ORIGIN = 'https://deutsch.vitavision.dev';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// State cookie
// ---------------------------------------------------------------------------

describe('OAuth state', () => {
  const state = {
    provider: 'google',
    nonce: 'abc',
    verifier: 'v',
    returnTo: '/konto',
    expiresAt: 2_000_000,
  };

  test('round-trips', async () => {
    const signed = await signState(SECRET, state);
    expect(await verifyState(SECRET, signed, 1_000_000)).toEqual(state);
  });

  test('a corrupted payload is rejected', async () => {
    const signed = await signState(SECRET, state);
    const [payload, signature] = signed.split('.');
    const tampered = `${payload!.slice(0, -1)}${payload!.at(-1) === 'A' ? 'B' : 'A'}.${signature}`;
    expect(await verifyState(SECRET, tampered, 1_000_000)).toBeNull();
  });

  /**
   * The signature check, isolated.
   *
   * The corruption test above passes even with the HMAC comparison deleted —
   * the mangled base64 simply fails to parse, so it proves nothing about the
   * signature. This one substitutes a payload that decodes to *valid* state,
   * leaving the original signature in place, so only the HMAC can reject it.
   */
  test('a well-formed payload swapped under a valid signature is rejected', async () => {
    const signed = await signState(SECRET, state);
    const signature = signed.slice(signed.lastIndexOf('.') + 1);
    const forged = base64url(JSON.stringify({ ...state, provider: 'github', returnTo: '/' }));
    expect(await verifyState(SECRET, `${forged}.${signature}`, 1_000_000)).toBeNull();
  });

  test('another secret cannot forge one', async () => {
    const signed = await signState('someone-elses-secret', state);
    expect(await verifyState(SECRET, signed, 1_000_000)).toBeNull();
  });

  test('an expired state is rejected', async () => {
    const signed = await signState(SECRET, state);
    expect(await verifyState(SECRET, signed, 3_000_000)).toBeNull();
  });
});

describe('safeReturnTo', () => {
  test('keeps a same-origin path', () => {
    expect(safeReturnTo('/progress')).toBe('/progress');
  });

  test('refuses a protocol-relative URL — a browser reads //evil.com as a host', () => {
    expect(safeReturnTo('//evil.com')).toBe('/konto');
  });

  test('refuses an absolute URL', () => {
    expect(safeReturnTo('https://evil.com/x')).toBe('/konto');
  });
});

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe('crypto helpers', () => {
  // RFC 7636 Appendix B.
  test('pkceChallenge matches the RFC 7636 test vector', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  test('timingSafeEqual compares by value and by length', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('cookie attributes', () => {
  test('__Host- over https, and every attribute the prefix requires', () => {
    const secure = isSecureRequest(new URL(`${ORIGIN}/api/auth/session`));
    expect(secure).toBe(true);
    const cookie = serializeCookie(cookieName('da_session', secure), 'token', {
      secure,
      sameSite: 'Lax',
      maxAge: 60,
    });
    expect(cookie).toStartWith('__Host-da_session=token');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // A Domain attribute makes a __Host- cookie invalid and the browser drops it.
    expect(cookie).not.toContain('Domain');
  });

  test('plain name over http, because __Host- without Secure is dropped', () => {
    const secure = isSecureRequest(new URL('http://localhost:8787/api/auth/session'));
    expect(secure).toBe(false);
    expect(serializeCookie(cookieName('da_session', secure), 'token', { secure })).toStartWith(
      'da_session=token',
    );
  });
});

// ---------------------------------------------------------------------------
// The whole sign-in flow
// ---------------------------------------------------------------------------

interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Answer Google's token endpoint with an id_token carrying `profile`. */
function stubGoogle(profile: GoogleProfile): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const idToken = `header.${base64url(JSON.stringify(profile))}.signature`;
      return new Response(JSON.stringify({ id_token: idToken }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
}

function stubGithub(user: { id: number; name?: string }, emails: unknown[]): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'gh-token' }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === 'https://api.github.com/user') {
      return new Response(JSON.stringify(user), { headers: { 'content-type': 'application/json' } });
    }
    if (url === 'https://api.github.com/user/emails') {
      return new Response(JSON.stringify(emails), { headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
}

/** Run start → callback and return the callback's response plus the cookie jar. */
async function signIn(
  env: never,
  provider: 'google' | 'github',
): Promise<{ response: Response; cookies: string }> {
  const start = await worker.fetch(
    new Request(`${ORIGIN}/api/auth/${provider}/start?returnTo=/konto`),
    env,
  );
  const stateCookie = cookieJar(start);
  // The nonce the provider must echo back is the `state` query parameter.
  const nonce = new URL(start.headers.get('location')!).searchParams.get('state')!;
  const response = await worker.fetch(
    makeRequest(`${ORIGIN}/api/auth/${provider}/callback?code=xyz&state=${nonce}`, {
      cookie: stateCookie,
    }),
    env,
  );
  return { response, cookies: cookieJar(start, response) };
}

async function sessionOf(env: never, cookies: string) {
  const response = await worker.fetch(
    makeRequest(`${ORIGIN}/api/auth/session`, { cookie: cookies }),
    env,
  );
  return (await response.json()) as {
    signedIn: boolean;
    user?: { id: string; email: string; status: string; role: string; linked: string[] };
  };
}

describe('sign-in', () => {
  test('the start redirect carries PKCE for Google and a state cookie', async () => {
    const env = makeEnv();
    const start = await worker.fetch(new Request(`${ORIGIN}/api/auth/google/start`), env);
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get('location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(cookieJar(start)).toContain('__Host-da_oauth=');
  });

  test('GitHub gets no code_challenge — OAuth Apps do not support PKCE', async () => {
    const env = makeEnv();
    const start = await worker.fetch(new Request(`${ORIGIN}/api/auth/github/start`), env);
    const location = new URL(start.headers.get('location')!);
    expect(location.origin).toBe('https://github.com');
    expect(location.searchParams.get('code_challenge')).toBeNull();
  });

  test('a first sign-in creates a PENDING account — storage is not granted by signing in', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-1', email: 'neu@example.com', email_verified: true, name: 'Neu' });
    const { response, cookies } = await signIn(env, 'google');
    expect(response.status).toBe(302);

    const session = await sessionOf(env, cookies);
    expect(session.signedIn).toBe(true);
    expect(session.user?.status).toBe('pending');
    expect(session.user?.role).toBe('learner');
  });

  test('an email in OWNER_EMAILS is created approved and owner, with no manual D1 row', async () => {
    const env = makeEnv({ OWNER_EMAILS: 'chef@example.com, other@example.com' });
    stubGoogle({ sub: 'g-2', email: 'Chef@Example.com', email_verified: true });
    const { cookies } = await signIn(env, 'google');

    const session = await sessionOf(env, cookies);
    expect(session.user?.status).toBe('approved');
    expect(session.user?.role).toBe('owner');
    // Case-insensitively matched and stored normalized, or a capital letter would mint a second account.
    expect(session.user?.email).toBe('chef@example.com');
  });

  test('an unverified provider email is refused — it is the account-linking key', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-3', email: 'nicht@example.com', email_verified: false });
    const { response } = await signIn(env, 'google');
    expect(response.headers.get('location')).toBe('/konto?auth=email-unverified');
    // And no session was minted.
    expect(cookieJar(response)).not.toContain('da_session');
  });

  test('GitHub with no verified address is refused for the same reason', async () => {
    const env = makeEnv();
    stubGithub({ id: 77 }, [{ email: 'gh@example.com', primary: true, verified: false }]);
    const { response } = await signIn(env, 'github');
    expect(response.headers.get('location')).toBe('/konto?auth=email-unverified');
  });

  test('signing in with GitHub after Google finds the SAME account, not a second one', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-4', email: 'beide@example.com', email_verified: true });
    const first = await signIn(env, 'google');
    const firstSession = await sessionOf(env, first.cookies);

    stubGithub({ id: 4242, name: 'Beide' }, [
      { email: 'beide@example.com', primary: true, verified: true },
    ]);
    const second = await signIn(env, 'github');
    const secondSession = await sessionOf(env, second.cookies);

    expect(secondSession.user?.id).toBe(firstSession.user!.id);
    expect(secondSession.user?.linked.sort()).toEqual(['github', 'google']);
  });

  test('a state that does not match the cookie is refused', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-5', email: 'x@example.com', email_verified: true });
    const start = await worker.fetch(new Request(`${ORIGIN}/api/auth/google/start`), env);
    const response = await worker.fetch(
      makeRequest(`${ORIGIN}/api/auth/google/callback?code=xyz&state=not-the-nonce`, {
        cookie: cookieJar(start),
      }),
      env,
    );
    expect(response.headers.get('location')).toBe('/konto?auth=state');
  });

  test('a callback with no state cookie at all is refused', async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request(`${ORIGIN}/api/auth/google/callback?code=xyz&state=anything`),
      env,
    );
    expect(response.headers.get('location')).toBe('/konto?auth=state');
  });

  test('logout drops the session and the cookie', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-6', email: 'tschuess@example.com', email_verified: true });
    const { cookies } = await signIn(env, 'google');
    expect((await sessionOf(env, cookies)).signedIn).toBe(true);

    const out = await worker.fetch(
      makeRequest(`${ORIGIN}/api/auth/logout`, {
        method: 'POST',
        cookie: cookies,
        origin: ORIGIN,
      }),
      env,
    );
    expect(out.status).toBe(200);
    expect((await sessionOf(env, cookies)).signedIn).toBe(false);
  });

  test('a cross-origin logout is refused even with a valid cookie', async () => {
    const env = makeEnv();
    stubGoogle({ sub: 'g-7', email: 'csrf@example.com', email_verified: true });
    const { cookies } = await signIn(env, 'google');
    const out = await worker.fetch(
      makeRequest(`${ORIGIN}/api/auth/logout`, {
        method: 'POST',
        cookie: cookies,
        origin: 'https://evil.example',
      }),
      env,
    );
    expect(out.status).toBe(403);
    expect((await sessionOf(env, cookies)).signedIn).toBe(true);
  });
});

describe('routing', () => {
  test('anything that is not /api/ is handed to the asset server untouched', async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request(`${ORIGIN}/topics/a1/artikel`), env);
    expect(await response.text()).toBe('asset');
  });

  test('every API response is no-store', async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request(`${ORIGIN}/api/auth/session`), env);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
