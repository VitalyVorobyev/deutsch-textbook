/**
 * OAuth providers, as data.
 *
 * Adding Apple later is a third entry in `PROVIDERS` plus two secrets — not a
 * rewrite — which is the whole reason `identities` is keyed by
 * `(provider, subject)` rather than by anything Google-shaped.
 *
 * The Worker is a **confidential** client: the code-for-token exchange happens
 * server-side with the client secret, which is what actually protects the flow.
 * PKCE is added on top where the provider supports it (Google does; GitHub
 * OAuth Apps do not), and the signed `state` cookie carries the CSRF binding
 * either way.
 */
import { base64UrlDecode } from '../crypto';
import type { Env } from '../env';

export const PROVIDER_IDS = ['google', 'github'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/** What a provider must tell us about a person before an account can exist. */
export interface ProviderProfile {
  subject: string;
  email: string;
  /** Refusing an unverified email is not optional: the email is the account-linking key. */
  emailVerified: boolean;
  displayName?: string;
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** GitHub OAuth Apps ignore `code_challenge`; sending one is harmless but pointless. */
  usesPkce: boolean;
  credentials(env: Env): ProviderCredentials | null;
  authorizeUrl(input: {
    credentials: ProviderCredentials;
    redirectUri: string;
    state: string;
    challenge?: string;
  }): string;
  exchange(input: {
    credentials: ProviderCredentials;
    code: string;
    redirectUri: string;
    verifier?: string;
  }): Promise<ProviderProfile>;
}

function credentialsFrom(id?: string, secret?: string): ProviderCredentials | null {
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

/**
 * The payload half of a JWT, without signature verification.
 *
 * This is safe **only** because the token was just returned by a direct,
 * TLS-protected, server-to-server call to the provider's own token endpoint —
 * the case OpenID Connect Core §3.1.3.7 explicitly exempts from ID token
 * signature validation. It would NOT be safe for a token that arrived from a
 * browser, and this helper must never be pointed at one.
 */
function decodeIdTokenPayload(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('id_token has no payload');
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Record<string, unknown>;
}

async function postForm(url: string, body: Record<string, string>, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...headers },
    body: new URLSearchParams(body).toString(),
  });
  if (!response.ok) {
    throw new Error(`token exchange failed (${response.status})`);
  }
  return (await response.json()) as Record<string, unknown>;
}

const google: Provider = {
  id: 'google',
  label: 'Google',
  usesPkce: true,
  credentials: (env) => credentialsFrom(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  authorizeUrl: ({ credentials, redirectUri, state, challenge }) => {
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      // No refresh token is wanted: the session is ours, and a stored Google
      // refresh token would be a credential we have no use for and must protect.
      access_type: 'online',
      prompt: 'select_account',
    });
    if (challenge) {
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
  exchange: async ({ credentials, code, redirectUri, verifier }) => {
    const token = await postForm('https://oauth2.googleapis.com/token', {
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      ...(verifier ? { code_verifier: verifier } : {}),
    });
    const idToken = token.id_token;
    if (typeof idToken !== 'string') throw new Error('google returned no id_token');
    const claims = decodeIdTokenPayload(idToken);
    const subject = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email : '';
    if (!subject || !email) throw new Error('google id_token is missing sub or email');
    return {
      subject,
      email,
      emailVerified: claims.email_verified === true,
      displayName: typeof claims.name === 'string' ? claims.name : undefined,
    };
  },
};

const github: Provider = {
  id: 'github',
  label: 'GitHub',
  usesPkce: false,
  credentials: (env) => credentialsFrom(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  authorizeUrl: ({ credentials, redirectUri, state }) => {
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      // user:email is required: /user returns null for a private primary address,
      // and a null email cannot be an account key.
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },
  exchange: async ({ credentials, code, redirectUri }) => {
    const token = await postForm('https://github.com/login/oauth/access_token', {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const accessToken = token.access_token;
    if (typeof accessToken !== 'string') throw new Error('github returned no access_token');

    // GitHub rejects API requests without a User-Agent — a 403 that reads like
    // an auth failure and is not one.
    const apiHeaders = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'deutsch-atlas',
    };

    const userResponse = await fetch('https://api.github.com/user', { headers: apiHeaders });
    if (!userResponse.ok) throw new Error(`github /user failed (${userResponse.status})`);
    const profile = (await userResponse.json()) as Record<string, unknown>;
    const subject = typeof profile.id === 'number' || typeof profile.id === 'string' ? String(profile.id) : '';
    if (!subject) throw new Error('github /user returned no id');

    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: apiHeaders });
    if (!emailsResponse.ok) throw new Error(`github /user/emails failed (${emailsResponse.status})`);
    const emails = (await emailsResponse.json()) as { email?: string; primary?: boolean; verified?: boolean }[];
    const chosen =
      emails.find((entry) => entry.primary && entry.verified && entry.email) ??
      emails.find((entry) => entry.verified && entry.email);

    const displayName =
      (typeof profile.name === 'string' && profile.name) ||
      (typeof profile.login === 'string' ? profile.login : undefined) ||
      undefined;

    return {
      subject,
      // An account with no verified address reaches the caller as
      // emailVerified: false and is refused there — not silently accepted with a blank key.
      email: chosen?.email ?? '',
      emailVerified: !!chosen?.email,
      displayName,
    };
  },
};

export const PROVIDERS: Record<ProviderId, Provider> = { google, github };

/** Which providers this deployment actually has secrets for. */
export function configuredProviders(env: Env): ProviderId[] {
  return PROVIDER_IDS.filter((id) => PROVIDERS[id].credentials(env) !== null);
}
