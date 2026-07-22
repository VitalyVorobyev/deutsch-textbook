import { MultipleChoice } from 'deutsch-atlas';

// Items are copied from content/exercises/a2/perfekt-haben-sein.yaml — real
// authored course material, so the card shows what a learner actually sees.
// The component shuffles `options` itself, so the rendered order will not match
// the array order.

const noop = () => {};

const nachHause = {
  id: 'mc-nach-hause',
  type: 'mc' as const,
  focus: 'haben-sein',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  prompt: 'Ich ___ gestern nach Hause gegangen.',
  options: ['habe', 'bin', 'ist'],
  correct: 1,
  translation: {
    en: 'I went home yesterday.',
    ru: 'Вчера я пошёл домой.',
    uk: 'Вчора я пішов додому.',
  },
  explain: {
    en: "gehen describes movement from A to B, so it forms the Perfekt with sein: ich bin gegangen. 'Ist' is the er/sie/es form, and 'habe' is the classic learner mistake — English 'I have gone' pulls you toward haben.",
    ru: "gehen обозначает движение из точки А в точку Б, поэтому перфект образуется с sein: ich bin gegangen. 'Ist' — форма для er/sie/es, а 'habe' — типичная ошибка русскоязычных.",
  },
};

const gegessen = {
  id: 'mc-gegessen',
  type: 'mc' as const,
  focus: 'haben-sein',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  prompt: 'Er ___ eine Pizza gegessen.',
  options: ['hat', 'ist', 'habt'],
  correct: 0,
  translation: {
    en: 'He ate a pizza.',
    ru: 'Он съел пиццу.',
    uk: 'Він з’їв піцу.',
  },
  explain: {
    en: "essen is neither movement nor a change of state, so it takes haben: er hat gegessen. 'Habt' is the ihr form.",
    ru: "essen — не движение и не смена состояния, поэтому перфект образуется с haben: er hat gegessen. 'Habt' — форма для ihr.",
  },
};

const withInstruction = {
  ...gegessen,
  id: 'mc-with-instruction',
  instruction: {
    en: 'Choose the correct auxiliary verb.',
    ru: 'Выберите правильный вспомогательный глагол.',
    uk: 'Виберіть правильне допоміжне дієслово.',
  },
};

/** The canonical item: a German gap sentence and one correct option. */
export function Default() {
  return (
    <div className="max-w-xl">
      <MultipleChoice
        item={nachHause}
        lang="en"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}

/** With an `instruction`, which renders above the prompt in the chosen language. */
export function WithInstruction() {
  return (
    <div className="max-w-xl">
      <MultipleChoice
        item={withInstruction}
        lang="en"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}

/**
 * The same item under the Russian explanation language. Only the bilingual
 * halves switch — the German prompt and options never do.
 */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <MultipleChoice
        item={withInstruction}
        lang="ru"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}

// No `locked` cell: the prop blocks the click handler but changes nothing
// visually, so a card for it would be an exact duplicate of Default.
