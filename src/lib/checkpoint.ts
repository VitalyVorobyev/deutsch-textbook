/** Pure rollups over cumulative checkpoint attempts (`role: checkpoint` sets). */
import type { Attempt } from './store';
import { attemptScore, isVerifiedEvidence } from './scoring';

/** What the rollup needs to know about a checkpoint item (from the set's YAML). */
export interface CheckpointItemRef {
  id: string;
  type: string;
  outcomes: string[];
}

export interface CheckpointOutcomeResult {
  outcome: string;
  /** parts-weighted score summed over this outcome's answered items */
  score: number;
  /** items referencing this outcome that have a verified attempt */
  answered: number;
  /** items referencing this outcome overall */
  items: number;
}

export interface CheckpointModeGroup {
  mode: string;
  outcomes: CheckpointOutcomeResult[];
}

export interface CheckpointSummary {
  /** scorable items answered so far (write items log practice evidence and are never scored) */
  answered: number;
  /** scorable items in the set */
  total: number;
  /** parts-weighted correct total across the latest attempt of each answered item */
  score: number;
  /** timestamp of the most recent attempt on the set */
  lastTs: number;
  byMode: CheckpointModeGroup[];
}

const MODE_ORDER = ['listening', 'reading', 'writing', 'spoken-production', 'spoken-interaction'];

/**
 * Roll up checkpoint attempts: the latest verified attempt per item wins (a
 * retake replaces the old result, it never averages), `write` items count as
 * taken but never as score, and outcomes group by CEFR mode for the results
 * panel. Returns null while the checkpoint has never been attempted at all.
 */
export function checkpointOutcomeResults(
  items: CheckpointItemRef[],
  attempts: Attempt[],
  setId: string,
  outcomeModes: Record<string, string> = {},
): CheckpointSummary | null {
  const own = attempts.filter((a) => a.setId === setId);
  if (own.length === 0) return null;

  const latest = new Map<string, Attempt>();
  for (const a of own) {
    if (!isVerifiedEvidence(a)) continue;
    const prev = latest.get(a.itemId);
    if (!prev || a.ts >= prev.ts) latest.set(a.itemId, a);
  }

  const scorable = items.filter((item) => item.type !== 'write');
  const perOutcome = new Map<string, CheckpointOutcomeResult>();
  let answered = 0;
  let score = 0;
  for (const item of scorable) {
    for (const outcome of item.outcomes) {
      const row = perOutcome.get(outcome) ?? { outcome, score: 0, answered: 0, items: 0 };
      row.items++;
      perOutcome.set(outcome, row);
    }
    const attempt = latest.get(item.id);
    if (!attempt) continue;
    answered++;
    const s = attemptScore(attempt);
    score += s;
    for (const outcome of item.outcomes) {
      const row = perOutcome.get(outcome)!;
      row.answered++;
      row.score += s;
    }
  }

  const byMode: CheckpointModeGroup[] = [];
  for (const mode of MODE_ORDER) {
    const outcomes = [...perOutcome.values()].filter((row) => outcomeModes[row.outcome] === mode);
    if (outcomes.length) byMode.push({ mode, outcomes });
  }

  return {
    answered,
    total: scorable.length,
    score,
    lastTs: Math.max(...own.map((a) => a.ts)),
    byMode,
  };
}
