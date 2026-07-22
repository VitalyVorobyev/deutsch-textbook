import { Listen } from 'deutsch-atlas';

// The German sentence is spoken by browser TTS and is also the canonical typed
// answer, so it is never shown before submission — the card is deliberately a
// play button and an empty input. Items from content/exercises/a2/.

const noop = () => {};

const haende = {
  id: 'listen-haende',
  type: 'listen' as const,
  focus: 'reflexiv-dativ',
  outcomes: ['arzttermin-verstehen'],
  instruction: {
    en: 'Listen and type what you hear.',
    ru: 'Прослушайте и напишите, что вы слышите.',
    uk: 'Прослухайте і напишіть, що ви чуєте.',
  },
  text: 'Waschen Sie sich bitte die Hände.',
  // Required, not optional: the schema defaults it to [] and the component
  // spreads it during render, so omitting it throws.
  accept: [],
  translation: {
    en: 'Please wash your hands.',
    ru: 'Пожалуйста, вымойте руки.',
    uk: 'Будь ласка, помийте руки.',
  },
};

const termin = {
  id: 'listen-termin',
  type: 'listen' as const,
  outcomes: ['arzttermin-verstehen'],
  instruction: {
    en: 'Listen and type what you hear.',
    ru: 'Прослушайте и напишите, что вы слышите.',
    uk: 'Прослухайте і напишіть, що ви чуєте.',
  },
  text: 'Der Termin ist am Dienstag um zehn Uhr.',
  accept: ['Der Termin ist Dienstag um zehn Uhr.'],
  translation: {
    en: 'The appointment is on Tuesday at ten.',
    ru: 'Приём во вторник в десять часов.',
  },
};

/** The canonical item: play button, insert bar for ä/ö/ü/ß, empty input. */
export function Default() {
  return (
    <div className="max-w-xl">
      <Listen item={haende} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

// No second English cell: the German text is never shown before submission, so
// two items under the same explanation language render identically — the only
// axis this component has a visible variant on is `lang`.

/**
 * Under the Russian explanation language — the instruction and the input
 * placeholder switch, the German insert bar does not.
 */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <Listen item={termin} lang="ru" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}
