/**
 * Reproducible inventory for ADR 0014.
 *
 * This reports architecture and review queues; it never turns activity counts into a quality
 * score. Use `--json` when another tool needs the data.
 */
import { LEARNING_ACTIVITIES, type LearningActivity } from '@da/schema';
import { contentGraph } from '@da/content/graph';
import { CORE_ITEMS } from '@da/content/profile';
import type { LearningMedium } from '@da/content/elements';

const graph = contentGraph();
const teaching = graph.elements.filter((element) => element.activity);
const media: LearningMedium[] = ['mixed', 'listening', 'document'];
const count = (predicate: (element: (typeof teaching)[number]) => boolean) =>
  teaching.filter(predicate).length;

const topics = [...graph.topics.values()].map((topic) => {
  const elements = (graph.elementsByTopic.get(topic.id) ?? []).filter((element) => element.activity);
  const core = elements.find((element) => element.activity === 'core');
  return {
    id: topic.id,
    level: topic.data.level,
    title: topic.data.title_de,
    sets: elements.length,
    items: elements.reduce((sum, element) => sum + element.depth.items, 0),
    activities: Object.fromEntries(
      LEARNING_ACTIVITIES.map((activity) => [
        activity,
        elements.filter((element) => element.activity === activity).length,
      ]),
    ) as Record<LearningActivity, number>,
    coreItems: core?.depth.items ?? 0,
    productiveApplication: elements.some(
      (element) => element.activity === 'application' && element.touches.includes('produktion'),
    ),
  };
});

const report = {
  sets: teaching.length,
  byActivity: Object.fromEntries(
    LEARNING_ACTIVITIES.map((activity) => [activity, count((element) => element.activity === activity)]),
  ),
  byMedium: Object.fromEntries(
    media.map((medium) => [medium, count((element) => element.medium === medium)]),
  ),
  review: {
    coreOutsideBand: topics.filter(
      (topic) => topic.coreItems < CORE_ITEMS.min || topic.coreItems > CORE_ITEMS.max,
    ),
    withoutProductiveApplication: topics.filter((topic) => !topic.productiveApplication),
    denseTopics: topics.filter((topic) => topic.sets >= 5),
  },
  topics,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('Lernaktivitäten');
console.log(`  ${report.sets} Sets · ${topics.length} Themen`);
console.log(
  `  ${LEARNING_ACTIVITIES.map((activity) => `${activity} ${report.byActivity[activity]}`).join(' · ')}`,
);
console.log(`  ${media.map((medium) => `${medium} ${report.byMedium[medium]}`).join(' · ')}`);

const section = (title: string, rows: typeof topics, detail: (topic: (typeof topics)[number]) => string) => {
  console.log(`\n${title} (${rows.length})`);
  for (const topic of rows) console.log(`  ${topic.level} ${topic.id}: ${detail(topic)}`);
};

section(
  `Grundübung außerhalb ${CORE_ITEMS.min}–${CORE_ITEMS.max}`,
  report.review.coreOutsideBand,
  (topic) => `${topic.coreItems} Aufgaben`,
);
section(
  'Ohne produktive Anwendung',
  report.review.withoutProductiveApplication,
  () => 'kein produktiver Abruf im neuen Kontext',
);
section(
  'Dichte Themen (redaktionell prüfen, kein Fehler)',
  report.review.denseTopics,
  (topic) =>
    `${topic.sets} Sets · ${topic.items} Aufgaben · ` +
    LEARNING_ACTIVITIES.map((activity) => `${activity} ${topic.activities[activity]}`).join(', '),
);
