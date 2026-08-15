import { describe, expect, test } from 'bun:test';
import { syncMenuStatus } from '../src/components/ProfileSwitcher';
import type { RemoteSession, RemoteUser } from '../src/lib/sync-remote';

// Every field an assertion depends on is stated here, none read from live
// state (tests/README rule: a fixture that leans on real data protects the
// defect it should catch).
function user(status: RemoteUser['status']): RemoteUser {
  return { id: 'acc-1', email: 'a@b.c', displayName: null, status, role: 'learner', linked: [] };
}

function session(status: RemoteUser['status']): RemoteSession {
  return { signedIn: true, providers: ['google'], via: 'cookie', user: user(status) };
}

describe('syncMenuStatus', () => {
  test('hidden with no session at all (menu still loading)', () => {
    expect(syncMenuStatus(null, {}, 'p1')).toEqual({ kind: 'hidden' });
  });

  test('hidden when signed out', () => {
    const signedOut: RemoteSession = { signedIn: false, providers: [] };
    expect(syncMenuStatus(signedOut, { profileId: 'p1', at: 123 }, 'p1')).toEqual({
      kind: 'hidden',
    });
  });

  test('pending account wins over any local sync state', () => {
    expect(syncMenuStatus(session('pending'), { profileId: 'p1', at: 123 }, 'p1')).toEqual({
      kind: 'pending',
    });
  });

  test('blocked account is stated, not silent', () => {
    expect(syncMenuStatus(session('blocked'), { profileId: 'p1', at: 123 }, 'p1')).toEqual({
      kind: 'blocked',
    });
  });

  test('approved but no bound profile → unbound', () => {
    expect(syncMenuStatus(session('approved'), {}, 'p1')).toEqual({ kind: 'unbound' });
  });

  test('bound to a different profile than the active one', () => {
    expect(syncMenuStatus(session('approved'), { profileId: 'p2', at: 123 }, 'p1')).toEqual({
      kind: 'other-profile',
    });
  });

  test('bound to the active profile with no completed sync → never', () => {
    expect(syncMenuStatus(session('approved'), { profileId: 'p1' }, 'p1')).toEqual({
      kind: 'never',
    });
  });

  test('bound with a completed sync reports its timestamp', () => {
    expect(syncMenuStatus(session('approved'), { profileId: 'p1', at: 1754350000000 }, 'p1')).toEqual(
      { kind: 'synced', at: 1754350000000 },
    );
  });
});
