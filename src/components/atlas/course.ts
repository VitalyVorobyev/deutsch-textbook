/** Shared shapes, labels and row logic for the Themen island (CurriculumPath + its views). */
import type { CurriculumStrand, Outcome } from '../../lib/schemas';
import type { Tier, TopicEvidence, TopicNode } from '../../lib/mastery';
import type { CheckpointItemRef } from '../../lib/checkpoint';
import type { LearningGoal } from '../../lib/store';
import type { EvidenceChipView } from '../topic/EvidenceChips';

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

/** A leading mastered run shorter than this stays unfolded: replacing a single
    row with a one-row summary hides information without saving space. */
export const FOLD_MIN_RUN = 2;

/**
 * How many leading rows of a level group a fold would hide: the length of the
 * consecutive run of mastered topics at the top of the group, or 0 when the
 * run is too short to be worth folding. Only a *prefix* ever folds — a
 * mastered topic sitting after the first open one stays visible, which is
 * also what keeps the row numbering honest (after a fold of 7, the first
 * visible row is number 8).
 */
export function foldableMasteredRun(tiers: readonly Tier[]): number {
  let run = 0;
  while (run < tiers.length && tiers[run] === 'mastered') run += 1;
  return run >= FOLD_MIN_RUN ? run : 0;
}

/**
 * Which evidence chips an overview row shows. The Gemeistert badge already
 * implies every chip, so a mastered row shows none; a Geübt row shows only
 * the metrics still missing, as dashed "open" chips — what is left to do,
 * not what is done. Lower tiers keep the full earned/missing rendering.
 * Fortschritt deliberately does not filter: its list always renders the full
 * EvidenceChips, and the two surfaces still cannot disagree because both
 * read the same topicEvidence().
 */
export function overviewChips(tier: Tier, evidence: TopicEvidence): EvidenceChipView[] {
  if (tier === 'mastered') return [];
  const all: EvidenceChipView[] = [
    { label: 'evidence.read', state: evidence.read ? 'earned' : 'missing' },
    { label: 'evidence.practiced', state: evidence.practiced ? 'earned' : 'missing' },
    { label: 'evidence.spaced', state: evidence.spaced ? 'earned' : 'missing' },
  ];
  if (evidence.hasVocab) {
    all.push({ label: 'evidence.vocab', state: evidence.vocab ? 'earned' : 'missing' });
  }
  if (tier === 'practiced') {
    return all.filter((chip) => chip.state === 'missing').map((chip) => ({ ...chip, state: 'open' as const }));
  }
  return all;
}
