/**
 * Compact progress audit for agents and course authors.
 *
 * The raw snapshot remains the source of truth. This command joins attempts to
 * authored exercises, re-grades rejected translations with today's contracts,
 * and prints only the evidence needed for a grading/content review.
 *
 * Usage:
 *   bun run progress:audit --profile vitaly
 *   bun run progress:audit --profile vitaly --json
 *   bun run progress:audit --snapshot progress/vitaly/2026-07-13.json
 *   bun run progress:audit --profile vitaly --item a2/perfekt-haben-sein:uebersetzen-pizza
 *   bun run progress:audit --profile vitaly --project 2026-08-02
 */
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { normalizeTranslation } from '../src/lib/cloze';
import {
  closestTranslationCandidate,
  gradeTranslation,
  type TranslationSpec,
} from '../src/lib/production';
import { attemptScore, isVerifiedEvidence } from '../src/lib/scoring';
import { isPretestAttempt } from '../src/lib/weakness';
import { decisionKey, loadGradingDecisions } from '../src/lib/grading-decisions';
import type { GradingDecision } from '../src/lib/schemas';
import { SUPPORTED_SNAPSHOT_VERSIONS } from '../src/lib/snapshot-schema';
import {
  armedAt,
  dueProbes,
  probeAttempts,
  probeFamilies,
  PROBE_INTERVALS_DAYS,
} from '../src/lib/probes';
import type { Attempt } from '../src/lib/store';

const DAY = 86_400_000;
const RECENT_DAYS = 30;
const DEFAULT_LIMIT = 10;

export interface AuditAttempt {
  setId: string;
  itemId: string;
  itemType: string;
  itemRevision?: number;
  correct: boolean;
  correctParts?: number;
  totalParts?: number;
  given: string;
  focus?: string;
  evidence?: 'verified' | 'practice';
  responseMode?: string;
  outcomes?: string[];
  practice?: {
    kind: 'writing' | 'speaking';
    draft?: string;
    revision?: string;
    /** Legacy only: written by the retired staged self-assessment. */
    before?: Array<'met' | 'needs-work'>;
    after?: Array<'met' | 'needs-work'>;
  };
  ts: number;
}

interface AuditCard {
  reps?: number;
  lapses?: number;
  last_review?: string;
}

export interface AuditSnapshot {
  version: number;
  exportedAt: string;
  profile?: string;
  attempts: AuditAttempt[];
  cards: Record<string, AuditCard>;
  sessions?: Array<{ date: string; reviewed: number | null; trained: number; ts: number }>;
  topics?: Record<string, unknown>;
  feedback?: Record<string, { artifactId: string; difficulty?: string; useful?: boolean; wantsMore?: boolean; ts: number }>;
}

export interface ExerciseItem {
  id: string;
  revision?: number;
  type: string;
  prompt?: string;
  prompt_en?: string;
  prompt_ru?: string;
  answer?: string;
  accept?: string[];
  focus?: string;
  key_tokens?: string[];
  outcomes?: string[];
}

export interface CatalogItem extends ExerciseItem {
  setId: string;
  topic?: string;
  role?: string;
}

export interface PerformanceRow {
  name: string;
  attempts: number;
  verified: number;
  score: number;
  possible: number;
}

export interface FocusSignal {
  focus: string;
  status: 'persistent' | 'historical';
  attempts: number;
  wrong: number;
  recentWrong: number;
  distinctWrongItems: number;
  probeWrong: number;
  recovered: boolean;
  lastWrongAt: string;
}

export interface RejectedRendering {
  given: string;
  count: number;
  latestAt: string;
  reasons: string[];
}

export interface GradingCandidate {
  ref: string;
  prompt?: string;
  promptRu?: string;
  answer: string;
  accept: string[];
  keyTokens: string[];
  focus?: string;
  rejected: RejectedRendering[];
}

export interface ItemDetail {
  ref: string;
  item?: CatalogItem;
  attempts: AuditAttempt[];
}

export interface ProgressAudit {
  snapshot: {
    path: string;
    version: number;
    profile?: string;
    exportedAt: string;
    ageDays: number;
    stale: boolean;
  };
  counts: {
    attempts: number;
    cards: number;
    sessions: number;
    topics: number;
    readings: number;
    gradingReviewExcluded: number;
    revisionKnown: number;
    revisionMismatch: number;
    writingRevisions: number;
    writingChanged: number;
  };
  byItemType: PerformanceRow[];
  byResponseMode: PerformanceRow[];
  byTopic: PerformanceRow[];
  byCycle: PerformanceRow[];
  cards: {
    graded: number;
    lapses: number;
    withLapses: number;
    byDirection: Array<{ direction: string; cards: number; lapses: number }>;
    byDeck: Array<{ deck: string; cards: number; lapses: number }>;
  };
  delayed: {
    attempts: number;
    correct: number;
    probes: {
      attempts: number;
      loggedCorrect: number;
      currentCorrect: number;
      focusRetained: number;
      focusFailed: number;
      /**
       * The same three verdicts split by the competence each probe was aimed at, which is the
       * grouping the P3-6 bar is stated in. The pooled counters above cannot answer it: they mix
       * both levels, and P3-6 is an A1 gate.
       */
      byCompetence: CompetenceRetention[];
      /**
       * Whether each competence *can* be readable by the projection date — the question
       * that decides whether the gate can be read at all, and one the retention table
       * cannot answer because it is keyed off attempts that have already happened.
       */
      byReadability: CompetenceReadability[];
      /** the projection horizon, ISO date */
      projectTo: string;
      dueNow: number;
      overdue: number;
      maxOverdueDays: number;
      maxTakenInOneDay: number;
      /**
       * Distribution of the intervals that actually elapsed for taken probes (days from
       * arming to the probe attempt), vs the nominal 2/7/21. An overdue probe is valid
       * data — the elapsed interval is the one reported — but the drift between the two
       * is what the P5-11 window audits and the P5-7 expansion decision read.
       */
      actualIntervals: Array<{ days: number; count: number }>;
    };
  };
  sessionWorkload: { sessions: number; averageReviewed: number; averageTrained: number };
  gradingCandidates: GradingCandidate[];
  gradingDecisions: {
    /** decisions that matched a logged rejected rendering of their item */
    ruled: number;
    /** queueable renderings still awaiting a linguistic ruling */
    undecided: number;
    /** decisions matching no logged rendering (content or normalization moved on) */
    orphaned: number;
  };
  focusSignals: FocusSignal[];
  feedback: AuditSnapshot['feedback'];
  detail?: ItemDetail;
}

export interface AuditOptions {
  snapshotPath: string;
  catalog: Map<string, CatalogItem>;
  /** committed linguistic rulings (data/grading-decisions.yaml) */
  decisions?: GradingDecision[];
  now?: number;
  limit?: number;
  itemRef?: string;
  /**
   * Horizon for the readability projection, as an epoch ms. Defaults to the snapshot's
   * export date plus the longest scheduled interval — the point by which a family armed on
   * export day would have completed its schedule. Pass the retention-gate date to ask the
   * question that actually matters: can the gate be read when it is due?
   */
  projectTo?: number;
}

const itemRef = (setId: string, itemId: string) => `${setId}:${itemId}`;
const iso = (ts: number) => new Date(ts).toISOString();
const compareAttempts = (a: AuditAttempt, b: AuditAttempt) =>
  a.ts - b.ts || a.setId.localeCompare(b.setId) || a.itemId.localeCompare(b.itemId) ||
  a.given.localeCompare(b.given);
const pct = (score: number, possible: number) =>
  possible === 0 ? '—' : `${Math.round((score / possible) * 100)}%`;
const bare = (word: string) => word.replace(/[.,!?;:]+$/, '');
const tokens = (text: string) =>
  normalizeTranslation(text).split(/\s+/).filter(Boolean).map(bare);

function parseItemRef(ref: string): { setId: string; itemId: string } {
  const at = ref.lastIndexOf(':');
  if (at <= 0 || at === ref.length - 1)
    throw new Error(`Invalid --item "${ref}"; expected <set-id>:<item-id>`);
  return { setId: ref.slice(0, at), itemId: ref.slice(at + 1) };
}

export function resolveSnapshotPath(root: string, profile?: string, explicit?: string): string {
  if (explicit) return isAbsolute(explicit) ? explicit : resolve(root, explicit);
  if (!profile) throw new Error('Pass --profile <slug> or --snapshot <path>.');
  const dir = join(root, 'progress', profile);
  let files: string[];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
  } catch {
    throw new Error(`Progress profile not found: ${profile}`);
  }
  const newest = files.at(-1);
  if (!newest) throw new Error(`No JSON snapshots found in progress/${profile}.`);
  return join(dir, newest);
}

export function readSnapshot(path: string): AuditSnapshot {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AuditSnapshot>;
  if (
    !SUPPORTED_SNAPSHOT_VERSIONS.includes(parsed.version ?? 0) ||
    !Array.isArray(parsed.attempts) ||
    !parsed.cards ||
    typeof parsed.cards !== 'object'
  ) {
    const min = SUPPORTED_SNAPSHOT_VERSIONS[0];
    const max = SUPPORTED_SNAPSHOT_VERSIONS.at(-1);
    throw new Error(`Not a valid Deutsch-Atlas v${min}-v${max} progress snapshot: ${path}`);
  }
  return {
    version: parsed.version!,
    exportedAt: parsed.exportedAt ?? '',
    profile: parsed.profile,
    attempts: parsed.attempts,
    cards: parsed.cards,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    topics: parsed.topics && typeof parsed.topics === 'object' ? parsed.topics : {},
    feedback: parsed.feedback && typeof parsed.feedback === 'object' ? parsed.feedback : {},
  };
}

/**
 * True only when the attempt names a revision and it is *not* the one the item ships today —
 * i.e. the task contract demonstrably changed under the learner, so today's answer key would
 * grade an answer to a question they were never asked.
 *
 * An **absent** revision is not a mismatch. No attempt logged before the v5 contract carries
 * one (0 of 817 in the current snapshot), so treating "unknown" as "changed" would retire the
 * whole history from this audit: the grading-review queue would be permanently empty and, worse,
 * its `excluded` set would be too — re-admitting rejections that today's grader accepts back
 * into the focus signal, which is exactly the false attribution the review exists to prevent.
 * Replaying here is read-only analysis; it never rewrites a learner's logged result.
 */
function revisionKnownMismatch(attempt: AuditAttempt, item: CatalogItem): boolean {
  return attempt.itemRevision !== undefined && attempt.itemRevision !== (item.revision ?? 1);
}

export function loadExerciseCatalog(root: string): Map<string, CatalogItem> {
  const exerciseRoot = join(root, 'content', 'exercises');
  const files = readdirSync(exerciseRoot, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.yaml'))
    .sort();
  const catalog = new Map<string, CatalogItem>();
  for (const file of files) {
    const setId = relative(exerciseRoot, join(exerciseRoot, file))
      .split(sep).join('/').replace(/\.yaml$/, '');
    const data = YAML.parse(readFileSync(join(exerciseRoot, file), 'utf8')) as {
      topic?: string;
      role?: string;
      items?: ExerciseItem[];
    };
    for (const item of data.items ?? [])
      catalog.set(itemRef(setId, item.id), { ...item, setId, topic: data.topic, role: data.role });
  }

  const readingRoot = join(root, 'content', 'reading');
  const readings = readdirSync(readingRoot, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.yaml'))
    .sort();
  for (const file of readings) {
    const pathId = relative(readingRoot, join(readingRoot, file))
      .split(sep).join('/').replace(/\.yaml$/, '');
    const setId = `reading:${pathId}`;
    const data = YAML.parse(readFileSync(join(readingRoot, file), 'utf8')) as {
      topic?: string;
      questions?: ExerciseItem[];
    };
    for (const question of data.questions ?? [])
      catalog.set(itemRef(setId, question.id), { ...question, setId, topic: data.topic });
  }
  return catalog;
}

function performance(
  attempts: AuditAttempt[],
  key: (attempt: AuditAttempt) => string,
): PerformanceRow[] {
  const rows = new Map<string, PerformanceRow>();
  for (const attempt of attempts) {
    const name = key(attempt);
    const row = rows.get(name) ?? { name, attempts: 0, verified: 0, score: 0, possible: 0 };
    row.attempts += 1;
    if (isVerifiedEvidence(attempt)) {
      row.verified += 1;
      row.possible += 1;
      row.score += attemptScore(attempt);
    }
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function currentSpec(item: CatalogItem): TranslationSpec {
  return {
    answer: item.answer!,
    accept: item.accept,
    focus: item.focus,
    keyTokens: item.key_tokens,
  };
}

/** Exact, positional preservation against the closest authored rendering. */
function keyTokensIntact(given: string, item: CatalogItem): boolean {
  if (!item.key_tokens?.length || !item.answer) return false;
  const target = tokens(closestTranslationCandidate(given, currentSpec(item)));
  const got = tokens(given);
  const keys = new Set(item.key_tokens.map(bare));
  const answerHead = bare(tokens(item.answer)[0] ?? '');
  if (keys.has(answerHead)) {
    keys.add(answerHead.charAt(0).toLowerCase() + answerHead.slice(1));
  }
  return target.length === got.length && target.every((token, index) => {
    if (!keys.has(token) && !(index === 0 && keys.has(token.toLowerCase()))) return true;
    return token === got[index] || (index === 0 && token.toLowerCase() === got[index]?.toLowerCase());
  });
}

function attemptKey(attempt: AuditAttempt): string {
  return `${attempt.setId}|${attempt.itemId}|${attempt.ts}`;
}

function gradingReview(
  attempts: AuditAttempt[],
  catalog: Map<string, CatalogItem>,
  decisions: GradingDecision[],
): {
  candidates: GradingCandidate[];
  excluded: Set<string>;
  /**
   * Confirmed attempts re-enter the focus signals with attribution recomputed under
   * today's grading contract — never with the stored historical `focus` tag. Many
   * renderings are queued precisely because today's grader leaves the divergence
   * outside the targeted focus; a tag stored by an older grader would inject exactly
   * the false entry the weakness signal must not contain.
   */
  refocused: Map<string, string | undefined>;
  ruled: number;
  undecided: number;
  orphaned: number;
} {
  const decisionFor = new Map<string, GradingDecision>();
  for (const decision of decisions)
    decisionFor.set(decisionKey(decision.item, decision.given), decision);

  const groups = new Map<string, AuditAttempt[]>();
  const excluded = new Set<string>();
  // Every logged rejected-translate rendering, stale revisions included — a decision on
  // a rendering whose item contract has since changed is applied history, not an orphan.
  const matchable = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.itemType !== 'translate' || attempt.correct) continue;
    const ref = itemRef(attempt.setId, attempt.itemId);
    const item = catalog.get(ref);
    if (!item?.answer || item.type !== 'translate') continue;
    matchable.add(decisionKey(ref, attempt.given));
    // A *changed* task contract retains its logged result: replaying it against today's
    // answer key would grade an answer to a question the learner was never asked. An
    // unknown revision is legacy, not changed, and stays in the review.
    if (revisionKnownMismatch(attempt, item)) {
      // An accept/constrain ruling judges the rendering against the contract the learner
      // actually faced, so its exclusion survives the paired revision bump — otherwise the
      // content edit the ruling requires would put the attempt's stored focus right back
      // into the signals the ruling withheld it from. confirm keeps the as-logged record:
      // its attribution was real under the answered contract, and recomputing it against
      // the changed item would replay.
      const decision = decisionFor.get(decisionKey(ref, attempt.given));
      if (decision && decision.decision !== 'confirm') excluded.add(attemptKey(attempt));
      continue;
    }
    groups.set(ref, [...(groups.get(ref) ?? []), attempt]);
  }

  const candidates: GradingCandidate[] = [];
  const refocused = new Map<string, string | undefined>();
  let undecided = 0;
  for (const [ref, rejectedAttempts] of groups) {
    const item = catalog.get(ref)!;
    const renderings = new Map<string, RejectedRendering & { attempts: AuditAttempt[] }>();
    for (const attempt of rejectedAttempts) {
      const normalized = normalizeTranslation(attempt.given);
      const rendering = renderings.get(normalized) ?? {
        given: attempt.given,
        count: 0,
        latestAt: iso(attempt.ts),
        reasons: [],
        attempts: [],
      };
      rendering.count += 1;
      rendering.attempts.push(attempt);
      if (attempt.ts > Date.parse(rendering.latestAt)) {
        rendering.given = attempt.given;
        rendering.latestAt = iso(attempt.ts);
      }
      renderings.set(normalized, rendering);

      const verdict = gradeTranslation(attempt.given, currentSpec(item));
      if (verdict.kind !== 'wrong') {
        rendering.reasons.push('current grader no longer rejects this response');
      }
      if (verdict.kind === 'wrong' && !verdict.focus) {
        rendering.reasons.push('current grader leaves the divergence outside the targeted focus');
      }
      if (keyTokensIntact(attempt.given, item)) {
        rendering.reasons.push(
          'all graded key tokens remain intact in the closest authored rendering',
        );
      }
    }
    const queuedRenderings: (RejectedRendering & { attempts: AuditAttempt[] })[] = [];
    for (const rendering of renderings.values()) {
      if (rendering.count > 1) rendering.reasons.push('the same rejected rendering recurs');
      rendering.reasons = [...new Set(rendering.reasons)].sort();
      // Renderings without a queue reason keep today's behaviour: they feed the focus
      // signals exactly as logged and are never the decisions file's business.
      if (!rendering.reasons.length) continue;

      const decision = decisionFor.get(decisionKey(ref, rendering.given));
      if (decision?.decision === 'confirm') {
        // The rejection was right: the exclusion lifts. Attribution is recomputed
        // under today's grader (see the `refocused` contract above).
        for (const attempt of rendering.attempts) {
          const verdict = gradeTranslation(attempt.given, currentSpec(item));
          refocused.set(attemptKey(attempt), verdict.kind === 'wrong' ? verdict.focus : undefined);
        }
        continue;
      }
      // Undecided renderings stay withheld pending review; accept/constrain rulings
      // keep them withheld for good — they were never the learner's grammar errors.
      for (const attempt of rendering.attempts) excluded.add(attemptKey(attempt));
      if (decision) continue;
      undecided += 1;
      queuedRenderings.push(rendering);
    }
    if (queuedRenderings.length === 0) continue;

    candidates.push({
      ref,
      prompt: item.prompt_en ?? item.prompt,
      promptRu: item.prompt_ru,
      answer: item.answer!,
      accept: item.accept ?? [],
      keyTokens: item.key_tokens ?? [],
      focus: item.focus,
      rejected: queuedRenderings.map(({ attempts: _attempts, ...rendering }) => rendering).sort(
        (a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt) ||
          a.given.localeCompare(b.given),
      ),
    });
  }
  candidates.sort((a, b) => {
    const aCount = a.rejected.reduce((sum, row) => sum + row.count, 0);
    const bCount = b.rejected.reduce((sum, row) => sum + row.count, 0);
    const aLatest = a.rejected[0]?.latestAt ?? '';
    const bLatest = b.rejected[0]?.latestAt ?? '';
    return bCount - aCount || bLatest.localeCompare(aLatest) || a.ref.localeCompare(b.ref);
  });
  const ruled = decisions
    .filter((decision) => matchable.has(decisionKey(decision.item, decision.given))).length;
  return { candidates, excluded, refocused, ruled, undecided, orphaned: decisions.length - ruled };
}

function focusSignals(
  attempts: AuditAttempt[],
  exportedAt: number,
  limit: number,
  excluded: Set<string>,
  refocused: Map<string, string | undefined>,
): FocusSignal[] {
  const groups = new Map<string, AuditAttempt[]>();
  for (const attempt of attempts) {
    if (!isVerifiedEvidence(attempt)) continue;
    // Same rule as `focusStats`, imported rather than restated: this table is the decision
    // surface for drill authoring and `weakFocuses` is what training acts on, so the two must
    // agree about what counts. A pretest is answered before the lesson and all 96 pretest
    // items are `mc` — easy recognition padding a production signal.
    if (isPretestAttempt(attempt)) continue;
    const key = attemptKey(attempt);
    if (excluded.has(key)) continue;
    // A confirm-ruled attempt carries the attribution today's grader gives it, never
    // the tag an older grader stored — see the `refocused` contract in gradingReview.
    const focus = refocused.has(key) ? refocused.get(key) : attempt.focus;
    if (!focus) continue;
    groups.set(focus, [...(groups.get(focus) ?? []), attempt]);
  }
  const recentStart = exportedAt - RECENT_DAYS * DAY;
  return [...groups.entries()]
    .map(([focus, rows]): FocusSignal | undefined => {
      const ordered = [...rows].sort((a, b) => a.ts - b.ts);
      const wrong = ordered.filter((row) => !row.correct);
      if (!wrong.length) return undefined;
      const lastWrong = wrong.at(-1)!;
      const recentWrong = wrong.filter((row) => row.ts >= recentStart).length;
      const probeWrong = wrong.filter((row) => /(^|\/)probe-/.test(row.setId)).length;
      const distinctWrongItems = new Set(wrong.map((row) => itemRef(row.setId, row.itemId))).size;
      const persistent = distinctWrongItems >= 2 && (recentWrong > 0 || probeWrong > 0);
      return {
        focus,
        status: persistent ? 'persistent' : 'historical',
        attempts: ordered.length,
        wrong: wrong.length,
        recentWrong,
        distinctWrongItems,
        probeWrong,
        recovered: ordered.some((row) => row.ts > lastWrong.ts && row.correct),
        lastWrongAt: iso(lastWrong.ts),
      };
    })
    .filter((row): row is FocusSignal => row !== undefined)
    .sort((a, b) =>
      Number(b.status === 'persistent') - Number(a.status === 'persistent') ||
      b.recentWrong - a.recentWrong || b.probeWrong - a.probeWrong || b.wrong - a.wrong ||
      a.focus.localeCompare(b.focus))
    .slice(0, limit);
}

function cardSummary(cards: Record<string, AuditCard>) {
  const directions = new Map<string, { direction: string; cards: number; lapses: number }>();
  const decks = new Map<string, { deck: string; cards: number; lapses: number }>();
  let lapses = 0;
  let withLapses = 0;
  for (const [id, card] of Object.entries(cards)) {
    const parts = id.split('::');
    const deck = parts[0] ?? 'unknown';
    const direction = parts.at(-1) ?? 'unknown';
    const cardLapses = card.lapses ?? 0;
    lapses += cardLapses;
    if (cardLapses > 0) withLapses += 1;
    const dir = directions.get(direction) ?? { direction, cards: 0, lapses: 0 };
    dir.cards += 1;
    dir.lapses += cardLapses;
    directions.set(direction, dir);
    const deckRow = decks.get(deck) ?? { deck, cards: 0, lapses: 0 };
    deckRow.cards += 1;
    deckRow.lapses += cardLapses;
    decks.set(deck, deckRow);
  }
  return {
    graded: Object.keys(cards).length,
    lapses,
    withLapses,
    byDirection: [...directions.values()].sort((a, b) => a.direction.localeCompare(b.direction)),
    byDeck: [...decks.values()]
      .sort((a, b) => b.lapses - a.lapses || b.cards - a.cards || a.deck.localeCompare(b.deck))
      .slice(0, DEFAULT_LIMIT),
  };
}

/**
 * What a single probe attempt says about the competence it was aimed at.
 *
 * `correct` is whole-sentence flawlessness, and that is *not* the retention question. A probe of
 * `akkusativ-artikel` whose article is right and whose noun is misspelled is evidence that the
 * accusative survived the interval — the sentence failed, the competence did not. So the three
 * outcomes are kept apart at the source and both the pooled counters and the per-competence table
 * read them from here, so the two can never drift into disagreeing about the same attempt.
 *
 * `retained` therefore means "the target survived", not "nearly right": it is exactly the case
 * where `gradeTranslation` refused to attribute the miss to the item's own focus tag.
 */
type ProbeVerdict = 'correct' | 'retained' | 'failed';

function classifyProbe(attempt: AuditAttempt, item: CatalogItem | undefined): ProbeVerdict {
  if (attempt.itemType === 'translate' && item?.answer && !revisionKnownMismatch(attempt, item)) {
    const verdict = gradeTranslation(attempt.given, currentSpec(item));
    if (verdict.kind !== 'wrong') return 'correct';
    return verdict.focus ? 'failed' : 'retained';
  }
  if (attempt.correct) return 'correct';
  return attempt.focus ? 'failed' : 'retained';
}

/**
 * How many probe attempts a competence needs before its retention percentage is worth reading.
 *
 * A family serves **one variant per interval**, so a competence carried by a single family can
 * never exceed one attempt per scheduled interval. Anything above that floor would make the gate
 * permanently unreadable rather than merely unmet: at the A1 cohort's current depth a floor of 4
 * leaves exactly one of eight competences readable, and the seven excluded ones are not weak
 * evidence — they are the instrument working as designed, mid-schedule.
 *
 * Below the floor a competence is reported as pending and left out of the percentage. It is never
 * counted as a pass: 2/2 is not 100% retention, it is two data points.
 */
const PROBE_READABLE_MIN = PROBE_INTERVALS_DAYS.length;

/** The P3-6 exit bar, in percent. Stated here so the report and the roadmap cite one number. */
const RETENTION_BAR = 80;

export interface CompetenceRetention {
  level: string;
  focus: string | undefined;
  families: number;
  attempts: number;
  correct: number;
  retained: number;
  failed: number;
  /** (correct + retained) / attempts — the share where the target survived the interval */
  retentionPct: number;
  /** the longest interval this competence has actually been probed at, in days */
  maxElapsedDays: number;
  readable: boolean;
  /**
   * Survival split by item type, so a format effect cannot hide inside the pooled figure.
   *
   * A competence probed by two families of different type is measured through two response
   * demands, and they are not equally hard: a `translate` probe asks the learner to build the
   * whole sentence, while a `cloze` probe hands over the frame and asks only for the graded
   * token. Pooling them is the right headline — it is the more robust estimate — but pooling
   * them *silently* would let the number rise when a second, easier format is added and read
   * as improved retention. Reporting the split means a jump in the percentage can always be
   * checked against the mix that produced it.
   */
  formats: Record<string, { attempts: number; survived: number }>;
}

/**
 * Can this competence still become readable, and by when?
 *
 * The retention gate is read on a fixed date, and a competence below
 * `PROBE_READABLE_MIN` is excluded from the verdict rather than counted as a pass. So the
 * question that decides whether the gate can be read at all is not "what is the retention
 * percentage" but "how many competences can hold three attempts by then" — and that is
 * answerable **now**, from arming timestamps and the interval schedule alone, without
 * assuming anything about how often the learner studies.
 *
 * Two ceilings, because they fail for different reasons and have different remedies:
 *
 * - `ceilingEver` = families × intervals. A competence carried by one family caps at
 *   exactly three attempts, so it is readable only if all three are actually taken; it has
 *   no margin for a missed probe. The remedy is a second family, which is authoring work.
 * - `ceilingByTarget` counts only the intervals whose due date has arrived by the target.
 *   A family armed eight days ago cannot have served its 21-day probe, whatever anyone
 *   does. The remedy is time, or a target further out — never effort.
 *
 * A row where `ceilingByTarget < PROBE_READABLE_MIN` is **structurally unreachable**: no
 * amount of studying makes it readable by that date. Reporting that separately from
 * "pending" matters, because the two look identical in the retention table and only one of
 * them is something the learner can act on.
 */
export interface CompetenceReadability {
  level: string;
  focus: string | undefined;
  families: number;
  /** probe attempts logged so far */
  attempts: number;
  /** most attempts this competence could ever hold: families × scheduled intervals */
  ceilingEver: number;
  /** most it could hold by the projection target, given each family's arming date */
  ceilingByTarget: number;
  /** probes of this competence that are due and unanswered right now */
  dueNow: number;
  /**
   * How many of this competence's families have never armed — their topic has not been
   * practised. Their share of `ceilingByTarget` assumes arming on the snapshot date, so a
   * row with unarmed families is reporting what is reachable *if the lesson is opened now*.
   */
  unarmedFamilies: number;
  readableToday: boolean;
  /** false when the schedule alone rules it out by the target date */
  reachableByTarget: boolean;
}

function delayedSummary(
  attempts: AuditAttempt[],
  catalog: Map<string, CatalogItem>,
  at: number,
  projectTo: number,
) {
  const firstByItem = new Map<string, number>();
  for (const attempt of attempts) {
    if (!isVerifiedEvidence(attempt)) continue;
    const ref = itemRef(attempt.setId, attempt.itemId);
    firstByItem.set(ref, Math.min(firstByItem.get(ref) ?? attempt.ts, attempt.ts));
  }
  const delayed = attempts.filter((attempt) =>
    isVerifiedEvidence(attempt) &&
    attempt.ts - (firstByItem.get(itemRef(attempt.setId, attempt.itemId)) ?? attempt.ts) >= 2 * DAY);
  const probes = attempts.filter((attempt) =>
    /(^|\/)probe-/.test(attempt.setId) && isVerifiedEvidence(attempt));
  const sets = new Map<string, {
    setId: string;
    topicId: string;
    role?: string;
    items: Array<{ id: string; outcomes: string[] }>;
  }>();
  for (const item of catalog.values()) {
    if (!item.topic || !item.role) continue;
    const set = sets.get(item.setId) ?? {
      setId: item.setId, topicId: item.topic, role: item.role, items: [],
    };
    set.items.push({ id: item.id, outcomes: item.outcomes ?? [] });
    sets.set(item.setId, set);
  }
  const families = probeFamilies([...sets.values()]);
  const schedulableAttempts: Attempt[] = attempts.map((attempt) => ({
    ...attempt,
    responseMode: attempt.responseMode as Attempt['responseMode'],
    practice: undefined,
  }));
  // Arming timestamps, computed once: the pooled classification, the per-competence depth and the
  // actual-interval distribution all need them, and `armedAt` walks the whole attempt log.
  const armedByFamily = new Map<string, number | undefined>();
  for (const family of families) {
    armedByFamily.set(family.setId, armedAt(family, schedulableAttempts));
  }
  const familiesPerCompetence = new Map<string, Set<string>>();

  let currentCorrect = 0;
  let focusRetained = 0;
  let focusFailed = 0;
  const competences = new Map<string, CompetenceRetention>();
  for (const attempt of probes) {
    const item = catalog.get(itemRef(attempt.setId, attempt.itemId));
    const verdict = classifyProbe(attempt, item);
    if (verdict === 'correct') currentCorrect += 1;
    else if (verdict === 'failed') focusFailed += 1;
    else focusRetained += 1;

    // Level comes off the set-id directory, the same convention `getCheckpoints()` uses. P3-6 is
    // an A1 gate, and a figure pooled across both levels cannot answer it.
    const level = attempt.setId.split('/')[0]!.toUpperCase();
    // The instrument's own declaration, not the stored attempt tag: a historical tag may come from
    // an older scorer, and grouping by it would sort the same item into two competences.
    const focus = item?.focus ?? attempt.focus;
    const key = `${level}\u0000${focus ?? ''}`;
    const row = competences.get(key) ?? {
      level, focus, families: 0, attempts: 0, correct: 0, retained: 0, failed: 0,
      retentionPct: 0, maxElapsedDays: 0, readable: false,
      formats: {} as Record<string, { attempts: number; survived: number }>,
    };
    row.attempts += 1;
    row[verdict] += 1;
    // Same rule as `focus` above: the instrument's own declaration, not the stored attempt.
    const type = item?.type ?? attempt.itemType;
    const fmt = (row.formats[type] ??= { attempts: 0, survived: 0 });
    fmt.attempts += 1;
    if (verdict !== 'failed') fmt.survived += 1;
    const armed = armedByFamily.get(attempt.setId);
    if (armed !== undefined) {
      row.maxElapsedDays = Math.max(row.maxElapsedDays, Math.round((attempt.ts - armed) / DAY));
    }
    competences.set(key, row);
    const seen = familiesPerCompetence.get(key) ?? new Set<string>();
    seen.add(attempt.setId);
    familiesPerCompetence.set(key, seen);
  }
  const byCompetence = [...competences.entries()]
    .map(([key, row]) => ({
      ...row,
      families: familiesPerCompetence.get(key)?.size ?? 0,
      retentionPct: row.attempts
        ? Math.round((100 * (row.correct + row.retained)) / row.attempts)
        : 0,
      // An untagged family cannot fail its target by construction — `classifyProbe` has no tag to
      // attribute a miss to, so every miss lands in `retained` and the row reads 100%. That is an
      // instrument gap, not retention, so it is never readable however many attempts it holds.
      readable: row.focus !== undefined && row.attempts >= PROBE_READABLE_MIN,
    }))
    .sort((a, b) =>
      a.level.localeCompare(b.level) || (a.focus ?? '').localeCompare(b.focus ?? ''));

  const owed = dueProbes(families, schedulableAttempts, at);
  const takenPerDay = new Map<string, number>();
  for (const attempt of probes) {
    const day = iso(attempt.ts).slice(0, 10);
    takenPerDay.set(day, (takenPerDay.get(day) ?? 0) + 1);
  }
  // The intervals that actually elapsed, derived exactly the way the scheduler sees them:
  // arming timestamp → probe attempt, per family, from the attempt log alone.
  const intervalCounts = new Map<number, number>();
  for (const family of families) {
    const armed = armedByFamily.get(family.setId);
    if (armed === undefined) continue;
    for (const taken of probeAttempts(family, schedulableAttempts)) {
      const days = Math.round((taken.ts - armed) / DAY);
      intervalCounts.set(days, (intervalCounts.get(days) ?? 0) + 1);
    }
  }
  const actualIntervals = [...intervalCounts.entries()]
    .map(([days, count]) => ({ days, count }))
    .sort((a, b) => a.days - b.days);

  // Readability projection. Built over ALL families, not only those with attempts: a
  // competence whose family has never been probed is precisely the one at risk of being
  // unreadable on the gate date, and it is invisible in the retention table by
  // construction (that table is keyed off attempts).
  const dueSetIds = new Set(owed.map((probe) => probe.family.setId));
  const readability = new Map<string, CompetenceReadability>();
  for (const family of families) {
    // The family's competence is its variants' shared focus — one per family, which the
    // validator enforces precisely so this reads unambiguously. Taken from the catalog
    // rather than from an attempt, for the same reason the retention rows are.
    const focus = family.items
      .map((item) => catalog.get(itemRef(family.setId, item.id))?.focus)
      .find((tag) => tag !== undefined);
    const level = family.setId.split('/')[0]!.toUpperCase();
    const key = `${level}\u0000${focus ?? ''}`;
    const row = readability.get(key) ?? {
      level, focus, families: 0, attempts: 0, ceilingEver: 0, ceilingByTarget: 0,
      dueNow: 0, unarmedFamilies: 0, readableToday: false, reachableByTarget: false,
    };
    row.families += 1;
    row.ceilingEver += PROBE_INTERVALS_DAYS.length;
    const armed = armedByFamily.get(family.setId);
    // An unarmed family has not started its schedule, but that is a *conditional* ceiling,
    // not a closed door: the topic has simply never been practised, and practising it today
    // arms the clock today. Counting it as zero would report "unreachable by date" for a
    // competence the learner could still reach by opening the lesson — the opposite of
    // actionable. So an unarmed family is projected from the snapshot date, the earliest it
    // could arm, and the row says how many of its families that assumption covers.
    if (armed === undefined) row.unarmedFamilies += 1;
    const start = armed ?? at;
    row.ceilingByTarget += PROBE_INTERVALS_DAYS.filter(
      (days) => start + days * DAY <= projectTo).length;
    row.attempts += probeAttempts(family, schedulableAttempts).length;
    if (dueSetIds.has(family.setId)) row.dueNow += 1;
    readability.set(key, row);
  }
  const byReadability = [...readability.values()]
    .map((row) => ({
      ...row,
      readableToday: row.focus !== undefined && row.attempts >= PROBE_READABLE_MIN,
      // An untagged family can never fail its target, so it is never readable however many
      // attempts it holds — the same exclusion the retention rows make, applied here so a
      // projection cannot promise readability the verdict will refuse.
      reachableByTarget:
        row.focus !== undefined && row.ceilingByTarget >= PROBE_READABLE_MIN,
    }))
    .sort((a, b) =>
      a.level.localeCompare(b.level) || (a.focus ?? '').localeCompare(b.focus ?? ''));

  return {
    attempts: delayed.length,
    correct: delayed.filter((attempt) => attempt.correct).length,
    probes: {
      attempts: probes.length,
      loggedCorrect: probes.filter((attempt) => attempt.correct).length,
      currentCorrect,
      focusRetained,
      focusFailed,
      byCompetence,
      byReadability,
      projectTo: iso(projectTo).slice(0, 10),
      dueNow: owed.length,
      overdue: owed.filter((probe) => probe.overdueDays > 0).length,
      maxOverdueDays: Math.max(0, ...owed.map((probe) => probe.overdueDays)),
      maxTakenInOneDay: Math.max(0, ...takenPerDay.values()),
      actualIntervals,
    },
  };
}

export function buildAudit(snapshot: AuditSnapshot, options: AuditOptions): ProgressAudit {
  const now = options.now ?? Date.now();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const exportedAt = Date.parse(snapshot.exportedAt);
  if (!Number.isFinite(exportedAt)) throw new Error('Snapshot exportedAt is missing or invalid.');
  const attempts = [...snapshot.attempts].sort(compareAttempts);
  const review = gradingReview(attempts, options.catalog, options.decisions ?? []);
  const withCatalog = attempts.flatMap((attempt) => {
    const item = options.catalog.get(itemRef(attempt.setId, attempt.itemId));
    return item ? [{ attempt, item }] : [];
  });
  const writing = attempts.filter((attempt) => attempt.practice?.kind === 'writing');
  const cycleByTopic: Record<string, string> = {
    'reisen-verkehr': '1 · Reisen + Einkaufen', 'einkaufen-reklamation': '1 · Reisen + Einkaufen',
    'gesundheit-arzttermin': '2 · Gesundheit + Präpositionen', 'verben-mit-praepositionen': '2 · Gesundheit + Präpositionen',
    'arbeit-beruf': '3 · Arbeit + Nebensätze', 'nebensaetze-plaene': '3 · Arbeit + Nebensätze',
    'biografie-erfahrungen': '4 · Biografie + Freunde', 'freunde-feste': '4 · Biografie + Freunde',
    'lernen-verstehen': '5 · Lernen + Ämter', 'aemter-dienstleistungen': '5 · Lernen + Ämter',
  };
  let detail: ItemDetail | undefined;
  if (options.itemRef) {
    const parsed = parseItemRef(options.itemRef);
    const ref = itemRef(parsed.setId, parsed.itemId);
    detail = {
      ref,
      item: options.catalog.get(ref),
      attempts: attempts.filter((attempt) =>
        attempt.setId === parsed.setId && attempt.itemId === parsed.itemId),
    };
  }
  return {
    snapshot: {
      path: options.snapshotPath,
      version: snapshot.version,
      profile: snapshot.profile,
      exportedAt: snapshot.exportedAt,
      ageDays: Math.max(0, Math.floor((now - exportedAt) / DAY)),
      stale: now - exportedAt > 7 * DAY,
    },
    counts: {
      attempts: attempts.length,
      cards: Object.keys(snapshot.cards).length,
      sessions: snapshot.sessions?.length ?? 0,
      topics: Object.keys(snapshot.topics ?? {}).length,
      readings: attempts.filter((attempt) => attempt.setId.startsWith('reading:')).length,
      gradingReviewExcluded: review.excluded.size,
      revisionKnown: attempts.filter((attempt) => attempt.itemRevision !== undefined).length,
      revisionMismatch: withCatalog.filter(({ attempt, item }) =>
        revisionKnownMismatch(attempt, item)).length,
      writingRevisions: writing.length,
      writingChanged: writing.filter((attempt) =>
        attempt.practice?.kind === 'writing' &&
        normalizeTranslation(attempt.practice.draft ?? '') !== normalizeTranslation(attempt.practice.revision ?? '')).length,
    },
    byItemType: performance(attempts, (attempt) => attempt.itemType || 'unknown'),
    byResponseMode: performance(attempts, (attempt) =>
      attempt.responseMode ?? 'unknown (historical)'),
    byTopic: performance(attempts, (attempt) =>
      options.catalog.get(itemRef(attempt.setId, attempt.itemId))?.topic ?? attempt.setId)
      .sort((a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name))
      .slice(0, limit),
    byCycle: performance(attempts.filter((attempt) => {
      const topic = options.catalog.get(itemRef(attempt.setId, attempt.itemId))?.topic;
      return !!topic && !!cycleByTopic[topic];
    }), (attempt) => {
      const topic = options.catalog.get(itemRef(attempt.setId, attempt.itemId))?.topic ?? '';
      return cycleByTopic[topic] ?? 'other';
    }),
    cards: cardSummary(snapshot.cards),
    delayed: delayedSummary(
      attempts,
      options.catalog,
      exportedAt,
      options.projectTo ?? exportedAt + PROBE_INTERVALS_DAYS[PROBE_INTERVALS_DAYS.length - 1]! * DAY,
    ),
    sessionWorkload: {
      sessions: snapshot.sessions?.length ?? 0,
      averageReviewed: snapshot.sessions?.length
        ? snapshot.sessions.reduce((sum, session) => sum + (session.reviewed ?? 0), 0) / snapshot.sessions.length
        : 0,
      averageTrained: snapshot.sessions?.length
        ? snapshot.sessions.reduce((sum, session) => sum + session.trained, 0) / snapshot.sessions.length
        : 0,
    },
    // Never capped: a queue that hides rows cannot drain — the top-10 display cap is
    // how "fourteen queued renderings" shipped as a plan while 32 existed. Decided
    // rows leave the section, so it shrinks naturally instead.
    gradingCandidates: review.candidates,
    gradingDecisions: {
      ruled: review.ruled,
      undecided: review.undecided,
      orphaned: review.orphaned,
    },
    focusSignals: focusSignals(attempts, exportedAt, limit, review.excluded, review.refocused),
    feedback: snapshot.feedback ?? {},
    ...(detail ? { detail } : {}),
  };
}

const md = (value: unknown) =>
  String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function performanceTable(rows: PerformanceRow[]): string[] {
  return [
    '| Kind | Attempts | Verified | Score |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map((row) =>
      `| ${md(row.name)} | ${row.attempts} | ${row.verified} | ${pct(row.score, row.possible)} |`),
  ];
}

/**
 * The P3-6 gate, rendered so it can be read rather than inferred.
 *
 * Deliberately reports two different things and keeps them apart: the retention percentage over
 * competences with enough evidence to have one, and a named list of the competences that do not
 * yet. Folding the second group into the first — in either direction — is how a mid-schedule
 * instrument comes to look like a verdict.
 */
/** `translate 3/6 · cloze 2/2` — survived/attempts per response format, hardest format first. */
function formatSplit(row: CompetenceRetention): string {
  return Object.entries(row.formats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, { attempts, survived }]) => `${type} ${survived}/${attempts}`)
    .join(' · ');
}

function retentionSection(rows: CompetenceRetention[]): string[] {
  if (!rows.length) return [];
  const out = [
    '## Retention by competence',
    '',
    'A probe is *retained* when the graded target survived the interval, whether or not the rest ' +
      'of the sentence did. Readable = at least ' + PROBE_READABLE_MIN + ' attempts (one per ' +
      'scheduled interval); below that the row is pending and is excluded from the verdict ' +
      'rather than counted as a pass.',
    '',
    '| Level | Competence | Families | n | Correct | Retained | Failed | Retention | Max delay | By format | Readable |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...rows.map((row) =>
      `| ${md(row.level)} | ${md(row.focus ?? '(untagged)')} | ${row.families} | ${row.attempts} ` +
      `| ${row.correct} | ${row.retained} | ${row.failed} | ${row.retentionPct}% ` +
      `| ${row.maxElapsedDays}d | ${md(formatSplit(row))} | ${row.readable ? 'yes' : 'pending'} |`),
    '',
  ];
  if (rows.some((row) => Object.keys(row.formats).length > 1)) {
    out.push(
      '*Mixed-format rows above:* a `cloze` probe hands the learner the sentence frame and asks ' +
        'only for the graded token, while a `translate` probe asks them to build the whole ' +
        'sentence. The pooled percentage is the more robust estimate and stays the headline, but ' +
        'read a rise against the split before reading it as improved retention.',
      '',
    );
  }
  for (const level of [...new Set(rows.map((row) => row.level))].sort()) {
    const own = rows.filter((row) => row.level === level);
    const readable = own.filter((row) => row.readable);
    const passing = readable.filter((row) => row.retentionPct >= RETENTION_BAR);
    const untagged = own.filter((row) => row.focus === undefined);
    out.push(
      readable.length
        ? `**${level}: ${passing.length}/${readable.length} readable competences at ` +
          `≥${RETENTION_BAR}% retention** ` +
          `(${own.length - readable.length} pending` +
          (untagged.length ? `, of which ${untagged.length} untagged — an instrument gap` : '') +
          ').'
        : `**${level}: no competence is readable yet** — all ${own.length} row(s) are below ` +
          `${PROBE_READABLE_MIN} attempts` +
          (untagged.length ? ` or carry no focus tag (${untagged.length})` : '') +
          '. The gate cannot be read at this depth.',
    );
  }
  out.push('');
  return out;
}

function readabilitySection(
  rows: CompetenceReadability[],
  projectTo: string,
  intervals: readonly number[],
): string[] {
  if (!rows.length) return [];
  const out = [
    '## Can the gate be read?',
    '',
    `Projected to **${projectTo}**. A competence enters the verdict only at ` +
      `${PROBE_READABLE_MIN} attempts, so before asking what the retention percentage is, ask ` +
      'how many competences can hold that many by then. This is derived from arming dates and ' +
      'the scheduled intervals alone — it assumes nothing about how often the learner studies.',
    '',
    '| Level | Competence | Families | n now | Max by date | Max ever | Due now | Verdict |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map((row) => {
      const unarmed = row.unarmedFamilies
        ? ` (${row.unarmedFamilies} unarmed — needs the lesson opened)`
        : '';
      const verdict = row.readableToday
        ? 'readable'
        : row.focus === undefined
          ? 'untagged — never readable'
          : row.reachableByTarget
            ? `needs ${PROBE_READABLE_MIN - row.attempts} more${unarmed}`
            : `**unreachable by date**${unarmed}`;
      return `| ${md(row.level)} | ${md(row.focus ?? '(untagged)')} | ${row.families} ` +
        `| ${row.attempts} | ${row.ceilingByTarget} | ${row.ceilingEver} | ${row.dueNow} ` +
        `| ${verdict} |`;
    }),
    '',
  ];
  for (const level of [...new Set(rows.map((row) => row.level))].sort()) {
    const own = rows.filter((row) => row.level === level);
    const readable = own.filter((row) => row.readableToday);
    const reachable = own.filter((row) => !row.readableToday && row.reachableByTarget);
    const blocked = own.filter((row) => !row.readableToday && !row.reachableByTarget);
    const owed = reachable.reduce(
      (sum, row) => sum + Math.max(0, PROBE_READABLE_MIN - row.attempts), 0);
    out.push(
      `**${level}: ${readable.length} readable now, ${reachable.length} still reachable by ` +
        `${projectTo}, ${blocked.length} not.** Reaching them needs ${owed} more probe ` +
        'attempt(s) to actually be taken.',
    );
  }
  out.push(
    '',
    'A row is *unreachable by date* when the schedule alone rules it out — a family armed ' +
      `eight days ago cannot have served its ${intervals[intervals.length - 1]}-day probe, ` +
      'whatever anyone does. That is a different problem from *needs N more*, which effort ' +
      'fixes, and the retention table shows both as "pending". A competence carried by one ' +
      `family caps at ${intervals.length} attempts ever, exactly the readability floor, so it ` +
      'has no margin for a probe that is never taken — widening that is authoring work, not ' +
      'study.',
    '',
  );
  return out;
}

export function renderMarkdown(audit: ProgressAudit): string {
  const out: string[] = [
    '# Progress audit',
    '',
    `Snapshot: \`${md(audit.snapshot.path)}\` · v${audit.snapshot.version} · ${audit.snapshot.exportedAt}`,
    audit.snapshot.stale
      ? `Warning: snapshot is ${audit.snapshot.ageDays} days old; current weaknesses may be stale.`
      : `Snapshot age: ${audit.snapshot.ageDays} day(s).`,
    '',
    `Engagement: ${audit.counts.attempts} attempts, ${audit.counts.sessions} sessions, ` +
      `${audit.counts.readings} reading-question attempts, ${audit.counts.topics} touched topics.`,
    `${audit.counts.gradingReviewExcluded} rejected production attempt(s) are withheld from ` +
      'focus signals (ruled accept/constrain, or awaiting linguistic review).',
    `Grading rulings: ${audit.gradingDecisions.ruled} rendering(s) ruled; ` +
      `${audit.gradingDecisions.undecided} awaiting linguistic review` +
      (audit.gradingDecisions.orphaned
        ? `; ${audit.gradingDecisions.orphaned} ruling(s) match no logged rendering (orphaned).`
        : '.'),
    `Revision metadata: ${audit.counts.revisionKnown}/${audit.counts.attempts} attempts known; ` +
      `${audit.counts.revisionMismatch} known mismatch(es) preserved without regrading.`,
    `Open writing: ${audit.counts.writingRevisions} structured revision(s), ` +
      `${audit.counts.writingChanged} changed between drafts.`,
    '',
    '## Attempts by item type',
    '',
    ...performanceTable(audit.byItemType),
    '',
    '## Attempts by actual response mode',
    '',
    ...performanceTable(audit.byResponseMode),
    '',
    '## Attempts by topic — top 10 by concentration',
    '',
    ...performanceTable(audit.byTopic),
    '',
    '## Current A2 two-unit cycles',
    '',
    ...performanceTable(audit.byCycle),
    '',
    '## Delayed and card evidence',
    '',
    `Delayed repeats (≥2 days): ${audit.delayed.correct}/${audit.delayed.attempts} logged correct.`,
    `Novel probes: ${audit.delayed.probes.loggedCorrect}/${audit.delayed.probes.attempts} ` +
      `historically logged correct; ${audit.delayed.probes.currentCorrect} correct under the current ` +
      `contract; ${audit.delayed.probes.focusRetained} retained the target but missed elsewhere; ` +
      `${audit.delayed.probes.focusFailed} failed the target.`,
    // Reported bare, not against MAX_PROBES_PER_SESSION: that cap is per *session* and this
    // count is per *day*, and a day may hold several sessions. Printing "4/3" made a normal
    // day look like a violated invariant.
    `Probe workload: ${audit.delayed.probes.dueNow} due now; ${audit.delayed.probes.overdue} ` +
      `overdue (max ${audit.delayed.probes.maxOverdueDays} day(s)); peak taken in one day: ` +
      `${audit.delayed.probes.maxTakenInOneDay}.`,
    // Overdue probes are valid data — the elapsed interval is what gets reported. The
    // drift of this distribution from the nominal schedule is the catch-up pacing signal.
    `Actual probe intervals (nominal ${PROBE_INTERVALS_DAYS.join('/')}): ` +
      (audit.delayed.probes.actualIntervals.length
        ? audit.delayed.probes.actualIntervals
            .map((row) => `${row.days}d ×${row.count}`).join(' · ')
        : 'none taken yet') + '.',
    `Session workload: ${audit.sessionWorkload.averageReviewed.toFixed(1)} cards reviewed and ` +
      `${audit.sessionWorkload.averageTrained.toFixed(1)} training items on average across ` +
      `${audit.sessionWorkload.sessions} session(s).`,
    `Cards: ${audit.cards.graded} graded, ${audit.cards.lapses} lapses across ` +
      `${audit.cards.withLapses} cards.`,
    '',
    '| Direction | Cards | Lapses |',
    '| --- | ---: | ---: |',
    ...audit.cards.byDirection.map((row) =>
      `| ${md(row.direction)} | ${row.cards} | ${row.lapses} |`),
    '',
    '| Deck (top 10 by lapses) | Cards | Lapses |',
    '| --- | ---: | ---: |',
    ...audit.cards.byDeck.map((row) => `| ${md(row.deck)} | ${row.cards} | ${row.lapses} |`),
    '',
    ...retentionSection(audit.delayed.probes.byCompetence),
    ...readabilitySection(
      audit.delayed.probes.byReadability,
      audit.delayed.probes.projectTo,
      PROBE_INTERVALS_DAYS,
    ),
    '## Grading-review queue — needs linguistic review',
    '',
  ];
  if (!audit.gradingCandidates.length) out.push('No conservative grading candidates found.', '');
  for (const candidate of audit.gradingCandidates) {
    out.push(
      `### \`${candidate.ref}\``,
      '',
      `Prompt: ${md(candidate.prompt ?? '—')}`,
      `Answer: ${md(candidate.answer)}`,
      `Accepted: ${candidate.accept.length ? candidate.accept.map(md).join(' / ') : '—'}`,
      `Focus / key tokens: ${md(candidate.focus ?? '—')} / ` +
        `${candidate.keyTokens.map(md).join(', ') || '—'}`,
      '',
      '| Rejected rendering | Count | Latest | Why queued |',
      '| --- | ---: | --- | --- |',
      ...candidate.rejected.map((row) =>
        `| ${md(row.given)} | ${row.count} | ${row.latestAt} | ` +
          `${row.reasons.map(md).join('; ')} |`),
      '',
    );
  }
  out.push(
    '## Focus signals',
    '',
    'Persistent requires attributed errors across ≥2 distinct items plus a recent or probe error. ' +
      'Queued grading candidates are excluded; historical signals are not drill recommendations.',
    '',
    '| Focus | Status | Wrong / attempts | Recent | Items | Probe | Recovery after last error |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...audit.focusSignals.map((row) =>
      `| ${md(row.focus)} | ${row.status} | ${row.wrong}/${row.attempts} | ${row.recentWrong} | ` +
      `${row.distinctWrongItems} | ${row.probeWrong} | ${row.recovered ? 'yes' : 'no'} |`),
    '',
  );
  const feedback = Object.values(audit.feedback ?? {}).sort((a, b) => b.ts - a.ts);
  out.push('## Optional-content feedback', '');
  if (!feedback.length) out.push('No optional-artifact feedback logged yet.', '');
  else out.push(
    '| Artifact | Difficulty | Useful | Wants more |',
    '| --- | --- | --- | --- |',
    ...feedback.map((entry) => `| ${md(entry.artifactId)} | ${md(entry.difficulty ?? '—')} | ${entry.useful === undefined ? '—' : entry.useful ? 'yes' : 'no'} | ${entry.wantsMore === undefined ? '—' : entry.wantsMore ? 'yes' : 'no'} |`),
    '',
  );
  if (audit.detail) {
    out.push(`## Item detail — \`${audit.detail.ref}\``, '');
    if (audit.detail.item) {
      out.push(
        `Prompt: ${md(audit.detail.item.prompt_en ?? audit.detail.item.prompt ?? '—')}`,
        `Answer: ${md(audit.detail.item.answer ?? '—')}`,
        `Accepted: ${(audit.detail.item.accept ?? []).map(md).join(' / ') || '—'}`,
        '',
      );
    } else out.push('No matching authored exercise item was found.', '');
    out.push(
      '| Time | Result | Given | Logged focus |',
      '| --- | --- | --- | --- |',
      ...audit.detail.attempts.map((attempt) =>
        `| ${iso(attempt.ts)} | ${attempt.correct ? 'correct' : 'wrong'} | ${md(attempt.given)} | ` +
        `${md(attempt.focus ?? '—')} |`),
      '',
    );
  }
  return out.join('\n').trimEnd() + '\n';
}

interface CliArgs {
  profile?: string;
  snapshot?: string;
  item?: string;
  project?: string;
  json: boolean;
}

function cliArgs(argv: string[]): CliArgs {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    if (index === -1) return undefined;
    const found = argv[index + 1];
    if (!found || found.startsWith('--')) throw new Error(`${flag} requires a value.`);
    return found;
  };
  return {
    profile: value('--profile'),
    snapshot: value('--snapshot'),
    item: value('--item'),
    project: value('--project'),
    json: argv.includes('--json'),
  };
}

/**
 * `--project` date → end-of-day epoch ms, rejecting a date that does not exist.
 *
 * `Date.parse` alone is not enough, and the failure is silent rather than loud:
 * `2026-02-30T23:59:59Z` does not throw, it **rolls over** to 2026-03-02, and
 * `2026-02-29` in a non-leap year rolls to 2026-03-01 (measured, not assumed — the ISO
 * branch of the spec should return NaN, but V8's fallback parser normalizes instead). The
 * whole section is a projection *to a named date*, so a typo would publish reachability
 * figures for a horizon nobody asked about. Codex review, PR #91.
 *
 * The round-trip is the check: reformat what was parsed and require it to equal the input.
 */
function parseProjectDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid --project "${value}"; expected YYYY-MM-DD`);
  const ts = Date.parse(`${value}T23:59:59Z`);
  if (!Number.isFinite(ts)) throw new Error(`Invalid --project "${value}"; expected YYYY-MM-DD`);
  if (iso(ts).slice(0, 10) !== value)
    throw new Error(
      `Invalid --project "${value}": no such date (it would roll over to ${iso(ts).slice(0, 10)})`,
    );
  return ts;
}

export function run(argv = process.argv.slice(2), root = process.cwd()): string {
  const args = cliArgs(argv);
  const snapshotPath = resolveSnapshotPath(root, args.profile, args.snapshot);
  const snapshot = readSnapshot(snapshotPath);
  const projectTo = args.project === undefined ? undefined : parseProjectDate(args.project);
  const audit = buildAudit(snapshot, {
    snapshotPath: relative(root, snapshotPath) || snapshotPath,
    catalog: loadExerciseCatalog(root),
    decisions: loadGradingDecisions(root),
    itemRef: args.item,
    projectTo,
  });
  return args.json ? `${JSON.stringify(audit, null, 2)}\n` : renderMarkdown(audit);
}

if (import.meta.main) {
  try {
    process.stdout.write(run());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
