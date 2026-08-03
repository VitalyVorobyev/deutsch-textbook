import { useEffect, useRef, useState } from 'react';
import {
  apiFetch,
  approvePairing,
  describePairing,
  getDeviceToken,
  pollPairing,
  setDeviceToken,
  startPairing,
  type PairingStart,
} from '../../lib/sync-remote';
import { isTauri } from '../../lib/syncdir';
import { pick } from '../../lib/prefs';
import type { ExplainLang } from '../../lib/prefs';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md). */
const UI = {
  intro: {
    en: 'The desktop app runs in its own window, not in this browser, so the sign-in cookie cannot reach it. Start the connection in the app; it shows a short code, and you type that code here.',
    ru: 'Приложение для компьютера работает в собственном окне, а не в этом браузере, поэтому cookie входа до него не доходит. Начните подключение в приложении: оно покажет короткий код, а вы введёте этот код здесь.',
    uk: 'Застосунок для комп’ютера працює у власному вікні, а не в цьому браузері, тому cookie входу до нього не доходить. Почніть підключення в застосунку: він покаже короткий код, а ви введете цей код тут.',
    de: 'Die Desktop-App läuft in einem eigenen Fenster, nicht in diesem Browser, deshalb erreicht sie das Anmelde-Cookie nicht. Starte die Verbindung in der App; sie zeigt einen kurzen Code, den du hier eingibst.',
  },
  enterCode: {
    en: 'Code shown in the app',
    ru: 'Код, показанный в приложении',
    uk: 'Код, показаний у застосунку',
    de: 'In der App angezeigter Code',
  },
  confirmPrompt: {
    en: 'Only approve this if the code matches the one on the device in front of you. Approving connects that device to your account.',
    ru: 'Подтверждайте, только если код совпадает с тем, что показан на устройстве перед вами. Подтверждение подключит это устройство к вашему аккаунту.',
    uk: 'Підтверджуйте, лише якщо код збігається з тим, що показано на пристрої перед вами. Підтвердження підключить цей пристрій до вашого облікового запису.',
    de: 'Nur bestätigen, wenn der Code mit dem auf dem Gerät vor dir übereinstimmt. Die Bestätigung verbindet dieses Gerät mit deinem Konto.',
  },
  codeUnknown: {
    en: 'No pending connection with that code. Codes expire after ten minutes — start again in the app.',
    ru: 'Нет ожидающего подключения с таким кодом. Коды истекают через десять минут — начните заново в приложении.',
    uk: 'Немає підключення, що очікує, з таким кодом. Коди діють десять хвилин — почніть знову в застосунку.',
    de: 'Keine wartende Verbindung mit diesem Code. Codes verfallen nach zehn Minuten — starte in der App neu.',
  },
  approved: {
    en: 'Approved. The device connects within a few seconds.',
    ru: 'Подтверждено. Устройство подключится в течение нескольких секунд.',
    uk: 'Підтверджено. Пристрій підключиться протягом кількох секунд.',
    de: 'Bestätigt. Das Gerät verbindet sich in wenigen Sekunden.',
  },
  // Desktop side
  desktopIntro: {
    en: 'Connect this app to your account. It will show a short code; type that code on the website under Konto, on any device where you are signed in.',
    ru: 'Подключите это приложение к аккаунту. Оно покажет короткий код; введите его на сайте в разделе Konto на любом устройстве, где вы вошли.',
    uk: 'Підключіть цей застосунок до облікового запису. Він покаже короткий код; введіть його на сайті в розділі Konto на будь-якому пристрої, де ви увійшли.',
    de: 'Verbinde diese App mit deinem Konto. Sie zeigt einen kurzen Code; gib ihn auf der Website unter Konto ein, auf einem beliebigen angemeldeten Gerät.',
  },
  typeItAt: {
    en: 'Type this code at deutsch.vitavision.dev/konto',
    ru: 'Введите этот код на deutsch.vitavision.dev/konto',
    uk: 'Введіть цей код на deutsch.vitavision.dev/konto',
    de: 'Diesen Code auf deutsch.vitavision.dev/konto eingeben',
  },
  waiting: {
    en: 'Waiting for approval…',
    ru: 'Ожидание подтверждения…',
    uk: 'Очікування підтвердження…',
    de: 'Warte auf Bestätigung…',
  },
  expired: {
    en: 'The code expired. Start again.',
    ru: 'Код истёк. Начните заново.',
    uk: 'Код минув. Почніть знову.',
    de: 'Der Code ist abgelaufen. Starte neu.',
  },
  pairFailed: {
    en: 'Could not reach the sync service. Check the connection and try again.',
    ru: 'Не удалось связаться со службой синхронизации. Проверьте соединение и повторите.',
    uk: 'Не вдалося зв’язатися зі службою синхронізації. Перевірте з’єднання та повторіть.',
    de: 'Der Sync-Dienst war nicht erreichbar. Verbindung prüfen und erneut versuchen.',
  },
  manualFallback: {
    en: 'Paste a device code instead',
    ru: 'Вместо этого вставить код устройства',
    uk: 'Замість цього вставити код пристрою',
    de: 'Stattdessen einen Gerätecode einfügen',
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
  advanced: {
    en: 'Issue a device code by hand',
    ru: 'Выдать код устройства вручную',
    uk: 'Видати код пристрою вручну',
    de: 'Gerätecode von Hand ausstellen',
  },
} as const;

interface DeviceRow {
  ref: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/** `ABCD-EFGH` — grouped for reading aloud and for typing without losing your place. */
function formatUserCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * Connecting the desktop app to an account.
 *
 * The flow is the OAuth device grant's, and the direction of travel is what
 * matters: the **app** shows a short code and the **browser** approves it. The
 * older path — mint a 43-character bearer token in the browser and carry it to
 * the other machine — is still here behind a disclosure, because it is the only
 * thing that works when the two devices cannot both be looked at.
 *
 * Why typing rather than a link: a code that must be read off the screen in
 * front of you cannot be forwarded in a message, which is the one attack this
 * grant is prone to (worker/routes/pairing.ts).
 */
export default function DeviceTokens({ lang }: { lang: ExplainLang }) {
  const uiLang = useUiLang();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [hasToken, setHasToken] = useState(false);

  // Desktop: the pairing in flight.
  const [pairing, setPairing] = useState<PairingStart | null>(null);
  const [pairError, setPairError] = useState<'expired' | 'failed' | null>(null);
  const cancelled = useRef(false);

  // Browser: the code being approved.
  const [entered, setEntered] = useState('');
  const [candidate, setCandidate] = useState<{ userCode: string; label: string } | null>(null);
  const [notice, setNotice] = useState<'unknown' | 'approved' | null>(null);

  useEffect(() => {
    // localStorage is client-only; queueMicrotask keeps the setState out of the
    // effect body (the idiom the Fortschritt panel uses for its saved view).
    queueMicrotask(() => setHasToken(!!getDeviceToken()));
    if (isTauri()) return;
    void load();
  }, []);

  // Stop polling when the panel goes away, or the loop outlives the screen.
  useEffect(() => () => void (cancelled.current = true), []);

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

  // -- desktop -------------------------------------------------------------

  async function beginPairing() {
    setPairError(null);
    cancelled.current = false;
    const started = await startPairing('Desktop');
    if (!started) {
      setPairError('failed');
      return;
    }
    setPairing(started);

    // Poll until approved, expired or cancelled. `pollPairing` stores the token
    // itself, so there is exactly one writer of it in the client.
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, started.interval * 1000));
      if (cancelled.current) return;
      const result = await pollPairing(started.deviceCode);
      if (result.state === 'approved') {
        setPairing(null);
        setHasToken(true);
        return;
      }
      if (result.state === 'expired') {
        setPairing(null);
        setPairError('expired');
        return;
      }
      if (result.state === 'error') {
        setPairing(null);
        setPairError('failed');
        return;
      }
    }
  }

  function stopPairing() {
    cancelled.current = true;
    setPairing(null);
  }

  // -- browser -------------------------------------------------------------

  async function checkCode() {
    setNotice(null);
    const found = await describePairing(entered);
    if (!found) {
      setCandidate(null);
      setNotice('unknown');
      return;
    }
    setCandidate({ userCode: found.userCode, label: found.label });
  }

  async function grant() {
    if (!candidate) return;
    const ok = await approvePairing(candidate.userCode);
    setCandidate(null);
    setEntered('');
    setNotice(ok ? 'approved' : 'unknown');
    if (ok) await load();
  }

  // Inside the desktop app: no browser session, so nothing to list — this is
  // where the connection is started instead.
  if (isTauri()) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
        <h2 className="mb-2 text-sm font-semibold">{t('account.devices', uiLang)}</h2>

        {hasToken ? (
          <>
            <p className="text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.connected)}</p>
            <button
              type="button"
              onClick={() => {
                setDeviceToken(null);
                setHasToken(false);
              }}
              className="mt-2 min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-red-500 dark:border-stone-600 sm:min-h-0"
            >
              {t('account.disconnect', uiLang)}
            </button>
          </>
        ) : pairing ? (
          <>
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.typeItAt)}
            </p>
            <p className="select-all font-mono text-3xl font-bold tracking-[0.2em]">
              {formatUserCode(pairing.userCode)}
            </p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.waiting)}
            </p>
            <button
              type="button"
              onClick={stopPairing}
              className="mt-2 min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold dark:border-stone-600 sm:min-h-0"
            >
              {t('account.cancel', uiLang)}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.desktopIntro)}
            </p>
            {pairError && (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                {pick(lang, pairError === 'expired' ? UI.expired : UI.pairFailed)}
              </p>
            )}
            <button
              type="button"
              onClick={() => void beginPairing()}
              className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
            >
              {t('account.connect', uiLang)}
            </button>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-stone-500 dark:text-stone-400">
                {pick(lang, UI.manualFallback)}
              </summary>
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
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold dark:border-stone-600"
                >
                  {t('account.connect', uiLang)}
                </button>
              </div>
            </details>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="mb-2 text-sm font-semibold">{t('account.devices', uiLang)}</h2>
      <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.intro)}</p>

      {candidate ? (
        <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950">
          <p className="font-mono text-2xl font-bold tracking-[0.2em]">
            {formatUserCode(candidate.userCode)}
          </p>
          <p className="mt-1 text-sm font-semibold">{candidate.label}</p>
          <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">
            {pick(lang, UI.confirmPrompt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void grant()}
              className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
            >
              {t('account.approve', uiLang)}
            </button>
            <button
              type="button"
              onClick={() => setCandidate(null)}
              className="min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold dark:border-stone-600 sm:min-h-0"
            >
              {t('account.cancel', uiLang)}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void checkCode();
          }}
          className="mb-3 flex flex-wrap gap-2"
        >
          <input
            value={entered}
            onChange={(event) => setEntered(event.target.value)}
            placeholder={pick(lang, UI.enterCode)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 font-mono text-sm uppercase tracking-widest dark:border-stone-600 dark:bg-stone-900"
          />
          <button
            type="submit"
            className="min-h-11 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
          >
            {t('account.continue', uiLang)}
          </button>
        </form>
      )}

      {notice && (
        <p
          className={`mb-3 text-sm ${notice === 'approved' ? 'text-stone-500 dark:text-stone-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {pick(lang, notice === 'approved' ? UI.approved : UI.codeUnknown)}
        </p>
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

      {/* The pre-pairing path. Kept because it is the only one that works when
          the two devices cannot both be looked at — a headless box, a VM, a
          machine you are connecting to over SSH. */}
      <details>
        <summary className="cursor-pointer text-xs text-stone-500 dark:text-stone-400">
          {pick(lang, UI.advanced)}
        </summary>

        {issued && (
          <div className="mt-2 rounded-md border border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950">
            <p className="mb-1 text-xs font-semibold">{pick(lang, UI.shownOnce)}</p>
            <code className="block break-all font-mono text-xs">{issued}</code>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          className="mt-2 flex flex-wrap gap-2"
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
      </details>
    </section>
  );
}
