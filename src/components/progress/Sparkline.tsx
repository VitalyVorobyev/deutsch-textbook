interface Props {
  /** series in [0,1]; null renders a gap. Higher value sits higher (near the top). */
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
  const path = pts
    .map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`)
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
