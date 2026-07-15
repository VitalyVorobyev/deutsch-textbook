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

/** Display order of the strands. Labels are chrome now — STRAND_KEYS in
    TopicDetail.tsx maps these ids into the strings table (the per-tier action
    labels moved the same way, to TIER_ACTION_KEYS in OverviewTable.tsx). */
export const STRANDS: readonly CurriculumStrand[] = [
  'foundations',
  'grammar',
  'communication',
  'vocabulary',
];
