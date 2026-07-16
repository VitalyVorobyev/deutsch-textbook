import { useSyncExternalStore } from 'react';
import { getExplainLang, type ExplainLang } from '../lib/prefs';
import type { UiLang } from '../lib/strings';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('da:langchange', onChange);
  return () => window.removeEventListener('da:langchange', onChange);
}

/** Current explanation language, kept in sync with the header toggle.
    The <html data-explain-lang> attribute is the store (setExplainLang updates
    it before dispatching 'da:langchange'), so the toggle is a plain
    external-store subscription — no state to sync in an effect. */
export function useExplainLang(): ExplainLang {
  return useSyncExternalStore(subscribe, getExplainLang, () => 'en');
}

/** The chrome language, pinned to German (resolveUiLang in src/lib/prefs.ts
    has the rationale). Kept as a hook so the ~35 `t(key, useUiLang())` call
    sites — and a future un-pinning — stay one-line changes. */
export function useUiLang(): UiLang {
  return 'de';
}
