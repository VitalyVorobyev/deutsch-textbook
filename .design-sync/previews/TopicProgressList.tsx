import { TopicProgressList } from 'deutsch-atlas';

// The list derives every badge and chip itself from `ctx` — it is given no
// tiers, only the raw attempt log and topic state. So the preview has to build
// learner state that actually produces the four tiers rather than asserting
// them.
//
// Timestamps are fixed rather than relative to now, so the rendered card is
// deterministic across builds.

const DAY = 86_400_000;
const D1 = 1_752_000_000_000; // fixed reference day
const D2 = D1 + DAY;
const D3 = D1 + 2 * DAY;

const node = (
  id: string,
  title_de: string,
  title_en: string,
  title_ru: string,
  level: string,
) => ({
  id,
  path: `/topics/${level.toLowerCase()}/${id}`,
  level,
  kind: 'grammar',
  title_de,
  title_en,
  title_ru,
  prerequisites: [],
  exerciseSets: [`${level.toLowerCase()}/${id}`],
  vocabIds: [],
  readingIds: [],
});

const nodes = [
  node('perfekt-haben-sein', 'Perfekt mit haben und sein', 'Perfect with haben and sein', 'Перфект с haben и sein', 'A2'),
  node('adjektive-deklination', 'Adjektivdeklination', 'Adjective declension', 'Склонение прилагательных', 'A2'),
  node('wechselpraepositionen', 'Wechselpräpositionen', 'Two-way prepositions', 'Предлоги двойного управления', 'A2'),
  node('modalverben', 'Modalverben', 'Modal verbs', 'Модальные глаголы', 'A2'),
];

/** Correct attempts on one set, spread across the given days. */
const attempts = (setId: string, count: number, days: number[], correct = true) =>
  Array.from({ length: count }, (_, i) => ({
    setId,
    itemId: `${setId}-item-${i}`,
    itemType: 'mc',
    correct,
    given: correct ? 'bin' : 'habe',
    ts: days[i % days.length]! + i * 60_000,
  }));

const ctx = {
  attempts: [
    // Mastered: enough correct attempts, spread across more than one day.
    ...attempts('a2/perfekt-haben-sein', 12, [D1, D2, D3]),
    // Practised: real attempts, but all on a single day.
    ...attempts('a2/adjektive-deklination', 4, [D1]),
  ],
  cards: {},
  topics: {
    'perfekt-haben-sein': { readAt: D1 },
    'adjektive-deklination': { readAt: D1 },
    // Read only — the article was opened, nothing practised yet.
    wechselpraepositionen: { readAt: D2 },
    // modalverben deliberately absent: untouched.
  },
};

/** The Fortschritt panel's list, showing all four tiers at once. */
export function AllFourTiers() {
  return (
    <div className="w-full max-w-2xl">
      <TopicProgressList nodes={nodes} ctx={ctx} />
    </div>
  );
}

/** A learner who has just started: one article read, nothing practised. */
export function EarlyLearner() {
  return (
    <div className="w-full max-w-2xl">
      <TopicProgressList
        nodes={nodes}
        ctx={{ attempts: [], cards: {}, topics: { 'perfekt-haben-sein': { readAt: D1 } } }}
      />
    </div>
  );
}

/** A self-rated topic and a placed topic, beside their measured tiers. */
export function WithSelfRatingAndPlacement() {
  return (
    <div className="w-full max-w-2xl">
      <TopicProgressList
        nodes={nodes}
        ctx={{
          ...ctx,
          topics: {
            ...ctx.topics,
            wechselpraepositionen: { readAt: D2, manual: 'learned' as const, manualAt: D2 },
            modalverben: { placement: { setId: 'a2/placement-a2', at: D1, score: 0.85 } },
          },
        }}
      />
    </div>
  );
}
