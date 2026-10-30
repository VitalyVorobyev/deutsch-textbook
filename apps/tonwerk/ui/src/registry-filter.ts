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
  /** `listening` · `reading` · `scene` · `alle`. */
  art: string;
  /** A unit, an exercise set, a topic or `studio` (see `sammlungOf`), or `alle`. */
  sammlung?: string;
  /** Words to find in the id, the description or what the row says. Empty finds everything. */
  suche?: string;
  /** Whether archived studio scenes are listed. */
  archiv?: boolean;
}

export const NO_FILTER: RegistryFilter = { ebene: ANY, status: ANY, art: ANY };

/** The collection a studio-only scene belongs to: none, so it gets a name of its own. */
export const STUDIO = 'studio';

/**
 * What owns a row: the unit or exercise set a recording was planned for, a Lesetext's topic, or
 * the studio itself for a scene nothing plans.
 */
export function sammlungOf(row: RegistryRow): string {
  if (row.kind === 'scene') return STUDIO;
  const owner = row.collection ?? row.unit ?? row.topic ?? '';
  return String(owner);
}

/**
 * Every collection present, exercise sets first: they are few, named for what they are for, and
 * the reason the field exists. Units and topics follow in alphabetical order, the studio last.
 */
export function sammlungen(rows: readonly RegistryRow[]): string[] {
  const sets = new Set<string>();
  const rest = new Set<string>();
  let studio = false;
  for (const row of rows) {
    if (row.kind === 'scene') studio = true;
    else if (row.collection) sets.add(row.collection);
    else if (sammlungOf(row)) rest.add(sammlungOf(row));
  }
  const sorted = (values: Set<string>) =>
    [...values].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  return [...sorted(sets), ...sorted(rest), ...(studio ? [STUDIO] : [])];
}

/**
 * A studio scene is hidden once archived; a planned row never is. Archiving says "I no longer want
 * to see this project", and a plan entry is an obligation, not a project — hiding it would make
 * commissioned work disappear from the one list that shows what is missing.
 */
export function isHidden(row: RegistryRow, filter: RegistryFilter): boolean {
  return row.kind === 'scene' && row.project?.archived === true && !filter.archiv;
}

const fold = (text: string) => text.normalize('NFC').toLocaleLowerCase('de');

function haystack(row: RegistryRow): string {
  return fold(
    [row.id, row.scenario, row.title, sammlungOf(row), ...(row.serves ?? []), row.text]
      .filter(Boolean)
      .join(' '),
  );
}

/** Every word of the search must occur somewhere in the row. */
export function matchesSearch(row: RegistryRow, suche: string | undefined): boolean {
  const words = fold(suche ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack(row);
  return words.every((word) => text.includes(word));
}

/**
 * The stretch of a row's text around the first search word it contains, so a hit in the
 * transcript can be read in the table without opening the scene. Null when the hit is elsewhere.
 */
export function snippet(row: RegistryRow, suche: string | undefined, radius = 48): string | null {
  const text = row.text ?? '';
  const words = fold(suche ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const folded = fold(text);
  for (const word of words) {
    const at = folded.indexOf(word);
    if (at === -1) continue;
    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + word.length + radius);
    return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
  }
  return null;
}

/**
 * Whether a published recording kept to the length its plan asked for. The fix for a miss is the
 * script, never the window: the window is the brief, and widening it to fit is the brief agreeing
 * with whatever came back.
 */
export function laengeImFenster(row: RegistryRow): 'kurz' | 'passt' | 'lang' | null {
  if (!row.window || row.duration_seconds == null) return null;
  const [min, max] = row.window;
  if (row.duration_seconds < min) return 'kurz';
  if (row.duration_seconds > max) return 'lang';
  return 'passt';
}

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
  if (filter.sammlung && filter.sammlung !== ANY && sammlungOf(row) !== filter.sammlung)
    return false;
  if (isHidden(row, filter)) return false;
  return matchesSearch(row, filter.suche);
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
  const unit = sammlungOf(a).localeCompare(sammlungOf(b), 'de', { numeric: true });
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

/** What a row is called in the table's second column: its unit, exercise set or topic. */
export function rowContext(row: RegistryRow): string {
  return row.kind === 'scene' ? '' : sammlungOf(row);
}
