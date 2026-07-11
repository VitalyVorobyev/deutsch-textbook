/** Time-series rollups over the attempt/session logs for the progress dashboard. */
import type { Attempt, CardStates, SessionLogEntry } from './store';
import { localDateString } from './store';
import { attemptScore } from './scoring';

const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday (local) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = startOfLocalDay(d);
  const mondayIndex = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - mondayIndex);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ---------------------------------------------------------------------------
// Daily activity (heatmap + streak)
// ---------------------------------------------------------------------------

export interface DayActivity {
  date: string; // YYYY-MM-DD (local)
  attempts: number;
  /** parts-weighted correct answers (fractional with partial credit) */
  correct: number;
  reviewed: number; // cards reviewed (from sessions)
  trained: number; // items trained (from sessions)
  cardReviews: number; // cards whose most recent review fell on this day
  /** total weight for heatmap intensity */
  total: number;
}

/** Map of local-date → activity, aggregated from attempts, the session log,
    and card review dates (so standalone /review days count as active). */
export function dailyActivity(
  attempts: Attempt[],
  sessions: SessionLogEntry[],
  cards: CardStates = {},
): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  const ensure = (date: string): DayActivity => {
    let d = map.get(date);
    if (!d) {
      d = { date, attempts: 0, correct: 0, reviewed: 0, trained: 0, cardReviews: 0, total: 0 };
      map.set(date, d);
    }
    return d;
  };
  for (const a of attempts) {
    const d = ensure(localDateString(new Date(a.ts)));
    d.attempts++;
    d.correct += attemptScore(a);
  }
  for (const s of sessions) {
    const d = ensure(s.date);
    d.reviewed += s.reviewed ?? 0;
    d.trained += s.trained;
  }
  for (const c of Object.values(cards)) {
    if (c.last_review) ensure(localDateString(new Date(c.last_review))).cardReviews++;
  }
  // Session `reviewed` misses standalone /review activity; `last_review` keeps
  // only each card's most recent review. max() of the two is a lower bound on
  // real reviews that never double-counts a session's cards.
  for (const d of map.values()) d.total = d.attempts + Math.max(d.reviewed, d.cardReviews);
  return map;
}

export function activeDateSet(map: Map<string, DayActivity>): Set<string> {
  const set = new Set<string>();
  for (const [date, d] of map) if (d.total > 0) set.add(date);
  return set;
}

/** Consecutive active days ending today (or yesterday, if today is not yet active). */
export function currentStreak(active: Set<string>, today = new Date()): number {
  const cursor = startOfLocalDay(today);
  if (!active.has(localDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // today can still be started later
    if (!active.has(localDateString(cursor))) return 0;
  }
  let streak = 0;
  while (active.has(localDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Weakness trends (per focus tag, time-bucketed error rate)
// ---------------------------------------------------------------------------

export interface TrendBucket {
  start: string; // first local date of the bucket
  attempts: number;
  /** parts-weighted errors (fractional with partial credit) */
  errors: number;
  errorRate: number | null; // null when no attempts in the bucket
}

export interface FocusTrend {
  focus: string;
  buckets: TrendBucket[];
  total: number; // attempts across the whole window
  /** error rate of the most recent non-empty bucket */
  latestErrorRate: number | null;
}

export interface FocusTrendOpts {
  bucketDays?: number;
  buckets?: number;
  today?: Date;
}

/** Per-focus error-rate series over the last `buckets` windows of `bucketDays` each. */
export function focusTrends(attempts: Attempt[], opts: FocusTrendOpts = {}): FocusTrend[] {
  const { bucketDays = 7, buckets = 8, today = new Date() } = opts;
  const startOfToday = startOfLocalDay(today).getTime();
  const windowStart = startOfToday - (buckets * bucketDays - 1) * DAY_MS;

  const byFocus = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.focus || a.ts < windowStart) continue;
    const arr = byFocus.get(a.focus) ?? [];
    arr.push(a);
    byFocus.set(a.focus, arr);
  }

  const out: FocusTrend[] = [];
  for (const [focus, arr] of byFocus) {
    const b: TrendBucket[] = Array.from({ length: buckets }, (_, idx) => {
      const fromEnd = buckets - 1 - idx;
      const startTs = startOfToday - (fromEnd * bucketDays + bucketDays - 1) * DAY_MS;
      return { start: localDateString(new Date(startTs)), attempts: 0, errors: 0, errorRate: null };
    });
    for (const a of arr) {
      const dayStart = startOfLocalDay(new Date(a.ts)).getTime();
      const daysAgo = Math.round((startOfToday - dayStart) / DAY_MS);
      const fromEnd = Math.floor(daysAgo / bucketDays);
      if (fromEnd < 0 || fromEnd >= buckets) continue;
      const idx = buckets - 1 - fromEnd;
      b[idx].attempts++;
      b[idx].errors += 1 - attemptScore(a);
    }
    let latest: number | null = null;
    for (const bucket of b) {
      if (bucket.attempts > 0) {
        bucket.errorRate = bucket.errors / bucket.attempts;
        latest = bucket.errorRate;
      }
    }
    out.push({ focus, buckets: b, total: arr.length, latestErrorRate: latest });
  }

  // Worst current error rate first, then most evidence.
  return out.sort(
    (x, y) => (y.latestErrorRate ?? -1) - (x.latestErrorRate ?? -1) || y.total - x.total,
  );
}
