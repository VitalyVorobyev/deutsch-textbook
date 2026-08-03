/**
 * The approval queue — the mechanism behind "anyone may sign in, the owner
 * decides who gets storage".
 *
 * Two guards, and the second is not redundant: the caller must be an **owner**,
 * and must have authenticated with the **session cookie**. A device token is a
 * long-lived string pasted into a desktop app; it exists so a Tauri webview can
 * sync, and it must never be able to approve accounts or delete people.
 */
import {
  deleteUser,
  findUserById,
  listUsers,
  setUserStatus,
  type UserStatus,
} from '../db';
import { authenticate } from '../auth/session';
import { isSameOrigin, json, methodNotAllowed, noContent, problem, readJson } from '../http';
import type { Env } from '../env';
import { deleteAllSnapshots } from './sync';

const STATUSES: UserStatus[] = ['pending', 'approved', 'blocked'];

export async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
  segments: string[],
  secure: boolean,
  now: number,
): Promise<Response> {
  const principal = await authenticate(request, env, secure, now);
  if (!principal) return problem(401, 'signed-out', 'Not signed in.');
  if (principal.via !== 'cookie') {
    return problem(403, 'cookie-required', 'Device tokens grant sync only.');
  }
  if (principal.user.role !== 'owner') {
    // 404 rather than 403: an ordinary learner has no business learning that an
    // admin surface exists here at all.
    return problem(404, 'not-found', 'Unknown route.');
  }

  const [collection, userId] = segments;
  if (collection !== 'users') return problem(404, 'not-found', 'Unknown admin route.');

  if (segments.length === 1) {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    const users = await listUsers(env.DB);
    return json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        status: user.status,
        role: user.role,
        createdAt: user.created_at,
        decidedAt: user.decided_at,
      })),
    });
  }

  if (segments.length !== 2 || !userId) return problem(404, 'not-found', 'Unknown admin route.');
  if (!isSameOrigin(request, url)) return problem(403, 'cross-origin', 'Cross-origin request refused.');

  const target = await findUserById(env.DB, userId);
  if (!target) return problem(404, 'not-found', 'No such account.');

  if (request.method === 'PATCH') {
    const body = await readJson<{ status?: string }>(request);
    const status = body?.status;
    if (!status || !STATUSES.includes(status as UserStatus)) {
      return problem(400, 'bad-status', `status must be one of ${STATUSES.join(', ')}.`);
    }
    // Locking yourself out of the only surface that can unlock you.
    if (target.id === principal.user.id && status !== 'approved') {
      return problem(400, 'self-lockout', 'An owner cannot suspend their own account.');
    }
    await setUserStatus(env.DB, {
      userId: target.id,
      status: status as UserStatus,
      decidedBy: principal.user.id,
      now,
    });
    return noContent();
  }

  if (request.method === 'DELETE') {
    if (target.id === principal.user.id) {
      return problem(400, 'self-delete', 'Use the account page to delete your own account.');
    }
    // Their bytes go with the row: leaving orphaned objects in R2 would be a
    // silent, billable copy of someone whose account no longer exists.
    await deleteAllSnapshots(env, target.id);
    await deleteUser(env.DB, target.id);
    return noContent();
  }

  return methodNotAllowed(['PATCH', 'DELETE']);
}
