/**
 * Chrome strings — the UI's own furniture (navigation, buttons, section
 * labels), as opposed to the content's explanation language.
 *
 * Two independent axes (docs/i18n-design.md), never conflated: `UiLang` picks
 * the chrome language per profile and defaults to 'de' — today's exact UI —
 * while `ExplainLang` (src/lib/prefs.ts) picks which half of a Bilingual
 * block is shown. Full immersion is simply uiLang 'de' over any explanation
 * language.
 *
 * The classification rule: a string enters this table iff it is German
 * today. Helper text that follows the explanation language stays an
 * ExplainLang surface (a pick() record) and is never reclassified — that is
 * what makes the 'de' default zero-visual-change by construction.
 *
 * Every entry carries all four languages (`satisfies` enforces it), so chrome
 * needs no uk→en fallback — unlike content, where uk is optional (P8-4).
 */

export type UiLang = 'de' | 'en' | 'ru' | 'uk';
export const UI_LANGS: readonly UiLang[] = ['de', 'en', 'ru', 'uk'];

/** Per-profile localStorage key: `da:uilang:<profileId>`. */
export const UILANG_KEY_PREFIX = 'da:uilang:';

type ChromeString = Record<UiLang, string>;

export const STRINGS = {
  'nav.heute': { de: 'Heute', en: 'Today', ru: 'Сегодня', uk: 'Сьогодні' },
  'nav.themen': { de: 'Themen', en: 'Topics', ru: 'Темы', uk: 'Теми' },
  'nav.entdecken': { de: 'Entdecken', en: 'Discover', ru: 'Открытия', uk: 'Відкриття' },
  'nav.referenz': { de: 'Referenz', en: 'Reference', ru: 'Справочник', uk: 'Довідник' },
  'nav.ueben': { de: 'Üben', en: 'Practice', ru: 'Практика', uk: 'Практика' },
  'nav.fortschritt': { de: 'Fortschritt', en: 'Progress', ru: 'Прогресс', uk: 'Прогрес' },
  'nav.ueber': { de: 'Über', en: 'About', ru: 'О курсе', uk: 'Про курс' },
} as const satisfies Record<string, ChromeString>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, uiLang: UiLang): string {
  return STRINGS[key][uiLang];
}

export function isUiLang(v: unknown): v is UiLang {
  return v === 'de' || v === 'en' || v === 'ru' || v === 'uk';
}
