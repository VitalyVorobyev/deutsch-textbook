/**
 * The approval queue and the device-token boundary.
 *
 * The load-bearing claim here is the one that is easy to get wrong and
 * invisible when it is: **a device token grants sync and nothing else.** It is a
 * long-lived string pasted into a desktop app; if it could also approve accounts
 * or delete people, one leaked paste would be an administrative takeover.
 */
import { describe, expect, test } from 'bun:test';
import worker from '../worker/index';
import { currentKey } from '../worker/routes/sync';
import { makeEnv, makeRequest, seedUser, type FakeR2 } from './worker-fakes';

const ORIGIN = 'https://deutsch.vitavision.dev';
const USERS = `${ORIGIN}/api/admin/users`;
const TOKENS = `${ORIGIN}/api/tokens`;

async function listUsers(env: never, cookie: string) {
  const response = await worker.fetch(makeRequest(USERS, { cookie }), env);
  return { status: response.status, body: await response.json() };
}

describe('the approval queue', () => {
  test('an owner sees every account, pending first', async () => {
    const env = makeEnv();
    const owner = await seedUser(env, { email: 'chef@example.com', role: 'owner' });
    await seedUser(env, { email: 'wartet@example.com', status: 'pending' });

    const { status, body } = await listUsers(env, owner.cookie);
    expect(status).toBe(200);
    const users = (body as { users: { email: string; status: string }[] }).users;
    expect(users).toHaveLength(2);
    expect(users[0]!.status).toBe('pending');
  });

  test('a learner does not learn that the admin surface exists', async () => {
    const env = makeEnv();
    const learner = await seedUser(env);
    const { status } = await listUsers(env, learner.cookie);
    // 404 rather than 403: an ordinary account has no business knowing.
    expect(status).toBe(404);
  });

  test('approving a pending account is what turns on its storage', async () => {
    const env = makeEnv();
    const owner = await seedUser(env, { role: 'owner' });
    const learner = await seedUser(env, { status: 'pending' });
    const snapshot = `${ORIGIN}/api/sync/snapshot`;

    const before = await worker.fetch(
      makeRequest(snapshot, {
        method: 'PUT',
        body: 'bytes',
        cookie: learner.cookie,
        origin: ORIGIN,
        headers: { 'if-none-match': '*' },
      }),
      env,
    );
    expect(before.status).toBe(403);

    const approve = await worker.fetch(
      makeRequest(`${USERS}/${learner.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        cookie: owner.cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    expect(approve.status).toBe(204);

    const after = await worker.fetch(
      makeRequest(snapshot, {
        method: 'PUT',
        body: 'bytes',
        cookie: learner.cookie,
        origin: ORIGIN,
        headers: { 'if-none-match': '*' },
      }),
      env,
    );
    expect(after.status).toBe(204);
  });

  test('an owner cannot suspend themselves out of the only surface that could undo it', async () => {
    const env = makeEnv();
    const owner = await seedUser(env, { role: 'owner' });
    const response = await worker.fetch(
      makeRequest(`${USERS}/${owner.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'blocked' }),
        cookie: owner.cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'self-lockout' });
  });

  test('deleting an account takes its bytes with it', async () => {
    const env = makeEnv();
    const owner = await seedUser(env, { role: 'owner' });
    const learner = await seedUser(env);
    await worker.fetch(
      makeRequest(`${ORIGIN}/api/sync/snapshot`, {
        method: 'PUT',
        body: 'bytes',
        cookie: learner.cookie,
        origin: ORIGIN,
        headers: { 'if-none-match': '*' },
      }),
      env,
    );
    expect((env.SNAPSHOTS as FakeR2).objects.has(currentKey(learner.userId))).toBe(true);

    const response = await worker.fetch(
      makeRequest(`${USERS}/${learner.userId}`, {
        method: 'DELETE',
        cookie: owner.cookie,
        origin: ORIGIN,
      }),
      env,
    );
    expect(response.status).toBe(204);
    // Orphaned objects would be a billable copy of an account that no longer exists.
    expect((env.SNAPSHOTS as FakeR2).objects.has(currentKey(learner.userId))).toBe(false);
    // And the session rows cascade, so the deleted person is signed out everywhere.
    const session = await worker.fetch(
      makeRequest(`${ORIGIN}/api/auth/session`, { cookie: learner.cookie }),
      env,
    );
    expect(await session.json()).toMatchObject({ signedIn: false });
  });

  test('an admin write from another origin is refused', async () => {
    const env = makeEnv();
    const owner = await seedUser(env, { role: 'owner' });
    const learner = await seedUser(env, { status: 'pending' });
    const response = await worker.fetch(
      makeRequest(`${USERS}/${learner.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        cookie: owner.cookie,
        origin: 'https://evil.example',
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    expect(response.status).toBe(403);
  });
});

describe('device tokens', () => {
  test('a device token can sync', async () => {
    const env = makeEnv();
    const { deviceToken } = await seedUser(env, { device: true });
    const response = await worker.fetch(
      makeRequest(`${ORIGIN}/api/sync/snapshot`, {
        method: 'PUT',
        body: 'bytes',
        headers: { authorization: `Bearer ${deviceToken}`, 'if-none-match': '*' },
      }),
      env,
    );
    expect(response.status).toBe(204);
  });

  test('a device token cannot reach the admin surface, even on an owner account', async () => {
    const env = makeEnv();
    const { deviceToken } = await seedUser(env, { role: 'owner', device: true });
    const response = await worker.fetch(
      makeRequest(USERS, { headers: { authorization: `Bearer ${deviceToken}` } }),
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'cookie-required' });
  });

  test('a device token cannot mint another device token', async () => {
    const env = makeEnv();
    const { deviceToken } = await seedUser(env, { device: true });
    const response = await worker.fetch(
      makeRequest(TOKENS, {
        method: 'POST',
        body: JSON.stringify({ label: 'second' }),
        headers: { authorization: `Bearer ${deviceToken}`, 'content-type': 'application/json' },
        origin: ORIGIN,
      }),
      env,
    );
    expect(response.status).toBe(403);
  });

  test('a device token cannot delete the account', async () => {
    const env = makeEnv();
    const { deviceToken } = await seedUser(env, { device: true });
    const response = await worker.fetch(
      makeRequest(`${ORIGIN}/api/auth/account`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${deviceToken}` },
        origin: ORIGIN,
      }),
      env,
    );
    expect(response.status).toBe(403);
  });

  test('the token is returned once, and afterwards only a reference is listable', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const created = await worker.fetch(
      makeRequest(TOKENS, {
        method: 'POST',
        body: JSON.stringify({ label: 'Laptop' }),
        cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    expect(created.status).toBe(201);
    const { token } = (await created.json()) as { token: string };
    expect(token).toStartWith('dat_');

    const listed = await worker.fetch(makeRequest(TOKENS, { cookie }), env);
    const { tokens } = (await listed.json()) as { tokens: { ref: string; label: string }[] };
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.label).toBe('Laptop');
    // Only sha256(token) is stored, so the value cannot reappear anywhere.
    expect(JSON.stringify(tokens)).not.toContain(token);
  });

  test('revoking stops the device immediately', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const created = await worker.fetch(
      makeRequest(TOKENS, {
        method: 'POST',
        body: JSON.stringify({ label: 'Laptop' }),
        cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    const { token } = (await created.json()) as { token: string };
    const listed = await worker.fetch(makeRequest(TOKENS, { cookie }), env);
    const { tokens } = (await listed.json()) as { tokens: { ref: string }[] };

    const revoked = await worker.fetch(
      makeRequest(`${TOKENS}/${tokens[0]!.ref}`, { method: 'DELETE', cookie, origin: ORIGIN }),
      env,
    );
    expect(revoked.status).toBe(204);

    const after = await worker.fetch(
      makeRequest(`${ORIGIN}/api/sync/snapshot`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      env,
    );
    expect(after.status).toBe(401);
  });

  test('one account cannot revoke another account’s device by guessing its reference', async () => {
    const env = makeEnv();
    const victim = await seedUser(env);
    const attacker = await seedUser(env);
    await worker.fetch(
      makeRequest(TOKENS, {
        method: 'POST',
        body: JSON.stringify({ label: 'Victim laptop' }),
        cookie: victim.cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    const listed = await worker.fetch(makeRequest(TOKENS, { cookie: victim.cookie }), env);
    const { tokens } = (await listed.json()) as { tokens: { ref: string }[] };

    const response = await worker.fetch(
      makeRequest(`${TOKENS}/${tokens[0]!.ref}`, {
        method: 'DELETE',
        cookie: attacker.cookie,
        origin: ORIGIN,
      }),
      env,
    );
    expect(response.status).toBe(404);
    const still = await worker.fetch(makeRequest(TOKENS, { cookie: victim.cookie }), env);
    expect(((await still.json()) as { tokens: unknown[] }).tokens).toHaveLength(1);
  });

  test('a pending account cannot create a device token', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env, { status: 'pending' });
    const response = await worker.fetch(
      makeRequest(TOKENS, {
        method: 'POST',
        body: JSON.stringify({ label: 'x' }),
        cookie,
        origin: ORIGIN,
        headers: { 'content-type': 'application/json' },
      }),
      env,
    );
    expect(response.status).toBe(403);
  });
});
