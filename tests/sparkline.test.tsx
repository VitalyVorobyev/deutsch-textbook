/**
 * Sparkline's one contract: a null bucket breaks the line.
 *
 * `getFocusTrends` (src/lib/trends.ts) fills every one of its eight weekly buckets
 * with `errorRate: null` and only overwrites the ones that have attempts, so a
 * learner who drills a confusion in week 1 and again in week 6 hands this
 * component four nulls in the middle. WeaknessTrends renders the result under
 * "a falling line means it is improving" — so a stroke drawn across those four
 * weeks would invite the learner to read a trend out of two measurements taken a
 * month apart and no evidence in between. The gap has to stay visible.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { Sparkline } from '../src/components/progress/Sparkline';

afterEach(cleanup);

/** The `d` attribute of the rendered polyline, or null when no path was drawn. */
function pathData(values: (number | null)[]): string | null {
  const { container } = render(<Sparkline values={values} />);
  return container.querySelector('path')?.getAttribute('d') ?? null;
}

const subpaths = (d: string) => d.split('M').filter((s) => s.trim()).length;

describe('Sparkline', () => {
  test('an unbroken series is one subpath', () => {
    const d = pathData([0.2, 0.4, 0.6, 0.8]);
    expect(d).not.toBeNull();
    expect(subpaths(d!)).toBe(1);
    expect(d!.match(/L/g)).toHaveLength(3);
  });

  test('a null breaks the stroke instead of being drawn through', () => {
    const d = pathData([0.2, 0.4, null, 0.6, 0.8]);
    expect(d).not.toBeNull();
    // Two runs: [0.2, 0.4] and [0.6, 0.8]. Three L commands would mean the gap
    // was bridged.
    expect(subpaths(d!)).toBe(2);
    expect(d!.match(/L/g)).toHaveLength(2);
  });

  test('several gaps break the stroke each time', () => {
    const d = pathData([0.6, null, null, 0.55, 0.7, null, 0.75, 0.8, null, 0.85]);
    expect(subpaths(d!)).toBe(4); // [0.6] [0.55,0.7] [0.75,0.8] [0.85]
  });

  test('isolated measurements draw no connecting line', () => {
    // Every other bucket empty: there is nothing here that justifies a line, so
    // the path must be moves only. The dots still mark each measurement.
    const d = pathData([0.5, null, 0.6, null, 0.7]);
    expect(d!.match(/L/g)).toBeNull();
    expect(subpaths(d!)).toBe(3);
  });

  test('leading and trailing nulls do not start or extend a run', () => {
    const d = pathData([null, 0.4, 0.5, null]);
    expect(subpaths(d!)).toBe(1);
    expect(d!.match(/L/g)).toHaveLength(1);
  });

  test('a dot is rendered for every bucket that has data, gaps included', () => {
    const { container } = render(
      <Sparkline values={[0.6, null, null, 0.55, 0.7, null, 0.85]} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  test('an empty series renders nothing', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  test('an all-null series draws no path', () => {
    const { container } = render(<Sparkline values={[null, null, null]} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });
});
