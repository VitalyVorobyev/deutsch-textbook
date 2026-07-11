import { useEffect, useState } from 'react';
import { resolveProfileState, createProfile, switchProfile } from '../lib/profile';
import { useExplainLang } from './hooks';

/**
 * Blocking first-run dialog: shown only when no profile exists (and no legacy
 * pre-profile data could be adopted — see resolveProfileState). Creating the
 * profile persists it and reloads so every island rebinds to its database.
 */
export default function FirstRunGate() {
  const lang = useExplainLang();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void resolveProfileState().then((state) => setShow(state === 'first-run'));
  }, []);

  if (!show) return null;

  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  function handleCreate() {
    const label = name.trim();
    if (!label || busy) return;
    setBusy(true);
    switchProfile(createProfile(label).id); // persists da:profile + reloads
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
          handleCreate();
        }}
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-800"
      >
        <h2 className="text-lg font-bold">
          {t('Welcome to Deutsch-Atlas', 'Добро пожаловать в Deutsch-Atlas')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {t(
            'What should we call you? Your progress is stored only on this device.',
            'Как вас зовут? Прогресс хранится только на этом устройстве.',
          )}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Your name', 'Ваше имя')}
          className="mt-4 w-full rounded border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="mt-3 w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {t('Start learning', 'Начать учиться')}
        </button>
        <p className="mt-2 text-xs text-stone-400">
          {t(
            'Used Deutsch-Atlas on this device before? Enter the same name to reconnect your progress.',
            'Уже занимались на этом устройстве? Введите то же имя, чтобы вернуть прогресс.',
          )}
        </p>
      </form>
    </div>
  );
}
