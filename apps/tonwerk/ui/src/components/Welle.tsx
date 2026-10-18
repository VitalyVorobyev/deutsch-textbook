/**
 * Die Welle — a sound's shape, in the Pegel's vernacular.
 *
 * The engine sends 96 peak values per library row (`api.rows.peaks`), normalised to the loudest
 * bin. They are drawn as discrete ticks rather than as a filled envelope, for the same reason the
 * Pegel's segments are masked into LEDs: this app draws meters, not progress bars, and a shape
 * built from ticks reads as a measurement at a glance.
 *
 * Achromatic on purpose. A waveform is not a verdict, so it gets no hue — it is graphite, and the
 * only coloured thing in a sound row is whatever the machine or a person has said about it.
 */
export function Welle({
  peaks,
  hoehe = 34,
  titel,
}: {
  peaks: readonly number[];
  hoehe?: number;
  titel?: string;
}): React.JSX.Element {
  if (peaks.length === 0) {
    return (
      <div className="welle welle-leer" style={{ height: hoehe }}>
        <span className="entfernt">keine Wellenform</span>
      </div>
    );
  }
  const breite = peaks.length * 2 - 1;
  return (
    <svg
      className="welle"
      viewBox={`0 0 ${breite} ${hoehe}`}
      preserveAspectRatio="none"
      style={{ height: hoehe }}
      role="img"
      aria-label={titel ?? 'Wellenform'}
    >
      {peaks.map((peak, index) => {
        // A silent bin still gets one pixel: a gap in the row would read as missing data rather
        // than as silence, and the two need different action.
        const h = Math.max(1, Math.round(peak * (hoehe - 2)));
        return (
          <rect
            key={index}
            x={index * 2}
            y={(hoehe - h) / 2}
            width={1}
            height={h}
            fill="var(--ton-ruhe)"
          />
        );
      })}
    </svg>
  );
}
