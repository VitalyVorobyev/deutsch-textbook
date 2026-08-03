/**
 * Every D1 statement the Worker issues, in one place.
 *
 * Routes never build SQL. That is partly hygiene and partly the only way the
 * tests can hand the routes an in-memory fake (`tests/support/fake-d1.ts`) and
 * still be testing the real query shapes.
 */
import { randomId, sha256Hex } from './crypto';

export type UserStatus = 'pending' | 'approved' | 'blocked';
export type UserRole = 'learner' | 'owner';

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  status: UserStatus;
  role: UserRole;
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
}

export interface DeviceTokenRow {
  id: string;
  user_id: string;
  label: string;
  created_at: number;
  last_used_at: number | null;
}

/** Emails are compared case-insensitively; the local part technically is not, but no provider treats it that way and a learner typing a capital would otherwise get a second account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(normalizeEmail(email)).first<UserRow>();
}

export async function findUserByIdentity(
  db: D1Database,
  provider: string,
  subject: string,
): Promise<UserRow | null> {
  return db
    .prepare(
      'SELECT users.* FROM users JOIN identities ON identities.user_id = users.id' +
        ' WHERE identities.provider = ? AND identities.subject = ?',
    )
    .bind(provider, subject)
    .first<UserRow>();
}

export async function createUser(
  db: D1Database,
  input: { email: string; displayName?: string; status: UserStatus; role: UserRole; now: number },
): Promise<UserRow> {
  const id = randomId();
  await db
    .prepare(
      'INSERT INTO users (id, email, display_name, status, role, created_at, decided_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      normalizeEmail(input.email),
      input.displayName ?? null,
      input.status,
      input.role,
      input.now,
      input.status === 'approved' ? input.now : null,
    )
    .run();
  const created = await findUserById(db, id);
  if (!created) throw new Error('user insert did not land');
  return created;
}

export async function linkIdentity(
  db: D1Database,
  input: { provider: string; subject: string; userId: string; email: string; now: number },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)' +
        ' ON CONFLICT (provider, subject) DO UPDATE SET user_id = excluded.user_id, email = excluded.email',
    )
    .bind(input.provider, input.subject, input.userId, normalizeEmail(input.email), input.now)
    .run();
}

export async function listIdentityProviders(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT provider FROM identities WHERE user_id = ? ORDER BY provider')
    .bind(userId)
    .all<{ provider: string }>();
  return results.map((row) => row.provider);
}

/**
 * Promote an account the owner list names, and refresh a stale display name.
 *
 * The promotion is re-applied on every sign-in rather than only at creation, so
 * a D1 that was wiped, restored from an export, or created before the secret was
 * set still lets the owner into /konto. That is the whole reason OWNER_EMAILS is
 * a secret and not a hand-written row.
 */
export async function reconcileUser(
  db: D1Database,
  user: UserRow,
  input: { isOwner: boolean; displayName?: string; now: number },
): Promise<UserRow> {
  const shouldPromote = input.isOwner && (user.role !== 'owner' || user.status !== 'approved');
  const nameChanged = !!input.displayName && input.displayName !== user.display_name;
  if (!shouldPromote && !nameChanged) return user;

  const role: UserRole = input.isOwner ? 'owner' : user.role;
  // An owner is never left pending or blocked; a learner's status is the owner's decision and is untouched here.
  const status: UserStatus = input.isOwner ? 'approved' : user.status;
  await db
    .prepare(
      'UPDATE users SET role = ?, status = ?, display_name = ?,' +
        ' decided_at = CASE WHEN ? = 1 THEN ? ELSE decided_at END WHERE id = ?',
    )
    .bind(
      role,
      status,
      input.displayName ?? user.display_name,
      shouldPromote ? 1 : 0,
      input.now,
      user.id,
    )
    .run();
  return (await findUserById(db, user.id)) ?? user;
}

export async function setUserStatus(
  db: D1Database,
  input: { userId: string; status: UserStatus; decidedBy: string; now: number },
): Promise<void> {
  await db
    .prepare('UPDATE users SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?')
    .bind(input.status, input.now, input.decidedBy, input.userId)
    .run();
}

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  // Pending first: the list exists to be acted on, and the actionable rows belong at the top.
  const { results } = await db
    .prepare(
      "SELECT * FROM users ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC",
    )
    .all<UserRow>();
  return results;
}

export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  // identities/sessions/device_tokens cascade (migrations/0001_init.sql).
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Re-issue when less than this is left, so a daily learner never gets signed out. */
export const SESSION_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: D1Database,
  input: { userId: string; token: string; now: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(input.token), input.userId, input.now, input.now + SESSION_TTL_MS)
    .run();
}

export interface SessionLookup {
  user: UserRow;
  expiresAt: number;
}

export async function findSession(
  db: D1Database,
  token: string,
  now: number,
): Promise<SessionLookup | null> {
  const row = await db
    .prepare(
      'SELECT users.*, sessions.expires_at AS session_expires_at FROM sessions' +
        ' JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?',
    )
    .bind(await sha256Hex(token), now)
    .first<UserRow & { session_expires_at: number }>();
  if (!row) return null;
  const { session_expires_at: expiresAt, ...user } = row;
  return { user, expiresAt };
}

export async function touchSession(
  db: D1Database,
  token: string,
  now: number,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
    .bind(now + SESSION_TTL_MS, await sha256Hex(token))
    .run();
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
}

/**
 * Drop expired rows. Called opportunistically from the session route rather
 * than on a cron: sessions are per-learner and few, and a scheduled handler
 * would be a second deployable surface for a table that never gets large.
 */
export async function pruneSessions(db: D1Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
}

// ---------------------------------------------------------------------------
// Device tokens
// ---------------------------------------------------------------------------

export async function createDeviceToken(
  db: D1Database,
  input: { userId: string; token: string; label: string; now: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO device_tokens (id, user_id, label, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(input.token), input.userId, input.label, input.now)
    .run();
}

export async function findDeviceTokenUser(
  db: D1Database,
  token: string,
): Promise<UserRow | null> {
  const id = await sha256Hex(token);
  const user = await db
    .prepare('SELECT users.* FROM users JOIN device_tokens ON device_tokens.user_id = users.id WHERE device_tokens.id = ?')
    .bind(id)
    .first<UserRow>();
  if (user) {
    await db.prepare('UPDATE device_tokens SET last_used_at = ? WHERE id = ?').bind(Date.now(), id).run();
  }
  return user;
}

export async function listDeviceTokens(db: D1Database, userId: string): Promise<DeviceTokenRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM device_tokens WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<DeviceTokenRow>();
  return results;
}

/**
 * Revoke by the public reference (`ref`), which is the first 12 hex characters
 * of the token's sha256 — enough to name one of a handful of devices, and not
 * enough to reconstruct the token. Scoped to the owner of the row, so a ref
 * guessed from another account matches nothing.
 */
export async function deleteDeviceToken(db: D1Database, userId: string, ref: string): Promise<number> {
  const result = await db
    .prepare('DELETE FROM device_tokens WHERE user_id = ? AND substr(id, 1, 12) = ?')
    .bind(userId, ref)
    .run();
  return result.meta.changes ?? 0;
}

export const TOKEN_REF_LENGTH = 12;

export function tokenRef(hashedId: string): string {
  return hashedId.slice(0, TOKEN_REF_LENGTH);
}
