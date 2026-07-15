import { useSyncExternalStore } from 'react';
import { getExplainLang, getUiLang, type ExplainLang } from '../lib/prefs';
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

function subscribeUiLang(onChange: () => void): () => void {
  window.addEventListener('da:uilangchange', onChange);
  return () => window.removeEventListener('da:uilangchange', onChange);
}

/** Current UI (chrome) language — the other axis (docs/i18n-design.md).
    Same external-store pattern: <html data-ui-lang> is the store. */
export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribeUiLang, getUiLang, () => 'de');
}
