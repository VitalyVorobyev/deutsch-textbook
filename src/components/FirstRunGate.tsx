import { useEffect, useState } from 'react';
import {
  resolveProfileState,
  discoverProfiles,
  startProfile,
  reconnectProfile,
  type DiscoveredProfile,
} from '../lib/profile';
import { pick, type ExplainLang } from '../lib/prefs';
import { useExplainLang } from './hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
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
} as const satisfies Record<string, { en: string; ru: string }>;

/**
 * Blocking first-run dialog: shown whenever no profile is registered — it asks
 * who the learner is instead of guessing. Progress already saved in this browser
 * is offered for reconnection (see discoverProfiles): a named database can be
 * continued with one click, and the unnamed pre-profile database is claimed by
 * giving it a name. Both paths reload so every island rebinds to the database.
 */
export default function FirstRunGate() {
  const lang = useExplainLang();
  const [show, setShow] = useState(false);
  const [found, setFound] = useState<DiscoveredProfile[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void resolveProfileState().then(async (state) => {
      if (state !== 'first-run') return;
      setFound(await discoverProfiles());
      setShow(true);
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
