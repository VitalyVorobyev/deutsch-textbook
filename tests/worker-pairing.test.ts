/**
 * Device pairing (`worker/routes/pairing.ts`).
 *
 * Two endpoints here are unauthenticated by necessity — the desktop has no
 * credential yet, which is the problem being solved — so most of this file is
 * about what those two must *not* do: hand a token to a caller who guessed,
 * hand one out twice, honour an approval from a principal who should not be
 * able to give one, or become a way around the per-account device cap.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import worker from '../worker/index';
import {
  MAX_PENDING_PAIRINGS,
  PAIRING_POLL_INTERVAL_S,
  PAIRING_TTL_MS,
} from '../worker/routes/pairing';
import { newUserCode, normalizeUserCode, USER_CODE_ALPHABET, USER_CODE_LENGTH } from '../worker/db';
import { makeEnv, makeRequest, seedUser } from './worker-fakes';

const ORIGIN = 'https://deutsch.vitavision.dev';

let env: never;

beforeEach(() => {
  env = makeEnv();
});

function call(path: string, init: Parameters<typeof makeRequest>[1] = {}): Promise<Response> {
  return worker.fetch(makeRequest(`${ORIGIN}${path}`, init), env);
}

function post(path: string, body: unknown, init: Parameters<typeof makeRequest>[1] = {}) {
  return call(path, {
    method: 'POST',
    body: JSON.stringify(body),
    origin: ORIGIN,
    ...init,
  });
}

/** Start a pairing the way the desktop does, and return both halves. */
async function startPairing(): Promise<{ deviceCode: string; userCode: string }> {
  const response = await post('/api/pair/start', { label: 'Laptop' });
  expect(response.status).toBe(201);
  return (await response.json()) as { deviceCode: string; userCode: string };
}

describe('user codes', () => {
  test('the alphabet excludes every character pair a person confuses by eye', () => {
    // A mistyped character is not a typo here — it is a lookup against someone
    // else's pending request.
    for (const confusable of ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B', 'Z']) {
      expect(USER_CODE_ALPHABET).not.toContain(confusable);
    }
  });

  test('a generated code uses only the published alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = newUserCode();
      expect(code).toHaveLength(USER_CODE_LENGTH);
      for (const char of code) expect(USER_CODE_ALPHABET).toContain(char);
    }
  });

  test('normalization accepts what a person types, and nothing more', () => {
    expect(normalizeUserCode(' ab-cd efgh ')).toBe('ABCDEFGH');
    // A character outside the alphabet is left in place so the lookup fails,
    // rather than being rewritten into a different, valid code.
    expect(normalizeUserCode('abcd0fgh')).toBe('ABCD0FGH');
  });
});

describe('starting a pairing', () => {
  test('needs no credential — that is the whole point', async () => {
    const { deviceCode, userCode } = await startPairing();
    expect(userCode).toHaveLength(USER_CODE_LENGTH);
    // The two halves are different credentials with different jobs.
    expect(deviceCode).not.toContain(userCode);
    expect(deviceCode.startsWith('dpc_')).toBe(true);
  });

  test('the ceiling on simultaneously pending pairings is real', async () => {
    // `/api/pair/start` writes a D1 row for an anonymous caller, so the bound is
    // the only thing between that endpoint and unbounded litter.
    for (let i = 0; i < MAX_PENDING_PAIRINGS; i++) {
      expect((await post('/api/pair/start', {})).status).toBe(201);
    }
    const refused = await post('/api/pair/start', {});
    expect(refused.status).toBe(503);
    expect(((await refused.json()) as { error: string }).error).toBe('busy');
  });

  test('the device code is not a device token, and cannot be used as one', async () => {
    const { deviceCode } = await startPairing();
    const response = await call('/api/sync/snapshot', {
      headers: { authorization: `Bearer ${deviceCode}` },
    });
    expect(response.status).toBe(401);
  });
});

describe('polling', () => {
  test('an unapproved request reports pending and hands out nothing', async () => {
    const { deviceCode } = await startPairing();
    const response = await post('/api/pair/poll', { deviceCode });
    const body = (await response.json()) as { state: string; token?: string };
    expect(body.state).toBe('pending');
    expect(body.token).toBeUndefined();
  });

  test('a guessed device code learns nothing an unapproved one would not', async () => {
    await startPairing();
    const response = await post('/api/pair/poll', { deviceCode: 'dpc_not-a-real-code' });
    const body = (await response.json()) as { state: string; token?: string };
    expect(body.state).toBe('expired');
    expect(body.token).toBeUndefined();
  });

  test('polling faster than the interval is told to slow down', async () => {
    const { deviceCode } = await startPairing();
    expect((await post('/api/pair/poll', { deviceCode })).status).toBe(200);
    const second = await post('/api/pair/poll', { deviceCode });
    expect(second.status).toBe(429);
    expect(((await second.json()) as { state: string }).state).toBe('slow-down');
  });
});

describe('approval', () => {
  test('an approved account connects a device end to end', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const { deviceCode, userCode } = await startPairing();

    // The browser sees what it is about to grant before granting it.
    const described = await call(`/api/pair/request?code=${userCode}`, { cookie: owner.cookie });
    expect(described.status).toBe(200);
    expect(((await described.json()) as { label: string }).label).toBe('Laptop');

    const approved = await post('/api/pair/approve', { userCode }, { cookie: owner.cookie });
    expect(approved.status).toBe(200);

    const polled = await post('/api/pair/poll', { deviceCode });
    const body = (await polled.json()) as { state: string; token: string };
    expect(body.state).toBe('approved');
    expect(body.token.startsWith('dat_')).toBe(true);

    // And the token it just received actually syncs.
    const sync = await call('/api/sync/snapshot', {
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(sync.status).toBe(404); // authenticated, nothing stored yet
  });

  test('the token is issued exactly once', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const { deviceCode, userCode } = await startPairing();
    await post('/api/pair/approve', { userCode }, { cookie: owner.cookie });

    const first = (await (await post('/api/pair/poll', { deviceCode })).json()) as {
      state: string;
    };
    expect(first.state).toBe('approved');

    // Replaying the same device code must not mint a second token.
    const second = (await (await post('/api/pair/poll', { deviceCode })).json()) as {
      state: string;
      token?: string;
    };
    expect(second.state).toBe('expired');
    expect(second.token).toBeUndefined();
  });

  test('a device token cannot approve a pairing', async () => {
    // Otherwise one leaked token is a self-renewing foothold — the same reason
    // /api/tokens refuses a bearer principal.
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const minted = await post('/api/tokens', { label: 'Laptop' }, { cookie: owner.cookie });
    const { token } = (await minted.json()) as { token: string };

    const { userCode } = await startPairing();
    const response = await post(
      '/api/pair/approve',
      { userCode },
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toBe('cookie-required');
  });

  test('a pending account cannot approve a pairing', async () => {
    const pending = await seedUser(env, { email: 'neu@example.com', status: 'pending' });
    const { userCode } = await startPairing();
    const response = await post('/api/pair/approve', { userCode }, { cookie: pending.cookie });
    expect(response.status).toBe(403);
  });

  test('an anonymous caller cannot approve, and cannot ask what a code is', async () => {
    const { userCode } = await startPairing();
    expect((await post('/api/pair/approve', { userCode })).status).toBe(401);
    expect((await call(`/api/pair/request?code=${userCode}`)).status).toBe(401);
  });

  test('a cross-origin approval is refused', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const { userCode } = await startPairing();
    const response = await post(
      '/api/pair/approve',
      { userCode },
      { cookie: owner.cookie, origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
  });

  test('an unknown code is refused the same way an expired one is', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const response = await post(
      '/api/pair/approve',
      { userCode: 'AAAAAAAA' },
      { cookie: owner.cookie },
    );
    expect(response.status).toBe(404);
  });

  test('a second account cannot redirect a pairing someone else already approved', async () => {
    // Without `approved_user_id IS NULL` on the UPDATE, the last approver wins —
    // so a second signed-in learner could quietly take over a device that is
    // mid-pairing with the first.
    const first = await seedUser(env, { email: 'eins@example.com' });
    const second = await seedUser(env, { email: 'zwei@example.com' });
    const { deviceCode, userCode } = await startPairing();

    expect((await post('/api/pair/approve', { userCode }, { cookie: first.cookie })).status).toBe(
      200,
    );
    expect((await post('/api/pair/approve', { userCode }, { cookie: second.cookie })).status).toBe(
      404,
    );

    // The token lands on the first account, and syncing with it reaches that
    // account's snapshot — not the second's.
    const body = (await (await post('/api/pair/poll', { deviceCode })).json()) as {
      state: string;
      token: string;
    };
    expect(body.state).toBe('approved');
    const listed = await call('/api/tokens', { cookie: first.cookie });
    expect(((await listed.json()) as { tokens: unknown[] }).tokens).toHaveLength(1);
    const other = await call('/api/tokens', { cookie: second.cookie });
    expect(((await other.json()) as { tokens: unknown[] }).tokens).toHaveLength(0);
  });

  test('an account blocked between approval and redemption gets no token', async () => {
    // Approval and redemption are separated by however long the desktop takes
    // to poll. Status is therefore re-read at redemption, not trusted from the
    // moment of approval.
    const owner = await seedUser(env, { email: 'lerner@example.com', role: 'owner' });
    const learner = await seedUser(env, { email: 'wer@example.com' });
    const { deviceCode, userCode } = await startPairing();
    await post('/api/pair/approve', { userCode }, { cookie: learner.cookie });

    const blocked = await call(`/api/admin/users/${learner.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'blocked' }),
      cookie: owner.cookie,
      origin: ORIGIN,
    });
    expect(blocked.status).toBe(204);

    const body = (await (await post('/api/pair/poll', { deviceCode })).json()) as {
      state: string;
      token?: string;
    };
    expect(body.state).toBe('expired');
    expect(body.token).toBeUndefined();
  });

  test('pairing is not a way around the per-account device cap', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    for (let i = 0; i < 10; i++) {
      expect((await post('/api/tokens', { label: `L${i}` }, { cookie: owner.cookie })).status).toBe(
        201,
      );
    }
    const { deviceCode, userCode } = await startPairing();
    await post('/api/pair/approve', { userCode }, { cookie: owner.cookie });

    const response = await post('/api/pair/poll', { deviceCode });
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toBe('too-many');
  });

  test('approving twice does not re-arm a redeemed code', async () => {
    const owner = await seedUser(env, { email: 'lerner@example.com' });
    const { deviceCode, userCode } = await startPairing();
    await post('/api/pair/approve', { userCode }, { cookie: owner.cookie });
    await post('/api/pair/poll', { deviceCode });

    const again = await post('/api/pair/approve', { userCode }, { cookie: owner.cookie });
    expect(again.status).toBe(404);
  });
});

describe('constants', () => {
  test('the TTL and interval are the values the client is told to use', () => {
    // Pinned rather than derived: the desktop sleeps on `interval` and gives up
    // on the TTL, so moving either silently changes a behaviour on the other
    // side of the wire.
    expect(PAIRING_TTL_MS).toBe(10 * 60 * 1000);
    expect(PAIRING_POLL_INTERVAL_S).toBe(3);
  });
});
