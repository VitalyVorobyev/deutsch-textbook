/**
 * Device pairing — how the desktop app gets a device token.
 *
 * The alternative it replaces was: mint a token in the browser, read 43 base64
 * characters off one screen, type them into another. That is not a security
 * control, it is a transcription task, and the thing being transcribed is a
 * bearer credential — so it ends up in a clipboard, a note, or a screenshot.
 *
 * This is the OAuth 2.0 Device Authorization Grant (RFC 8628) shape, minus the
 * OAuth: the desktop asks for a pairing, shows a short code, and polls; the
 * learner types that code on `/konto` in a browser where they are already
 * signed in. Two credentials, two different jobs:
 *
 *   device code  256 bits, never displayed, held only by the desktop. Whoever
 *                holds it receives the token. Hashed at rest.
 *   user code    8 symbols, displayed on both screens. Approving is all it can
 *                do, and only from an authenticated, approved session.
 *
 * The learner **types** the code rather than following a link that carries it.
 * That is the documented mitigation for the grant's one real weakness: an
 * attacker who starts their own pairing and talks a victim into approving it
 * walks away with a token on the victim's account. A code that must be read off
 * the device in front of you does not travel in a message.
 *
 * `/api/pair/start` and `/api/pair/poll` are unauthenticated because they must
 * be — the desktop has no credential yet, which is the entire problem. Neither
 * reveals anything: start returns codes it just generated, and poll answers
 * `pending` for every device code that is not both real and approved.
 */
import {
  countPendingPairings,
  createPairingRequest,
  approvePairing as dbApprovePairing,
  deletePairing,
  findPairingByDeviceCode,
  findPairingByUserCode,
  listDeviceTokens,
  newUserCode,
  normalizeUserCode,
  purgeExpiredPairings,
  touchPairingPoll,
  createDeviceToken,
  findUserById,
} from '../db';
import { DEVICE_TOKEN_PREFIX, authenticate } from '../auth/session';
import { randomToken } from '../crypto';
import { isSameOrigin, json, methodNotAllowed, problem, readJson } from '../http';
import type { Env } from '../env';

/** Prefix for the device code. Distinct from `dat_` on purpose — see where it is minted. */
export const PAIRING_CODE_PREFIX = 'dpc_';

/** Ten minutes. Long enough to walk to another device, short enough that an abandoned row is gone before it matters. */
export const PAIRING_TTL_MS = 10 * 60 * 1000;

/** Seconds the desktop is asked to wait between polls; enforced, not suggested. */
export const PAIRING_POLL_INTERVAL_S = 3;

/**
 * A ceiling on simultaneously pending pairings across the whole instance.
 *
 * `/api/pair/start` writes a D1 row for an anonymous caller, so it needs *some*
 * bound. This one is deliberately crude: it is a cap on litter, not a rate
 * limiter, and at a ten-minute TTL it would take sustained abuse to reach.
 */
export const MAX_PENDING_PAIRINGS = 200;

/** Mirrors the ceiling in routes/tokens.ts — pairing must not be a way around it. */
const MAX_TOKENS = 10;

export async function handlePairing(
  request: Request,
  env: Env,
  url: URL,
  segments: string[],
  secure: boolean,
  now: number,
): Promise<Response> {
  const [action] = segments;

  if (action === 'start') return start(request, env, now);
  if (action === 'poll') return poll(request, env, now);
  if (action === 'request') return describe(request, env, secure, now);
  if (action === 'approve') return approve(request, env, url, secure, now);

  return problem(404, 'not-found', 'Unknown pairing route.');
}

/** The desktop opens a pairing. No credential exists yet — that is what this is for. */
async function start(request: Request, env: Env, now: number): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  await purgeExpiredPairings(env.DB, now);
  if ((await countPendingPairings(env.DB, now)) >= MAX_PENDING_PAIRINGS) {
    return problem(503, 'busy', 'Too many pending pairings. Try again shortly.');
  }

  const body = await readJson<{ label?: string }>(request);
  const label = (body?.label ?? '').trim().slice(0, 60) || 'Desktop';
  // Deliberately *not* the `dat_` prefix: a pairing code is not a credential
  // for anything, and the two must not be mistakable for one another in a log,
  // a bug report or a paste.
  const deviceCode = `${PAIRING_CODE_PREFIX}${randomToken(32)}`;

  // A UNIQUE collision is a coincidence, not a condition; retry rather than fail.
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = newUserCode();
    try {
      await createPairingRequest(env.DB, {
        deviceCode,
        userCode,
        label,
        now,
        expiresAt: now + PAIRING_TTL_MS,
      });
      return json(
        {
          deviceCode,
          userCode,
          label,
          expiresAt: now + PAIRING_TTL_MS,
          interval: PAIRING_POLL_INTERVAL_S,
        },
        { status: 201 },
      );
    } catch {
      continue;
    }
  }

  return problem(503, 'busy', 'Could not allocate a pairing code.');
}

/**
 * The desktop asks whether it has been approved yet, and collects its token.
 *
 * Answers `pending` for an unknown device code as readily as for a real one: a
 * caller who is guessing learns nothing from the difference, and there is
 * nothing useful to tell them.
 */
async function poll(request: Request, env: Env, now: number): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const body = await readJson<{ deviceCode?: string }>(request);
  const deviceCode = (body?.deviceCode ?? '').trim();
  if (!deviceCode) return problem(400, 'bad-request', 'No device code.');

  const row = await findPairingByDeviceCode(env.DB, deviceCode, now);
  if (!row) return json({ state: 'expired' });

  if (row.polled_at !== null && now - row.polled_at < PAIRING_POLL_INTERVAL_S * 1000) {
    return json({ state: 'slow-down', interval: PAIRING_POLL_INTERVAL_S }, { status: 429 });
  }
  await touchPairingPoll(env.DB, row.id, now);

  if (!row.approved_user_id) return json({ state: 'pending', interval: PAIRING_POLL_INTERVAL_S });

  // Approved between polls. Mint the token now and drop the row in the same
  // step, so no readable credential is ever at rest and no code redeems twice.
  const user = await findUserById(env.DB, row.approved_user_id);
  if (!user || user.status !== 'approved') {
    await deletePairing(env.DB, row.id);
    return json({ state: 'expired' });
  }

  const existing = await listDeviceTokens(env.DB, user.id);
  if (existing.length >= MAX_TOKENS) {
    await deletePairing(env.DB, row.id);
    return problem(409, 'too-many', `At most ${MAX_TOKENS} devices. Revoke one first.`);
  }

  const token = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
  await createDeviceToken(env.DB, { userId: user.id, token, label: row.label, now });
  await deletePairing(env.DB, row.id);

  // The only time this value is ever readable.
  return json({ state: 'approved', token, label: row.label });
}

/**
 * What the learner is about to approve.
 *
 * Cookie-only and approved-only, like `approve` itself: this exists so the
 * browser can show the label and the code before anything is granted, and an
 * endpoint that confirms which pairing codes are live should not answer to an
 * anonymous caller.
 */
async function describe(
  request: Request,
  env: Env,
  secure: boolean,
  now: number,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const gate = await approverGate(request, env, secure, now);
  if ('response' in gate) return gate.response;

  const url = new URL(request.url);
  const code = normalizeUserCode(url.searchParams.get('code') ?? '');
  const row = code ? await findPairingByUserCode(env.DB, code, now) : null;
  if (!row) return problem(404, 'not-found', 'No pending pairing with that code.');

  return json({
    userCode: row.user_code,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approved: row.approved_user_id !== null,
  });
}

/** The learner grants the pairing. Cookie-only: a device token must not mint another. */
async function approve(
  request: Request,
  env: Env,
  url: URL,
  secure: boolean,
  now: number,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request, url)) {
    return problem(403, 'cross-origin', 'Cross-origin request refused.');
  }

  const gate = await approverGate(request, env, secure, now);
  if ('response' in gate) return gate.response;

  const body = await readJson<{ userCode?: string }>(request);
  const code = normalizeUserCode(body?.userCode ?? '');
  if (!code) return problem(400, 'bad-request', 'No code.');

  const changed = await dbApprovePairing(env.DB, code, gate.userId, now);
  if (changed === 0) {
    // Unknown, expired or already approved — all the same answer, because the
    // difference is only interesting to someone trying codes.
    return problem(404, 'not-found', 'No pending pairing with that code.');
  }

  return json({ ok: true });
}

/**
 * Who may approve a pairing: a browser session, on an approved account.
 *
 * `via !== 'cookie'` is the rule that keeps a leaked device token from being a
 * self-renewing foothold — the same reason `/api/tokens` refuses one. Pairing
 * would otherwise be a second door into the room that door was locking.
 */
async function approverGate(
  request: Request,
  env: Env,
  secure: boolean,
  now: number,
): Promise<{ userId: string } | { response: Response }> {
  const principal = await authenticate(request, env, secure, now);
  if (!principal) return { response: problem(401, 'signed-out', 'Not signed in.') };
  if (principal.via !== 'cookie') {
    return {
      response: problem(403, 'cookie-required', 'Sign in in a browser to approve a device.'),
    };
  }
  if (principal.user.status !== 'approved') {
    return { response: problem(403, principal.user.status, 'This account cannot sync yet.') };
  }
  return { userId: principal.user.id };
}
