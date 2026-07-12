/** Shared shapes and labels for the Themen island (CurriculumPath + its views). */
import type { CurriculumStrand, Outcome } from '../../lib/schemas';
import type { Tier, TopicNode } from '../../lib/mastery';
import type { CheckpointItemRef } from '../../lib/checkpoint';
import type { LearningGoal } from '../../lib/store';

export interface CourseTopic extends TopicNode {
  strand: CurriculumStrand;
  group: string;
  outcomes: Outcome[];
  deepens: string[];
  related: string[];
}

export interface CourseUnit {
  id: string;
  level: string;
  title_de: string;
  title_en: string;
  title_ru: string;
  topics: CourseTopic[];
}

export interface PathCheckpoint {
  level: string;
  title: string;
  path: string;
  setId: string;
  items: CheckpointItemRef[];
}

export type ActiveGoal = LearningGoal & { topicId: string };
export type View = 'path' | 'atlas' | 'overview';
export type LevelFilter = 'all' | 'A1' | 'A2';
/** `open` is every tier below mastered — "what's still left for me". */
export type StatusFilter = 'all' | 'open' | Tier;

export const STRANDS: Array<[CurriculumStrand, string]> = [
  ['foundations', 'Grundlagen'],
  ['grammar', 'Grammatik'],
  ['communication', 'Kommunikation'],
  ['vocabulary', 'Wortschatz'],
];

export const actionLabel: Record<Tier, string> = {
  untouched: 'Starten',
  read: 'Fortsetzen',
  practiced: 'Weiter üben',
  mastered: 'Wiederholen',
};
