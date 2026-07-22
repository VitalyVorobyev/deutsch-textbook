import { TableFill } from 'deutsch-atlas';

// From content/exercises/a2/perfekt-haben-sein.yaml. A `given: true` cell
// renders prefilled and is not asked — it is the worked example that shows the
// learner what the column wants before the first real gap.

const noop = () => {};

const partizip2 = {
  id: 'partizip2-tabelle',
  type: 'table' as const,
  focus: 'partizip2-form',
  outcomes: ['perfekt-vergangenheit-erzaehlen'],
  title: 'Partizip II',
  instruction: {
    en: 'Fill in the Partizip II of each verb.',
    ru: 'Впишите Partizip II каждого глагола.',
    uk: 'Впишіть Partizip II кожного дієслова.',
  },
  columns: ['Partizip II'],
  rows: [
    { label: 'machen', cells: [{ answer: 'gemacht', given: true }] },
    { label: 'kaufen', cells: [{ answer: 'gekauft' }] },
    { label: 'essen', cells: [{ answer: 'gegessen' }] },
    { label: 'trinken', cells: [{ answer: 'getrunken' }] },
    { label: 'gehen', cells: [{ answer: 'gegangen' }] },
    { label: 'schreiben', cells: [{ answer: 'geschrieben' }] },
  ],
  explain: {
    en: 'Regular verbs: ge-…-t (gemacht, gekauft). Strong verbs: ge-…-en, often with a vowel change (gegessen, getrunken, gegangen, geschrieben).',
    ru: 'Правильные глаголы: ge-…-t (gemacht, gekauft). Сильные глаголы: ge-…-en, часто со сменой гласной (gegessen, getrunken, gegangen, geschrieben).',
  },
};

const praesens = {
  id: 'praesens-endungen',
  type: 'table' as const,
  outcomes: ['praesens-konjugieren'],
  title: 'Präsens — regelmäßige Endungen',
  instruction: {
    en: 'Conjugate each verb in the present tense.',
    ru: 'Проспрягайте каждый глагол в настоящем времени.',
    uk: 'Провідміняйте кожне дієслово в теперішньому часі.',
  },
  columns: ['ich', 'du', 'er/sie/es'],
  rows: [
    {
      label: 'wohnen',
      cells: [{ answer: 'wohne', given: true }, { answer: 'wohnst' }, { answer: 'wohnt' }],
    },
    {
      label: 'arbeiten',
      cells: [{ answer: 'arbeite' }, { answer: 'arbeitest' }, { answer: 'arbeitet' }],
    },
    {
      label: 'heißen',
      cells: [{ answer: 'heiße' }, { answer: 'heißt' }, { answer: 'heißt' }],
    },
  ],
};

/** One asked column, with the first row given as a worked example. */
export function SingleColumn() {
  return (
    <div className="max-w-xl">
      <TableFill
        item={partizip2}
        lang="en"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}

/** A full conjugation grid — three asked columns against a row label. */
export function MultipleColumns() {
  return (
    <div className="max-w-2xl">
      <TableFill
        item={praesens}
        lang="en"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}

/** Under the Russian explanation language; the German table never switches. */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <TableFill
        item={partizip2}
        lang="ru"
        onResult={noop}
        onNext={noop}
        locked={false}
        nextLabel="Weiter →"
      />
    </div>
  );
}
