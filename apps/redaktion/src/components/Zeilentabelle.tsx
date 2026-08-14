/**
 * The editorial table, and the five rules the first one lacked.
 *
 * Each rule below is a defect that was **measured on the shipping build** before it was fixed
 * (`scratchpad/measure.py`, 1440×900, dark): row heights and anchor counts read straight off the
 * rendered DOM, because "the tables feel bad" is not something anyone can act on twice.
 *
 *   1. **One primary link per row.** Strukturen carried a median of 4 anchors per row and a
 *      maximum of 16; Fokus-Tags a median of 3 across 102 rows — something over three hundred blue
 *      words on one screen. When every column is a link, no column is: the eye has nothing to
 *      aim at. So the identifier column is the row's target and reads as ink with a hover, and a
 *      cross-reference is a quiet chip. `Extern` marks the one kind of link that leaves the app.
 *
 *   2. **No unbounded cell.** Strukturen's `Themen` column rendered every topic whose elements
 *      carry any of a structure's focus tags — twenty of them for `verbzweit` — and the row grew
 *      to 224 px against a 40 px median, a **raggedness of 5.6**. A one-to-many relation with a fat
 *      tail is not a column. `Mehrere` shows two and counts the rest.
 *
 *   3. **Counts carry a scale.** A column of 102 numbers is not comparable by reading it.
 *
 *   4. **Sticky head.** At 98 and 102 rows the column meanings scroll away immediately, which is
 *      how the screenshots that started this were taken.
 *
 *   5. **Sortable numerics.** "Which confusion has the fewest probes" is the question this table
 *      exists to answer and the first version could not be asked it.
 *
 * The raggedness figure is the one to keep an eye on: it is asserted in the verification pass, so
 * a future column that wraps without bound fails rather than merely looking bad.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Chip, Empty } from '@da/ui/primitives';
import { Hinweis } from './Hinweis';

export interface Spalte<Row> {
  key: string;
  head: ReactNode;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  /** Providing this makes the column sortable; the header becomes a button. */
  sort?: (row: Row) => number | string;
  /**
   * Dropped below 1280 px. For a column that is real but secondary — a machine key beside the
   * human label it belongs to. Measured on `Quellen` at 1024: the five columns squeezed the label
   * column to 309 px, two of the ninety-five entries wrapped to three lines, and the tallest row hit
   * **2.74× the median** where the same table reads 1.56× at 1440. Dropping the key column gives the
   * label ~440 px and the wrapping stops. Never mark the column a row is identified by.
   */
  nurBreit?: boolean;
  cell: (row: Row) => ReactNode;
}

type Richtung = 'auf' | 'ab';

/**
 * The row's one target. Ink, not blue — the row is the link, so the colour is spent elsewhere.
 *
 * `data-primary` is not styling. "One primary link per row" is a design rule, and a design rule
 * nobody can measure is one that comes back: counting every `<a>` cannot tell a row's target from
 * the quiet cross-references beside it, so the rule needs a marker the verification pass can count.
 * `tests/…`/the Playwright sweep assert `a[data-primary]` ≤ 1 per row.
 */
export function Primaer({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      data-primary="true"
      className="font-medium text-ink underline-offset-2 hover:text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-brand"
    >
      {children}
    </a>
  );
}

/** A link that leaves the application. Muted, and says so — it is never the row's primary action. */
export function Extern({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
    >
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

/**
 * A bounded view of a long SINGLE value — the same rule as `Mehrere`, applied to length rather than
 * to count.
 *
 * `Mehrere` was written because one cell holding twenty links set the height of its row. A cell
 * holding one forty-word label does exactly the same thing, and the audit caught it: `Quellen` at
 * 1024 px ran **2.15× its median row height** on two of ninety-five entries — "Perfekt der Verben:
 * arbeiten / bleiben / essen …" wrapping to three lines. Two lines, then the full value on hover,
 * which is what the row's own `title` could never give a keyboard.
 */
export function Kurz({ children, text }: { children: ReactNode; text: string }) {
  return (
    <Hinweis inhalt={text}>
      <span className="line-clamp-2">{children}</span>
    </Hinweis>
  );
}

/**
 * A bounded view of a one-to-many relation. Two members and a count, expandable in place — so the
 * row keeps its height until the reader asks for the rest.
 */
export function Mehrere({ children, zeige = 2 }: { children: ReactNode[]; zeige?: number }) {
  const [offen, setOffen] = useState(false);
  const all = children.filter(Boolean);
  if (!all.length) return <span className="text-ink-muted">—</span>;
  const shown = offen ? all : all.slice(0, zeige);
  const rest = all.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown}
      {rest > 0 ? (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="tabular rounded-full px-1.5 py-0.5 text-xs text-ink-muted ring-1 ring-inset ring-border-subtle hover:text-ink"
          aria-label={`${rest} weitere anzeigen`}
        >
          +{rest}
        </button>
      ) : null}
      {offen && all.length > zeige ? (
        <button type="button" onClick={() => setOffen(false)} className="text-xs text-ink-muted hover:text-ink">
          weniger
        </button>
      ) : null}
    </span>
  );
}

/** A count with the scale that makes a column of them comparable. */
export function Zahl({ value, max, warnBei }: { value: number; max: number; warnBei?: number }) {
  const tone = warnBei !== undefined && value <= warnBei ? 'warn' : 'brand';
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className="flex items-center justify-end gap-2 leading-none">
      {/* Inline rather than the shared `Bar`: that one wraps a 24-unit track in its own flex row and
          set the row height for the whole table. Here the track is the same height as the digits. */}
      <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-surface-sunken sm:block">
        <span
          // Ink, not brand: a hundred and two amber tracks down one column is a texture, not a
          // reading. Hue is kept for the rows that are short.
          className={`block h-full ${tone === 'warn' ? 'bg-warn' : 'bg-ink-muted'}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={`tabular w-8 text-right ${tone === 'warn' ? 'text-warn-ink' : 'text-ink'}`}>{value}</span>
    </span>
  );
}

export function Zeilentabelle<Row>({
  rows,
  rowKey,
  columns,
  empty = 'nichts gefunden',
  sortKey: initialKey,
}: {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: Spalte<Row>[];
  empty?: ReactNode;
  sortKey?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: Richtung } | undefined>(
    initialKey ? { key: initialKey, dir: 'auf' } : undefined,
  );

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!column?.sort) return rows;
    const pick = column.sort;
    const factor = sort!.dir === 'auf' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const [x, y] = [pick(a), pick(b)];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * factor;
      return String(x).localeCompare(String(y), 'de') * factor;
    });
  }, [rows, columns, sort]);

  if (!rows.length) return typeof empty === 'string' ? <Empty>{empty}</Empty> : <>{empty}</>;

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'auf' ? 'ab' : 'auf' } : { key, dir: 'auf' }));

  return (
    /*
     * NO `overflow-x-auto` HERE, and that is the sticky header's price.
     *
     * `overflow-x: auto` makes `overflow-y` compute to `auto` too, which turns the wrapper into a
     * scroll container — and a `sticky top-14` header inside an unscrolled one is pushed DOWN to
     * 56 px below the container instead of staying put. Measured: table top 280, first row 312,
     * header 336. The header rendered underneath row one, on a page nobody had scrolled.
     *
     * The two cannot both be had in CSS, so the choice is which the reader needs at 98 and 102 rows:
     * a header that survives scrolling. These tables no longer need the horizontal escape hatch
     * anyway — bounding the multi-value cells (`Mehrere`) is what used to make them overflow, and
     * the widest column is now a topic title. `Matrix` keeps its wrapper: it is genuinely wide and
     * has no sticky header to lose.
     */
    <div>
      <ul className="space-y-2 min-[900px]:hidden" aria-label="Ergebnisliste">
        {sorted.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
            <dl className="grid grid-cols-[minmax(6.5rem,0.35fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              {columns.filter((column) => !column.nurBreit).map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{column.head}</dt>
                  <dd className={`${column.numeric ? 'tabular' : ''} min-w-0 text-ink`}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full border-collapse text-sm min-[900px]:table">
        <thead>
          {/* Sticky under the page header, which is `top-0 h-14` in the shell. */}
          <tr className="sticky top-14 z-10 bg-surface text-left text-xs text-ink-muted shadow-[0_1px_0_var(--color-border-subtle)]">
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  aria-sort={active ? (sort!.dir === 'auf' ? 'ascending' : 'descending') : undefined}
                  className={`whitespace-nowrap px-2 py-2 font-semibold uppercase tracking-wide first:pl-0 last:pr-0 ${
                    column.numeric ? 'text-right' : ''
                  } ${column.nurBreit ? 'hidden xl:table-cell' : ''}`}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${
                        active ? 'text-ink' : ''
                      }`}
                    >
                      {column.head}
                      <span aria-hidden="true" className={active ? '' : 'opacity-0 group-hover:opacity-40'}>
                        {active ? (sort!.dir === 'auf' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.head
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border-subtle/50 last:border-0 hover:bg-surface-sunken"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-2 py-1.5 align-middle text-ink first:pl-0 last:pr-0 ${
                    column.numeric ? 'tabular text-right' : ''
                  } ${column.nurBreit ? 'hidden xl:table-cell' : ''}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One header row for many groups, replacing the N tables the first detail views built — the third
 * screenshot in the report that started this printed `ART · STUFE · AUFGABEN · DATEI` three times
 * on one page, once per topic, which reads as three tables that happen to share a shape.
 */
export function Gruppentabelle<Row>({
  gruppen,
  columns,
  rowKey,
  empty = 'nichts gefunden',
}: {
  gruppen: { id: string; label: ReactNode; rows: Row[] }[];
  columns: Spalte<Row>[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
}) {
  if (!gruppen.length) return typeof empty === 'string' ? <Empty>{empty}</Empty> : <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-2 py-2 font-semibold first:pl-0 last:pr-0 ${
                  column.numeric ? 'text-right' : ''
                }`}
              >
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        {gruppen.map((gruppe) => (
          <tbody key={gruppe.id}>
            <tr>
              <th
                colSpan={columns.length}
                scope="colgroup"
                className="border-t border-border-subtle pb-1 pt-4 text-left text-xs font-semibold text-ink"
              >
                {gruppe.label}
              </th>
            </tr>
            {gruppe.rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-surface-sunken">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-2 py-1.5 align-middle text-ink first:pl-0 last:pr-0 ${
                      column.numeric ? 'tabular text-right' : ''
                    }`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** A cross-reference inside a row: present, findable, and never competing with the primary link. */
export function Quer({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="focus-visible:outline-2 focus-visible:outline-brand">
      <Chip>{children}</Chip>
    </a>
  );
}
