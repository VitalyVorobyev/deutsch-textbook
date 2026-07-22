import { Translate } from 'deutsch-atlas';

// The prompt is the source sentence in the learner's explanation language; the
// answer is typed in German. `key_tokens` names the tokens whose exact form the
// item's focus tag grades. Item from content/exercises/a2/.

const noop = () => {};

const biografie = {
  id: 'translate-mareike',
  type: 'translate' as const,
  focus: 'praeteritum-sein-haben',
  outcomes: ['biografie-erzaehlen'],
  instruction: {
    en: 'Translate into German.',
    ru: 'Переведите на немецкий.',
    uk: 'Перекладіть німецькою.',
  },
  prompt_en:
    'Three years ago Mareike moved to Hamburg. At first she was alone. She had no job and she had to learn a lot of German.',
  prompt_ru:
    'Три года назад Марайке переехала в Гамбург. Сначала она была одна. Работы у неё не было, и ей приходилось много учить немецкий.',
  prompt_uk:
    'Три роки тому Марайке переїхала до Гамбурга. Спочатку вона була сама. Роботи в неї не було, і їй доводилося багато вчити німецьку.',
  answer:
    'Vor drei Jahren ist Mareike nach Hamburg umgezogen. Zuerst war sie allein. Sie hatte keine Arbeit und sie musste viel Deutsch lernen.',
  accept: [
    'Mareike ist vor drei Jahren nach Hamburg umgezogen. Zuerst war sie allein. Sie hatte keine Arbeit und sie musste viel Deutsch lernen.',
    'Vor drei Jahren ist Mareike nach Hamburg gezogen. Zuerst war sie allein. Sie hatte keine Arbeit und sie musste viel Deutsch lernen.',
  ],
  key_tokens: ['war', 'hatte', 'musste'],
};

const shortItem = {
  id: 'translate-kurz',
  type: 'translate' as const,
  focus: 'perfekt-satzklammer',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  instruction: {
    en: 'Translate into German.',
    ru: 'Переведите на немецкий.',
    uk: 'Перекладіть німецькою.',
  },
  prompt_en: 'Yesterday I bought a loaf of bread.',
  prompt_ru: 'Вчера я купил хлеб.',
  answer: 'Gestern habe ich ein Brot gekauft.',
  accept: ['Ich habe gestern ein Brot gekauft.'],
  key_tokens: ['habe', 'gekauft'],
};

/** A one-sentence item — the usual size. */
export function ShortPrompt() {
  return (
    <div className="max-w-xl">
      <Translate item={shortItem} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** A three-sentence transfer task, where the textarea grows. */
export function LongerPrompt() {
  return (
    <div className="max-w-2xl">
      <Translate item={biografie} lang="en" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}

/** Under Russian: the source prompt itself switches, since it is the question. */
export function RussianSourcePrompt() {
  return (
    <div className="max-w-2xl">
      <Translate item={biografie} lang="ru" onResult={noop} onNext={noop} locked={false} nextLabel="Weiter →" />
    </div>
  );
}
