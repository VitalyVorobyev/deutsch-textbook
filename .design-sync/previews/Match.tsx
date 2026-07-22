import { Match } from 'deutsch-atlas';

// Both `right` forms are shown, because they are genuinely different tasks:
// a plain string is a German↔German pairing, a {en, ru, uk} record is a
// meaning-side pairing that renders in the learner's explanation language.
// Items from content/exercises/a2/.

const noop = () => {};

const germanToGerman = {
  id: 'match-partizip',
  type: 'match' as const,
  focus: 'partizip2-form',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  instruction: {
    en: 'Match each infinitive with its Partizip II.',
    ru: 'Соедините каждый инфинитив с его Partizip II.',
    uk: "З'єднайте кожен інфінітив із його Partizip II.",
  },
  pairs: [
    { left: 'kaufen', right: 'gekauft' },
    { left: 'trinken', right: 'getrunken' },
    { left: 'aufstehen', right: 'aufgestanden' },
    { left: 'bezahlen', right: 'bezahlt' },
    { left: 'studieren', right: 'studiert' },
  ],
};

const meaningSide = {
  id: 'match-modalverben',
  type: 'match' as const,
  outcomes: ['modalverben-verwenden'],
  instruction: {
    en: 'Match each modal verb with its meaning.',
    ru: 'Соедините каждый модальный глагол с его значением.',
    uk: "З'єднайте кожне модальне дієслово з його значенням.",
  },
  pairs: [
    { left: 'können', right: { en: 'ability', ru: 'умение', uk: 'уміння' } },
    { left: 'müssen', right: { en: 'necessity', ru: 'необходимость', uk: 'необхідність' } },
    { left: 'wollen', right: { en: 'wish, plan', ru: 'желание', uk: 'бажання' } },
    { left: 'dürfen', right: { en: 'permission', ru: 'разрешение', uk: 'дозвіл' } },
    { left: 'sollen', right: { en: 'advice', ru: 'совет', uk: 'порада' } },
    { left: 'mögen', right: { en: 'liking', ru: 'нравится', uk: 'подобається' } },
  ],
};

/** A German↔German pairing: both columns stay German. */
export function GermanToGerman() {
  return (
    <div className="max-w-xl">
      <Match item={germanToGerman} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** A meaning-side pairing: the right column renders in the explanation language. */
export function MeaningSide() {
  return (
    <div className="max-w-xl">
      <Match item={meaningSide} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** The same meaning-side item under Russian — only the right column changes. */
export function MeaningSideInRussian() {
  return (
    <div className="max-w-xl">
      <Match item={meaningSide} lang="ru" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}
