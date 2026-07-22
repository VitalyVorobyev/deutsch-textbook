import { TopicDetail } from 'deutsch-atlas';

// The card resolves the prerequisite / unlocks / deepens / related ids on
// `topic` against the full `topics` array, so the preview has to supply the
// neighbours too — a detail card with an empty topics array renders every
// relation as "keine".

const noop = async () => {};

const courseTopic = (
  id: string,
  title_de: string,
  title_en: string,
  title_ru: string,
  extra: Partial<{
    prerequisites: string[];
    deepens: string[];
    related: string[];
    group: string;
    strand: 'foundations' | 'grammar' | 'communication' | 'vocabulary';
  }> = {},
) => ({
  id,
  path: `/topics/a2/${id}`,
  level: 'A2',
  kind: 'grammar',
  title_de,
  title_en,
  title_ru,
  prerequisites: extra.prerequisites ?? [],
  exerciseSets: [`a2/${id}`],
  vocabIds: [],
  readingIds: [],
  strand: extra.strand ?? ('grammar' as const),
  group: extra.group ?? 'verbformen',
  outcomes: [],
  deepens: extra.deepens ?? [],
  related: extra.related ?? [],
});

const perfekt = {
  ...courseTopic(
    'perfekt-haben-sein',
    'Perfekt mit haben und sein',
    'Perfect with haben and sein',
    'Перфект с haben и sein',
    {
      prerequisites: ['praesens-regelmaessig'],
      related: ['praeteritum-sein-haben'],
    },
  ),
  outcomes: [
    {
      id: 'perfekt-vergangenheit-erzaehlen',
      mode: 'writing' as const,
      domain: 'personal' as const,
      de: 'Ich kann über Vergangenes berichten und dabei haben und sein richtig wählen.',
      en: 'I can talk about the past, choosing haben or sein correctly.',
      ru: 'Я могу рассказать о прошлом, правильно выбирая haben или sein.',
    },
    {
      id: 'partizip2-bilden',
      mode: 'writing' as const,
      de: 'Ich kann das Partizip II regelmäßiger und häufiger starker Verben bilden.',
      en: 'I can form the Partizip II of regular and common strong verbs.',
      ru: 'Я могу образовать Partizip II правильных и частотных сильных глаголов.',
    },
  ],
};

const topics = [
  perfekt,
  courseTopic('praesens-regelmaessig', 'Präsens regelmäßig', 'Regular present tense', 'Настоящее время'),
  courseTopic('praeteritum-sein-haben', 'Präteritum von sein und haben', 'Past of sein and haben', 'Претерит sein и haben'),
  courseTopic('plusquamperfekt', 'Plusquamperfekt', 'Past perfect', 'Плюсквамперфект', {
    deepens: ['perfekt-haben-sein'],
  }),
  courseTopic('trennbare-verben', 'Trennbare Verben', 'Separable verbs', 'Отделяемые приставки', {
    prerequisites: ['perfekt-haben-sein'],
  }),
];

const groups = [
  { id: 'verbformen', strand: 'grammar' as const, title_de: 'Verbformen', title_en: 'Verb forms', title_ru: 'Формы глагола' },
];

/** The standalone card, as the atlas drawer renders it. */
export function Default() {
  return (
    <div className="max-w-3xl">
      <TopicDetail
        topic={perfekt}
        topics={topics}
        groups={groups}
        completion={{ auto: 'practiced', tier: 'practiced' }}
        lang="en"
        isGoal={false}
        onGoal={noop}
      />
    </div>
  );
}

/** Under the Russian explanation language — outcomes and subtitle switch. */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-3xl">
      <TopicDetail
        topic={perfekt}
        topics={topics}
        groups={groups}
        completion={{ auto: 'practiced', tier: 'practiced' }}
        lang="ru"
        isGoal={false}
        onGoal={noop}
      />
    </div>
  );
}

/** Already the active goal: the "set as goal" button is dropped. */
export function AlreadyTheGoal() {
  return (
    <div className="max-w-3xl">
      <TopicDetail
        topic={perfekt}
        topics={topics}
        groups={groups}
        completion={{ auto: 'mastered', tier: 'mastered' }}
        lang="en"
        isGoal
        onGoal={noop}
      />
    </div>
  );
}

/** `embedded` drops the card chrome; the host row or drawer provides it. */
export function Embedded() {
  return (
    <div className="max-w-3xl rounded-lg bg-stone-100 py-5 dark:bg-stone-900">
      <TopicDetail
        topic={perfekt}
        topics={topics}
        groups={groups}
        lang="en"
        isGoal={false}
        onGoal={noop}
        embedded
      />
    </div>
  );
}
