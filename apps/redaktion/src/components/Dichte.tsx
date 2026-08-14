/**
 * The density block, and the matrix built out of it — this app's one visual atom.
 *
 * WHAT IT REPLACES. The first Sprachkarte printed every structure id into a table cell: ten rows,
 * up to 21 links in a single cell, and the reader's job was to compare 98 identifiers by reading
 * them. It held all the information and answered no question. Measured on that build, one cell
 * carried 21 anchors and the widest row ran 116 px against a 68 px median.
 *
 * WHAT IT ENCODES. One square per structure, filled where a topic teaches it and hollow where the
 * inventory has it and nothing does. Measured on the shipping corpus so the geometry is not a
 * guess: 10 strands × 4 levels, **23 non-empty cells, at most 12 structures in one of them**
 * (`satzverbindung` at B1). Every cell reserves the same twelve slots, which is the whole point —
 * a strand with three structures must *look* like a quarter of one with twelve, or the columns are
 * decoration rather than a comparison.
 *
 * WHERE THE INK GOES. The count is printed **only when something is untaught**. A cell reading
 * 7/7 says nothing worth a label and gets none; `nominalgruppe` at A1 reads 3/6 in warn ink and is
 * the finding. Labelling all forty cells equally would rebuild the table this replaces.
 *
 * WHAT IT DELIBERATELY DOES NOT ENCODE. Fifteen of the 98 structures expect reception a level
 * before production, and that is a real fact with a real home — the chip on the Struktur page and
 * the count below the map. It is not a third fill here: one glyph answering two questions answers
 * neither, and the map's question is *what does this course teach and where are the holes*.
 */
import type { ReactNode } from 'react';
import { Label } from '@da/ui/primitives';
import { Hinweis } from './Hinweis';

export interface Zelle {
  /** One entry per structure in this cell, in inventory order. */
  items: { id: string; label: string; on: boolean }[];
  href?: string;
}

/**
 * `slots` is the matrix-wide maximum, passed in rather than derived per cell: alignment across
 * columns is the comparison, so a cell cannot be allowed to size itself.
 */
export function Dichte({ items, slots, title }: { items: Zelle['items']; slots: number; title?: string }) {
  const off = items.filter((i) => !i.on).length;
  if (!items.length) return <span className="text-ink-muted/40">·</span>;
  return (
    <span className="inline-flex flex-col gap-1" title={title}>
      <span className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => {
          const item = items[i];
          if (!item) return <span key={i} className="h-2.5 w-2.5" />;
          return (
            <Hinweis
              key={item.id}
              inhalt={
                <>
                  {item.label}
                  {item.on ? null : (
                    <span className="text-warn-ink"> — kein Element trägt einen ihrer Fokus-Tags</span>
                  )}
                </>
              }
            >
              <span
                className={`h-2.5 w-2.5 rounded-[2px] ${
                  item.on ? 'bg-brand' : 'border border-warn/70 bg-transparent'
                }`}
              />
            </Hinweis>
          );
        })}
      </span>
      {off > 0 ? (
        <span className="tabular text-[0.65rem] leading-none text-warn-ink">
          {items.length - off}/{items.length}
        </span>
      ) : null}
      {/* The squares are decoration to a screen reader; this is the cell's actual content. */}
      <span className="sr-only">
        {items.length - off} von {items.length} gelehrt
      </span>
    </span>
  );
}

export function DichteLegende() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" />
        <span>ein Thema unterrichtet die Struktur</span>
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[2px] border border-warn/70" />
        <span>im Inventar, kein Element trägt einen ihrer Fokus-Tags</span>
      </li>
      <li className="flex items-center gap-1.5">
        <span className="text-ink-muted/40">·</span>
        <span>der Standard führt hier nichts</span>
      </li>
    </ul>
  );
}

/**
 * Rows × columns of density blocks. Wide on purpose and scrolls inside its own container, so the
 * page never scrolls sideways (the same rule the shared `Table` follows).
 */
export function Matrix<Row extends { id: string; label: ReactNode }>({
  rows,
  columns,
  cell,
  slots,
  columnNote,
}: {
  rows: Row[];
  columns: string[];
  cell: (row: Row, column: string) => Zelle;
  slots: number;
  /** Rendered under a column head — where an empty level says what its emptiness means. */
  columnNote?: (column: string) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-0 pb-2 text-left" />
            {columns.map((column) => (
              <th key={column} className="px-3 pb-2 text-left align-bottom">
                <Label>{column}</Label>
                {columnNote?.(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border-subtle/60">
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap bg-surface py-2 pr-4 text-left text-xs font-medium text-ink"
              >
                {row.label}
              </th>
              {columns.map((column) => {
                const value = cell(row, column);
                const body = <Dichte items={value.items} slots={slots} />;
                return (
                  <td key={column} className="px-3 py-2 align-top">
                    {value.href && value.items.length ? (
                      <a
                        href={value.href}
                        className="inline-block rounded focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        {body}
                      </a>
                    ) : (
                      body
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
