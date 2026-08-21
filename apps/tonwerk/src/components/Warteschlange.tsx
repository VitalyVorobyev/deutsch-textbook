/**
 * The DOM half of a keyboard-driven queue. The rules are in `../warteschlange.ts`.
 *
 * One focusable region holding a table, one selected row, and three keys. It exists because both
 * review queues — Prüfung and Lesetexte — are the same job with different columns, and a second
 * copy of the key handling is a second place for `Enter` to stop working.
 *
 * **The table takes focus, not the rows.** A roving `tabindex` over 85 rows means 85 tab stops
 * between the queue and the next control, and a screen reader announcing a row every time focus
 * moves through the page. `role="grid"` with `aria-activedescendant` is the shape a spreadsheet
 * uses for the same reason: one stop, one announced row, and the selection is a value the app
 * owns rather than wherever the browser last put the ring.
 *
 * The role goes on the `<table>` and not on the scroll wrapper around it, so `tr` and `td` keep
 * mapping to `row` and `gridcell`. A `role="grid"` on a `div` containing a table is two grids: the
 * rows announced belong to the inner table, and the id `aria-activedescendant` names is not a
 * child of the thing that claims to own it.
 *
 * **It grabs focus on mount.** A queue whose keys need a click first is a queue whose keys nobody
 * finds. Nothing else on these two screens wants the first key press.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { befehlFuer, naechste } from '../warteschlange';

export function Warteschlange({
  ids,
  gewaehlt,
  onWahl,
  onOeffnen,
  beschriftung,
  children,
}: {
  /** The rows on screen, in the order they are shown. The keys step through exactly this. */
  ids: readonly string[];
  gewaehlt: string | undefined;
  onWahl(id: string): void;
  /** Enter. What "open" means is the queue's business, not this component's. */
  onOeffnen(id: string): void;
  beschriftung: string;
  children: ReactNode;
}): React.JSX.Element {
  const bereich = useRef<HTMLTableElement | null>(null);

  useEffect(() => {
    bereich.current?.focus({ preventScroll: true });
  }, []);

  // The selected row is kept in view when the keys move it — a selection below the fold is a
  // selection the reviewer cannot read, and `j` held down would otherwise scroll nothing.
  useEffect(() => {
    if (!gewaehlt) return;
    const zeile = bereich.current?.querySelector(`[data-zeile="${CSS.escape(gewaehlt)}"]`);
    zeile?.scrollIntoView({ block: 'nearest' });
  }, [gewaehlt]);

  return (
    <div className="warteschlange tabelle-rahmen">
      <table
        ref={bereich}
        className="tabelle"
        role="grid"
        tabIndex={0}
        aria-label={beschriftung}
        aria-activedescendant={gewaehlt ? `zeile-${gewaehlt}` : undefined}
        onKeyDown={(event) => {
          const befehl = befehlFuer(event);
          if (befehl === null) return;
          event.preventDefault();
          if (befehl === 'oeffnen') {
            if (gewaehlt) onOeffnen(gewaehlt);
            return;
          }
          const ziel = naechste(ids, gewaehlt, befehl === 'weiter' ? 1 : -1);
          if (ziel !== undefined && ziel !== gewaehlt) onWahl(ziel);
        }}
      >
        {children}
      </table>
    </div>
  );
}

/** One row of a queue. The id is on the element twice: once for CSS, once for `activedescendant`. */
export function Zeile({
  id,
  gewaehlt,
  onWahl,
  children,
}: {
  id: string;
  gewaehlt: boolean;
  onWahl(): void;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <tr
      id={`zeile-${id}`}
      data-zeile={id}
      aria-selected={gewaehlt}
      // A click selects rather than opens: in a queue the pointer is how you *aim*, and a list
      // where one click leaves the page is a list you cannot look at.
      onClick={onWahl}
    >
      {children}
    </tr>
  );
}
