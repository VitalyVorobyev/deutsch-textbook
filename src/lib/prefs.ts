/** Client-side preferences persisted in localStorage and mirrored as <html> attributes. */

export type ExplainLang = 'en' | 'ru';
export type Theme = 'light' | 'dark';
/**
 * Flashcard answer mode: 'typed'/'reveal' apply to the x-de (production)
 * direction; 'listen' additionally turns de-x (recognition) cards into
 * dictation — hear the word, type it.
 */
export type CardInputMode = 'typed' | 'reveal' | 'listen';

export const LANG_KEY = 'da:lang';
export const THEME_KEY = 'da:theme';
export const CARD_INPUT_KEY = 'da:cardinput';
export const ASSIST_KEY = 'da:assist';
export const ASSIST_MODEL_KEY = 'da:assist:model';

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
  const v = localStorage.getItem(CARD_INPUT_KEY);
  return v === 'reveal' || v === 'listen' ? v : 'typed';
}

export function setCardInputMode(mode: CardInputMode): void {
  localStorage.setItem(CARD_INPUT_KEY, mode);
}

/**
 * Schreib-Assistent (local Ollama advisory feedback on `write` drafts).
 * Device-level, not profile-level: which model is installed is a property of
 * the machine, not of who is learning. Default **on** — safe because the
 * feature self-hides when the probe finds no local model.
 */
export function getAssistEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(ASSIST_KEY) !== 'off';
}

export function setAssistEnabled(on: boolean): void {
  localStorage.setItem(ASSIST_KEY, on ? 'on' : 'off');
}

/** The learner's chosen Ollama tag; resolution against the installed tags
    (first gemma*, else first) lives in chooseAssistModel (src/lib/assist.ts). */
export function getAssistModel(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(ASSIST_MODEL_KEY) : null;
}

export function setAssistModel(tag: string): void {
  localStorage.setItem(ASSIST_MODEL_KEY, tag);
}

/** Pick the current-language variant of a bilingual text. */
export function pick(lang: ExplainLang, text: { en: string; ru: string } | undefined): string {
  if (!text) return '';
  return lang === 'ru' ? text.ru : text.en;
}
