/**
 * One editable field, in the place the value already lives.
 *
 * The design decision worth stating: this is a `<select>` in the column that already shows the
 * value, at the row's own size and weight, so a table of facts stays a table and does not become a
 * form. No modal, no save button, no toast — an editorial judgement is one keystroke and the file
 * is the record of it.
 *
 * The second is **derived vs declared**, and it is the only thing here that earns a colour
 * difference, because it is the entire meaning of a field like `stage`: the corpus computes a
 * default from `role`, and declaring one is an author overriding that. So the empty option is not
 * blank — it names the value that would be used instead ("abgeleitet: Gerüst"), and a declared value
 * renders in full ink against the muted derived one. Choosing the empty option removes the key,
 * which is the only way back.
 *
 * Nothing is invented, but the confirmed write is held. On success the dev server's watcher pushes
 * a refetch, and **rebuilding the graph takes about six seconds** — measured, not guessed, in the
 * browser: the PUT returns immediately, the payload does not. Rendering the incoming `value` prop
 * during that window snaps the row back to the value that is no longer on disk, which is the
 * opposite of the honesty this is for. So the written value is displayed, and the control stays
 * disabled, until the prop catches up with it — the server has already confirmed the byte is
 * written, and this only refuses to un-say it.
 */
import { useState } from 'react';
import { writeField } from '../write';

export function Feldwahl({
  file,
  field,
  value,
  options,
  labels,
  derived,
  ariaLabel,
  width = 'w-44',
}: {
  file: string;
  field: string;
  /** The declared value, or null when the field is absent and the derived one applies. */
  value: string | null;
  options: string[];
  labels: Record<string, string>;
  /** What applies when nothing is declared. Omitted for fields that are always present. */
  derived?: string;
  ariaLabel: string;
  /** The column's width, not the control's — see the class comment below. */
  width?: string;
}) {
  // `base` is what the prop said when the write went out. The moment the prop moves off it, the
  // refetch has landed and `written` is ignored for good — so the catch-up needs no effect and no
  // second render pass, only a comparison.
  const [pending, setPending] = useState<{ base: string | null; written: string | null }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onChange = async (raw: string) => {
    const next = raw === '' ? null : raw;
    setBusy(true);
    setError(undefined);
    const result = await writeField({ file, field, value: next });
    setBusy(false);
    if (result.ok) setPending({ base: value, written: next });
    // The controller's own words. "the result would not validate as a exercise-set: …" is the
    // useful message; a generic "Speichern fehlgeschlagen" would hide the one thing worth knowing.
    else setError(result.error);
  };

  const held = pending !== undefined && pending.base === value;
  const shown = held ? pending.written : value;
  const waiting = busy || held;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <select
        aria-label={ariaLabel}
        aria-busy={waiting}
        disabled={waiting}
        value={shown ?? ''}
        onChange={(e) => void onChange(e.target.value)}
        className={
          // The width belongs to the COLUMN, not to the control: every select in one column is the
          // same width so the table keeps a straight right edge whatever the option labels happen
          // to be. `abgeleitet: Nachprüfung` is twice the length of `Transfer`, and a ragged column
          // is the first thing that stops a table scanning.
          `${width} rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 text-xs ` +
          'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60 ' +
          (shown === null ? 'text-ink-muted' : 'text-ink')
        }
      >
        {derived !== undefined && <option value="">abgeleitet: {labels[derived] ?? derived}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? option}
          </option>
        ))}
      </select>
      {waiting && !error && (
        <span className="text-[0.65rem] leading-tight text-ink-muted">geschrieben — Korpus wird neu gelesen…</span>
      )}
      {error && (
        <span role="alert" className="max-w-64 text-[0.65rem] leading-tight text-warn">
          {error}
        </span>
      )}
    </span>
  );
}
