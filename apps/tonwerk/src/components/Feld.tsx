/**
 * The controls the editor is built from — a rack's front panel, one legend per control.
 *
 * Two rules carried from `DESIGN.md`, and they are the reason these are components rather than
 * bare inputs:
 *
 * **The face says what kind of thing you are looking at.** A field the author types *German* into
 * is set in the script face (`SkriptFeld`); a field holding an id, a seed, a gain or a millisecond
 * count is apparatus and stays mono. In the Skript view that difference is legible from across the
 * room, which is the whole argument for having three faces.
 *
 * **A legend belongs on the control, not beside it.** Every field renders a real `<label>` wrapping
 * its input, so a click on the legend focuses the control and a screen reader gets the name without
 * an `aria-label` that can drift from the visible text.
 *
 * `einheit` prints the unit the number is in — ms, dB, ×. A number whose unit is only in the
 * author's head is a number somebody will type seconds into.
 */
import type { ReactNode } from 'react';

interface Gemeinsam {
  legende: string;
  /** One line under the control, when what it does is not obvious from its name. */
  hinweis?: string;
  einheit?: string;
  disabled?: boolean;
}

function Rahmen({
  legende,
  hinweis,
  einheit,
  children,
}: Gemeinsam & { children: ReactNode }): React.JSX.Element {
  return (
    <label className="feld-block">
      <span className="tafel feld-legende">
        {legende}
        {einheit ? <span className="feld-einheit"> {einheit}</span> : null}
      </span>
      {children}
      {hinweis ? <span className="feld-hinweis">{hinweis}</span> : null}
    </label>
  );
}

export function Feld({
  wert,
  onWert,
  platzhalter,
  ...rest
}: Gemeinsam & {
  wert: string;
  onWert(next: string): void;
  platzhalter?: string;
}): React.JSX.Element {
  return (
    <Rahmen {...rest}>
      <input
        className="feld"
        type="text"
        value={wert}
        placeholder={platzhalter}
        disabled={rest.disabled}
        onChange={(event) => onWert(event.target.value)}
      />
    </Rahmen>
  );
}

/** A field for the German being manufactured: the script face, and it grows with the text. */
export function SkriptFeld({
  wert,
  onWert,
  zeilen = 2,
  platzhalter,
  ...rest
}: Gemeinsam & {
  wert: string;
  onWert(next: string): void;
  zeilen?: number;
  platzhalter?: string;
}): React.JSX.Element {
  return (
    <Rahmen {...rest}>
      <textarea
        className="feld feld-skript"
        rows={zeilen}
        value={wert}
        placeholder={platzhalter}
        disabled={rest.disabled}
        onChange={(event) => onWert(event.target.value)}
      />
    </Rahmen>
  );
}

/**
 * A number, and `null` when the field is empty and the schema allows it.
 *
 * The empty string is kept apart from zero on purpose: `end_ms: null` means "to the end of the
 * scene" and `end_ms: 0` means "stop immediately", and a control that turned a cleared field into
 * a zero would silence a bed while looking like it did nothing.
 */
export function ZahlFeld({
  wert,
  onWert,
  min,
  max,
  schritt,
  leerErlaubt,
  ...rest
}: Gemeinsam & {
  wert: number | null;
  onWert(next: number | null): void;
  min?: number;
  max?: number;
  schritt?: number;
  leerErlaubt?: boolean;
}): React.JSX.Element {
  return (
    <Rahmen {...rest}>
      <input
        className="feld feld-zahl"
        type="number"
        value={wert === null ? '' : wert}
        min={min}
        max={max}
        step={schritt}
        disabled={rest.disabled}
        onChange={(event) => {
          const roh = event.target.value;
          if (roh === '') {
            onWert(leerErlaubt ? null : 0);
            return;
          }
          const zahl = Number(roh);
          if (Number.isFinite(zahl)) onWert(zahl);
        }}
      />
    </Rahmen>
  );
}

export function WahlFeld({
  wert,
  onWert,
  optionen,
  ...rest
}: Gemeinsam & {
  wert: string;
  onWert(next: string): void;
  optionen: readonly { wert: string; name: string }[];
}): React.JSX.Element {
  return (
    <Rahmen {...rest}>
      <select
        className="feld feld-wahl"
        value={wert}
        disabled={rest.disabled}
        onChange={(event) => onWert(event.target.value)}
      >
        {optionen.map((option) => (
          <option key={option.wert} value={option.wert}>
            {option.name}
          </option>
        ))}
      </select>
    </Rahmen>
  );
}

/**
 * Der Panoramaregler — a pan pot, −1 to +1, printed the way a desk prints it.
 *
 * A slider and not a number field, because pan is the one acoustic value an author sets by feel
 * against a picture of the stereo field rather than by typing a figure. The reading beside it is
 * still exact — `L 40` — so the control can be used both ways.
 */
export function Regler({
  wert,
  onWert,
  ...rest
}: Gemeinsam & { wert: number; onWert(next: number): void }): React.JSX.Element {
  const seite = wert === 0 ? 'Mitte' : `${wert < 0 ? 'L' : 'R'} ${Math.round(Math.abs(wert) * 100)}`;
  return (
    <Rahmen {...rest}>
      <span className="regler">
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={wert}
          disabled={rest.disabled}
          aria-label={rest.legende}
          onChange={(event) => onWert(Number(event.target.value))}
        />
        <span className="zahl regler-wert">{seite}</span>
      </span>
    </Rahmen>
  );
}

/** A row of fields on the 4px grid. `spalten` is a minimum width, not a count. */
export function Feldreihe({
  spalten = '11rem',
  children,
}: {
  spalten?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="feldreihe"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${spalten}, 1fr))` }}
    >
      {children}
    </div>
  );
}
