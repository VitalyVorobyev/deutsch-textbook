interface Props {
  /**
   * Series in [0,1]; higher value sits higher (near the top).
   *
   * `null` is "not measured in this bucket" and **breaks the line** — the stroke
   * restarts after the gap rather than running through it. That is the whole
   * point: WeaknessTrends draws these under "a falling line means it is
   * improving", so a segment spanning weeks with no attempts would invite the
   * learner to read a trend out of two measurements and nothing in between.
   * The dots still mark every bucket that has data.
   */
  values: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}

/** Tiny inline-SVG line chart. Inherits color from the parent (`currentColor`). */
export function Sparkline({ values, width = 88, height = 24, className = '' }: Props) {
  const n = values.length;
  if (n === 0) return null;
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => (1 - v) * (height - 3) + 1.5; // padding so dots aren't clipped

  const pts: Array<{ i: number; v: number }> = [];
  values.forEach((v, i) => {
    if (v !== null) pts.push({ i, v });
  });
  // A point starts a new subpath when the bucket before it had no data, so the
  // stroke never spans a gap. Runs of one point draw no line at all — correct:
  // a lone measurement is a dot, not a trend.
  const path = pts
    .map((p, k) => {
      const continues = k > 0 && pts[k - 1]!.i === p.i - 1;
      return `${continues ? 'L' : 'M'} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" strokeOpacity="0.15" />
      {pts.length > 1 && <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="1.6" fill="currentColor" />
      ))}
    </svg>
  );
}
