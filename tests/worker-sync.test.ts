/**
 * Snapshot storage: the approval gate, the conditional write, and the byte cap.
 *
 * The property under test throughout is that **the server never inspects a
 * snapshot**. Every body here is a short opaque string rather than real
 * snapshot JSON, on purpose: if any of these tests needed a well-formed
 * snapshot to pass, the server would have grown an opinion about the schema.
 */
import { describe, expect, test } from 'bun:test';
import worker from '../worker/index';
import { MAX_SNAPSHOT_BYTES, currentKey, dailyKey } from '../worker/routes/sync';
import { makeEnv, makeRequest, seedUser, type FakeR2 } from './worker-fakes';

const ORIGIN = 'https://deutsch.vitavision.dev';
const SNAPSHOT = `${ORIGIN}/api/sync/snapshot`;

function put(cookie: string, body: BodyInit, headers: Record<string, string> = {}) {
  return makeRequest(SNAPSHOT, {
    method: 'PUT',
    body,
    cookie,
    origin: ORIGIN,
    headers: { 'content-type': 'application/gzip', ...headers },
  });
}

describe('the approval gate', () => {
  test('a pending account is refused with a reason, not a bare 403', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env, { status: 'pending' });

    const response = await worker.fetch(put(cookie, 'bytes', { 'if-none-match': '*' }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'pending' });
    // Nothing was stored: an unapproved account costs one D1 row and no bytes.
    expect((env.SNAPSHOTS as FakeR2).objects.size).toBe(0);
  });

  test('a blocked account is refused', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env, { status: 'blocked' });
    const response = await worker.fetch(makeRequest(SNAPSHOT, { cookie }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'blocked' });
  });

  test('no credential at all is 401, not 403', async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request(SNAPSHOT), env);
    expect(response.status).toBe(401);
  });
});

describe('conditional writes', () => {
  test('a write with no precondition is refused — an unconditional PUT is how a day is lost', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const response = await worker.fetch(put(cookie, 'bytes'), env);
    expect(response.status).toBe(428);
    expect((env.SNAPSHOTS as FakeR2).objects.size).toBe(0);
  });

  test('If-None-Match: * creates, and then refuses to create again', async () => {
    const env = makeEnv();
    const { cookie, userId } = await seedUser(env);

    const first = await worker.fetch(put(cookie, 'one', { 'if-none-match': '*' }), env);
    expect(first.status).toBe(204);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await worker.fetch(put(cookie, 'two', { 'if-none-match': '*' }), env);
    expect(second.status).toBe(412);
    // The loser did not overwrite the winner.
    const stored = (env.SNAPSHOTS as FakeR2).objects.get(currentKey(userId))!;
    expect(new TextDecoder().decode(stored.body)).toBe('one');
  });

  test('If-Match with the current etag replaces; with a stale one it 412s and returns the current etag', async () => {
    const env = makeEnv();
    const { cookie, userId } = await seedUser(env);

    const first = await worker.fetch(put(cookie, 'one', { 'if-none-match': '*' }), env);
    const etag = first.headers.get('etag')!;

    const second = await worker.fetch(put(cookie, 'two', { 'if-match': etag }), env);
    expect(second.status).toBe(204);
    const newEtag = second.headers.get('etag')!;
    expect(newEtag).not.toBe(etag);

    // A second device still holding the old etag loses, and is told what to pull.
    const stale = await worker.fetch(put(cookie, 'three', { 'if-match': etag }), env);
    expect(stale.status).toBe(412);
    expect(stale.headers.get('etag')).toBe(newEtag);
    const stored = (env.SNAPSHOTS as FakeR2).objects.get(currentKey(userId))!;
    expect(new TextDecoder().decode(stored.body)).toBe('two');
  });
});

describe('reads', () => {
  test('GET returns the stored bytes verbatim and an etag', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    await worker.fetch(put(cookie, 'opaque-bytes', { 'if-none-match': '*' }), env);

    const response = await worker.fetch(makeRequest(SNAPSHOT, { cookie }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/gzip');
    expect(await response.text()).toBe('opaque-bytes');
  });

  test('GET with a matching If-None-Match is a 304 with no body — this is what makes polling cheap', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const written = await worker.fetch(put(cookie, 'bytes', { 'if-none-match': '*' }), env);
    const etag = written.headers.get('etag')!;

    const response = await worker.fetch(
      makeRequest(SNAPSHOT, { cookie, headers: { 'if-none-match': etag } }),
      env,
    );
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  });

  test('GET with a stale If-None-Match returns the new body', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const first = await worker.fetch(put(cookie, 'one', { 'if-none-match': '*' }), env);
    await worker.fetch(put(cookie, 'two', { 'if-match': first.headers.get('etag')! }), env);

    const response = await worker.fetch(
      makeRequest(SNAPSHOT, { cookie, headers: { 'if-none-match': first.headers.get('etag')! } }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('two');
  });

  test('an account with nothing stored gets 404, not an empty 200', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const response = await worker.fetch(makeRequest(SNAPSHOT, { cookie }), env);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'no-snapshot' });
  });
});

describe('limits and the daily copy', () => {
  /**
   * The cap is pinned separately from the test that exercises it.
   *
   * The oversize test builds its body from `MAX_SNAPSHOT_BYTES + 1`, so raising
   * the constant would move the test with it and stay green — the figure needs
   * its own assertion or it is not actually a limit.
   * 5 MiB is 44x `wc -c progress/vitaly/2026-08-03.json` | `gzip -9` = 113,814.
   */
  test('the cap is 5 MiB', () => {
    expect(MAX_SNAPSHOT_BYTES).toBe(5 * 1024 * 1024);
  });

  test('a body over the cap is refused and nothing is stored', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const oversized = new Uint8Array(MAX_SNAPSHOT_BYTES + 1);
    const response = await worker.fetch(put(cookie, oversized, { 'if-none-match': '*' }), env);
    expect(response.status).toBe(413);
    expect((env.SNAPSHOTS as FakeR2).objects.size).toBe(0);
  });

  test('the learner’s local date names the per-day copy, not the server’s UTC day', async () => {
    const env = makeEnv();
    const { cookie, userId } = await seedUser(env);
    await worker.fetch(
      put(cookie, 'bytes', { 'if-none-match': '*', 'x-snapshot-date': '2026-08-01' }),
      env,
    );
    const objects = (env.SNAPSHOTS as FakeR2).objects;
    expect([...objects.keys()].sort()).toEqual(
      [currentKey(userId), dailyKey(userId, '2026-08-01')].sort(),
    );
  });

  test('a malformed date writes no daily copy rather than a key named after junk', async () => {
    const env = makeEnv();
    const { cookie, userId } = await seedUser(env);
    await worker.fetch(
      put(cookie, 'bytes', { 'if-none-match': '*', 'x-snapshot-date': '../../etc/passwd' }),
      env,
    );
    expect([...(env.SNAPSHOTS as FakeR2).objects.keys()]).toEqual([currentKey(userId)]);
  });

  test('DELETE removes the current object and every daily copy', async () => {
    const env = makeEnv();
    const { cookie } = await seedUser(env);
    const first = await worker.fetch(
      put(cookie, 'a', { 'if-none-match': '*', 'x-snapshot-date': '2026-08-01' }),
      env,
    );
    await worker.fetch(
      put(cookie, 'b', { 'if-match': first.headers.get('etag')!, 'x-snapshot-date': '2026-08-02' }),
      env,
    );
    expect((env.SNAPSHOTS as FakeR2).objects.size).toBe(3);

    const response = await worker.fetch(
      makeRequest(SNAPSHOT, { method: 'DELETE', cookie, origin: ORIGIN }),
      env,
    );
    expect(response.status).toBe(204);
    expect((env.SNAPSHOTS as FakeR2).objects.size).toBe(0);
  });
});

describe('one account, one snapshot', () => {
  test('two accounts never share a key', async () => {
    const env = makeEnv();
    const a = await seedUser(env);
    const b = await seedUser(env);

    await worker.fetch(put(a.cookie, 'a-bytes', { 'if-none-match': '*' }), env);
    await worker.fetch(put(b.cookie, 'b-bytes', { 'if-none-match': '*' }), env);

    const read = await worker.fetch(makeRequest(SNAPSHOT, { cookie: a.cookie }), env);
    expect(await read.text()).toBe('a-bytes');
    expect(currentKey(a.userId)).not.toBe(currentKey(b.userId));
  });
});
