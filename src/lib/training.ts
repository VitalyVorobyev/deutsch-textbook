/** Which exercise sets mixed training may draw from (client-side — "opened" lives in IndexedDB). */
import { topicPracticeSetIds, type TopicContext, type TopicNode } from './mastery';
import type { Bilingual, ExerciseItem, ExerciseRole, Level, VisualDocument } from '@da/schema';
import type { RecordingScript } from './audio';
import type { Attempt } from './store';
import { weakFocuses, type RevisionLookup } from './weakness';
import { shuffle } from './shuffle';
import { AGAIN_GAP_UNFAMILIAR, requeueAfter } from './requeue';

/** A set a topic owns: the only kind training, probes and the Lernpfad serve. */
export type TopicOwnedSet = TrainingSet & { topicId: string };

/** Level-owned sets (checkpoints, placements, exam practice) have pages of their own and are
    never served by training, so every training entry point filters them out first. */
export const isTopicOwned = <T extends { topicId?: string }>(
  set: T,
): set is T & { topicId: string } => set.topicId !== undefined;

/**
 * A retired set stays in the corpus so its ids stay reserved and its attempts keep resolving
 * (`revisionLookup` reads every set), but nothing serves it: not training, not remediation, not
 * a probe, not a resumed queue.
 */
export const isServed = (set: { retired?: boolean }): boolean => set.retired !== true;

/** One exercise set flattened for training, with its owning topic's metadata. */
export interface TrainingSet {
  /** exercise set id, e.g. "a2/perfekt-haben-sein" — attempts are logged under this */
  setId: string;
  /** the owning topic; absent for a level-owned set (checkpoint, placement, exam practice) */
  topicId?: string;
  /** German title of the owning topic, or the set's own title for a level-owned set */
  title_de: string;
  level: Level;
  role: ExerciseRole;
  arming?: string[];
  items: ExerciseItem[];
  document?: VisualDocument;
  /** the set's own bilingual title, when authored — not every set carries one (schema-optional) */
  title?: Bilingual;
  /** a task set's shared recording: its items carry no script, so served alone they play this */
  recording?: RecordingScript;
  /** retired: kept so old attempts resolve, never served (`isServed`) */
  retired?: true;
}

/**
 * Roles that ordinary practice — mixed training and probe-failure remediation — may
 * ever draw from. Pretests are guesses taken before the lesson; checkpoints, probes
 * and placements each own a separate evidence surface (docs/architecture/runtime-
 * contracts.md). Hoisted so `eligibleTrainingSets` and `remediationSetFor` share one
 * definition of "trainable" rather than two allowlists that could drift apart.
 */
const TRAINABLE_ROLES = new Set<ExerciseRole>(['practice', 'drill']);

export interface SessionItem {
  /** `${setId}::${itemId}` — matches how attempts are keyed for priority lookup; a retry's
      uid adds `RETRY_SUFFIX`, so a queue never holds one uid twice */
  uid: string;
  setId: string;
  topicId: string;
  title_de: string;
  level: Level;
  item: ExerciseItem;
  document?: VisualDocument;
  recording?: RecordingScript;
  /** a second try at an item answered wrong earlier in this run — never logged (`withRetry`) */
  retry?: true;
}

/** Appended to an item's uid for its in-session retry. Item and set ids are slugs, never `#`. */
export const RETRY_SUFFIX = '#retry';

/** The queue entry's uid without a retry marker: the item's own `${setId}::${itemId}`. */
export const baseUid = (uid: string): string =>
  uid.endsWith(RETRY_SUFFIX) ? uid.slice(0, -RETRY_SUFFIX.length) : uid;

/**
 * The queue after the entry at `index` was answered: a `translate` answered wrong comes back
 * once, later in the same run, as the same item. Anything else returns the queue unchanged.
 *
 * Feedback has just shown the model answer, so the retry is retrieval practice after
 * feedback — and an immediate one would be answered from working memory, the finding behind
 * the flashcard rule (`recordMiss`, requeue.ts). It therefore waits `AGAIN_GAP_UNFAMILIAR`
 * items, the flashcard gap for something not retrieved at all, or goes last when fewer remain.
 *
 * The retry is not evidence: the caller never logs it, so the first failure stays the logged
 * result and the item is still last-answered-wrong for tomorrow's `buildSession`. One retry
 * per item per run, and a retry is never itself retried.
 */
export function withRetry(
  queue: readonly SessionItem[],
  index: number,
  correct: boolean,
): readonly SessionItem[] {
  const entry = queue[index];
  if (!entry || correct || entry.retry || entry.item.type !== 'translate') return queue;
  const uid = `${entry.uid}${RETRY_SUFFIX}`;
  if (queue.some((e) => e.uid === uid)) return queue;
  const retry: SessionItem = { ...entry, uid, retry: true };
  return [
    ...queue.slice(0, index + 1),
    ...requeueAfter(queue.slice(index + 1), retry, AGAIN_GAP_UNFAMILIAR),
  ];
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
 * A `RevisionLookup` over shipped content, for `buildSession`'s weakness signal.
 *
 * Build it from **all** sets, not the eligible ones: an item outside the session's pool still
 * contributes attempts to a focus tag, and resolving it to `undefined` would keep counting an
 * answer to a question it no longer asks. `scripts/progress-audit.ts` reads the whole exercise
 * catalog for the same reason, and the two are meant to agree about what counts.
 */
export function revisionLookup(sets: readonly TrainingSet[]): RevisionLookup {
  const revisions = new Map<string, number>();
  for (const s of sets)
    for (const item of s.items) revisions.set(`${s.setId}::${item.id}`, item.revision ?? 1);
  return (setId, itemId) => revisions.get(`${setId}::${itemId}`);
}

/**
 * Pretests never enter the pool — they are guesses by design, meant to be
 * taken once before the article. Any other set is eligible only when its
 * topic is opened (readAt) or already practiced (≥1 logged non-pretest attempt
 * — profiles that predate readAt tracking must not lose their pool).
 */
export function eligibleTrainingSets<
  T extends { setId: string; topicId?: string; role?: string; retired?: boolean },
>(
  sets: T[],
  spine: string[],
  nodes: TopicNode[],
  ctx: TopicContext,
): Array<T & { topicId: string }> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const attempted = new Set(ctx.attempts.map((a) => a.setId));
  const practiced = (topicId: string): boolean => {
    const node = nodeById.get(topicId);
    return node ? topicPracticeSetIds(node).some((id) => attempted.has(id)) : false;
  };
  void spine;
  return sets
    .filter(isTopicOwned)
    .filter(isServed)
    .filter(
      (s) =>
        TRAINABLE_ROLES.has((s.role ?? 'practice') as ExerciseRole) &&
        (ctx.topics[s.topicId]?.readAt || practiced(s.topicId)),
    );
}

/**
 * Which of a topic's own exercise sets to point a learner back at after a failed
 * delayed probe (docs/adrs/0003-the-evidence-model.md).
 *
 * Candidates are the topic's own `TRAINABLE_ROLES` sets whose items carry the given
 * `focus` tag — the same tag a probe family exposes on `ProbeFamily.focus`
 * (src/lib/probes.ts). Among those:
 *
 * 1. **`role: drill` first** — purpose-built remediation over a practice set the tag
 *    merely passes through.
 * 2. **Then the most `translate` items carrying the tag.** The learner's assembly mode
 *    (`translate`) runs at 43% accuracy against 85–92% for recognition formats
 *    (mc/match/order) — measured against the attempt log, not assumed — so the
 *    recommendation should point at the response mode that is actually weak, not at
 *    whichever set happens to have more recognition coverage of the same tag.
 * 3. **Then earliest in the topic's authored `exercises:` order.**
 *
 * Pure and stateless — no attempt log, no I/O. The third tie-break relies on
 * `Array.prototype.sort`'s guaranteed stability plus **the order of `sets` as given**,
 * so a caller that cares about it must pass `sets` already in `TopicNode.exerciseSets`
 * order (the atlas's authored order), not collection order. `sets` may be the whole
 * corpus — filtering by `topicId` happens here — or already narrowed to one topic.
 */
export function remediationSetFor(
  focus: string,
  topicId: string,
  sets: readonly TrainingSet[],
): TrainingSet | undefined {
  const candidates = sets.filter(
    (s) =>
      s.topicId === topicId &&
      isServed(s) &&
      TRAINABLE_ROLES.has(s.role) &&
      s.items.some((item) => item.focus === focus),
  );
  if (candidates.length === 0) return undefined;

  const translateCount = (s: TrainingSet): number =>
    s.items.filter((item) => item.type === 'translate' && item.focus === focus).length;
  const roleRank = (s: TrainingSet): number => (s.role === 'drill' ? 0 : 1);

  return [...candidates].sort((a, b) => {
    const byRole = roleRank(a) - roleRank(b);
    if (byRole !== 0) return byRole;
    return translateCount(b) - translateCount(a);
  })[0];
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
 * Priority bands, in order of precedence (`allocatePrioritySlots` shares the slots out):
 *   1. items whose most recent attempt was wrong — minus any that are FOSSILIZING
 *      (see below); their never-seen same-focus siblings are promoted into this band
 *      in their place,
 *   2. items whose `focus` tag is currently weak and that are not already in band 1,
 *   3. items never attempted (minus any siblings promoted into band 1),
 *   4. fossilizing items that were demoted out of band 1 (see below).
 * Bands 1–4 are each shuffled within themselves (band 3 within each of its tiers).
 *
 * An item is FOSSILIZING when its last two attempts were both wrong: it has already
 * failed a retry, and dealing it again on the same footing is exactly how
 * `b1/erfahrungen-erzaehlen:uebersetzen-waehrend-regen` was dealt and
 * failed nine sessions running while the eight never-seen items of
 * `b1/drill-temporal-nebensatz`, sharing its focus tag, sat untouched in band 3. A
 * fossilizing band-1 item with at least one never-seen same-focus sibling in the pool
 * is demoted: the never-seen siblings move ahead into the band-1 slot it held, and the
 * fossilizing item itself drops to the end of the priority list (after band 3, before
 * the broad-retrieval band) — fresh material gets the turn a repeated retry never
 * earned, and the item's own re-anchoring pauses until it has been worked through. A
 * fossilizing item with NO never-seen same-focus sibling stays in band 1 unchanged:
 * retrying is all there is. A single recent wrong answer (not two consecutive) is
 * never fossilizing and keeps today's band-1 behavior exactly.
 *
 * Band 5 — items answered correctly, least recently first — is not merely the leftover:
 * `BROAD_RETRIEVAL_SHARE` of the session is *reserved* for it, so the loud bands cannot
 * take everything (see the constant). When band 5 is short the priority bands take the
 * slack back, and vice versa; nothing is ever wasted.
 *
 * The priority slots are shared out by `allocatePrioritySlots`, not filled band after band:
 * band 1 alone holds every item ever answered wrong last, which on a real log is far more
 * than a session has slots, and filled first it left weak-focus items, drills and every
 * never-attempted item without a single slot. Within band 3, items that would arm a probe
 * family still waiting for its first practice (`unarmedArmingKeys`) come first, then items
 * of sets never attempted at all, then the rest; each tier is shuffled within itself.
 *
 * Afterwards the selection is interleaved so that no two consecutive items share a set,
 * which is possible exactly when no set holds more than half the queue.
 */
export function buildSession(
  sets: readonly TopicOwnedSet[],
  count: number,
  attempts: readonly Attempt[],
  options: SessionOptions,
): SessionItem[] {
  const { current, unarmedArmingKeys } = options;
  // most recent attempt per item
  const lastAttempt = new Map<string, { correct: boolean; ts: number }>();
  for (const a of attempts) {
    const key = `${a.setId}::${a.itemId}`;
    const prev = lastAttempt.get(key);
    if (!prev || a.ts >= prev.ts) lastAttempt.set(key, { correct: a.correct, ts: a.ts });
  }

  // every attempt per item, oldest→newest — only used to test the last two for
  // "fossilizing" below; `lastAttempt` above stays the single source of
  // truth for correctness/recency everywhere else.
  const attemptsByItem = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const key = `${a.setId}::${a.itemId}`;
    const arr = attemptsByItem.get(key);
    if (arr) arr.push(a);
    else attemptsByItem.set(key, [a]);
  }
  for (const arr of attemptsByItem.values()) arr.sort((a, b) => a.ts - b.ts);
  const isFossilizing = (uid: string): boolean => {
    const arr = attemptsByItem.get(uid);
    if (!arr || arr.length < 2) return false;
    return !arr[arr.length - 1]!.correct && !arr[arr.length - 2]!.correct;
  };

  const weak = new Set(weakFocuses([...attempts], { current }).map((w) => w.focus));

  const pool: SessionItem[] = sets.flatMap((s) =>
    s.items.map((item) => ({
      uid: `${s.setId}::${item.id}`,
      setId: s.setId,
      topicId: s.topicId,
      title_de: s.title_de,
      level: s.level,
      item,
      document: s.document,
      recording: s.recording,
    })),
  );

  const lastWrong: SessionItem[] = [];
  const fossilizing: SessionItem[] = [];
  const weakFocus: SessionItem[] = [];
  const untried: SessionItem[] = [];
  const seen: { entry: SessionItem; ts: number }[] = [];
  for (const p of pool) {
    const a = lastAttempt.get(p.uid);
    if (a && !a.correct) (isFossilizing(p.uid) ? fossilizing : lastWrong).push(p);
    else if (p.item.focus && weak.has(p.item.focus)) weakFocus.push(p);
    else if (!a) untried.push(p);
    else seen.push({ entry: p, ts: a.ts });
  }

  // Never-seen items sharing a fossilizing item's focus tag — its candidate
  // replacements in band 1.
  const untriedByFocus = new Map<string, SessionItem[]>();
  for (const p of untried) {
    if (!p.item.focus) continue;
    const arr = untriedByFocus.get(p.item.focus);
    if (arr) arr.push(p);
    else untriedByFocus.set(p.item.focus, [p]);
  }

  const promoted: SessionItem[] = [];
  const promotedUids = new Set<string>();
  const fossilizedDropped: SessionItem[] = [];
  for (const p of fossilizing) {
    const siblings = p.item.focus ? untriedByFocus.get(p.item.focus) : undefined;
    if (!siblings || siblings.length === 0) {
      lastWrong.push(p); // no fresh material to hand the slot to — retry is all there is
      continue;
    }
    fossilizedDropped.push(p);
    for (const sibling of siblings) {
      if (promotedUids.has(sibling.uid)) continue;
      promotedUids.add(sibling.uid);
      promoted.push(sibling);
    }
  }
  const untriedRemaining = untried.filter((p) => !promotedUids.has(p.uid));

  // Band 3 in three tiers: what an unarmed probe family waits on, then sets never opened,
  // then the rest.
  const attemptedSets = new Set(attempts.map((a) => a.setId));
  const armsFamily = untriedRemaining.filter((p) => unarmedArmingKeys.has(p.uid));
  const unopenedSet = untriedRemaining.filter(
    (p) => !unarmedArmingKeys.has(p.uid) && !attemptedSets.has(p.setId),
  );
  const restUntried = untriedRemaining.filter(
    (p) => !unarmedArmingKeys.has(p.uid) && attemptedSets.has(p.setId),
  );

  const bands = {
    lastWrong: shuffle([...lastWrong, ...promoted]),
    weakFocus: shuffle(weakFocus),
    untried: [...shuffle(armsFamily), ...shuffle(unopenedSet), ...shuffle(restUntried)],
    fossilized: shuffle(fossilizedDropped),
  };
  const broad = seen.sort((a, b) => a.ts - b.ts).map((s) => s.entry);

  const reserved = Math.min(Math.round(count * BROAD_RETRIEVAL_SHARE), broad.length);
  const take = allocatePrioritySlots(Math.max(0, count - reserved), {
    lastWrong: bands.lastWrong.length,
    weakFocus: bands.weakFocus.length,
    untried: bands.untried.length,
    fossilized: bands.fossilized.length,
  });
  const fromPriority = [
    ...bands.lastWrong.slice(0, take.lastWrong),
    ...bands.weakFocus.slice(0, take.weakFocus),
    ...bands.untried.slice(0, take.untried),
    ...bands.fossilized.slice(0, take.fossilized),
  ];
  const fromBroad = broad.slice(0, count - fromPriority.length);

  return interleaveByTopic([...fromPriority, ...fromBroad].slice(0, count));
}

/** What `buildSession` needs besides the pool and the log. Both callers must decide both. */
export interface SessionOptions {
  /** current item revisions, for the weakness signal; `undefined` turns that filter off */
  current: RevisionLookup | undefined;
  /**
   * `setId::itemId` keys that would arm a probe family not armed yet (`unarmedArmingKeys` in
   * probes.ts). Required, so no caller silently loses the ordering: pass an empty set when
   * there are no families.
   */
  unarmedArmingKeys: ReadonlySet<string>;
}

/** How many items each priority band has on offer, and how many it is given. */
export interface PriorityBands {
  lastWrong: number;
  weakFocus: number;
  untried: number;
  fossilized: number;
}

/**
 * Shares `slots` priority slots among the four bands, proportionally, so an 8-item daily
 * session and a 15-item training run follow one rule:
 *
 * 1. band 2 (weak focus, where drills are served) and band 3 (never attempted) each get one
 *    slot when they have an item — a guarantee, taken before anything else, because without
 *    it a large band 1 starves both completely;
 * 2. band 1 (last answered wrong, with the siblings promoted into it) gets at most half the
 *    slots, rounded down;
 * 3. the slots left go to the bands in their order — band 2, band 3, then band 1 past its
 *    half, then band 4 — so a slot a band cannot fill is never wasted.
 *
 * With one or two slots the two guarantees can use them all; band 1 then waits for a session
 * with room, and its items are still there tomorrow.
 */
export function allocatePrioritySlots(slots: number, have: PriorityBands): PriorityBands {
  const take: PriorityBands = { lastWrong: 0, weakFocus: 0, untried: 0, fossilized: 0 };
  let left = slots;
  const give = (band: keyof PriorityBands, n: number) => {
    const k = Math.max(0, Math.min(n, have[band] - take[band], left));
    take[band] += k;
    left -= k;
  };
  give('weakFocus', 1);
  give('untried', 1);
  give('lastWrong', Math.floor(slots / 2));
  give('weakFocus', left);
  give('untried', left);
  give('lastWrong', left);
  give('fossilized', left);
  return take;
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
