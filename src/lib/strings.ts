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

// The per-profile `da:uilang:<profileId>` key is retired: the chrome language
// is pinned to German (resolveUiLang in src/lib/prefs.ts has the rationale).
// Old keys in learners' localStorage are ignored and never written.

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

  // Shared filters (Themen tabs, vocabulary tables).
  'filter.all': { de: 'Alle', en: 'All', ru: 'Все', uk: 'Усі' },
  'filter.level': { de: 'Niveau', en: 'Level', ru: 'Уровень', uk: 'Рівень' },
  'filter.strand': { de: 'Strang', en: 'Strand', ru: 'Направление', uk: 'Напрям' },
  'filter.status': { de: 'Status', en: 'Status', ru: 'Статус', uk: 'Статус' },

  // Curriculum strand names (ids in course.ts).
  'strand.foundations': { de: 'Grundlagen', en: 'Foundations', ru: 'Основы', uk: 'Основи' },
  'strand.grammar': { de: 'Grammatik', en: 'Grammar', ru: 'Грамматика', uk: 'Граматика' },
  'strand.communication': {
    de: 'Kommunikation',
    en: 'Communication',
    ru: 'Коммуникация',
    uk: 'Комунікація',
  },
  'strand.vocabulary': { de: 'Wortschatz', en: 'Vocabulary', ru: 'Лексика', uk: 'Лексика' },

  // Themen island (CurriculumPath / TopicDetail / OverviewTable).
  'topics.tabPath': { de: 'Lernpfad', en: 'Learning path', ru: 'Учебный путь', uk: 'Навчальний шлях' },
  'topics.tabAtlas': { de: 'Atlas', en: 'Atlas', ru: 'Атлас', uk: 'Атлас' },
  'topics.tabOverview': { de: 'Alle Themen', en: 'All topics', ru: 'Все темы', uk: 'Усі теми' },
  'topics.viewsAria': { de: 'Themenansicht', en: 'Topics view', ru: 'Вид списка тем', uk: 'Вигляд списку тем' },
  'topics.goal': { de: 'Ziel', en: 'Goal', ru: 'Цель', uk: 'Мета' },
  'topics.clearGoalAria': {
    de: 'Lernziel löschen',
    en: 'Clear the learning goal',
    ru: 'Сбросить учебную цель',
    uk: 'Скинути навчальну мету',
  },
  'topics.allMastered': {
    de: 'Alle verfügbaren Themen sind gemeistert.',
    en: 'All available topics are mastered.',
    ru: 'Все доступные темы освоены.',
    uk: 'Усі доступні теми опановано.',
  },
  'topics.nextStep': { de: 'Nächster Schritt', en: 'Next step', ru: 'Следующий шаг', uk: 'Наступний крок' },
  'topics.goalRouteTitle': {
    de: 'Weg zu deinem Ziel',
    en: 'The way to your goal',
    ru: 'Путь к вашей цели',
    uk: 'Шлях до вашої мети',
  },
  'topics.howPathTitle': {
    de: 'So funktioniert der Lernpfad',
    en: 'How the learning path works',
    ru: 'Как устроен учебный путь',
    uk: 'Як влаштовано навчальний шлях',
  },
  'topics.pathExplainer': {
    de: 'Der nächste Schritt folgt dem Lehrplan und deinem gemessenen Lernstand. Im Atlas kannst du stattdessen ein eigenes Ziel wählen.',
    en: 'The next step follows the curriculum and your measured progress. In the Atlas you can pick a goal of your own instead.',
    ru: 'Следующий шаг определяется учебным планом и вашим измеренным прогрессом. В Атласе можно вместо этого выбрать собственную цель.',
    uk: 'Наступний крок визначається навчальним планом і вашим виміряним прогресом. В Атласі можна натомість обрати власну мету.',
  },
  // Per-tier next-action labels (TIER_ACTION_KEYS in OverviewTable.tsx).
  'topics.actionStart': { de: 'Starten', en: 'Start', ru: 'Начать', uk: 'Почати' },
  'topics.actionContinue': { de: 'Fortsetzen', en: 'Continue', ru: 'Продолжить', uk: 'Продовжити' },
  'topics.actionPractice': {
    de: 'Weiter üben',
    en: 'Keep practicing',
    ru: 'Продолжить упражнения',
    uk: 'Продовжити вправи',
  },
  'topics.actionReview': { de: 'Wiederholen', en: 'Review', ru: 'Повторить', uk: 'Повторити' },
  // Full `{…}` templates: Russian and Ukrainian flip to the tabular colon form
  // where an invariant word after a count would be agrammatical.
  'topics.masteredOf': {
    de: '{done}/{total} gemeistert',
    en: '{done}/{total} mastered',
    ru: 'освоено: {done}/{total}',
    uk: 'опановано: {done}/{total}',
  },
  'topics.masteredCount': { de: '{n} gemeistert', en: '{n} mastered', ru: 'освоено: {n}', uk: 'опановано: {n}' },
  // The folded leading-mastered run in the overview table: "✓ 7 gemeistert — anzeigen".
  'topics.foldShow': { de: 'anzeigen', en: 'show', ru: 'показать', uk: 'показати' },
  'topics.foldHide': { de: 'ausblenden', en: 'hide', ru: 'скрыть', uk: 'приховати' },
  'topics.prereqCountOne': {
    de: '{n} Voraussetzung',
    en: '{n} prerequisite',
    ru: 'предварительных тем: {n}',
    uk: 'попередніх тем: {n}',
  },
  'topics.prereqCountMany': {
    de: '{n} Voraussetzungen',
    en: '{n} prerequisites',
    ru: 'предварительных тем: {n}',
    uk: 'попередніх тем: {n}',
  },
  'topics.unlocksCount': { de: 'öffnet {n}', en: 'unlocks {n}', ru: 'открывает {n}', uk: 'відкриває {n}' },
  'topics.current': { de: 'aktuell', en: 'current', ru: 'сейчас', uk: 'зараз' },
  'topics.openDetails': { de: 'Details öffnen ↑', en: 'Open details ↑', ru: 'Открыть детали ↑', uk: 'Відкрити деталі ↑' },
  'topics.collapse': { de: 'Einklappen', en: 'Collapse', ru: 'Свернуть', uk: 'Згорнути' },
  'topics.closeDetailsAria': { de: 'Details schließen', en: 'Close details', ru: 'Закрыть детали', uk: 'Закрити деталі' },
  'topics.relPrereqs': {
    de: 'Voraussetzungen',
    en: 'Prerequisites',
    ru: 'Предварительные темы',
    uk: 'Попередні теми',
  },
  'topics.relUnlocks': {
    de: 'Baut darauf auf',
    en: 'Builds on this',
    ru: 'Опирается на эту тему',
    uk: 'Спирається на цю тему',
  },
  'topics.relDeepens': { de: 'Vertieft', en: 'Deepens', ru: 'Углубляет', uk: 'Поглиблює' },
  'topics.relDeepenedBy': {
    de: 'Wird vertieft durch',
    en: 'Deepened by',
    ru: 'Углубляется темами',
    uk: 'Поглиблюється темами',
  },
  'topics.relRelated': { de: 'Verwandte Themen', en: 'Related topics', ru: 'Связанные темы', uk: 'Пов’язані теми' },
  'topics.none': { de: 'Keine', en: 'None', ru: 'Нет', uk: 'Немає' },
  'topics.openTopic': { de: 'Thema öffnen', en: 'Open the topic', ru: 'Открыть тему', uk: 'Відкрити тему' },
  'topics.setGoal': { de: 'Als Ziel setzen', en: 'Set as goal', ru: 'Сделать целью', uk: 'Зробити метою' },
  // Status filter options (OverviewTable) — deliberately their own keys, not a
  // future TierBadge's: filter options read plural in ru/uk, a badge reads singular.
  'topics.statusOpen': { de: 'Offen', en: 'Open', ru: 'Открытые', uk: 'Відкриті' },
  'topics.statusNew': { de: 'Neu', en: 'New', ru: 'Новые', uk: 'Нові' },
  'topics.statusRead': { de: 'Gelesen', en: 'Read', ru: 'Прочитанные', uk: 'Прочитані' },
  'topics.statusPracticed': { de: 'Geübt', en: 'Practiced', ru: 'Отработанные', uk: 'Відпрацьовані' },
  'topics.statusMastered': { de: 'Gemeistert', en: 'Mastered', ru: 'Освоенные', uk: 'Опановані' },
  'topics.search': { de: 'Thema suchen', en: 'Search topics', ru: 'Поиск темы', uk: 'Пошук теми' },
  'topics.countAll': { de: '{n} Themen', en: '{n} topics', ru: 'тем: {n}', uk: 'тем: {n}' },
  'topics.countFiltered': {
    de: '{shown} von {total} Themen',
    en: '{shown} of {total} topics',
    ru: '{shown} из {total} тем',
    uk: '{shown} з {total} тем',
  },
  'topics.emptyFilter': {
    de: 'Keine Themen mit diesem Filter.',
    en: 'No topics match this filter.',
    ru: 'Нет тем с таким фильтром.',
    uk: 'Немає тем із таким фільтром.',
  },

  // Checkpoint card (Lernpfad).
  'checkpoint.start': {
    de: 'Checkpoint starten →',
    en: 'Start the checkpoint →',
    ru: 'Начать контрольную точку →',
    uk: 'Розпочати контрольну точку →',
  },

  // Probe backlog card (Heute).
  'probe.backlogTitle': {
    de: 'Probe-Rückstand',
    en: 'Delayed-check backlog',
    ru: 'Очередь отложенных проверок',
    uk: 'Черга відкладених перевірок',
  },

  // First-steps onboarding card (Heute).
  'today.howItWorks': { de: "So funktioniert's", en: 'How it works', ru: 'Как это работает', uk: 'Як це працює' },
  // Onboarding step names — their own keys, not nav.ueben/session.stepReview:
  // the role differs (loop step, imperative in ru/uk) and the translations diverge.
  'today.stepRead': { de: 'Lesen', en: 'Read', ru: 'Читайте', uk: 'Читайте' },
  'today.stepPractice': { de: 'Üben', en: 'Practice', ru: 'Упражняйтесь', uk: 'Вправляйтеся' },
  'today.stepReview': { de: 'Wiederholen', en: 'Review', ru: 'Повторяйте', uk: 'Повторюйте' },

  // Vocabulary mastery tables (VocabMastery.tsx).
  'vocab.loading': {
    de: 'Lernstand wird geladen…',
    en: 'Loading your progress…',
    ru: 'Загрузка прогресса…',
    uk: 'Завантаження прогресу…',
  },
  'vocab.search': { de: 'Wort suchen…', en: 'Search words…', ru: 'Поиск слова…', uk: 'Пошук слова…' },
  'vocab.allStatuses': { de: 'Alle Lernstände', en: 'All statuses', ru: 'Все статусы', uk: 'Усі статуси' },
  'vocab.allPos': {
    de: 'Alle Wortarten',
    en: 'All parts of speech',
    ru: 'Все части речи',
    uk: 'Усі частини мови',
  },
  'vocab.dueChip': { de: 'fällig', en: 'due', ru: 'к повторению', uk: 'до повторення' },
  'vocab.dirRecognize': {
    de: 'Erkennen · DE→EN/RU',
    en: 'Recognize · DE→EN/RU',
    ru: 'Узнавание · DE→EN/RU',
    uk: 'Розпізнавання · DE→EN/RU',
  },
  'vocab.dirProduce': {
    de: 'Produzieren · EN/RU→DE',
    en: 'Produce · EN/RU→DE',
    ru: 'Воспроизведение · EN/RU→DE',
    uk: 'Відтворення · EN/RU→DE',
  },
  'vocab.cardStats': {
    de: '{reps} Wiederholungen · Intervall {days} T. · {lapses} Fehler',
    en: '{reps} reviews · interval {days} d · {lapses} lapses',
    ru: 'повторений: {reps} · интервал: {days} дн. · ошибок: {lapses}',
    uk: 'повторень: {reps} · інтервал: {days} дн. · помилок: {lapses}',
  },
  'vocab.notStarted': { de: 'Noch nicht begonnen', en: 'Not started yet', ru: 'Ещё не начато', uk: 'Ще не розпочато' },
  'vocab.dueDate': { de: 'Fällig: {date}', en: 'Due: {date}', ru: 'Повторить: {date}', uk: 'Повторити: {date}' },
  'vocab.emptyFilter': {
    de: 'Keine Wörter entsprechen den Filtern.',
    en: 'No words match the filters.',
    ru: 'Нет слов, соответствующих фильтрам.',
    uk: 'Немає слів, що відповідають фільтрам.',
  },
  'vocab.byArea': {
    de: 'Wortschatz nach Bereichen',
    en: 'Vocabulary by area',
    ru: 'Лексика по разделам',
    uk: 'Лексика за розділами',
  },
  'vocab.deckSummary': {
    de: '{due} Wörter fällig · {strong} sicher',
    en: '{due} words due · {strong} secure',
    ru: 'слов к повторению: {due} · надёжных: {strong}',
    uk: 'слів до повторення: {due} · надійних: {strong}',
  },

  // Mastery gate (TopicProgress.tsx).
  'mastery.missingHeader': {
    de: 'Für „Gemeistert“ fehlt noch:',
    en: 'Still missing for “Mastered”:',
    ru: 'Для «Освоено» ещё не хватает:',
    uk: 'Для «Опановано» ще бракує:',
  },
  'mastery.reqAttempts': { de: 'Aufgaben gelöst', en: 'items answered', ru: 'заданий решено', uk: 'завдань розв’язано' },
  'mastery.reqAccuracy': { de: 'richtig', en: 'correct', ru: 'верно', uk: 'правильно' },
  'mastery.reqDays': { de: 'an 2 Tagen geübt', en: 'practised on 2 days', ru: 'занятия в 2 разных дня', uk: 'заняття у 2 різні дні' },
  'mastery.reqCards': { de: 'Vokabeln wiederholt', en: 'flashcards reviewed', ru: 'карточки повторены', uk: 'картки повторено' },

  // Chrome residue (P8-5): components that never had a language ternary, and
  // static .astro page furniture.
  // Tier badge on a single topic — singular forms; topics.status* above are
  // the OverviewTable filter labels and deliberately plural.
  'tier.untouched': { de: 'Neu', en: 'New', ru: 'Новая', uk: 'Нова' },
  'tier.read': { de: 'Gelesen', en: 'Read', ru: 'Прочитана', uk: 'Прочитана' },
  'tier.practiced': { de: 'Geübt', en: 'Practiced', ru: 'Отработана', uk: 'Відпрацьована' },
  'tier.mastered': { de: 'Gemeistert', en: 'Mastered', ru: 'Освоена', uk: 'Опанована' },
  'tier.manual': { de: 'manuell', en: 'manual', ru: 'вручную', uk: 'вручну' },
  'tier.selfLearned': { de: 'gelernt', en: 'learned', ru: 'изучено', uk: 'вивчено' },
  'tier.selfLearnedTitle': {
    de: 'Selbsteinschätzung – ändert den gemessenen Stand nicht',
    en: 'Self-assessment — does not change the measured state',
    ru: 'Самооценка — не меняет измеренный статус',
    uk: 'Самооцінка — не змінює виміряний стан',
  },
  'evidence.read': { de: 'Gelesen', en: 'Read', ru: 'Прочитано', uk: 'Прочитано' },
  'evidence.practiced': { de: 'Geübt', en: 'Practiced', ru: 'Отработано', uk: 'Відпрацьовано' },
  'evidence.spaced': { de: '2 Tage', en: '2 days', ru: '2 дня', uk: '2 дні' },
  'evidence.vocab': { de: 'Vokabeln', en: 'Vocab', ru: 'Слова', uk: 'Слова' },
  // Static pages: Heute, Session, Üben, topic/vocab/discovery furniture, footer.
  'today.greeting': { de: 'Guten Tag!', en: 'Good day!', ru: 'Добрый день!', uk: 'Доброго дня!' },
  'today.startSession': { de: 'Session starten →', en: 'Start session →', ru: 'Начать сессию →', uk: 'Почати сесію →' },
  'today.quickAccess': { de: 'Schnellzugriff', en: 'Quick access', ru: 'Быстрый доступ', uk: 'Швидкий доступ' },
  'session.pageTitle': { de: 'Tägliche Session', en: 'Daily session', ru: 'Ежедневная сессия', uk: 'Щоденна сесія' },
  'training.pageTitle': { de: 'Gemischtes Training', en: 'Mixed training', ru: 'Смешанная тренировка', uk: 'Змішане тренування' },
  'about.pageTitle': { de: 'Über Deutsch-Atlas', en: 'About Deutsch-Atlas', ru: 'О Deutsch-Atlas', uk: 'Про Deutsch-Atlas' },
  'ueben.tabWiederholen': { de: 'Wiederholen', en: 'Review', ru: 'Повторение', uk: 'Повторення' },
  'ueben.tabTraining': { de: 'Training', en: 'Training', ru: 'Тренировка', uk: 'Тренування' },
  'ueben.tabWortschatz': { de: 'Wortschatz', en: 'Vocabulary', ru: 'Лексика', uk: 'Лексика' },
  'vocab.allWords': { de: 'Alle Wörter', en: 'All words', ru: 'Все слова', uk: 'Усі слова' },
  // Colon style in ru/uk on purpose: it sidesteps numeral agreement, which a
  // flat template cannot carry ("21 слов" is not Russian).
  'vocab.deckSize': {
    de: '{words} Wörter · {cards} Karten',
    en: '{words} words · {cards} cards',
    ru: 'Слов: {words} · Карточек: {cards}',
    uk: 'Слів: {words} · Карток: {cards}',
  },
  'vocab.groupTopic': { de: 'Thema', en: 'Topic', ru: 'Тема', uk: 'Тема' },
  'vocab.groupPos': { de: 'Wortart', en: 'Part of speech', ru: 'Часть речи', uk: 'Частина мови' },
  'topic.prerequisites': { de: 'Voraussetzungen:', en: 'Prerequisites:', ru: 'Предварительные темы:', uk: 'Попередні теми:' },
  'topic.draft': { de: 'Entwurf', en: 'Draft', ru: 'Черновик', uk: 'Чернетка' },
  'topic.pretestTitle': { de: 'Was weißt du schon?', en: 'What do you already know?', ru: 'Что вы уже знаете?', uk: 'Що ви вже знаєте?' },
  'topic.sectionReading': { de: 'Lesetext', en: 'Reading', ru: 'Текст для чтения', uk: 'Текст для читання' },
  'topic.sectionWordField': { de: 'Wortfeld', en: 'Word field', ru: 'Лексическое поле', uk: 'Лексичне поле' },
  'topic.sectionVocab': { de: 'Wortschatz', en: 'Vocabulary', ru: 'Лексика', uk: 'Лексика' },
  'topic.sectionExercises': { de: 'Übungen', en: 'Exercises', ru: 'Упражнения', uk: 'Вправи' },
  // Topic-kind badge (grammar/vocab-field/communication/phonetics). Dedicated
  // keys rather than reusing strand.*: kinds and strands are different
  // taxonomies that merely share three German words today.
  'kind.grammar': { de: 'Grammatik', en: 'Grammar', ru: 'Грамматика', uk: 'Граматика' },
  'kind.vocabField': { de: 'Wortschatz', en: 'Vocabulary', ru: 'Лексика', uk: 'Лексика' },
  'kind.communication': { de: 'Kommunikation', en: 'Communication', ru: 'Коммуникация', uk: 'Комунікація' },
  'kind.phonetics': { de: 'Aussprache', en: 'Pronunciation', ru: 'Произношение', uk: 'Вимова' },
  'discovery.links': { de: 'Links', en: 'Links', ru: 'Ссылки', uk: 'Посилання' },
  'footer.tagline': {
    de: 'Deutsch-Atlas · ein agentengeschriebenes Lehrbuch · A1 → B2',
    en: 'Deutsch-Atlas · an agent-written textbook · A1 → B2',
    ru: 'Deutsch-Atlas · учебник, написанный агентами · A1 → B2',
    uk: 'Deutsch-Atlas · підручник, написаний агентами · A1 → B2',
  },
} as const satisfies Record<string, ChromeString>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, uiLang: UiLang): string {
  return STRINGS[key][uiLang];
}

export function isUiLang(v: unknown): v is UiLang {
  return v === 'de' || v === 'en' || v === 'ru' || v === 'uk';
}
