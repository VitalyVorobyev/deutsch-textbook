/**
 * The registry's slicing, sorting and counting — pure, and deliberately outside the view.
 *
 * The Übersicht is the one screen where a wrong answer is invisible: a filter that drops a row is
 * indistinguishable from a plan that never contained it, and the whole argument for a registry is
 * that it shows you what you would otherwise not know to look for. So the logic lives here, where
 * a test can hold it, and `Uebersicht.tsx` only renders what it returns.
 */
import { PIPELINE_STATUSES, OVER_STATUS, type RegistryRow } from './contracts';

export const ANY = 'alle';

export interface RegistryFilter {
  /** `A1` · `A2` · `B1` · … or `alle`. Compared case-insensitively: the two row families disagree. */
  ebene: string;
  /** One of the engine's status words, or `alle`. */
  status: string;
  /** `listening` · `reading` · `alle`. */
  art: string;
}

export const NO_FILTER: RegistryFilter = { ebene: ANY, status: ANY, art: ANY };

/**
 * The levels present in the data, in curriculum order.
 *
 * Read off the rows rather than hard-coded: the plan gains a level before this app hears about it,
 * and a filter that cannot express a level hides every row at it.
 */
export function levelsOf(rows: readonly RegistryRow[]): string[] {
  const known = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const found = [...new Set(rows.map((row) => row.level.toUpperCase()))];
  return found.sort((a, b) => {
    const left = known.indexOf(a);
    const right = known.indexOf(b);
    if (left === -1 && right === -1) return a.localeCompare(b, 'de');
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });
}

export function matches(row: RegistryRow, filter: RegistryFilter): boolean {
  if (filter.ebene !== ANY && row.level.toUpperCase() !== filter.ebene.toUpperCase()) return false;
  if (filter.status !== ANY && row.status !== filter.status) return false;
  if (filter.art !== ANY && row.kind !== filter.art) return false;
  return true;
}

/**
 * The filtered rows, in the order the reader wants them: **the most alarming first**.
 *
 * Not alphabetical, and not the plan's order. The registry is opened to find what is wrong, and a
 * table sorted by id makes the reader do the scanning the sort should have done. `stale` outranks
 * everything — it is published audio the studio has moved past — then a failed check, then the two
 * rows that are waiting on a person, then the quiet end of the pipeline. Within a status, plan
 * order (level, then unit, then id) so a row keeps a stable place between reloads.
 */
const URGENCY: readonly string[] = [
  OVER_STATUS,
  'qa_failed',
  'awaiting_approval',
  'approved',
  'drafted',
  'planned',
  'published',
];

export function selectRows(rows: readonly RegistryRow[], filter: RegistryFilter): RegistryRow[] {
  return rows.filter((row) => matches(row, filter)).sort(compareRows);
}

function compareRows(a: RegistryRow, b: RegistryRow): number {
  const rank = urgency(a.status) - urgency(b.status);
  if (rank !== 0) return rank;
  const level = a.level.localeCompare(b.level, 'de');
  if (level !== 0) return level;
  const unit = String(a.unit ?? '').localeCompare(String(b.unit ?? ''), 'de', { numeric: true });
  if (unit !== 0) return unit;
  return a.id.localeCompare(b.id, 'de');
}

function urgency(status: string): number {
  const index = URGENCY.indexOf(status);
  // A status this build has never heard of sorts to the top rather than the bottom: an unknown
  // state on a row is exactly the thing an editor needs to see, not the thing to bury.
  return index === -1 ? -1 : index;
}

/**
 * Counts per status over a set of rows, in pipeline order, with anything unrecognised appended.
 *
 * Computed from the rows and not from the engine's `summary.by_status`, because the Pegel is drawn
 * over the *filtered* set: a summary of everything under a table of one level would be a scale that
 * does not describe the thing beneath it.
 */
export function statusCounts(rows: readonly RegistryRow[]): { status: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const row of rows) tally.set(row.status, (tally.get(row.status) ?? 0) + 1);
  const ordered: { status: string; count: number }[] = PIPELINE_STATUSES.map((status) => ({
    status,
    count: tally.get(status) ?? 0,
  }));
  for (const [status, count] of tally) {
    if (!(PIPELINE_STATUSES as readonly string[]).includes(status) && status !== OVER_STATUS) {
      ordered.push({ status, count });
    }
  }
  return ordered;
}

/** The off-scale count. Separate from `statusCounts` because it is drawn past the end of the bar. */
export function overCount(rows: readonly RegistryRow[]): number {
  return rows.filter((row) => row.status === OVER_STATUS).length;
}

/** What a row is called in the table's second column: a unit for a scene, a topic for a reading. */
export function rowContext(row: RegistryRow): string {
  const unit = row.unit ?? row.topic ?? null;
  return unit === null || unit === '' ? '' : String(unit);
}
