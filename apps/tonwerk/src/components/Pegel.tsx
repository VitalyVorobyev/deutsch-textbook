/**
 * Der Pegel — the level meter, and the one thing Tonwerk should be remembered by.
 *
 * The registry's statuses are not categories, they are a **pipeline**: commissioned → drafted →
 * measured → waiting on a human → approved → published. That is a scale, so it is drawn as one, in
 * the vernacular of the room this app belongs to: a segmented bar of discrete ticks with a printed
 * legend beneath it, and the over-indicator set past the end behind a gap.
 *
 * `stale` is what earns the gap. It is not a later position on the scale — it is a *regression out
 * of* the last one, published audio the studio has since moved past — and a peak-programme meter
 * has exactly one place for a value that left the scale.
 *
 * Every tick is also a control: clicking a legend entry filters the table to that status, and
 * clicking the active one clears the filter. The legend and the filter are therefore the same
 * object, which is why there is no separate status dropdown above the table.
 */
import { OVER_STATUS, STATUS_LABEL, STATUS_MEANING, isRegistryStatus } from '../contracts';
import { ANY } from '../registry-filter';

export interface PegelProps {
  /** Pipeline statuses in order, with their counts. Zero-count entries stay on the scale. */
  segments: readonly { status: string; count: number }[];
  /** The off-scale count. */
  over: number;
  /** The status currently filtered on, or `alle`. */
  active: string;
  onSelect(status: string): void;
}

function label(status: string): string {
  return isRegistryStatus(status) ? STATUS_LABEL[status] : status;
}

function meaning(status: string): string {
  return isRegistryStatus(status) ? STATUS_MEANING[status] : 'Ein Status, den dieser Build nicht kennt.';
}

const SEGMENT_COLOUR: Record<string, string> = {
  planned: 'var(--ton-ruhe)',
  drafted: 'var(--ton-messung-ab)',
  qa_failed: 'var(--ton-alarm)',
  awaiting_approval: 'var(--ton-messung)',
  approved: 'var(--ton-signal-ab)',
  published: 'var(--ton-signal)',
};

export function Pegel({ segments, over, active, onSelect }: PegelProps): React.JSX.Element {
  // No total on the legend: the panel header already carries the row count, and a figure that is
  // not a control sitting in a row of controls reads as a button that does nothing.
  return (
    <div className="pegel">
      <div
        className="pegel-bahn"
        role="img"
        aria-label={`Pegel: ${segments.map((entry) => `${label(entry.status)} ${entry.count}`).join(', ')}; überholt ${over}`}
      >
        {segments.map((entry) => (
          <span
            key={entry.status}
            className="pegel-segment"
            data-status={entry.status}
            style={{
              flexGrow: entry.count,
              // A status with no rows still holds its place on the scale — a meter whose marks move
              // is not a meter — but it holds it as an unlit sliver, not as a share of the width.
              flexBasis: entry.count === 0 ? '6px' : 0,
              backgroundColor: SEGMENT_COLOUR[entry.status] ?? 'var(--ton-schrift-weg)',
              opacity: active === ANY || active === entry.status ? 1 : 0.28,
            }}
          />
        ))}
        <span
          className="pegel-ueber"
          data-leer={over === 0 ? 'ja' : 'nein'}
          style={{ opacity: active === ANY || active === OVER_STATUS ? 1 : 0.28 }}
        />
      </div>

      <div className="pegel-skala">
        {[...segments, { status: OVER_STATUS, count: over }].map((entry) => (
          <button
            key={entry.status}
            type="button"
            className="pegel-strich"
            aria-pressed={active === entry.status}
            title={meaning(entry.status)}
            onClick={() => onSelect(active === entry.status ? ANY : entry.status)}
          >
            <span className="pegel-strich-zahl">{entry.count}</span>
            <span>{label(entry.status)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
