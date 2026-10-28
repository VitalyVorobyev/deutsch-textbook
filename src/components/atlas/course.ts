/** Shared shapes, labels and row logic for the Themen island (CurriculumPath + its views). */
import type { CurriculumStrand, Outcome } from '@da/schema';
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
export type LevelFilter = 'all' | 'A1' | 'A2' | 'B1';
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

/** Fewer mastered rows than this stay unfolded: replacing a single row with a one-row
    summary hides information without saving space. */
export const FOLD_MIN_RUN = 2;

/**
 * Which rows of a level group a fold would hide: the positions of every mastered topic in the
 * group, wherever it sits, or none when there are too few to be worth folding. Each visible row
 * keeps its curriculum number (`Row` reads it from the full topic list), so a gap in the
 * numbering is where folded rows are, and the summary row says how many.
 */
export function foldableMastered(tiers: readonly Tier[]): Set<number> {
  const mastered = tiers.flatMap((tier, index) => (tier === 'mastered' ? [index] : []));
  return new Set(mastered.length >= FOLD_MIN_RUN ? mastered : []);
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
    return all
      .filter((chip) => chip.state === 'missing')
      .map((chip) => ({ ...chip, state: 'open' as const }));
  }
  return all;
}
