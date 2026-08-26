/**
 * Explicit error state for a progress read that stalled or came back implausibly
 * empty. Rendered INSTEAD of the surface's normal empty/fresh view, because on
 * those surfaces "empty" has a meaning ("you are new here", "nothing due") that a
 * stalled store must never be allowed to fake — the reassurance line exists
 * because the learner seeing this has just been told their progress is missing.
 */
import { t } from '../lib/strings';
import { useUiLang } from './hooks';

export default function ProgressLoadError({ onRetry }: { onRetry: () => void }) {
  const uiLang = useUiLang();
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950"
    >
      <p className="text-sm font-medium text-red-800 dark:text-red-200">
        {t('persist.loadError', uiLang)}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        {t('persist.loadRetry', uiLang)}
      </button>
    </div>
  );
}
