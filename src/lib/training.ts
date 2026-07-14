/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { topicPracticeSetIds, type TopicContext, type TopicNode } from './mastery';
import type { ExerciseItem, ExerciseRole, Level, VisualDocument } from './schemas';
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
  document?: VisualDocument;
}

export interface SessionItem {
  /** `${setId}::${itemId}` — matches how attempts are keyed for priority lookup */
  uid: string;
  setId: string;
  topicId: string;
  title_de: string;
  level: Level;
  item: ExerciseItem;
  document?: VisualDocument;
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
 * Afterwards the selection is interleaved so that no two consecutive items share a set,
 * which is possible exactly when no set holds more than half the queue.
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
        document: s.document,
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

  return interleaveByTopic([...fromPriority, ...fromBroad].slice(0, count));
}

/**
 * Reorders a selection so that no two consecutive items come from the same **topic**.
 *
 * The topic is the right grain, and it was not always the one used. Grouping by set let
 * `a2/dativ` and `a2/drill-mir-mich` sit next to each other — two different sets, but the
 * same rule, back to back. Interleaving exists so the learner has to *choose* the rule
 * before applying it; two dative items in a row hand them the choice for free, whichever
 * file the items came from. `dativ` alone owns four sets, so this was not a corner case.
 *
 * It also replaces a hill-climbing swap repair that got stuck: it only ever tried to
 * relocate the *right-hand* member of a conflicting pair, and only accepted a swap that
 * strictly reduced the conflict count, so a queue like `a b a b b a b a` was a local
 * minimum with nowhere to go. Every single swap of that stray `b` either kept the count at
 * one or made it worse — and moving the `b` to its *left* would have fixed it. A third of
 * four-and-four sessions came out with a same-topic pair in them.
 *
 * The greedy rule below cannot get stuck: at each step take the next item from whichever
 * topic has the most items left, excluding the topic just served. Always spending down the
 * largest remaining topic is what keeps it from cornering itself, and it reaches zero
 * conflicts whenever zero is reachable at all — that is, whenever no single topic holds
 * more than half the queue. When one topic does dominate, the leftovers are unavoidable and
 * are appended; nothing is dropped, because a short session would be the worse failure.
 *
 * Order inside a topic is preserved exactly, and ties between equally large topics go to
 * whichever one's next item came first, so the priority bands still decide who is served
 * early.
 */
function interleaveByTopic(items: readonly SessionItem[]): SessionItem[] {
  const groups = new Map<string, SessionItem[]>();
  for (const item of items) {
    const group = groups.get(item.topicId);
    if (group) group.push(item);
    else groups.set(item.topicId, [item]);
  }
  const rank = new Map(items.map((item, i) => [item.uid, i]));

  const out: SessionItem[] = [];
  let previous: string | null = null;
  while (out.length < items.length) {
    let pick: SessionItem[] | undefined;
    let pickId: string | null = null;
    for (const [topicId, group] of groups) {
      if (group.length === 0 || topicId === previous) continue;
      if (
        !pick ||
        group.length > pick.length ||
        (group.length === pick.length && rank.get(group[0]!.uid)! < rank.get(pick[0]!.uid)!)
      ) {
        pick = group;
        pickId = topicId;
      }
    }
    // Only the topic we just served has anything left: it holds more than half the queue,
    // so a same-topic pair is arithmetically unavoidable. Serve them rather than shorten
    // the session.
    if (!pick) {
      out.push(...groups.get(previous!)!);
      break;
    }
    out.push(pick.shift()!);
    previous = pickId;
  }
  return out;
}
