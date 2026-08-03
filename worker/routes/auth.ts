/**
 * Sign-in, sign-out, and "who am I".
 *
 * The one rule that shapes the callback: **a new account is created `pending`
 * and pending grants no storage.** Anyone may start a sign-in — that is what
 * makes it self-serve — but nothing is written to R2 on their behalf until the
 * owner approves them on /konto. So the abuse surface of a public sign-in
 * button is one D1 row, not an open object store.
 *
 * Failures redirect back to the page the learner came from with `?auth=<code>`
 * rather than answering JSON: this endpoint is reached by a top-level browser
 * navigation, and a raw error document is a dead end.
 */
import {
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  findUserByEmail,
  findUserByIdentity,
  linkIdentity,
  listIdentityProviders,
  normalizeEmail,
  pruneSessions,
  reconcileUser,
  type UserRow,
} from '../db';
import {
  authenticate,
  clearedSessionCookie,
  readSessionToken,
  sessionCookie,
} from '../auth/session';
import {
  OAUTH_COOKIE,
  OAUTH_STATE_TTL_MS,
  newNonce,
  newVerifier,
  safeReturnTo,
  signState,
  verifyState,
} from '../auth/state';
import { PROVIDERS, configuredProviders, isProviderId } from '../auth/providers';
import { pkceChallenge, randomToken } from '../crypto';
import {
  clearCookie,
  cookieName,
  isSameOrigin,
  json,
  methodNotAllowed,
  parseCookies,
  problem,
  readCookie,
  redirect,
  serializeCookie,
} from '../http';
import type { Env } from '../env';
import { deleteAllSnapshots } from './sync';

function ownerEmails(env: Env): string[] {
  return (env.OWNER_EMAILS ?? '')
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

function publicUser(user: UserRow, linked: string[]) {
  return {
    // The account id is also the R2 prefix; /konto shows it so `bun run progress:pull` can be pointed at it.
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    status: user.status,
    role: user.role,
    linked,
  };
}

export async function handleAuth(
  request: Request,
  env: Env,
  url: URL,
  segments: string[],
  secure: boolean,
  now: number,
): Promise<Response> {
  const [first, second] = segments;

  if (first === 'session' && segments.length === 1) {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return sessionInfo(request, env, secure, now);
  }

  if (first === 'logout' && segments.length === 1) {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    if (!isSameOrigin(request, url)) return problem(403, 'cross-origin', 'Cross-origin request refused.');
    const token = readSessionToken(request, secure);
    if (token) await deleteSession(env.DB, token);
    return json({ signedIn: false }, { cookies: [clearedSessionCookie(secure)] });
  }

  if (first === 'account' && segments.length === 1) {
    if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
    return deleteOwnAccount(request, env, url, secure, now);
  }

  if (first && isProviderId(first) && (second === 'start' || second === 'callback')) {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return second === 'start'
      ? startSignIn(env, url, first, secure, now)
      : completeSignIn(request, env, url, first, secure, now);
  }

  return problem(404, 'not-found', 'Unknown auth route.');
}

async function sessionInfo(request: Request, env: Env, secure: boolean, now: number): Promise<Response> {
  const providers = configuredProviders(env);
  const principal = await authenticate(request, env, secure, now);
  if (!principal) {
    return json({ signedIn: false, providers });
  }
  // Cheap and self-limiting: the only table that grows without a learner action.
  await pruneSessions(env.DB, now);
  const linked = await listIdentityProviders(env.DB, principal.user.id);
  return json(
    { signedIn: true, providers, via: principal.via, user: publicUser(principal.user, linked) },
    { cookies: principal.refreshedCookie ? [principal.refreshedCookie] : [] },
  );
}

async function deleteOwnAccount(
  request: Request,
  env: Env,
  url: URL,
  secure: boolean,
  now: number,
): Promise<Response> {
  if (!isSameOrigin(request, url)) return problem(403, 'cross-origin', 'Cross-origin request refused.');
  const principal = await authenticate(request, env, secure, now);
  if (!principal) return problem(401, 'signed-out', 'Not signed in.');
  // Deleting an account is not something a pasted device token should be able to do.
  if (principal.via !== 'cookie') return problem(403, 'cookie-required', 'Sign in in a browser to delete the account.');
  await deleteAllSnapshots(env, principal.user.id);
  await deleteUser(env.DB, principal.user.id);
  return json({ signedIn: false }, { cookies: [clearedSessionCookie(secure)] });
}

function failed(returnTo: string, code: string): Response {
  const separator = returnTo.includes('?') ? '&' : '?';
  return redirect(`${returnTo}${separator}auth=${encodeURIComponent(code)}`);
}

async function startSignIn(
  env: Env,
  url: URL,
  providerId: 'google' | 'github',
  secure: boolean,
  now: number,
): Promise<Response> {
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const provider = PROVIDERS[providerId];
  const credentials = provider.credentials(env);
  if (!credentials) return failed(returnTo, 'provider-unavailable');
  if (!env.SESSION_SECRET) return failed(returnTo, 'misconfigured');

  const nonce = newNonce();
  const verifier = provider.usesPkce ? newVerifier() : undefined;
  const signed = await signState(env.SESSION_SECRET, {
    provider: providerId,
    nonce,
    verifier,
    returnTo,
    expiresAt: now + OAUTH_STATE_TTL_MS,
  });

  const location = provider.authorizeUrl({
    credentials,
    redirectUri: `${url.origin}/api/auth/${providerId}/callback`,
    state: nonce,
    challenge: verifier ? await pkceChallenge(verifier) : undefined,
  });

  return redirect(location, [
    serializeCookie(cookieName(OAUTH_COOKIE, secure), signed, {
      secure,
      sameSite: 'Lax',
      maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
    }),
  ]);
}

async function completeSignIn(
  request: Request,
  env: Env,
  url: URL,
  providerId: 'google' | 'github',
  secure: boolean,
  now: number,
): Promise<Response> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const dropState = clearCookie(cookieName(OAUTH_COOKIE, secure), secure);

  if (!env.SESSION_SECRET) return failed('/konto', 'misconfigured');
  const state = await verifyState(
    env.SESSION_SECRET,
    readCookie(cookies, OAUTH_COOKIE, secure),
    now,
  );
  // With no valid state there is no trustworthy returnTo either, so land on /konto.
  if (!state || state.provider !== providerId) return failed('/konto', 'state');

  const fail = (code: string) => {
    const response = failed(state.returnTo, code);
    response.headers.append('set-cookie', dropState);
    return response;
  };

  if (url.searchParams.get('error')) return fail('denied');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code || returnedState !== state.nonce) return fail('state');

  const provider = PROVIDERS[providerId];
  const credentials = provider.credentials(env);
  if (!credentials) return fail('provider-unavailable');

  let profile;
  try {
    profile = await provider.exchange({
      credentials,
      code,
      redirectUri: `${url.origin}/api/auth/${providerId}/callback`,
      verifier: state.verifier,
    });
  } catch {
    return fail('exchange');
  }

  // The email is the account-linking key, so an unverified one would let anyone
  // who can claim an address at a provider walk into someone else's account.
  if (!profile.email || !profile.emailVerified) return fail('email-unverified');

  const isOwner = ownerEmails(env).includes(normalizeEmail(profile.email));

  // Resolution order, and each step exists for a reason:
  //   1. this exact identity — the ordinary returning learner;
  //   2. an account with the same verified email — so signing in with GitHub
  //      after Google finds the existing progress instead of minting a second
  //      account the learner cannot tell apart;
  //   3. a new pending account.
  let user = await findUserByIdentity(env.DB, providerId, profile.subject);
  if (!user) {
    user = await findUserByEmail(env.DB, profile.email);
    if (user) {
      await linkIdentity(env.DB, {
        provider: providerId,
        subject: profile.subject,
        userId: user.id,
        email: profile.email,
        now,
      });
    }
  }
  if (!user) {
    user = await createUser(env.DB, {
      email: profile.email,
      displayName: profile.displayName,
      status: isOwner ? 'approved' : 'pending',
      role: isOwner ? 'owner' : 'learner',
      now,
    });
    await linkIdentity(env.DB, {
      provider: providerId,
      subject: profile.subject,
      userId: user.id,
      email: profile.email,
      now,
    });
  }

  user = await reconcileUser(env.DB, user, { isOwner, displayName: profile.displayName, now });

  // A blocked account gets no session at all. Handing it one and refusing every
  // call afterwards would look like a broken app rather than a decision.
  if (user.status === 'blocked') return fail('blocked');

  const token = randomToken(32);
  await createSession(env.DB, { userId: user.id, token, now });

  const response = redirect(state.returnTo);
  response.headers.append('set-cookie', sessionCookie(token, secure));
  response.headers.append('set-cookie', dropState);
  return response;
}
