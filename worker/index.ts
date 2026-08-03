/**
 * Deutsch-Atlas Worker.
 *
 * The site is still a static build; this entry exists for `/api/*` alone.
 * Anything else is handed straight back to the asset server, which applies
 * `not_found_handling` and `public/_headers` exactly as it did when there was
 * no `main` at all — so adding a server did not make the site dynamic.
 *
 * Design notes worth reading before changing anything here:
 * - `docs/cloud-sync.md` — why the server stores opaque bytes, why the approval
 *   gate, why conditional PUT rather than a version column.
 * - `worker/routes/sync.ts` — the snapshot contract itself.
 *
 * The `/api` prefix is matched at the root because the deployment serves at the
 * root (`BASE_PATH` is unset — see wrangler.toml). A subpath mirror would need
 * the base stripped here; the client already goes through `withBase`.
 */
import { handleAdmin } from './routes/admin';
import { handleAuth } from './routes/auth';
import { handlePairing } from './routes/pairing';
import { handleSync } from './routes/sync';
import { handleTokens } from './routes/tokens';
import { isSecureRequest, problem } from './http';
import type { Env } from './env';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const segments = url.pathname.slice('/api/'.length).split('/').filter(Boolean);
    const [area, ...rest] = segments;
    const secure = isSecureRequest(url);
    const now = Date.now();

    try {
      switch (area) {
        case 'auth':
          return await handleAuth(request, env, url, rest, secure, now);
        case 'sync':
          return await handleSync(request, env, url, rest, secure, now);
        case 'tokens':
          return await handleTokens(request, env, url, rest, secure, now);
        case 'pair':
          return await handlePairing(request, env, url, rest, secure, now);
        case 'admin':
          return await handleAdmin(request, env, url, rest, secure, now);
        default:
          return problem(404, 'not-found', 'Unknown API route.');
      }
    } catch (error) {
      // Never let a provider outage or a malformed row reach the learner as a
      // stack trace: the client treats any non-2xx as "sync unavailable" and
      // keeps working locally, which is the correct behaviour for all of them.
      console.error('[api]', url.pathname, error);
      return problem(500, 'internal', 'The sync service failed.');
    }
  },
} satisfies ExportedHandler<Env>;
