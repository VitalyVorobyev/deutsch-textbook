import { useEffect, useState } from 'react';
import { apiFetch, type AccountStatus } from '../../lib/sync-remote';
import { pick } from '../../lib/prefs';
import type { ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  intro: {
    en: 'Anyone may sign in, but a new account stores nothing until you approve it here. Until then that person still has the full app — it simply keeps their progress on their own device.',
    ru: 'Войти может любой, но новый аккаунт ничего не хранит, пока вы не одобрите его здесь. До этого у человека всё равно есть полное приложение — просто прогресс остаётся на его устройстве.',
    uk: 'Увійти може будь-хто, але новий обліковий запис нічого не зберігає, доки ви не схвалите його тут. До того людина все одно має повний застосунок — просто прогрес лишається на її пристрої.',
    de: 'Anmelden darf jede Person, aber ein neues Konto speichert nichts, bis du es hier freigibst. Bis dahin steht die vollständige App trotzdem zur Verfügung — der Fortschritt bleibt einfach auf dem eigenen Gerät.',
  },
  removeConfirm: {
    en: 'Delete this account and everything stored for it? This cannot be undone.',
    ru: 'Удалить этот аккаунт и все его данные? Отменить будет нельзя.',
    uk: 'Видалити цей обліковий запис і всі його дані? Скасувати буде неможливо.',
    de: 'Dieses Konto und alle gespeicherten Daten löschen? Das lässt sich nicht rückgängig machen.',
  },
} as const;

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  status: AccountStatus;
  role: 'learner' | 'owner';
  createdAt: number;
  decidedAt: number | null;
}

const STATUS_KEY = {
  pending: 'account.statusPending',
  approved: 'account.statusApproved',
  blocked: 'account.statusBlocked',
} as const;

const STATUS_CLASS: Record<AccountStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  blocked: 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300',
};

/** The approval queue. Rendered only for an owner; the API also refuses anyone else. */
export default function OwnerUsers({ lang, selfId }: { lang: ExplainLang; selfId: string }) {
  const uiLang = useUiLang();
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const response = await apiFetch('/api/admin/users');
    if (!response.ok) return;
    const data = (await response.json()) as { users: AdminUser[] };
    setUsers(data.users);
  }

  async function setStatus(id: string, status: AccountStatus) {
    await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(pick(lang, UI.removeConfirm))) return;
    await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-2 text-sm font-semibold">{t('account.users', uiLang)}</h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.intro)}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-t border-stone-100 dark:border-stone-700">
                <td className="py-2 pr-2">
                  <span className="block truncate font-medium">{user.email}</span>
                  {user.displayName && (
                    <span className="block truncate text-xs text-stone-400">{user.displayName}</span>
                  )}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[user.status]}`}>
                    {t(STATUS_KEY[user.status], uiLang)}
                  </span>
                  {user.role === 'owner' && (
                    <span className="ml-1 text-xs text-stone-400">{t('account.owner', uiLang)}</span>
                  )}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  {user.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => void setStatus(user.id, 'approved')}
                      className="rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {t('account.approve', uiLang)}
                    </button>
                  )}
                  {/* An owner cannot suspend or delete themselves — the API refuses it too,
                      because the only surface that could undo it is this one. */}
                  {user.status !== 'blocked' && user.id !== selfId && (
                    <button
                      type="button"
                      onClick={() => void setStatus(user.id, 'blocked')}
                      className="ml-1 rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold hover:border-red-500 dark:border-stone-600"
                    >
                      {t('account.block', uiLang)}
                    </button>
                  )}
                  {user.id !== selfId && (
                    <button
                      type="button"
                      onClick={() => void remove(user.id)}
                      className="ml-1 rounded px-1.5 py-1 text-xs text-stone-400 hover:text-red-600"
                    >
                      {t('account.remove', uiLang)}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
