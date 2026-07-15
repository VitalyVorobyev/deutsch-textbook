/** Client-side preferences persisted in localStorage and mirrored as <html> attributes. */

import { getActiveProfileId } from './profile';
import { UILANG_KEY_PREFIX, isUiLang, type UiLang } from './strings';

/**
 * Content explanation languages (the other axis from UiLang chrome — see
 * docs/i18n-design.md). `en` and `ru` are fully authored; `uk` and `de` are
 * optional per field and fall back to `en` at render time (see pick()).
 * Mirrors the UI_LANGS/isUiLang pattern in src/lib/strings.ts.
 */
export const EXPLAIN_LANGS = ['en', 'ru', 'uk', 'de'] as const;
export type ExplainLang = (typeof EXPLAIN_LANGS)[number];

export function isExplainLang(v: unknown): v is ExplainLang {
  return (EXPLAIN_LANGS as readonly unknown[]).includes(v);
}
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
  if (isExplainLang(own)) return own;
  // The legacy device key predates uk/de and is never written anymore, so it
  // deliberately stays en/ru-only: a wider value there could only be
  // hand-edited storage, and copying it forward would launder it into a
  // profile choice the learner never made.
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
  const v = document.documentElement.dataset.explainLang;
  return isExplainLang(v) ? v : 'en';
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

/**
 * An explanation text: `en`/`ru` always authored, `uk`/`de` optional halves
 * that arrive content-wave by content-wave and fall back to `en`.
 *
 * WARNING: never pass a record whose `de` key is German *content* rather than
 * a German explanation half — e.g. a reading gloss, where `de` is the glossed
 * phrase itself. Under ExplainLang 'de', pick() would reveal the phrase as
 * its own gloss. Destructure such records to {en, ru, uk} at the call site
 * (see src/components/reading/ReadingText.tsx). Outcome records are fine:
 * their `de` is the German can-do, which IS the 'de'-mode explanation.
 */
export interface ExplainText {
  en: string;
  ru: string;
  uk?: string;
  de?: string;
}

/** Pick the current-language variant of an explanation text. */
export function pick(lang: ExplainLang, text: ExplainText | undefined): string {
  if (!text) return '';
  if (lang === 'ru') return text.ru;
  if (lang === 'uk') return text.uk ?? text.en;
  if (lang === 'de') return text.de ?? text.en;
  return text.en;
}

/**
 * The language pick() actually resolves to for this record — for the `lang`
 * attribute of an element showing picked text. Under 'uk'/'de' the text may be
 * the EN fallback, and stamping the raw ExplainLang there would have a screen
 * reader pronounce English with Ukrainian/German rules. Keep the branches in
 * lockstep with pick() above.
 */
export function pickLang(lang: ExplainLang, text: ExplainText | undefined): ExplainLang {
  if (!text) return 'en';
  if (lang === 'ru') return 'ru';
  if (lang === 'uk') return text.uk ? 'uk' : 'en';
  if (lang === 'de') return text.de ? 'de' : 'en';
  return 'en';
}
