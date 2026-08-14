/**
 * The primitives both apps can use.
 *
 * Seeded from what already existed and was genuinely generic — the `Filter<T>` select at the foot
 * of `atlas/TopicDetail.tsx`, the four-state pill in `topic/TierBadge.tsx`, the chip row in
 * `topic/EvidenceChips.tsx`, and the `CARD` / `PRIMARY_BUTTON` / `QUIET_BUTTON` class-string
 * constants in `pruefung/shared.tsx`, which are what a design system looks like just before someone
 * writes one. Nothing here knows about learners, attempts or IndexedDB: a component that reads
 * `src/lib/store.ts` on mount is a learner-flow component and stays in the app that owns it.
 */
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'brand' | 'ok' | 'info' | 'warn';

const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted ring-border-subtle',
  brand: 'bg-brand-soft text-brand ring-brand/30',
  ok: 'bg-ok-soft text-ok ring-ok/30',
  info: 'bg-info-soft text-info ring-info/30',
  warn: 'bg-warn-soft text-warn ring-warn/30',
};

export function Chip({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${TONE_CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border-subtle bg-surface-raised p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-ink-muted">{sub}</p> : null}
    </header>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Suchen …',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
    />
  );
}

export function Filter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | 'alle';
  options: readonly T[];
  onChange: (next: T | 'alle') => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | 'alle')}
        className="rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
      >
        <option value="alle">alle</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface Column<Row> {
  key: string;
  head: ReactNode;
  /** Right-aligned and tabular — for counts. */
  numeric?: boolean;
  cell: (row: Row) => ReactNode;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  empty = 'nichts gefunden',
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-ink-muted">{empty}</p>;
  return (
    // Wide editorial tables scroll inside their own container; the page never scrolls sideways.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-ink-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                // `px-2 first:pl-0` rather than `pr-3`: a right-aligned numeric column sat flush
                // against the one before it, so two headers read as one word ("AUFGABENPRODUKTIV")
                // and a long cell value ran into its neighbour.
                className={`whitespace-nowrap px-2 py-2 font-medium first:pl-0 last:pr-0 ${
                  column.numeric ? 'text-right' : ''
                }`}
              >
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border-subtle/60 last:border-0 hover:bg-surface-sunken">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-2 py-1.5 align-top text-ink first:pl-0 last:pr-0 ${
                    column.numeric ? 'tabular text-right' : ''
                  }`}
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
 * A proportion, drawn. Deliberately without a "good" colour threshold: the caller passes the tone,
 * because whether 60 % is good depends on what is being measured and this component cannot know.
 */
export function Bar({ value, max, tone = 'brand', label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill: Record<Tone, string> = {
    neutral: 'bg-stone-400',
    brand: 'bg-brand',
    ok: 'bg-ok',
    info: 'bg-info',
    warn: 'bg-warn',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full ${fill[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="tabular text-xs text-ink-muted">{label}</span> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border-subtle px-3 py-6 text-center text-sm text-ink-muted">{children}</p>;
}
