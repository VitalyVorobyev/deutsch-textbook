/** Mastery heuristics derived from the attempt log (used by the Today page). */
import type { Attempt } from './store';

export type MasteryState = 'untouched' | 'started' | 'mastered';

export interface TopicNode {
  /** topic id (frontmatter id) */
  id: string;
  /** route path, e.g. "/topics/a2/perfekt-haben-sein" */
  path: string;
  level: string;
  kind: string;
  title_de: string;
  title_en: string;
  title_ru: string;
  prerequisites: string[];
  /** exercise set ids belonging to this topic */
  exerciseSets: string[];
}

const MASTERY_WINDOW = 10;
const MASTERY_MIN_ATTEMPTS = 5;
const MASTERY_ACCURACY = 0.8;

export function topicMastery(node: TopicNode, attempts: Attempt[]): MasteryState {
  const own = attempts.filter((a) => node.exerciseSets.includes(a.setId));
  if (own.length === 0) return 'untouched';
  const recent = own.slice(-MASTERY_WINDOW);
  if (recent.length >= MASTERY_MIN_ATTEMPTS) {
    const accuracy = recent.filter((a) => a.correct).length / recent.length;
    if (accuracy >= MASTERY_ACCURACY) return 'mastered';
  }
  return 'started';
}

const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

/** Suggest the next topic: lowest level first; prefer topics already started,
    then untouched topics whose prerequisites are all mastered, then any untouched. */
export function suggestNextTopic(nodes: TopicNode[], attempts: Attempt[]): TopicNode | undefined {
  const mastery = new Map(nodes.map((n) => [n.id, topicMastery(n, attempts)]));
  const sorted = [...nodes].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.id.localeCompare(b.id),
  );
  const started = sorted.find((n) => mastery.get(n.id) === 'started');
  if (started) return started;
  const ready = sorted.find(
    (n) =>
      mastery.get(n.id) === 'untouched' &&
      n.prerequisites.every((p) => !mastery.has(p) || mastery.get(p) === 'mastered'),
  );
  if (ready) return ready;
  return sorted.find((n) => mastery.get(n.id) !== 'mastered');
}
