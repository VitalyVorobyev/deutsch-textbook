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

  // Shared action buttons (exercise runners, session flow).
  'action.check': { de: 'Prüfen', en: 'Check', ru: 'Проверить', uk: 'Перевірити' },
  'action.next': { de: 'Weiter →', en: 'Next →', ru: 'Дальше →', uk: 'Далі →' },
  'action.done': { de: 'Fertig', en: 'Done', ru: 'Готово', uk: 'Готово' },
  'action.doneArrow': { de: 'Fertig →', en: 'Done →', ru: 'Готово →', uk: 'Готово →' },
  'action.again': { de: 'Nochmal', en: 'Again', ru: 'Ещё раз', uk: 'Ще раз' },
  'action.skip': { de: 'Überspringen →', en: 'Skip →', ru: 'Пропустить →', uk: 'Пропустити →' },
  'action.play': { de: '▶ Anhören', en: '▶ Listen', ru: '▶ Прослушать', uk: '▶ Прослухати' },
  'action.playSlow': { de: '🐢 Langsam', en: '🐢 Slow', ru: '🐢 Медленно', uk: '🐢 Повільно' },
  'action.cancel': { de: 'Abbrechen', en: 'Cancel', ru: 'Отмена', uk: 'Скасувати' },

  // Flashcard grade buttons (also the ↵ keyboard hint).
  'grade.again': { de: 'Nochmal', en: 'Again', ru: 'Ещё раз', uk: 'Ще раз' },
  'grade.hard': { de: 'Schwer', en: 'Hard', ru: 'Трудно', uk: 'Важко' },
  'grade.good': { de: 'Gut', en: 'Good', ru: 'Хорошо', uk: 'Добре' },
  'grade.easy': { de: 'Leicht', en: 'Easy', ru: 'Легко', uk: 'Легко' },

  // Verdict chip and feedback furniture.
  'verdict.correct': { de: 'Richtig! ✓', en: 'Correct! ✓', ru: 'Правильно! ✓', uk: 'Правильно! ✓' },
  'verdict.wrong': {
    de: 'Leider falsch ✗',
    en: 'Not quite ✗',
    ru: 'К сожалению, неверно ✗',
    uk: 'На жаль, неправильно ✗',
  },
  'verdict.why': { de: 'Warum?', en: 'Why?', ru: 'Почему?', uk: 'Чому?' },

  // Guided session (SessionFlow / ProbeStep). `{n}` is replaced by the caller.
  'session.stepProbes': {
    de: 'Rückblick',
    en: 'Recall check',
    ru: 'Проверка памяти',
    uk: 'Перевірка пам’яті',
  },
  'session.stepReview': { de: 'Wiederholen', en: 'Review', ru: 'Повторение', uk: 'Повторення' },
  'session.stepTraining': { de: 'Training', en: 'Training', ru: 'Тренировка', uk: 'Тренування' },
  'session.stepLearn': {
    de: 'Weiter lernen',
    en: 'Keep learning',
    ru: 'Учиться дальше',
    uk: 'Вчитися далі',
  },
  'session.doneToday': {
    de: 'Heute schon erledigt',
    en: 'Already done today',
    ru: 'На сегодня уже выполнено',
    uk: 'На сьогодні вже виконано',
  },
  'session.repeat': {
    de: 'Nochmal üben',
    en: 'Practice again',
    ru: 'Позаниматься ещё',
    uk: 'Позайматися ще',
  },
  'session.toHome': { de: 'Zur Startseite', en: 'To the home page', ru: 'На главную', uk: 'На головну' },
  'session.noCardsDue': {
    de: 'Keine Karten fällig — weiter zum Training …',
    en: 'No cards due — on to training …',
    ru: 'Нет карточек к повторению — переходим к тренировке …',
    uk: 'Немає карток до повторення — переходимо до тренування …',
  },
  'session.oneCardDue': {
    de: 'Noch 1 Karte fällig — weiter wiederholen',
    en: '1 more card due — keep reviewing',
    ru: 'Осталась 1 карточка — продолжить повторение',
    uk: 'Залишилася 1 картка — продовжити повторення',
  },
  'session.moreCardsDue': {
    de: 'Noch {n} Karten fällig — weiter wiederholen',
    en: '{n} more cards due — keep reviewing',
    ru: 'Осталось карточек: {n} — продолжить повторение',
    uk: 'Залишилося карток: {n} — продовжити повторення',
  },
  'session.noProbesDue': {
    de: 'Keine Rückfragen fällig — weiter …',
    en: 'No recall checks due — moving on …',
    ru: 'Отложенных проверок нет — дальше …',
    uk: 'Відкладених перевірок немає — далі …',
  },
  'session.probesDone': {
    de: 'Rückblick abgeschlossen',
    en: 'Recall check complete',
    ru: 'Проверка памяти завершена',
    uk: 'Перевірка пам’яті завершена',
  },

  // Mixed training empty states.
  'training.emptyNext': {
    de: 'Noch keine Übungen — weiter zum nächsten Schritt …',
    en: 'No exercises yet — on to the next step …',
    ru: 'Упражнений пока нет — к следующему шагу …',
    uk: 'Вправ поки немає — до наступного кроку …',
  },
  'training.emptyTitle': {
    de: 'Noch nichts zu üben',
    en: 'Nothing to practice yet',
    ru: 'Пока нечего тренировать',
    uk: 'Поки немає чого тренувати',
  },

  // Reading section headers.
  'reading.questions': {
    de: 'Fragen zum Text',
    en: 'Questions about the text',
    ru: 'Вопросы к тексту',
    uk: 'Питання до тексту',
  },
  'reading.gist': { de: 'Worum geht es?', en: 'What is it about?', ru: 'О чём текст?', uk: 'Про що текст?' },

  // Flashcard session furniture.
  'flashcards.input': { de: 'Eingabe:', en: 'Input:', ru: 'Ввод:', uk: 'Введення:' },
  'flashcards.modeTyped': { de: 'Tippen', en: 'Type', ru: 'Печатать', uk: 'Друкувати' },
  'flashcards.modeReveal': { de: 'Aufdecken', en: 'Reveal', ru: 'Показать', uk: 'Показати' },
  'flashcards.modeListen': { de: 'Hören', en: 'Listen', ru: 'Слушать', uk: 'Слухати' },
  'flashcards.ttsUnavailable': {
    de: 'Audio ist auf diesem Gerät nicht verfügbar',
    en: 'Audio is not available on this device',
    ru: 'Аудио недоступно на этом устройстве',
    uk: 'Аудіо недоступне на цьому пристрої',
  },
  'flashcards.dirListen': {
    de: '🔊 Hören → Schreiben',
    en: '🔊 Listen → write',
    ru: '🔊 Слушать → писать',
    uk: '🔊 Слухати → писати',
  },
  'flashcards.dirFromDe': { de: 'Deutsch →', en: 'German →', ru: 'Немецкий →', uk: 'Німецька →' },
  'flashcards.dirToDe': { de: '→ Deutsch', en: '→ German', ru: '→ Немецкий', uk: '→ Німецька' },
  'flashcards.typePlaceholder': {
    de: 'Auf Deutsch …',
    en: 'In German …',
    ru: 'По-немецки …',
    uk: 'Німецькою …',
  },
  'flashcards.typedCorrect': { de: '✓ Richtig!', en: '✓ Correct!', ru: '✓ Правильно!', uk: '✓ Правильно!' },
  'flashcards.typedWrong': { de: '✗ Falsch', en: '✗ Wrong', ru: '✗ Неверно', uk: '✗ Неправильно' },
  'flashcards.yourInput': {
    de: 'Deine Eingabe:',
    en: 'Your answer:',
    ru: 'Ваш ответ:',
    uk: 'Ваша відповідь:',
  },
  // Full `{n}` templates, not bare labels: Russian and Ukrainian cannot append an
  // invariant word after a count ("1 новых" is agrammatical), so they flip to the
  // tabular colon form while de/en keep today's exact "3 fällig · 1 neu" shape.
  'flashcards.due': { de: '{n} fällig', en: '{n} due', ru: 'к повторению: {n}', uk: 'до повторення: {n}' },
  'flashcards.new': { de: '{n} neu', en: '{n} new', ru: 'новых: {n}', uk: 'нових: {n}' },

  // Exercise widgets.
  'exercise.specialChars': {
    de: 'Sonderzeichen',
    en: 'Special characters',
    ru: 'Специальные символы',
    uk: 'Спеціальні символи',
  },
  'exercise.words': { de: 'Wörter', en: 'words', ru: 'слов', uk: 'слів' },

  // Document stimulus.
  'document.everyday': {
    de: 'Alltagsdokument',
    en: 'Everyday document',
    ru: 'Бытовой документ',
    uk: 'Побутовий документ',
  },

  // Schreib-Assistent panel.
  'assist.reenable': {
    de: 'Assistent ist aus — einschalten',
    en: 'Assistant is off — turn it on',
    ru: 'Ассистент выключен — включить',
    uk: 'Асистент вимкнено — увімкнути',
  },
  'assist.request': {
    de: 'Hinweise vom lokalen Assistenten',
    en: 'Hints from the local assistant',
    ru: 'Подсказки локального ассистента',
    uk: 'Підказки локального асистента',
  },
  'assist.allDone': {
    de: 'Alle Hinweise erledigt.',
    en: 'All hints resolved.',
    ru: 'Все подсказки учтены.',
    uk: 'Усі підказки враховано.',
  },
  'assist.disclaimer': {
    de: 'Hinweise sind Vorschläge — keine Bewertung.',
    en: 'Hints are suggestions — not a grade.',
    ru: 'Подсказки — это предложения, а не оценка.',
    uk: 'Підказки — це пропозиції, а не оцінка.',
  },
} as const satisfies Record<string, ChromeString>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, uiLang: UiLang): string {
  return STRINGS[key][uiLang];
}

export function isUiLang(v: unknown): v is UiLang {
  return v === 'de' || v === 'en' || v === 'ru' || v === 'uk';
}
