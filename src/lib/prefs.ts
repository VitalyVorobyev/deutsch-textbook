/** Client-side preferences persisted in localStorage and mirrored as <html> attributes. */

import { getActiveProfileId } from './profile';
import { UILANG_KEY_PREFIX, isUiLang, type UiLang } from './strings';

export type ExplainLang = 'en' | 'ru';
export type Theme = 'light' | 'dark';
/**
 * Flashcard answer mode: 'typed'/'reveal' apply to the x-de (production)
 * direction; 'listen' additionally turns de-x (recognition) cards into
 * dictation — hear the word, type it.
 */
export type CardInputMode = 'typed' | 'reveal' | 'listen';

/** Legacy device-level explanation-language key. Reads and writes are
    profile-scoped now (`da:lang:<profileId>`); this key survives as the
    device default a new profile inherits on its first read. */
export const LANG_KEY = 'da:lang';
export const THEME_KEY = 'da:theme';
export const CARD_INPUT_KEY = 'da:cardinput';
export const ASSIST_KEY = 'da:assist';
export const ASSIST_MODEL_KEY = 'da:assist:model';

export function langKeyFor(profileId: string): string {
  return `${LANG_KEY}:${profileId}`;
}

export function uiLangKeyFor(profileId: string): string {
  return `${UILANG_KEY_PREFIX}${profileId}`;
}

/**
 * Stored explanation language for a profile, migrating the legacy
 * device-level key forward on the profile's first read. The legacy `da:lang`
 * is deliberately left in place: it is the device default a *second* profile
 * inherits, so one learner's later choice must never overwrite the device's
 * history (setExplainLang writes only the profile key).
 * Mirrored by the pre-paint inline script in src/layouts/Base.astro — keep
 * the two in sync.
 */
export function resolveExplainLang(profileId: string): ExplainLang | null {
  const own = localStorage.getItem(langKeyFor(profileId));
  if (own === 'en' || own === 'ru') return own;
  const legacy = localStorage.getItem(LANG_KEY);
  if (legacy === 'en' || legacy === 'ru') {
    localStorage.setItem(langKeyFor(profileId), legacy);
    return legacy;
  }
  return null;
}

/** Stored UI (chrome) language for a profile. 'de' — today's exact chrome —
    is the default; there is no legacy key to migrate. Mirrored by the
    pre-paint inline script in src/layouts/Base.astro — keep in sync. */
export function resolveUiLang(profileId: string): UiLang {
  const v = localStorage.getItem(uiLangKeyFor(profileId));
  return isUiLang(v) ? v : 'de';
}

export function getExplainLang(): ExplainLang {
  if (typeof document === 'undefined') return 'en';
  return document.documentElement.dataset.explainLang === 'ru' ? 'ru' : 'en';
}

export function setExplainLang(lang: ExplainLang): void {
  document.documentElement.dataset.explainLang = lang;
  localStorage.setItem(langKeyFor(getActiveProfileId()), lang);
  window.dispatchEvent(new CustomEvent('da:langchange', { detail: lang }));
}

export function getUiLang(): UiLang {
  if (typeof document === 'undefined') return 'de';
  const v = document.documentElement.dataset.uiLang;
  return isUiLang(v) ? v : 'de';
}

export function setUiLang(lang: UiLang): void {
  document.documentElement.dataset.uiLang = lang;
  localStorage.setItem(uiLangKeyFor(getActiveProfileId()), lang);
  window.dispatchEvent(new CustomEvent('da:uilangchange', { detail: lang }));
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
