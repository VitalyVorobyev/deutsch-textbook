/**
 * Post-deploy smoke check against a live origin.
 *
 * It exists because of a failure with no symptom: on 2026-08-03 a build of the
 * *old*, assets-only `wrangler.toml` landed on the same Worker and replaced its
 * whole binding set, taking all six secrets with it. Every gate stayed green —
 * `bun test`, `astro check`, the build, and the Cloudflare deploy — and the
 * site kept serving. Only `/konto` changed, and it changed to *nothing*: with
 * no provider secrets, `/api/auth/session` reports `providers: []` and the
 * sign-in row renders zero buttons. Nothing in this repo could see it, because
 * nothing in this repo was wrong.
 *
 * So the checks below are deliberately not unit tests of the Worker. They are
 * questions only the deployed thing can answer: are the bindings still there,
 * is the API still in front of the assets, is auth still enforced.
 *
 * Usage:
 *   bun run deploy:smoke
 *   bun run deploy:smoke --origin http://localhost:8787
 *   bun run deploy:smoke --deep        # also proves D1 (writes one expiring row)
 */

const DEFAULT_ORIGIN = 'https://deutsch.vitavision.dev';

/** A path no build will ever emit, used to check the site's own 404 page still serves. */
const MISSING_PATH = '/dieses-dokument-gibt-es-nicht-xyz';

export interface Options {
  origin: string;
  deep: boolean;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { origin: DEFAULT_ORIGIN, deep: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--origin') {
      const value = argv[++i];
      if (!value) throw new Error('--origin needs a value.');
      options.origin = value.replace(/\/+$/, '');
    } else if (arg === '--deep') options.deep = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/** What a check gets to look at. Flat and plain so a test can build one by hand. */
export interface Probe {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface Check {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  /** Return null when the deployment is healthy, or one line saying what is wrong. */
  verify: (probe: Probe) => string | null;
}

function parseJson(probe: Probe): unknown {
  try {
    return JSON.parse(probe.body);
  } catch {
    return undefined;
  }
}

export function checks(deep: boolean): Check[] {
  const list: Check[] = [
    {
      name: 'site root serves',
      method: 'GET',
      path: '/',
      verify: (probe) => (probe.status === 200 ? null : `expected 200, got ${probe.status}`),
    },
    {
      name: 'sign-in providers are configured',
      method: 'GET',
      path: '/api/auth/session',
      verify: (probe) => {
        if (probe.status !== 200) return `expected 200, got ${probe.status}`;
        const body = parseJson(probe) as { signedIn?: unknown; providers?: unknown } | undefined;
        if (!body) return `expected JSON, got ${probe.body.slice(0, 60)}`;
        if (body.signedIn !== false) return `expected signedIn:false, got ${String(body.signedIn)}`;
        if (!Array.isArray(body.providers)) return 'no providers array in the session response';
        // The one that would have caught 2026-08-03: an empty list is a Worker
        // with no OAuth secrets, and /konto then offers nothing to click.
        if (body.providers.length === 0) {
          return 'providers is empty — the Worker has no OAuth secrets (bunx wrangler secret list --name deutsch-textbook)';
        }
        return null;
      },
    },
    {
      name: 'API responses are never cached',
      method: 'GET',
      path: '/api/auth/session',
      verify: (probe) => {
        const cacheControl = probe.headers['cache-control'] ?? '';
        if (!cacheControl.includes('no-store')) return `cache-control is "${cacheControl}"`;
        const vary = probe.headers['vary'] ?? '';
        if (!/cookie/i.test(vary)) return `vary is "${vary}", which does not name Cookie`;
        return null;
      },
    },
    {
      name: 'Google sign-in reaches Google',
      method: 'GET',
      path: '/api/auth/google/start',
      verify: (probe) => {
        if (probe.status !== 302) return `expected 302, got ${probe.status}`;
        const location = probe.headers['location'] ?? '';
        if (location.includes('auth=provider-unavailable')) {
          return 'redirected to ?auth=provider-unavailable — GOOGLE_CLIENT_ID/SECRET or SESSION_SECRET is missing';
        }
        if (!location.startsWith('https://accounts.google.com/')) {
          return `redirected to "${location}" instead of accounts.google.com`;
        }
        return null;
      },
    },
    {
      name: 'GitHub sign-in reaches GitHub',
      method: 'GET',
      path: '/api/auth/github/start',
      verify: (probe) => {
        if (probe.status !== 302) return `expected 302, got ${probe.status}`;
        const location = probe.headers['location'] ?? '';
        if (location.includes('auth=provider-unavailable')) {
          return 'redirected to ?auth=provider-unavailable — GITHUB_CLIENT_ID/SECRET or SESSION_SECRET is missing';
        }
        if (!location.startsWith('https://github.com/login/oauth/authorize')) {
          return `redirected to "${location}" instead of github.com/login/oauth/authorize`;
        }
        return null;
      },
    },
    {
      name: 'sync refuses an unauthenticated caller',
      method: 'GET',
      path: '/api/sync/snapshot',
      verify: (probe) => {
        // 404 here would mean the Worker is absent and the asset server answered;
        // 200 would mean a stranger can read a learner's progress.
        if (probe.status !== 401) return `expected 401, got ${probe.status}`;
        return null;
      },
    },
    {
      name: "unknown paths get the site's own 404 page",
      method: 'GET',
      path: MISSING_PATH,
      verify: (probe) => {
        if (probe.status !== 404) return `expected 404, got ${probe.status}`;
        // Cloudflare's default error page would pass the status check alone.
        if (!probe.body.includes('Deutsch-Atlas')) return 'not the site 404 page';
        return null;
      },
    },
  ];

  if (deep) {
    list.push({
      name: 'D1 is reachable and migrated',
      method: 'POST',
      path: '/api/pair/start',
      verify: (probe) => {
        if (probe.status !== 201) return `expected 201, got ${probe.status}`;
        const body = parseJson(probe) as { deviceCode?: unknown; userCode?: unknown } | undefined;
        if (typeof body?.deviceCode !== 'string' || !body.deviceCode.startsWith('dpc_')) {
          return 'no device code in the response';
        }
        if (typeof body?.userCode !== 'string' || body.userCode.length !== 8) {
          return `expected an 8-symbol user code, got ${String(body?.userCode)}`;
        }
        return null;
      },
    });
  }

  return list;
}

async function probe(origin: string, check: Check): Promise<Probe> {
  const response = await fetch(`${origin}${check.path}`, {
    method: check.method,
    // Manual, because a redirect *is* the answer for the two sign-in checks.
    redirect: 'manual',
    headers:
      check.method === 'POST'
        ? { 'content-type': 'application/json', origin }
        : { origin },
    body: check.method === 'POST' ? '{"label":"deploy:smoke"}' : undefined,
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, body: await response.text() };
}

export async function runDeploySmoke(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const problems: string[] = [];

  for (const check of checks(options.deep)) {
    let result: string | null;
    try {
      result = check.verify(await probe(options.origin, check));
    } catch (error) {
      result = `request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.log(`${result === null ? 'ok  ' : 'FAIL'}  ${check.name}`);
    if (result !== null) problems.push(`${check.name} (${check.method} ${check.path}): ${result}`);
  }

  if (problems.length) {
    console.error(`\n${options.origin} failed ${problems.length} check(s):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n${options.origin} is healthy.`);
}

if (import.meta.main) await runDeploySmoke();
