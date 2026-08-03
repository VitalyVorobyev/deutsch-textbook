/**
 * `bun run deploy:smoke` — the assertions, without the network.
 *
 * The check exists for a failure every other gate passed: on 2026-08-03 a deploy
 * removed the Worker's secrets, so `/api/auth/session` reported `providers: []`
 * and /konto rendered no sign-in buttons at all. Nothing in the repo was wrong,
 * so nothing in the repo could see it.
 *
 * These tests hold the two properties that make the check worth having: it must
 * go red on exactly that response, and it must not go red on a healthy one.
 */
import { describe, expect, test } from 'bun:test';
import { type Check, type Probe, checks, parseArgs } from '../scripts/deploy-smoke';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  vary: 'Cookie, Authorization',
};

function check(name: string, deep = false): Check {
  const found = checks(deep).find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no check named "${name}"`);
  return found;
}

/** A probe fixture states every field the assertion reads — nothing is inherited from a default. */
function probe(over: Partial<Probe> = {}): Probe {
  return { status: 200, headers: { ...JSON_HEADERS }, body: '', ...over };
}

function session(providers: string[]): Probe {
  return probe({ body: JSON.stringify({ signedIn: false, providers }) });
}

describe('arguments', () => {
  test('the default origin is the live site, and a trailing slash is not doubled', () => {
    expect(parseArgs([]).origin).toBe('https://deutsch.vitavision.dev');
    expect(parseArgs(['--origin', 'http://localhost:8787/']).origin).toBe('http://localhost:8787');
    expect(parseArgs([]).deep).toBe(false);
    expect(parseArgs(['--deep']).deep).toBe(true);
  });

  test('an unknown argument is refused rather than ignored', () => {
    expect(() => parseArgs(['--orgin', 'x'])).toThrow(/Unknown argument/);
  });
});

describe('the check that would have caught 2026-08-03', () => {
  const providersCheck = check('sign-in providers are configured');

  test('an empty provider list fails, and says where to look', () => {
    // This is the exact body the live site returned while sign-in was impossible.
    const problem = providersCheck.verify(session([]));
    expect(problem).toContain('providers is empty');
    expect(problem).toContain('wrangler secret list');
  });

  test('a configured deployment passes', () => {
    expect(providersCheck.verify(session(['google', 'github']))).toBeNull();
  });

  test('the site 404 page answering instead of the Worker is not mistaken for health', () => {
    // Without a Worker, /api/auth/session is just an unknown path.
    expect(providersCheck.verify(probe({ status: 404, body: '<!doctype html>' }))).toContain('404');
  });

  test('a signed-in response is refused — the check must run unauthenticated', () => {
    const body = JSON.stringify({ signedIn: true, providers: ['google'] });
    expect(providersCheck.verify(probe({ body }))).toContain('signedIn');
  });
});

describe('the sign-in redirect', () => {
  const google = check('Google sign-in reaches Google');

  test('a redirect back to ?auth=provider-unavailable names the missing secrets', () => {
    const headers = { location: '/konto?auth=provider-unavailable' };
    expect(google.verify(probe({ status: 302, headers }))).toContain('SESSION_SECRET');
  });

  test('a redirect to Google passes', () => {
    const headers = { location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x' };
    expect(google.verify(probe({ status: 302, headers }))).toBeNull();
  });
});

describe('the checks that are not about auth', () => {
  test('an unauthenticated sync read must be refused, not merely absent', () => {
    const sync = check('sync refuses an unauthenticated caller');
    expect(sync.verify(probe({ status: 401 }))).toBeNull();
    expect(sync.verify(probe({ status: 200 }))).toContain('expected 401');
    // 404 means the asset server answered and the Worker is not in front of /api.
    expect(sync.verify(probe({ status: 404 }))).toContain('expected 401');
  });

  test("Cloudflare's own error page does not count as the site's 404", () => {
    const notFound = check("unknown paths get the site's own 404 page");
    expect(notFound.verify(probe({ status: 404, body: '<title>Error 404</title>' }))).toContain(
      'not the site 404 page',
    );
    expect(
      notFound.verify(probe({ status: 404, body: '<title>Seite nicht gefunden · Deutsch-Atlas</title>' })),
    ).toBeNull();
  });

  test('an API response that could be cached fails', () => {
    const caching = check('API responses are never cached');
    expect(caching.verify(probe())).toBeNull();
    expect(caching.verify(probe({ headers: { 'cache-control': 'public, max-age=60' } }))).toContain(
      'cache-control',
    );
    expect(
      caching.verify(probe({ headers: { 'cache-control': 'no-store', vary: 'Accept-Encoding' } })),
    ).toContain('Cookie');
  });
});

describe('--deep', () => {
  test('the D1 probe is opt-in, because it is the only check that writes', () => {
    expect(checks(false).some((c) => c.method === 'POST')).toBe(false);
    expect(checks(true).some((c) => c.path === '/api/pair/start')).toBe(true);
  });

  test('it fails when the pairing table is missing rather than reporting success', () => {
    const d1 = check('D1 is reachable and migrated', true);
    expect(d1.verify(probe({ status: 500, body: '{"error":"internal"}' }))).toContain('expected 201');
    const body = JSON.stringify({ deviceCode: 'dpc_abc', userCode: 'U33W2UX2' });
    expect(d1.verify(probe({ status: 201, body }))).toBeNull();
  });
});
