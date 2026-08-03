import { useEffect, useState } from 'react';
import { apiFetch, getDeviceToken, setDeviceToken } from '../../lib/sync-remote';
import { isTauri } from '../../lib/syncdir';
import { pick } from '../../lib/prefs';
import type { ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  intro: {
    en: 'The desktop app runs in its own window, not in this browser, so the sign-in cookie cannot reach it. Create a device code here and paste it into the desktop app once.',
    ru: 'Приложение для компьютера работает в собственном окне, а не в этом браузере, поэтому cookie входа до него не доходит. Создайте здесь код устройства и один раз вставьте его в приложение.',
    uk: 'Застосунок для комп’ютера працює у власному вікні, а не в цьому браузері, тому cookie входу до нього не доходить. Створіть тут код пристрою й один раз вставте його в застосунок.',
    de: 'Die Desktop-App läuft in einem eigenen Fenster, nicht in diesem Browser, deshalb erreicht sie das Anmelde-Cookie nicht. Erstelle hier einen Gerätecode und füge ihn einmal in der Desktop-App ein.',
  },
  shownOnce: {
    en: 'Copy it now — it is shown once and never again.',
    ru: 'Скопируйте сейчас — код показывается один раз и больше никогда.',
    uk: 'Скопіюйте зараз — код показується один раз і більше ніколи.',
    de: 'Jetzt kopieren — der Code wird nur ein einziges Mal angezeigt.',
  },
  labelPlaceholder: {
    en: 'Name of the device (e.g. Laptop)',
    ru: 'Название устройства (например, ноутбук)',
    uk: 'Назва пристрою (наприклад, ноутбук)',
    de: 'Name des Geräts (z. B. Laptop)',
  },
  pasteHere: {
    en: 'Paste the device code created in the browser:',
    ru: 'Вставьте код устройства, созданный в браузере:',
    uk: 'Вставте код пристрою, створений у браузері:',
    de: 'Den im Browser erstellten Gerätecode einfügen:',
  },
  connected: {
    en: 'This device is connected.',
    ru: 'Это устройство подключено.',
    uk: 'Цей пристрій підключено.',
    de: 'Dieses Gerät ist verbunden.',
  },
  none: {
    en: 'No devices connected.',
    ru: 'Подключённых устройств нет.',
    uk: 'Підключених пристроїв немає.',
    de: 'Keine Geräte verbunden.',
  },
  revokeConfirm: {
    en: 'Revoke this device? It will stop syncing immediately.',
    ru: 'Отозвать это устройство? Синхронизация прекратится немедленно.',
    uk: 'Відкликати цей пристрій? Синхронізація припиниться негайно.',
    de: 'Dieses Gerät widerrufen? Die Synchronisierung endet sofort.',
  },
  lastUsed: {
    en: 'last used',
    ru: 'использовано',
    uk: 'використано',
    de: 'zuletzt benutzt',
  },
} as const;

interface DeviceRow {
  ref: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/**
 * Device codes for the desktop app.
 *
 * A code is displayed exactly once, because only its sha256 is stored
 * (worker/routes/tokens.ts). Inside the desktop app this component shows the
 * other half of the exchange — a field to paste one in — since that shell has
 * no browser session to list anything with.
 */
export default function DeviceTokens({ lang }: { lang: ExplainLang }) {
  const uiLang = useUiLang();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // localStorage is client-only; queueMicrotask keeps the setState out of the
    // effect body (the idiom the Fortschritt panel uses for its saved view).
    queueMicrotask(() => setHasToken(!!getDeviceToken()));
    if (isTauri()) return;
    void load();
  }, []);

  async function load() {
    const response = await apiFetch('/api/tokens');
    if (!response.ok) return;
    const data = (await response.json()) as { tokens: DeviceRow[] };
    setDevices(data.tokens);
  }

  async function create() {
    const response = await apiFetch('/api/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { token: string };
    setIssued(data.token);
    setLabel('');
    await load();
  }

  async function revoke(ref: string) {
    if (!confirm(pick(lang, UI.revokeConfirm))) return;
    await apiFetch(`/api/tokens/${ref}`, { method: 'DELETE' });
    await load();
  }

  // Inside the desktop app: no session, so nothing to list — only somewhere to
  // paste the code the browser produced.
  if (isTauri()) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
        <h2 className="mb-2 text-sm font-semibold">{t('account.devices', uiLang)}</h2>
        {hasToken ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.connected)}</p>
        ) : (
          <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.pasteHere)}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 font-mono text-xs dark:border-stone-600 dark:bg-stone-900"
            placeholder="dat_…"
          />
          <button
            type="button"
            onClick={() => {
              setDeviceToken(pasted.trim() || null);
              setHasToken(!!pasted.trim());
              setPasted('');
            }}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {t('account.connect', uiLang)}
          </button>
          {hasToken && (
            <button
              type="button"
              onClick={() => {
                setDeviceToken(null);
                setHasToken(false);
              }}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-red-500 dark:border-stone-600"
            >
              {t('account.disconnect', uiLang)}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-2 text-sm font-semibold">{t('account.devices', uiLang)}</h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.intro)}</p>

      {issued && (
        <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950">
          <p className="mb-1 text-xs font-semibold">{pick(lang, UI.shownOnce)}</p>
          <code className="block break-all font-mono text-xs">{issued}</code>
        </div>
      )}

      <ul className="mb-3 space-y-1 text-sm">
        {devices?.length === 0 && (
          <li className="text-stone-500 dark:text-stone-400">{pick(lang, UI.none)}</li>
        )}
        {devices?.map((device) => (
          <li key={device.ref} className="flex items-center gap-2">
            <span className="flex-1 truncate">
              {device.label}
              <span className="ml-2 text-xs text-stone-400">
                {device.lastUsedAt
                  ? `${pick(lang, UI.lastUsed)} ${new Date(device.lastUsedAt).toLocaleDateString('de-DE')}`
                  : t('account.never', uiLang)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void revoke(device.ref)}
              className="rounded px-2 py-1 text-xs font-semibold text-stone-500 hover:text-red-600"
            >
              {t('account.revoke', uiLang)}
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={pick(lang, UI.labelPlaceholder)}
          className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600"
        >
          + {t('account.newDevice', uiLang)}
        </button>
      </form>
    </section>
  );
}
