/**
 * Test doubles for the Worker's two bindings.
 *
 * **D1 is not faked.** It is `bun:sqlite` loaded with the real
 * `migrations/0001_init.sql`, wrapped in D1's prepare/bind/first/all/run shape.
 * A hand-written fake would have had to re-implement `ON CONFLICT DO UPDATE`,
 * the `CHECK` constraints and `ON DELETE CASCADE` — which are exactly the parts
 * of the schema most worth testing, and the parts a fake would quietly get right
 * by not having them.
 *
 * R2 *is* faked, but the fake keeps the one property the sync route's
 * correctness rests on: `put` with `onlyIf` is an atomic compare-and-set that
 * returns null when the precondition fails.
 */
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDeviceToken, createSession, createUser, type UserRole, type UserStatus } from '../worker/db';
import { DEVICE_TOKEN_PREFIX } from '../worker/auth/session';
import { randomToken } from '../worker/crypto';

const MIGRATION = join(import.meta.dir, '..', 'migrations', '0001_init.sql');

export function makeDb(): D1Database {
  const sqlite = new Database(':memory:');
  // D1 enforces foreign keys; SQLite does not unless asked.
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(MIGRATION, 'utf8'));

  const prepare = (sql: string, params: unknown[] = []) => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    first: async <T>() => (sqlite.query(sql).get(...(params as never[])) as T) ?? null,
    all: async <T>() => ({ results: sqlite.query(sql).all(...(params as never[])) as T[] }),
    run: async () => {
      const result = sqlite.run(sql, params as never[]);
      return { meta: { changes: result.changes } };
    },
  });

  return { prepare: (sql: string) => prepare(sql) } as unknown as D1Database;
}

interface StoredObject {
  body: Uint8Array;
  etag: string;
  uploaded: Date;
}

export interface FakeR2 extends R2Bucket {
  /** Test-only view of what is stored. */
  readonly objects: Map<string, StoredObject>;
}

/** Etags only have to be stable per write and different across writes. */
let etagCounter = 0;

export function makeBucket(): FakeR2 {
  const objects = new Map<string, StoredObject>();

  const head = (key: string) => {
    const stored = objects.get(key);
    return stored ? { key, etag: stored.etag, uploaded: stored.uploaded, size: stored.body.byteLength } : null;
  };

  const bucket = {
    objects,
    async head(key: string) {
      return head(key);
    },
    async get(key: string) {
      const stored = objects.get(key);
      if (!stored) return null;
      return {
        key,
        etag: stored.etag,
        uploaded: stored.uploaded,
        body: new Blob([stored.body as unknown as BlobPart]).stream(),
        arrayBuffer: async () => stored.body.buffer,
      };
    },
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: { onlyIf?: Record<string, string> }) {
      const existing = objects.get(key);
      const condition = options?.onlyIf;
      if (condition?.etagMatches !== undefined && existing?.etag !== condition.etagMatches) return null;
      if (condition?.etagDoesNotMatch !== undefined) {
        const blocked =
          condition.etagDoesNotMatch === '*'
            ? !!existing
            : existing?.etag === condition.etagDoesNotMatch;
        if (blocked) return null;
      }
      const body = value instanceof Uint8Array ? value : new Uint8Array(value);
      const stored: StoredObject = { body, etag: `etag-${++etagCounter}`, uploaded: new Date() };
      objects.set(key, stored);
      return { key, etag: stored.etag, uploaded: stored.uploaded };
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix ?? '';
      return {
        objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
        truncated: false as const,
      };
    },
  };

  return bucket as unknown as FakeR2;
}

/** Everything the Worker reads off `env`, with test-shaped secrets. */
export function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: { fetch: async () => new Response('asset') },
    DB: makeDb(),
    SNAPSHOTS: makeBucket(),
    SESSION_SECRET: 'test-secret-not-a-real-one',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GITHUB_CLIENT_ID: 'github-id',
    GITHUB_CLIENT_SECRET: 'github-secret',
    ...overrides,
  } as never;
}

/**
 * An existing account with a live session, skipping the OAuth round trip.
 *
 * The sign-in flow itself is covered end-to-end in `worker-auth.test.ts`; the
 * sync and admin suites are about what an account may *do*, so they start from
 * one that already exists.
 */
export async function seedUser(
  env: { DB: D1Database },
  options: { email?: string; status?: UserStatus; role?: UserRole; device?: boolean } = {},
): Promise<{ userId: string; cookie: string; deviceToken: string }> {
  const now = Date.now();
  const user = await createUser(env.DB, {
    email: options.email ?? `learner-${randomToken(6)}@example.com`,
    status: options.status ?? 'approved',
    role: options.role ?? 'learner',
    now,
  });
  const token = randomToken(32);
  await createSession(env.DB, { userId: user.id, token, now });

  let deviceToken = '';
  if (options.device) {
    deviceToken = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
    await createDeviceToken(env.DB, { userId: user.id, token: deviceToken, label: 'Test', now });
  }

  // `__Host-` because the tests address the deployment over https.
  return { userId: user.id, cookie: `__Host-da_session=${token}`, deviceToken };
}

/**
 * Build a Request the way a browser would send it.
 *
 * `Cookie` and `Origin` are *forbidden request headers*: the happy-dom realm the
 * test suite runs in (tests/setup-dom.ts) drops them from a Request's init and
 * says nothing. Setting them after construction is allowed and is the only way
 * to exercise the Worker's cookie and same-origin paths at all — without this,
 * every authenticated test would silently run as an anonymous request and pass
 * for the wrong reason.
 */
export function makeRequest(url: string, init: RequestInit & { cookie?: string; origin?: string } = {}): Request {
  const { cookie, origin, ...rest } = init;
  const request = new Request(url, rest);
  if (cookie) request.headers.set('cookie', cookie);
  if (origin) request.headers.set('origin', origin);
  return request;
}

/** Collect every `set-cookie` into a single `Cookie:` header value. */
export function cookieJar(...responses: Response[]): string {
  const jar = new Map<string, string>();
  for (const response of responses) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const eq = pair?.indexOf('=') ?? -1;
      if (!pair || eq < 1) continue;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (value === '') jar.delete(name);
      else jar.set(name, value);
    }
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
