import { Cloze } from 'deutsch-atlas';

// Gaps are authored inline in `text` as {{answer}}; the component parses them
// into inputs sized to the answer. Items are copied from
// content/exercises/a2/ — real course material.

const noop = () => {};

const auxiliary = {
  id: 'cloze-gefahren',
  type: 'cloze' as const,
  focus: 'haben-sein',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  instruction: {
    en: 'Fill the gap with the correct auxiliary (haben or sein).',
    ru: 'Вставьте правильный вспомогательный глагол (haben или sein).',
    uk: 'Вставте правильне допоміжне дієслово (haben або sein).',
  },
  text: 'Wir {{sind}} am Sonntag nach Berlin gefahren.',
  translation: {
    en: 'On Sunday we went to Berlin.',
    ru: 'В воскресенье мы поехали в Берлин.',
    uk: 'У неділю ми поїхали до Берліна.',
  },
  explain: {
    en: 'fahren is a verb of movement from A to B, so it takes sein: wir sind gefahren.',
    ru: 'fahren — глагол движения из точки А в точку Б, поэтому вспомогательный глагол — sein: wir sind gefahren.',
  },
};

const adjectiveEndings = {
  id: 'cloze-adjektivendungen',
  type: 'cloze' as const,
  focus: 'adjektiv-endung',
  outcomes: ['adjektive-deklinieren'],
  instruction: {
    en: 'Fill in the correct adjective endings.',
    ru: 'Вставьте правильные окончания прилагательных.',
    uk: 'Вставте правильні закінчення прикметників.',
  },
  text: 'Die Wohnung ist {{hell}}. Wir suchen eine {{helle}} Wohnung. Der Tisch ist {{alt}}. Ich verkaufe den {{alten}} Tisch.',
  translation: {
    en: 'The flat is bright. We are looking for a bright flat. The table is old. I am selling the old table.',
    ru: 'Квартира светлая. Мы ищем светлую квартиру. Стол старый. Я продаю старый стол.',
  },
};

/** One gap in a single sentence — the common shape. */
export function SingleGap() {
  return (
    <div className="max-w-xl">
      <Cloze item={auxiliary} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** Four gaps across four sentences, contrasting predicative and attributive forms. */
export function MultipleGaps() {
  return (
    <div className="max-w-2xl">
      <Cloze item={adjectiveEndings} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** Under the Russian explanation language; the German sentence never switches. */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <Cloze item={auxiliary} lang="ru" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}
