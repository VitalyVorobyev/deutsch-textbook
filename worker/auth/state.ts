/**
 * The OAuth `state` — carried in a signed, short-lived cookie rather than a D1 row.
 *
 * A table would mean one write and one read per sign-in attempt, plus a sweeper
 * for the rows nobody ever completes. An HMAC over the payload gives the same
 * guarantee with no storage: the callback can prove the state it was handed is
 * one this Worker issued, minutes ago, for this provider.
 *
 * SameSite=Lax is correct here even though the cookie must survive a redirect
 * *from* the provider: that redirect is a top-level GET navigation, which Lax
 * allows. SameSite=None would be strictly weaker for no benefit.
 */
import { hmacSign, randomToken, timingSafeEqual } from '../crypto';
import { base64UrlDecode, base64UrlEncode } from '../crypto';

export const OAUTH_COOKIE = 'da_oauth';
/** Long enough for a password manager and a 2FA prompt, short enough to be uninteresting to steal. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthState {
  provider: string;
  /** The random value echoed back by the provider. */
  nonce: string;
  /** PKCE verifier, when the provider supports it. */
  verifier?: string;
  /** Same-origin path to land on after the callback. */
  returnTo: string;
  expiresAt: number;
}

const encoder = new TextEncoder();

function encodePayload(state: OAuthState): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(state)));
}

export async function signState(secret: string, state: OAuthState): Promise<string> {
  const payload = encodePayload(state);
  return `${payload}.${await hmacSign(secret, payload)}`;
}

/**
 * Verify and decode. Returns null for a tampered, malformed or expired value —
 * the caller cannot distinguish them, and does not need to.
 */
export async function verifyState(
  secret: string,
  value: string | undefined,
  now: number,
): Promise<OAuthState | null> {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!timingSafeEqual(signature, await hmacSign(secret, payload))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const state = parsed as Partial<OAuthState>;
  if (
    typeof state.provider !== 'string' ||
    typeof state.nonce !== 'string' ||
    typeof state.returnTo !== 'string' ||
    typeof state.expiresAt !== 'number'
  ) {
    return null;
  }
  if (state.expiresAt <= now) return null;
  return {
    provider: state.provider,
    nonce: state.nonce,
    verifier: typeof state.verifier === 'string' ? state.verifier : undefined,
    returnTo: state.returnTo,
    expiresAt: state.expiresAt,
  };
}

export function newNonce(): string {
  return randomToken(16);
}

/** PKCE verifiers must be 43–128 unreserved characters (RFC 7636 §4.1); 32 random bytes base64url is 43. */
export function newVerifier(): string {
  return randomToken(32);
}

/**
 * Where to send the learner after the callback.
 *
 * Only a same-origin absolute path is ever accepted. Echoing back an arbitrary
 * `returnTo` is how a sign-in endpoint becomes an open redirect, and `//evil.com`
 * is a path-looking string that a browser resolves as a host.
 */
export function safeReturnTo(raw: string | null, fallback = '/konto'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}
