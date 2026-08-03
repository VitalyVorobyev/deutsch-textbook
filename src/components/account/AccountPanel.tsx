import { useEffect, useRef, useState } from 'react';
import {
  apiFetch,
  bindActiveProfile,
  compressionSupported,
  forceSync,
  forgetSession,
  getSession,
  readSyncState,
  setDeviceToken,
  unbindProfile,
  type RemoteSession,
  type SyncOutcome,
} from '../../lib/sync-remote';
import { getActiveProfile, getActiveProfileId } from '../../lib/profile';
import { isTauri } from '../../lib/syncdir';
import { pick } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { withBase } from '../../lib/url';
import { useExplainLang, useUiLang } from '../hooks';
import DeviceTokens from './DeviceTokens';
import OwnerUsers from './OwnerUsers';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  localFirst: {
    en: 'Deutsch-Atlas works without an account. Everything you do is stored in this browser first; signing in only adds a copy in the cloud so a second device can pick it up.',
    ru: 'Deutsch-Atlas работает без аккаунта. Всё, что вы делаете, сначала сохраняется в этом браузере; вход лишь добавляет копию в облаке, чтобы её подхватило второе устройство.',
    uk: 'Deutsch-Atlas працює без облікового запису. Усе, що ви робите, спершу зберігається в цьому браузері; вхід лише додає копію в хмарі, щоб її підхопив другий пристрій.',
    de: 'Deutsch-Atlas funktioniert ohne Konto. Alles wird zuerst in diesem Browser gespeichert; die Anmeldung legt nur eine Kopie in der Cloud an, damit ein zweites Gerät sie übernehmen kann.',
  },
  pending: {
    en: 'Your account exists but is waiting to be approved. Nothing is stored in the cloud yet — keep learning, everything is saved on this device and will be uploaded once the account is approved.',
    ru: 'Аккаунт создан, но ожидает одобрения. В облаке пока ничего не хранится — продолжайте заниматься: всё сохраняется на этом устройстве и будет загружено после одобрения.',
    uk: 'Обліковий запис створено, але він очікує схвалення. У хмарі поки нічого не зберігається — навчайтеся далі: усе зберігається на цьому пристрої й буде завантажено після схвалення.',
    de: 'Dein Konto besteht, wartet aber auf die Freigabe. In der Cloud liegt noch nichts — lerne ruhig weiter: alles wird auf diesem Gerät gespeichert und nach der Freigabe hochgeladen.',
  },
  blocked: {
    en: 'This account has been blocked and cannot sync. Your progress on this device is untouched.',
    ru: 'Этот аккаунт заблокирован и не может синхронизироваться. Прогресс на этом устройстве не затронут.',
    uk: 'Цей обліковий запис заблоковано, синхронізація неможлива. Прогрес на цьому пристрої не змінено.',
    de: 'Dieses Konto ist gesperrt und kann nicht synchronisieren. Dein Fortschritt auf diesem Gerät bleibt unberührt.',
  },
  unbound: {
    en: 'Connect a profile to the account. Its progress is what gets synced; the other profiles on this device stay local.',
    ru: 'Свяжите профиль с аккаунтом. Синхронизируется именно его прогресс; остальные профили на этом устройстве остаются локальными.',
    uk: "Пов'яжіть профіль з обліковим записом. Синхронізується саме його прогрес; інші профілі на цьому пристрої лишаються локальними.",
    de: 'Verbinde ein Profil mit dem Konto. Sein Fortschritt wird synchronisiert; die anderen Profile auf diesem Gerät bleiben lokal.',
  },
  otherProfile: {
    en: 'The account is connected to a different profile on this device, so nothing is being synced right now. Switch to that profile, or connect this one instead.',
    ru: 'Аккаунт связан с другим профилем на этом устройстве, поэтому сейчас ничего не синхронизируется. Переключитесь на тот профиль или свяжите этот.',
    uk: "Обліковий запис пов'язано з іншим профілем на цьому пристрої, тому зараз нічого не синхронізується. Перейдіть на той профіль або пов'яжіть цей.",
    de: 'Das Konto ist mit einem anderen Profil auf diesem Gerät verbunden, deshalb wird gerade nichts synchronisiert. Wechsle zu jenem Profil oder verbinde dieses.',
  },
  bindConfirm: {
    en: 'This profile already has progress on this device. Connecting it merges that progress with whatever the account holds — nothing is deleted, but the two histories become one. Continue?',
    ru: 'В этом профиле на устройстве уже есть прогресс. Связывание объединит его с тем, что хранится в аккаунте: ничего не удаляется, но две истории станут одной. Продолжить?',
    uk: 'У цьому профілі на пристрої вже є прогрес. Зв’язування об’єднає його з тим, що зберігається в обліковому записі: нічого не видаляється, але дві історії стануть однією. Продовжити?',
    de: 'Dieses Profil hat auf diesem Gerät bereits Fortschritt. Beim Verbinden wird er mit dem Stand des Kontos zusammengeführt — nichts wird gelöscht, aber aus zwei Verläufen wird einer. Fortfahren?',
  },
  uploadHelp: {
    en: 'Have an exported file from another browser? Load it here: it is merged into this profile and then uploaded, so you continue exactly where you left off.',
    ru: 'Есть файл, выгруженный из другого браузера? Загрузите его здесь: он объединится с этим профилем и будет отправлен в облако — вы продолжите ровно с того же места.',
    uk: 'Маєте файл, вивантажений з іншого браузера? Завантажте його тут: він об’єднається з цим профілем і буде надісланий у хмару — ви продовжите точно з того самого місця.',
    de: 'Eine exportierte Datei aus einem anderen Browser? Hier laden: sie wird in dieses Profil eingefügt und hochgeladen, sodass du genau dort weitermachst, wo du aufgehört hast.',
  },
  unsupported: {
    en: 'This browser cannot compress data, so cloud sync is unavailable here. Export and import still work.',
    ru: 'Этот браузер не умеет сжимать данные, поэтому облачная синхронизация здесь недоступна. Экспорт и импорт работают.',
    uk: 'Цей браузер не вміє стискати дані, тому хмарна синхронізація тут недоступна. Експорт та імпорт працюють.',
    de: 'Dieser Browser kann keine Daten komprimieren, deshalb ist die Cloud-Synchronisierung hier nicht verfügbar. Export und Import funktionieren weiterhin.',
  },
  desktopSignIn: {
    en: 'Sign in on the website first, then create a device code there and paste it below.',
    ru: 'Сначала войдите на сайте, создайте там код устройства и вставьте его ниже.',
    uk: 'Спершу увійдіть на сайті, створіть там код пристрою й вставте його нижче.',
    de: 'Melde dich zuerst auf der Website an, erstelle dort einen Gerätecode und füge ihn unten ein.',
  },
  deleteCloudConfirm: {
    en: 'Delete the copy stored in the cloud? Your progress on this device is not touched.',
    ru: 'Удалить копию, хранящуюся в облаке? Прогресс на этом устройстве не затрагивается.',
    uk: 'Видалити копію, що зберігається в хмарі? Прогрес на цьому пристрої не змінюється.',
    de: 'Die in der Cloud gespeicherte Kopie löschen? Dein Fortschritt auf diesem Gerät bleibt unberührt.',
  },
  deleteAccountConfirm: {
    en: 'Delete the account and everything stored for it? Your progress on this device is not touched. This cannot be undone.',
    ru: 'Удалить аккаунт и все его данные? Прогресс на этом устройстве не затрагивается. Отменить будет нельзя.',
    uk: 'Видалити обліковий запис і всі його дані? Прогрес на цьому пристрої не змінюється. Скасувати буде неможливо.',
    de: 'Konto und alle gespeicherten Daten löschen? Dein Fortschritt auf diesem Gerät bleibt unberührt. Das lässt sich nicht rückgängig machen.',
  },
  syncing: { en: 'Syncing…', ru: 'Синхронизация…', uk: 'Синхронізація…', de: 'Wird synchronisiert…' },
  syncOk: { en: 'Up to date.', ru: 'Всё синхронизировано.', uk: 'Усе синхронізовано.', de: 'Auf dem neuesten Stand.' },
  syncFailed: {
    en: 'Sync could not finish ({reason}). It will try again automatically.',
    ru: 'Синхронизация не завершилась ({reason}). Повтор произойдёт автоматически.',
    uk: 'Синхронізацію не завершено ({reason}). Повтор відбудеться автоматично.',
    de: 'Die Synchronisierung wurde nicht abgeschlossen ({reason}). Sie wird automatisch wiederholt.',
  },
  importFailed: {
    en: 'That file is not a Deutsch-Atlas progress export.',
    ru: 'Этот файл не является выгрузкой прогресса Deutsch-Atlas.',
    uk: 'Цей файл не є вивантаженням прогресу Deutsch-Atlas.',
    de: 'Diese Datei ist kein Deutsch-Atlas-Fortschrittsexport.',
  },
  uploaded: {
    en: 'Loaded and uploaded.',
    ru: 'Загружено и отправлено в облако.',
    uk: 'Завантажено й надіслано в хмару.',
    de: 'Eingelesen und hochgeladen.',
  },
  authError: {
    en: 'Sign-in did not complete ({reason}).',
    ru: 'Вход не завершён ({reason}).',
    uk: 'Вхід не завершено ({reason}).',
    de: 'Die Anmeldung wurde nicht abgeschlossen ({reason}).',
  },
} as const;

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', github: 'GitHub' };

const STATUS_KEY = {
  pending: 'account.statusPending',
  approved: 'account.statusApproved',
  blocked: 'account.statusBlocked',
} as const;

/**
 * The account surface.
 *
 * Two things it must never do, both of which are runtime invariants elsewhere in
 * the app: create a profile implicitly (binding always names an existing one),
 * and imply that signing out costs the learner anything. Local progress is
 * untouched by everything on this page except the explicit import.
 */
export default function AccountPanel() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [boundProfile, setBoundProfile] = useState<string | undefined>(undefined);
  const [lastSync, setLastSync] = useState<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeProfileId = typeof window === 'undefined' ? '' : getActiveProfileId();

  useEffect(() => {
    void getSession(true).then(setSession);
    // localStorage and location are client-only, so the read has to happen here;
    // queueMicrotask defers the setState out of the effect body — the same idiom
    // the Fortschritt panel uses to restore its saved sub-tab.
    queueMicrotask(() => {
      const state = readSyncState();
      setBoundProfile(state.profileId);
      setLastSync(state.at);
      const failure = new URLSearchParams(window.location.search).get('auth');
      if (failure) setMessage(pick(lang, UI.authError).replace('{reason}', failure));
    });
    // `lang` is read once for the initial message; the effect must not re-run on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshLocalState() {
    const state = readSyncState();
    setBoundProfile(state.profileId);
    setLastSync(state.at);
  }

  async function runSync() {
    setBusy(true);
    setMessage(null);
    const result = await forceSync();
    setOutcome(result);
    refreshLocalState();
    setBusy(false);
  }

  async function bind(accountId: string) {
    const { getAttempts } = await import('../../lib/store');
    const attempts = await getAttempts();
    // Only warn when there is genuinely something to merge. A fresh device is
    // the common case and does not need a dialog.
    if (attempts.length > 0 && !confirm(pick(lang, UI.bindConfirm))) return;
    bindActiveProfile(accountId);
    refreshLocalState();
    await runSync();
  }

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const { mergeSnapshot } = await import('../../lib/store');
      await mergeSnapshot(JSON.parse(await file.text()));
    } catch {
      setMessage(pick(lang, UI.importFailed));
      setBusy(false);
      return;
    }
    const result = await forceSync();
    setOutcome(result);
    refreshLocalState();
    setMessage(result.state === 'ok' ? pick(lang, UI.uploaded) : null);
    setBusy(false);
  }

  async function deleteCloudCopy() {
    if (!confirm(pick(lang, UI.deleteCloudConfirm))) return;
    await apiFetch('/api/sync/snapshot', { method: 'DELETE' });
    unbindProfile();
    refreshLocalState();
    setOutcome(null);
  }

  async function signOut() {
    // In the desktop app there is no session to end — the credential is the
    // device token, so signing out means disconnecting this device. Posting to
    // /api/auth/logout there would succeed and change nothing.
    if (isTauri()) {
      setDeviceToken(null);
    } else {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
    forgetSession();
    setSession(await getSession(true));
  }

  async function deleteAccount() {
    if (!confirm(pick(lang, UI.deleteAccountConfirm))) return;
    await apiFetch('/api/auth/account', { method: 'DELETE' });
    unbindProfile();
    forgetSession();
    refreshLocalState();
    setSession(await getSession(true));
  }

  if (!session) {
    return <p className="text-sm text-stone-400">…</p>;
  }

  const user = session.user;

  // Signed out.
  if (!session.signedIn || !user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.localFirst)}</p>
        {isTauri() ? (
          <>
            <p className="text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.desktopSignIn)}</p>
            <DeviceTokens lang={lang} />
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {session.providers.map((provider) => (
              <a
                key={provider}
                href={withBase(`/api/auth/${provider}/start?returnTo=/konto`)}
                className="min-h-11 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {t('account.signIn', uiLang)} · {PROVIDER_LABEL[provider] ?? provider}
              </a>
            ))}
          </div>
        )}
        {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}
      </div>
    );
  }

  const bound = boundProfile === activeProfileId;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold">{user.displayName || user.email}</span>
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-stone-700">
            {t(STATUS_KEY[user.status], uiLang)}
          </span>
          {user.role === 'owner' && (
            <span className="text-xs text-stone-400">{t('account.owner', uiLang)}</span>
          )}
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-stone-500 sm:grid-cols-[auto_1fr] dark:text-stone-400">
          <dt className="font-semibold">E-Mail</dt>
          <dd className="truncate">{user.email}</dd>
          <dt className="font-semibold">{t('account.accountId', uiLang)}</dt>
          {/* Shown because `bun run progress:pull --account <id>` needs it when the bucket holds more than one. */}
          <dd className="truncate font-mono">{user.id}</dd>
          <dt className="font-semibold">{t('account.boundProfile', uiLang)}</dt>
          <dd className="truncate">
            {boundProfile ? (bound ? getActiveProfile().label : boundProfile) : '—'}
          </dd>
          <dt className="font-semibold">{t('account.lastSync', uiLang)}</dt>
          <dd>{lastSync ? new Date(lastSync).toLocaleString('de-DE') : t('account.never', uiLang)}</dd>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
          >
            {t('account.signOut', uiLang)}
          </button>
          {/* Deleting an account needs a browser session; a device token is
              deliberately not allowed to (worker/routes/auth.ts), so the button
              is absent here rather than present and refused. */}
          {!isTauri() && (
            <button
              type="button"
              onClick={() => void deleteAccount()}
              className="min-h-11 rounded-md px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-red-600 dark:text-stone-400 sm:min-h-0"
            >
              {t('account.deleteAccount', uiLang)}
            </button>
          )}
        </div>
      </section>

      {user.status === 'pending' && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
          {pick(lang, UI.pending)}
        </p>
      )}
      {user.status === 'blocked' && (
        <p className="rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm dark:border-stone-600 dark:bg-stone-900">
          {pick(lang, UI.blocked)}
        </p>
      )}

      {user.status === 'approved' && !compressionSupported() && (
        <p className="rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm dark:border-stone-600 dark:bg-stone-900">
          {pick(lang, UI.unsupported)}
        </p>
      )}

      {user.status === 'approved' && compressionSupported() && (
        <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
          {!boundProfile && (
            <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.unbound)}</p>
          )}
          {boundProfile && !bound && (
            <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.otherProfile)}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {bound ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runSync()}
                  className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 sm:min-h-0"
                >
                  {t('account.sync', uiLang)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unbindProfile();
                    refreshLocalState();
                  }}
                  className="min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
                >
                  {t('account.disconnect', uiLang)}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void bind(user.id)}
                className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 sm:min-h-0"
              >
                {t('account.connect', uiLang)} · {getActiveProfile().label}
              </button>
            )}
          </div>

          {bound && (
            <>
              <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.uploadHelp)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                  className="min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 disabled:opacity-50 dark:border-stone-600 sm:min-h-0"
                >
                  {t('account.upload', uiLang)}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteCloudCopy()}
                  className="min-h-11 rounded-md px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-red-600 dark:text-stone-400 sm:min-h-0"
                >
                  {t('account.deleteCloud', uiLang)}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </>
          )}

          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            {busy
              ? pick(lang, UI.syncing)
              : outcome?.state === 'ok'
                ? pick(lang, UI.syncOk)
                : outcome && outcome.state !== 'off'
                  ? pick(lang, UI.syncFailed).replace(
                      '{reason}',
                      outcome.state === 'error' ? outcome.reason : outcome.state,
                    )
                  : ''}
          </p>
          {message && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{message}</p>}
        </section>
      )}

      {/* In the browser this issues codes; in the desktop app it is where one is
          pasted, and where it can be disconnected again — so it stays visible
          there whether or not a device is currently connected. */}
      {(isTauri() || user.status === 'approved') && <DeviceTokens lang={lang} />}

      {/* `via` and not `role`: a device token belongs to an owner too, but the
          admin API refuses it, so rendering the queue there would show an
          empty table and no way to act. */}
      {user.role === 'owner' && session.via !== 'token' && (
        <OwnerUsers lang={lang} selfId={user.id} />
      )}
    </div>
  );
}
