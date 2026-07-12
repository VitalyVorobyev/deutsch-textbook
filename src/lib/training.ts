/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { topicPracticeSetIds, type TopicContext, type TopicNode } from './mastery';
import type { ExerciseItem, ExerciseRole, Level } from './schemas';
import type { Attempt } from './store';
import { weakFocuses } from './weakness';
import { shuffle } from './shuffle';

/** One exercise set flattened for training, with its owning topic's metadata. */
export interface TrainingSet {
  /** exercise set id, e.g. "a2/perfekt-haben-sein" — attempts are logged under this */
  setId: string;
  topicId: string;
  /** German title of the owning topic */
  title_de: string;
  level: Level;
  role: ExerciseRole;
  items: ExerciseItem[];
}

export interface SessionItem {
  /** `${setId}::${itemId}` — matches how attempts are keyed for priority lookup */
  uid: string;
  setId: string;
  topicId: string;
  title_de: string;
  level: Level;
  item: ExerciseItem;
}

/**
 * Share of every mixed session reserved for material the learner has already answered
 * correctly, longest ago — the broad cumulative retrieval the roadmap asks for.
 *
 * Without a reservation the three priority bands (answered wrong, weak focus, never seen)
 * fill the session on their own, and they always can: there is nearly always something
 * wrong or unseen to serve. A learner with any backlog would then never meet an older
 * topic again — and an old topic answered correctly weeks ago is precisely the material
 * whose retention has decayed most and is most worth retrieving. Recency and weakness
 * are the loudest signals, not the most informative ones, so they do not get the whole
 * session.
 */
export const BROAD_RETRIEVAL_SHARE = 0.25;

/**
 * Pretests never enter the pool — they are guesses by design, meant to be
 * taken once before the article. Any other set is eligible only when its
 * topic is opened (readAt) or already practiced (≥1 logged non-pretest attempt
 * — profiles that predate readAt tracking must not lose their pool).
 */
export function eligibleTrainingSets<
  T extends { setId: string; topicId: string; role?: string },
>(sets: T[], spine: string[], nodes: TopicNode[], ctx: TopicContext): T[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const attempted = new Set(ctx.attempts.map((a) => a.setId));
  const practiced = (topicId: string): boolean => {
    const node = nodeById.get(topicId);
    return node ? topicPracticeSetIds(node).some((id) => attempted.has(id)) : false;
  };
  void spine;
  const trainableRoles = new Set(['practice', 'drill']);
  return sets.filter(
    (s) =>
      trainableRoles.has(s.role ?? 'practice') &&
      (ctx.topics[s.topicId]?.readAt || practiced(s.topicId)),
  );
}

/** A resumed queue may continue only while every queued set is still eligible. */
export function resumedQueueIsEligible(
  queued: readonly { setId: string }[],
  eligible: readonly { setId: string }[],
): boolean {
  const allowed = new Set(eligible.map((set) => set.setId));
  return queued.every((entry) => allowed.has(entry.setId));
}

/**
 * Builds an interleaved session from all items across all eligible sets.
 *
 * Priority bands, filled in order:
 *   1. items whose most recent attempt was wrong,
 *   2. items whose `focus` tag is currently weak and that are not already in band 1,
 *   3. items never attempted.
 * Bands 1–3 are shuffled.
 *
 * Band 4 — items answered correctly, least recently first — is not merely the leftover:
 * `BROAD_RETRIEVAL_SHARE` of the session is *reserved* for it, so the loud bands cannot
 * take everything (see the constant). When band 4 is short the priority bands take the
 * slack back, and vice versa; nothing is ever wasted.
 *
 * Afterwards adjacency is repaired so no two consecutive items share a set (best effort —
 * impossible if one set dominates the selection).
 */
export function buildSession(
  sets: readonly TrainingSet[],
  count: number,
  attempts: readonly Attempt[],
): SessionItem[] {
  // most recent attempt per item
  const lastAttempt = new Map<string, { correct: boolean; ts: number }>();
  for (const a of attempts) {
    const key = `${a.setId}::${a.itemId}`;
    const prev = lastAttempt.get(key);
    if (!prev || a.ts >= prev.ts) lastAttempt.set(key, { correct: a.correct, ts: a.ts });
  }

  const weak = new Set(weakFocuses([...attempts]).map((w) => w.focus));

  const pool: SessionItem[] = sets.flatMap((s) =>
    s.items.map((item) => ({
      uid: `${s.setId}::${item.id}`,
      setId: s.setId,
      topicId: s.topicId,
      title_de: s.title_de,
      level: s.level,
      item,
    })),
  );

  const lastWrong: SessionItem[] = [];
  const weakFocus: SessionItem[] = [];
  const untried: SessionItem[] = [];
  const seen: { entry: SessionItem; ts: number }[] = [];
  for (const p of pool) {
    const a = lastAttempt.get(p.uid);
    if (a && !a.correct) lastWrong.push(p);
    else if (p.item.focus && weak.has(p.item.focus)) weakFocus.push(p);
    else if (!a) untried.push(p);
    else seen.push({ entry: p, ts: a.ts });
  }

  const priority = [...shuffle(lastWrong), ...shuffle(weakFocus), ...shuffle(untried)];
  const broad = seen.sort((a, b) => a.ts - b.ts).map((s) => s.entry);

  const reserved = Math.min(Math.round(count * BROAD_RETRIEVAL_SHARE), broad.length);
  const fromPriority = priority.slice(0, Math.max(0, count - reserved));
  const fromBroad = broad.slice(0, count - fromPriority.length);

  return repairAdjacency([...fromPriority, ...fromBroad].slice(0, count));
}

/**
 * Swaps items until no two consecutive entries come from the same set (or no swap
 * improves things anymore). Each accepted swap strictly reduces the number of adjacent
 * same-set pairs, so this terminates.
 */
function repairAdjacency(items: SessionItem[]): SessionItem[] {
  const out = [...items];
  const conflicts = (arr: readonly SessionItem[]): number => {
    let n = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i]!.setId === arr[i - 1]!.setId) n++;
    return n;
  };

  let current = conflicts(out);
  let improved = true;
  while (current > 0 && improved) {
    improved = false;
    outer: for (let i = 1; i < out.length; i++) {
      if (out[i]!.setId !== out[i - 1]!.setId) continue;
      for (let j = 0; j < out.length; j++) {
        if (j === i) continue;
        [out[i], out[j]] = [out[j]!, out[i]!];
        const c = conflicts(out);
        if (c < current) {
          current = c;
          improved = true;
          break outer;
        }
        [out[i], out[j]] = [out[j]!, out[i]!]; // revert
      }
    }
  }
  return out;
}
