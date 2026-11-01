/**
 * A line diff, Myers' algorithm: a one-line edit in a 3000-line deck costs one step per changed line
 * rather than a table the size of the file squared. Pure, so it is tested without a DOM.
 */
export type DiffOp = { type: 'same' | 'add' | 'del'; text: string };

/** Beyond this many edit steps the diff says so instead of computing a wall of red and green. */
const MAX_STEPS = 2000;

/**
 * The shortest edit script from `a` to `b`, line by line, or `undefined` when the two differ by more
 * than `MAX_STEPS` lines — at that size the file was rewritten and a diff does not help a reader.
 */
export function diffLines(a: readonly string[], b: readonly string[]): DiffOp[] | undefined {
  const n = a.length;
  const m = b.length;
  const offset = n + m;
  const v = new Int32Array(2 * offset + 2);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= Math.min(offset, MAX_STEPS); d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)
          ? v[offset + k + 1]!
          : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return undefined;

  const ops: DiffOp[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && prev[offset + k - 1]! < prev[offset + k + 1]!);
    const prevK = down ? k + 1 : k - 1;
    const prevX = prev[offset + prevK]!;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ type: 'same', text: a[x]! });
    }
    if (down) {
      y--;
      ops.push({ type: 'add', text: b[y]! });
    } else {
      x--;
      ops.push({ type: 'del', text: a[x]! });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ type: 'same', text: a[x]! });
  }
  return ops.reverse();
}
