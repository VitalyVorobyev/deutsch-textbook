/**
 * Device tokens — the desktop app's way in.
 *
 * The Tauri webview is a different origin (`tauri://localhost`), so the session
 * cookie cannot reach it and no amount of CORS makes an HttpOnly same-site
 * cookie cross-origin. The desktop therefore carries an explicit bearer
 * credential, issued here from a real browser session.
 *
 * The token is shown **once**. Only sha256(token) is stored, so there is no
 * later opportunity to display it — which is the point: a value the server can
 * still read is a value a database leak can replay.
 */
import {
  TOKEN_REF_LENGTH,
  createDeviceToken,
  deleteDeviceToken,
  listDeviceTokens,
  tokenRef,
} from '../db';
import { DEVICE_TOKEN_PREFIX, authenticate } from '../auth/session';
import { randomToken } from '../crypto';
import { isSameOrigin, json, methodNotAllowed, noContent, problem, readJson } from '../http';
import type { Env } from '../env';

const MAX_TOKENS = 10;

export async function handleTokens(
  request: Request,
  env: Env,
  url: URL,
  segments: string[],
  secure: boolean,
  now: number,
): Promise<Response> {
  const principal = await authenticate(request, env, secure, now);
  if (!principal) return problem(401, 'signed-out', 'Not signed in.');
  // A device token must not be able to mint more device tokens: one leaked
  // string would otherwise be a self-renewing foothold.
  if (principal.via !== 'cookie') {
    return problem(403, 'cookie-required', 'Sign in in a browser to manage devices.');
  }
  if (principal.user.status !== 'approved') {
    return problem(403, principal.user.status, 'This account cannot sync yet.');
  }

  const [ref] = segments;

  if (segments.length === 0) {
    if (request.method === 'GET') {
      const tokens = await listDeviceTokens(env.DB, principal.user.id);
      return json({
        tokens: tokens.map((token) => ({
          ref: tokenRef(token.id),
          label: token.label,
          createdAt: token.created_at,
          lastUsedAt: token.last_used_at,
        })),
      });
    }

    if (request.method === 'POST') {
      if (!isSameOrigin(request, url)) return problem(403, 'cross-origin', 'Cross-origin request refused.');
      const existing = await listDeviceTokens(env.DB, principal.user.id);
      if (existing.length >= MAX_TOKENS) {
        return problem(409, 'too-many', `At most ${MAX_TOKENS} devices. Revoke one first.`);
      }
      const body = await readJson<{ label?: string }>(request);
      const label = (body?.label ?? '').trim().slice(0, 60) || 'Gerät';
      const token = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
      await createDeviceToken(env.DB, { userId: principal.user.id, token, label, now });
      // The only time this value is ever readable.
      return json({ token, label }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (segments.length === 1 && ref) {
    if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
    if (!isSameOrigin(request, url)) return problem(403, 'cross-origin', 'Cross-origin request refused.');
    if (ref.length !== TOKEN_REF_LENGTH) return problem(400, 'bad-ref', 'Malformed device reference.');
    const removed = await deleteDeviceToken(env.DB, principal.user.id, ref);
    if (removed === 0) return problem(404, 'not-found', 'No such device.');
    return noContent();
  }

  return problem(404, 'not-found', 'Unknown device route.');
}
