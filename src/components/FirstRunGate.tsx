import { useEffect, useState } from 'react';
import {
  resolveProfileState,
  discoverProfiles,
  startProfile,
  reconnectProfile,
  type DiscoveredProfile,
} from '../lib/profile';
import { pick, type ExplainLang } from '../lib/prefs';
import { getSession, type RemoteSession } from '../lib/sync-remote';
import { isTauri } from '../lib/syncdir';
import { t } from '../lib/strings';
import { withBase } from '../lib/url';
import { useExplainLang, useUiLang } from './hooks';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0001-bilingual-explanation-halves.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  welcome: { en: 'Welcome to Deutsch-Atlas', ru: 'Добро пожаловать в Deutsch-Atlas' },
  whoLearning: { en: 'Who is learning?', ru: 'Кто занимается?' },
  someoneElse: { en: 'Someone else', ru: 'Кто-то другой' },
  claimSaved: {
    en: 'Progress is already saved in this browser. What should we call you? It will be kept under that name.',
    ru: 'В этом браузере уже сохранён прогресс. Как вас зовут? Он останется под этим именем.',
  },
  callYou: {
    en: 'What should we call you? Your progress is stored only on this device.',
    ru: 'Как вас зовут? Прогресс хранится только на этом устройстве.',
  },
  foundOnDevice: {
    en: 'Found on this device: {n} exercises answered.',
    ru: 'Найдено на этом устройстве: {n} выполненных упражнений.',
  },
  yourName: { en: 'Your name', ru: 'Ваше имя' },
  keepProgress: { en: 'Keep this progress', ru: 'Продолжить с этим прогрессом' },
  startLearning: { en: 'Start learning', ru: 'Начать учиться' },
  startFresh: { en: 'Start fresh instead', ru: 'Начать с нуля' },
  reconnectHint: {
    en: 'Used Deutsch-Atlas on this device before? Enter the same name to reconnect your progress.',
    ru: 'Уже занимались на этом устройстве? Введите то же имя, чтобы вернуть прогресс.',
  },
  noExercises: { en: 'no exercises yet', ru: 'пока без упражнений' },
  profileSummary: {
    en: '{n} exercises · last active {date}',
    ru: 'упражнений: {n} · последний раз {date}',
  },
  orSignIn: { en: 'Or with an account', ru: 'Или с аккаунтом' },
  cloudRecommend: {
    en: 'Recommended if you use more than one device: your progress keeps a second copy in the cloud.',
    ru: 'Рекомендуется, если у вас больше одного устройства: у прогресса появится вторая копия в облаке.',
  },
  signedInAs: { en: 'Signed in as {email}.', ru: 'Вы вошли как {email}.' },
  connectHint: {
    en: 'After you pick a name, connect this profile to the account under Fortschritt → Daten.',
    ru: 'После выбора имени свяжите профиль с аккаунтом в разделе Fortschritt → Daten.',
  },
  // Same wording as AccountPanel's pending copy (ADR 0004c): stated wherever the
  // pending state is reachable, and it changes nothing about local work.
  pendingGate: {
    en: 'Your account exists but is waiting to be approved. Nothing is stored in the cloud yet — keep learning, everything is saved on this device and will be uploaded once the account is approved.',
    ru: 'Аккаунт создан, но ожидает одобрения. В облаке пока ничего не хранится — продолжайте заниматься: всё сохраняется на этом устройстве и будет загружено после одобрения.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', github: 'GitHub' };

/**
 * Blocking first-run dialog: shown whenever no profile is registered — it asks
 * who the learner is instead of guessing. Progress already saved in this browser
 * is offered for reconnection (see discoverProfiles): a named database can be
 * continued with one click, and the unnamed pre-profile database is claimed by
 * giving it a name. Both paths reload so every island rebinds to the database.
 */
export default function FirstRunGate() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [show, setShow] = useState(false);
  const [found, setFound] = useState<DiscoveredProfile[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [returnTo, setReturnTo] = useState('/');

  useEffect(() => {
    void resolveProfileState().then(async (state) => {
      if (state !== 'first-run') return;
      setFound(await discoverProfiles());
      setShow(true);
      // Session is asked for only once the gate is actually shown — an install
      // with a profile never pays this request. Signing in from the gate must
      // land back in the gate (ADR 0004a), so returnTo is the current page.
      queueMicrotask(() =>
        setReturnTo(window.location.pathname + window.location.search),
      );
      if (!isTauri()) {
        const s = await getSession();
        setSession(s);
        // An OAuth display name may prefill the name field and nothing more
        // (ADR 0004b): fully editable, no profile created, discovery untouched.
        const displayName = s.signedIn ? s.user?.displayName : undefined;
        if (displayName) setName((prev) => prev || displayName);
      }
    });
  }, []);

  if (!show) return null;

  // A database that holds progress but was never named — the learner claims it by name.
  const unnamed = found.find((f) => !f.id);
  const named = found.filter((f) => f.id);

  function handleSubmit() {
    const label = name.trim();
    if (!label || busy) return;
    setBusy(true);
    // Claim the unnamed progress under this name, or start a fresh profile.
    void (unnamed ? reconnectProfile(unnamed, label) : startProfile(label));
  }

  function handleContinue(profile: DiscoveredProfile) {
    if (busy) return;
    setBusy(true);
    void reconnectProfile(profile);
  }

  function handleStartFresh() {
    if (busy) return;
    // Leave the unnamed progress untouched in its database; the name now starts a new one.
    setFound((prev) => prev.filter((f) => f.id));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-800"
      >
        <h2 className="text-lg font-bold">
          {pick(lang, UI.welcome)}
        </h2>

        {named.length > 0 && (
          <>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {pick(lang, UI.whoLearning)}
            </p>
            <ul className="mt-3 space-y-1">
              {named.map((p) => (
                <li key={p.db}>
                  <button
                    type="button"
                    onClick={() => handleContinue(p)}
                    disabled={busy}
                    className="w-full rounded border border-stone-200 px-3 py-2 text-left text-sm hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50 dark:border-stone-600 dark:hover:bg-stone-700"
                  >
                    <span className="font-semibold">{p.label ?? p.id}</span>
                    <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">
                      {summary(p, lang)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {pick(lang, UI.someoneElse)}
            </p>
          </>
        )}

        {named.length === 0 && (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {unnamed ? pick(lang, UI.claimSaved) : pick(lang, UI.callYou)}
          </p>
        )}

        {unnamed && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {pick(lang, UI.foundOnDevice).replace('{n}', String(unnamed.attempts))}
          </p>
        )}

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={pick(lang, UI.yourName)}
          className="mt-3 w-full rounded border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="mt-3 w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {unnamed ? pick(lang, UI.keepProgress) : pick(lang, UI.startLearning)}
        </button>

        {unnamed ? (
          <button
            type="button"
            onClick={handleStartFresh}
            disabled={busy}
            className="mt-2 w-full text-center text-xs text-stone-400 underline hover:text-stone-600 disabled:opacity-50 dark:hover:text-stone-200"
          >
            {pick(lang, UI.startFresh)}
          </button>
        ) : (
          <p className="mt-2 text-xs text-stone-400">
            {pick(lang, UI.reconnectHint)}
          </p>
        )}

        {/* Optional sign-in offer (ADR 0004a/d): visually below the local path,
            which stays first-class and one-click. Absent entirely when the
            deployment has no providers or in the desktop app (pairing is its
            route in, on Fortschritt → Daten). */}
        {session && !session.signedIn && session.providers.length > 0 && (
          <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              {pick(lang, UI.orSignIn)}
            </p>
            <p className="mt-1 text-xs text-stone-400">{pick(lang, UI.cloudRecommend)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.providers.map((provider) => (
                <a
                  key={provider}
                  href={withBase(`/api/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`)}
                  className="inline-flex min-h-11 items-center rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
                >
                  {t('account.signIn', uiLang)} · {PROVIDER_LABEL[provider] ?? provider}
                </a>
              ))}
            </div>
          </div>
        )}

        {session?.signedIn && session.user && (
          <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {pick(lang, UI.signedInAs).replace('{email}', session.user.email)}
            </p>
            {session.user.status === 'pending' ? (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                {pick(lang, UI.pendingGate)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-stone-400">{pick(lang, UI.connectHint)}</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

/** "312 exercises · last active 2026-07-02" — enough to tell two learners apart. */
function summary(p: DiscoveredProfile, lang: ExplainLang): string {
  if (!p.attempts || !p.lastActivity) return pick(lang, UI.noExercises);
  const date = new Date(p.lastActivity).toISOString().slice(0, 10);
  return pick(lang, UI.profileSummary).replace('{n}', String(p.attempts)).replace('{date}', date);
}
