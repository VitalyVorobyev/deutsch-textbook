import { useEffect, useRef, useState } from 'react';
import {
  listProfiles,
  getActiveProfileId,
  startProfile,
  switchProfile,
  deleteProfile,
  resolveProfileState,
  type Profile,
} from '../lib/profile';
import { EXPLAIN_LANGS, pick, setExplainLang } from '../lib/prefs';
import { getSession, readSyncState, type RemoteSession } from '../lib/sync-remote';
import { flushRemoteSync } from '../lib/autosync';
import { t } from '../lib/strings';
import { withBase } from '../lib/url';
import { useExplainLang, useUiLang } from './hooks';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0001-bilingual-explanation-halves.md).
    `{label}` is replaced by the caller. */
const UI = {
  switchProfile: { en: 'Switch learner profile', ru: 'Сменить профиль' },
  deleteConfirm: {
    en: 'Delete profile “{label}” and all its progress?',
    ru: 'Удалить профиль «{label}» и весь его прогресс?',
  },
  profile: { en: 'Profile', ru: 'Профиль' },
  deleteProfile: { en: 'Delete profile', ru: 'Удалить профиль' },
  learningLanguage: { en: 'Learning language', ru: 'Язык обучения' },
  name: { en: 'Name', ru: 'Имя' },
  add: { en: 'Add', ru: 'Добавить' },
  newProfile: { en: 'New profile', ru: 'Новый профиль' },
  account: { en: 'Account', ru: 'Аккаунт' },
  syncedAgo: { en: 'Synced {when}', ru: 'Синхронизировано {when}' },
  justNow: { en: 'just now', ru: 'только что' },
  minAgo: { en: '{n} min ago', ru: '{n} мин назад' },
  hoursAgo: { en: '{n} h ago', ru: '{n} ч назад' },
  daysAgo: { en: '{n} d ago', ru: '{n} дн назад' },
  syncPending: {
    en: 'Awaiting approval — everything stays on this device',
    ru: 'Ожидает одобрения — всё хранится на этом устройстве',
  },
  syncBlocked: { en: 'Account blocked — not syncing', ru: 'Аккаунт заблокирован — без синхронизации' },
  syncUnbound: { en: 'Cloud sync not connected', ru: 'Облачная синхронизация не подключена' },
  syncOtherProfile: { en: 'Syncing a different profile', ru: 'Синхронизируется другой профиль' },
  syncNever: { en: 'Not synced yet', ru: 'Ещё не синхронизировано' },
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * The sync state the profile menu can show without a single network request
 * (ADR 0004e): pending/blocked come from the session the menu already fetches
 * on open, everything else from the locally persisted sync state. No error
 * variant on purpose — outcomes are not persisted, and a *stale* "synced N ago"
 * is the honest outage signal ADR 0004 wants the learner to see.
 */
export type SyncMenuStatus =
  | { kind: 'hidden' }
  | { kind: 'pending' }
  | { kind: 'blocked' }
  | { kind: 'unbound' }
  | { kind: 'other-profile' }
  | { kind: 'never' }
  | { kind: 'synced'; at: number };

export function syncMenuStatus(
  session: RemoteSession | null,
  state: { profileId?: string; at?: number },
  activeProfileId: string,
): SyncMenuStatus {
  if (!session?.signedIn || !session.user) return { kind: 'hidden' };
  if (session.user.status === 'pending') return { kind: 'pending' };
  if (session.user.status === 'blocked') return { kind: 'blocked' };
  if (!state.profileId) return { kind: 'unbound' };
  if (state.profileId !== activeProfileId) return { kind: 'other-profile' };
  if (!state.at) return { kind: 'never' };
  return { kind: 'synced', at: state.at };
}

/**
 * The one cloud pull per page load.
 *
 * `scheduleAutoSync` only fires on a *write*, so a device that is only reading
 * would never learn that another device had written. This component is mounted
 * once in the header of every page (src/layouts/Base.astro), which makes it the
 * one place a per-load sync can live without a second global island. The
 * module-level flag survives React's development double-mount; the floor inside
 * `flushRemoteSync` handles everything else.
 */
let pulledThisLoad = false;

function pullOncePerLoad(): void {
  if (pulledThisLoad) return;
  pulledThisLoad = true;
  // Bound profile only: an unbound or signed-out install must not make a request.
  if (!readSyncState().profileId) return;
  void flushRemoteSync();
}

/** Header dropdown to switch, create, and delete local learner profiles,
    and the per-profile learning-language (explanation) setting — the one
    language selector; the chrome is pinned German (src/lib/prefs.ts). */
export default function ProfileSwitcher() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [session, setSession] = useState<RemoteSession | null>(null);
  // Snapshot per open: localStorage and the clock are impure, so both are read
  // in the effect below, never during render.
  const [menuSync, setMenuSync] = useState<SyncMenuStatus>({ kind: 'hidden' });
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for the first-run/legacy decision — it may seed the registry.
    void resolveProfileState().then(() => {
      setProfiles(listProfiles());
      setActiveId(getActiveProfileId());
      pullOncePerLoad();
    });
  }, []);

  // Only asked for when the menu opens: an account label nobody is looking at
  // is not worth a request on every page view.
  useEffect(() => {
    if (open && !session) void getSession().then(setSession);
  }, [open, session]);

  // queueMicrotask defers the setState out of the effect body — the same idiom
  // the Fortschritt panel uses for its saved-view restore. No reset on close:
  // the whole menu unmounts, and reopening recomputes.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setNow(Date.now());
      setMenuSync(syncMenuStatus(session, readSyncState(), activeId));
    });
  }, [open, session, activeId]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = profiles.find((p) => p.id === activeId);

  function relWhen(at: number): string {
    const mins = Math.floor((now - at) / 60_000);
    if (mins < 1) return pick(lang, UI.justNow);
    if (mins < 60) return pick(lang, UI.minAgo).replace('{n}', String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return pick(lang, UI.hoursAgo).replace('{n}', String(hours));
    return pick(lang, UI.daysAgo).replace('{n}', String(Math.floor(hours / 24)));
  }

  function syncStatusText(status: SyncMenuStatus): string | null {
    switch (status.kind) {
      case 'pending': return pick(lang, UI.syncPending);
      case 'blocked': return pick(lang, UI.syncBlocked);
      case 'unbound': return pick(lang, UI.syncUnbound);
      case 'other-profile': return pick(lang, UI.syncOtherProfile);
      case 'never': return pick(lang, UI.syncNever);
      case 'synced': return pick(lang, UI.syncedAgo).replace('{when}', relWhen(status.at));
      default: return null;
    }
  }

  function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    void startProfile(label); // stamps the new database with its identity, then reloads
  }

  function handleDelete(id: string, label: string) {
    const ok = confirm(pick(lang, UI.deleteConfirm).replace('{label}', label));
    if (!ok) return;
    deleteProfile(id); // reloads if the active profile was deleted
    setProfiles(listProfiles());
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold dark:border-stone-600 sm:px-2 sm:py-1"
        aria-haspopup="menu"
        aria-expanded={open}
        title={pick(lang, UI.switchProfile)}
      >
        <span aria-hidden>👤</span>
        <span className="max-w-24 truncate">{active?.label ?? '…'}</span>
        <span aria-hidden className="text-stone-400">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-800"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {pick(lang, UI.profile)}
          </p>
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (p.id === activeId ? setOpen(false) : switchProfile(p.id))}
                className={`flex-1 rounded px-2 py-1.5 text-left text-sm ${
                  p.id === activeId
                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {p.id === activeId ? '✓ ' : ''}
                {p.label}
              </button>
              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.label)}
                  className="rounded px-1.5 py-1 text-xs text-stone-400 hover:text-red-600"
                  title={pick(lang, UI.deleteProfile)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {pick(lang, UI.account)}
            </p>
            <a
              href={withBase('/progress?tab=daten')}
              className="block rounded px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-700"
            >
              {session?.signedIn && session.user ? (
                <span className="block truncate">{session.user.email}</span>
              ) : (
                <span className="text-stone-600 dark:text-stone-300">{t('account.signIn', uiLang)}</span>
              )}
            </a>
            {menuSync.kind !== 'hidden' && (
              <p className="px-2 pb-1 text-[11px] leading-snug text-stone-400">
                {syncStatusText(menuSync)}
              </p>
            )}
          </div>

          <div className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {pick(lang, UI.learningLanguage)}
            </p>
            <div className="flex gap-1 px-2 pb-1" role="group" aria-label={pick(lang, UI.learningLanguage)}>
              {EXPLAIN_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setExplainLang(l)}
                  className={`flex-1 rounded px-1.5 py-1 text-xs font-semibold uppercase ${
                    l === lang
                      ? 'bg-amber-600 text-white'
                      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="flex items-center gap-1 p-1"
              >
                <input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={pick(lang, UI.name)}
                  className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
                />
                <button
                  type="submit"
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {pick(lang, UI.add)}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                + {pick(lang, UI.newProfile)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
