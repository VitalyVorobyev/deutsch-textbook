import { useSyncExternalStore } from 'react';
import { getExplainLang, type ExplainLang } from '../lib/prefs';

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
