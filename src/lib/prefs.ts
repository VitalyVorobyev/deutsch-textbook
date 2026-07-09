/** Client-side preferences persisted in localStorage and mirrored as <html> attributes. */

export type ExplainLang = 'en' | 'ru';
export type Theme = 'light' | 'dark';
/** Flashcard answer mode for the x-de (production) direction. */
export type CardInputMode = 'typed' | 'reveal';

export const LANG_KEY = 'da:lang';
export const THEME_KEY = 'da:theme';
export const CARD_INPUT_KEY = 'da:cardinput';

export function getExplainLang(): ExplainLang {
  if (typeof document === 'undefined') return 'en';
  return document.documentElement.dataset.explainLang === 'ru' ? 'ru' : 'en';
}

export function setExplainLang(lang: ExplainLang): void {
  document.documentElement.dataset.explainLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  window.dispatchEvent(new CustomEvent('da:langchange', { detail: lang }));
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function getCardInputMode(): CardInputMode {
  if (typeof localStorage === 'undefined') return 'typed';
  return localStorage.getItem(CARD_INPUT_KEY) === 'reveal' ? 'reveal' : 'typed';
}

export function setCardInputMode(mode: CardInputMode): void {
  localStorage.setItem(CARD_INPUT_KEY, mode);
}

/** Pick the current-language variant of a bilingual text. */
export function pick(lang: ExplainLang, text: { en: string; ru: string } | undefined): string {
  if (!text) return '';
  return lang === 'ru' ? text.ru : text.en;
}
