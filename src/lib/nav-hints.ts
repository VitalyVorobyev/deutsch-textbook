/**
 * What a page is for, as the `title` tooltip of the navigation link that leads to it.
 *
 * These were standing descriptions under each page's H1 — a line of explanation the learner read
 * on every visit, beneath a heading that only repeated the tab they had just clicked. A page
 * header now says only what the navigation does not (docs/overview.md, "Page chrome"), and the
 * description moved here, where it answers the question before the click rather than after it.
 *
 * Explanation-language text, so it follows Lernsprache rather than the pinned German chrome: the
 * links carry every half as `data-hint-*` attributes and `applyHints` sets `title` from the
 * active one — again on `da:langchange`, so a switch needs no reload. A missing half (`de`
 * included) falls back to EN, as the descriptions did. Touch devices never show a `title`; what
 * they lose is exactly what was judged not worth a line of screen.
 */

export interface Hint {
  en: string;
  ru: string;
  uk: string;
}

export const NAV_HINTS = {
  themen: {
    en: 'Your course path — continue clearly, explore freely.',
    ru: 'Ваш учебный путь: понятный следующий шаг и свободный выбор тем.',
    uk: 'Ваш навчальний шлях — чіткий наступний крок і вільний вибір тем.',
  },
  entdecken: {
    en: 'German worth reading for its own sake: places, people, documents and stories. Optional, with no completion bar and no review debt.',
    ru: 'Немецкий, который интересен сам по себе: места, люди, документы и истории. Всё необязательно — без шкалы прохождения и долгов по повторению.',
    uk: "Німецька, яку варто читати заради неї самої: місця, люди, документи та історії. Усе необов'язкове — без шкали проходження й боргів із повторення.",
  },
  referenz: {
    en: 'Compact lookup pages. Opening them does not change mastery or progress.',
    ru: 'Краткие справочные страницы. Их просмотр не влияет на освоение тем и прогресс.',
    uk: 'Компактні довідкові сторінки. Їхній перегляд не впливає на опанування тем і прогрес.',
  },
  fortschritt: {
    en: 'Your activity, evidence, and vocabulary mastery for this profile — all stored in this browser.',
    ru: 'Ваша активность, результаты и владение словарём по этому профилю — всё хранится в этом браузере.',
    uk: 'Ваша активність, результати та володіння словником у цьому профілі — усе зберігається в цьому браузері.',
  },
  wiederholen: {
    en: 'Your daily review across all decks — due cards first, then a few new ones.',
    ru: 'Ежедневное повторение по всем колодам — сначала карточки к повторению, затем немного новых.',
    uk: 'Щоденне повторення за всіма колодами — спершу картки до повторення, потім кілька нових.',
  },
  training: {
    en: 'A mixed session across all topics — constantly switching rules forces you to recognize which one applies, something practicing one topic at a time never trains.',
    ru: 'Смешанная тренировка по всем темам — постоянная смена правил учит распознавать, какое из них применить; при отработке тем по отдельности этот навык не развивается.',
    uk: 'Змішане заняття за всіма темами — постійна зміна правил змушує розпізнавати, яке з них застосувати; відпрацювання однієї теми за раз цієї навички не тренує.',
  },
  wortschatz: {
    en: 'Flashcard decks built from the vocabulary base.',
    ru: 'Колоды карточек, собранные из словарной базы.',
    uk: 'Колоди карток, зібрані зі словникової бази.',
  },
  pruefung: {
    en: 'Exam preparation: the official Goethe practice sets for A1, A2 and B1 as timed runs, original A1 practice, and the Leben in Deutschland test. Results are for calibration and never change mastery.',
    ru: 'Подготовка к экзаменам: официальные тренировочные комплекты Гёте для A1, A2 и B1 на время, собственные задания для A1 и тест Leben in Deutschland. Результаты нужны для самооценки и не влияют на освоение тем.',
    uk: 'Підготовка до іспитів: офіційні тренувальні комплекти Ґете для A1, A2 і B1 на час, власні завдання для A1 і тест Leben in Deutschland. Результати потрібні для самооцінки й не впливають на опанування тем.',
  },
  // The hub card's short name ("Leben in D.") is abbreviated, so its hint spells the name out.
  leben: {
    en: 'Leben in Deutschland: practice for the citizenship test and the “Leben in Deutschland” test.',
    ru: 'Leben in Deutschland: подготовка к тесту на гражданство и тесту «Leben in Deutschland».',
    uk: 'Leben in Deutschland: підготовка до тесту на громадянство й тесту «Leben in Deutschland».',
  },
} as const satisfies Record<string, Hint>;

export type HintKey = keyof typeof NAV_HINTS;

/** The attributes a navigation link carries for `applyHints` — spread onto the element. */
export function hintAttrs(key: HintKey | undefined): Record<string, string> {
  if (!key) return {};
  const hint = NAV_HINTS[key];
  return { 'data-hint-en': hint.en, 'data-hint-ru': hint.ru, 'data-hint-uk': hint.uk };
}

/** Sets each hinted element's `title` to its half in `lang`, or to EN when it has none. */
export function applyHints(root: ParentNode, lang: string | undefined): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-hint-en]')) {
    const own = lang ? el.getAttribute(`data-hint-${lang}`) : null;
    el.title = own || el.getAttribute('data-hint-en') || '';
  }
}
