/**
 * "A new version is ready" toast.
 *
 * Mounted once in Base.astro. It also owns the service-worker registration, because registering
 * is the thing that discovers an update, and splitting the two would mean a second module racing
 * this one for the same `registration.waiting`.
 *
 * The prompt is a prompt, not an announcement: `sw.js` never calls `skipWaiting()` by itself, so
 * the running bundle stays put until the learner presses the button. Dismissing is real — the new
 * worker keeps waiting and takes over on the next natural navigation.
 */
import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateReady, registerServiceWorker, requestPersistentStorage } from '../lib/pwa';
import { useUiLang } from './hooks';
import { t } from '../lib/strings';

export default function UpdatePrompt() {
  const uiLang = useUiLang();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void registerServiceWorker();
    // Independent of the worker: the learner's whole history is in IndexedDB, and iOS evicts it
    // from non-installed sites after about a week idle.
    void requestPersistentStorage();
    return onUpdateReady(() => setReady(true));
  }, []);

  if (!ready || dismissed) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-stone-300 bg-stone-50 px-4 py-3 text-sm shadow-lg dark:border-stone-600 dark:bg-stone-800">
        <span className="text-stone-700 dark:text-stone-200">{t('update.available', uiLang)}</span>
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
        >
          {t('update.apply', uiLang)}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md px-2 py-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
        >
          {t('update.dismiss', uiLang)}
        </button>
      </div>
    </div>
  );
}
