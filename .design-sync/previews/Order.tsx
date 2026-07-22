import { Order } from 'deutsch-atlas';

// The component shuffles `words` itself, so the rendered token order will not
// match the array. Items from content/exercises/a2/.

const noop = () => {};

const satzklammer = {
  id: 'order-brot',
  type: 'order' as const,
  focus: 'perfekt-satzklammer',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  instruction: {
    en: 'Arrange the words into a correct sentence. Start with the capitalized word.',
    ru: 'Составьте правильное предложение. Начните со слова с заглавной буквы.',
    uk: 'Складіть правильне речення. Почніть зі слова з великої літери.',
  },
  words: ['Ich', 'habe', 'ein', 'Brot', 'gekauft.'],
  // Required, not optional: the schema defaults it to [] and the component
  // maps over it during render, so omitting it throws.
  accept: [],
  translation: {
    en: 'I bought a loaf of bread.',
    ru: 'Я купил хлеб.',
    uk: 'Я купив хліб.',
  },
  explain: {
    en: "Sentence bracket: 'habe' in position 2, the participle 'gekauft' strictly at the end.",
    ru: "Глагольная рамка: 'habe' на втором месте, причастие 'gekauft' — строго в конце.",
  },
};

const longerSentence = {
  id: 'order-nebensatz',
  type: 'order' as const,
  focus: 'nebensatz-verb-ende',
  outcomes: ['gruende-nennen'],
  instruction: {
    en: 'Arrange the words into a correct sentence.',
    ru: 'Составьте правильное предложение.',
    uk: 'Складіть правильне речення.',
  },
  words: ['Ich', 'bleibe', 'zu', 'Hause,', 'weil', 'ich', 'krank', 'bin.'],
  accept: [],
  translation: {
    en: 'I am staying at home because I am ill.',
    ru: 'Я остаюсь дома, потому что я болен.',
  },
};

/** A short sentence — five tokens, the common length. */
export function ShortSentence() {
  return (
    <div className="max-w-xl">
      <Order item={satzklammer} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** Eight tokens, which is where the token row starts wrapping. */
export function LongerSentence() {
  return (
    <div className="max-w-xl">
      <Order item={longerSentence} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** Under the Russian explanation language. */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <Order item={satzklammer} lang="ru" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}
