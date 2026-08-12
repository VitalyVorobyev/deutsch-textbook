/**
 * `weakFocuses` (src/lib/weakness.ts) excludes unverified evidence and pretest
 * attempts, and nothing else — it applies no role filter, so a probe attempt is
 * counted exactly like an ordinary practice attempt. That is a deliberate ruling
 * (docs/adrs/0010-probe-failure-remediation.md, R2): a failed delayed check is
 * stronger evidence of a live confusion than a same-session miss, not weaker, and it
 * should raise same-focus practice priority. Before this pin, that behavior was
 * correct but untested — a claim without a test is how a role filter could have been
 * added later without anything noticing.
 */
import { describe, expect, test } from 'bun:test';
import { focusStats, weakFocuses } from '../src/lib/weakness';
import type { Attempt } from '../src/lib/store';

const T0 = 1_780_000_000_000;
const DAY = 86_400_000;

function probeAttempt(over: Partial<Attempt> & { itemId: string; ts: number }): Attempt {
  return {
    setId: 'a2/probe-dativ-praepositionen',
    itemType: 'translate',
    correct: false,
    given: '',
    focus: 'dativ-praepositionen',
    outcomes: ['dativ-praepositionen-anwenden'],
    ...over,
  };
}

describe('probe attempts feed weakFocuses (R2)', () => {
  // Four wrong probe attempts, one per rung of a family that would run past its own
  // three-stage ladder if repeated (nextVariant falls back to the oldest variant) —
  // and NO ordinary practice attempt at all. If probe-set attempts were excluded the
  // way pretest attempts are, this focus would have zero recorded evidence.
  const wrongProbeAttempts: Attempt[] = [0, 1, 2, 3].map((i) =>
    probeAttempt({ itemId: `variant-${i % 3}`, ts: T0 + i * DAY }),
  );

  test('a wrong probe attempt is counted in focusStats', () => {
    const stats = focusStats(wrongProbeAttempts);
    const stat = stats.find((s) => s.focus === 'dativ-praepositionen');
    expect(stat).toBeDefined();
    expect(stat!.attempts).toBe(4);
    expect(stat!.errors).toBe(4);
    expect(stat!.errorRate).toBe(1);
  });

  test('a focus with only failed probe attempts surfaces as weak', () => {
    const weak = weakFocuses(wrongProbeAttempts);
    expect(weak.map((w) => w.focus)).toContain('dativ-praepositionen');
  });

  test('a correct probe attempt still counts as evidence, just not an error', () => {
    const mixed: Attempt[] = [
      ...wrongProbeAttempts,
      probeAttempt({ itemId: 'variant-2', ts: T0 + 4 * DAY, correct: true }),
    ];
    const stat = focusStats(mixed).find((s) => s.focus === 'dativ-praepositionen');
    expect(stat!.attempts).toBe(5);
    expect(stat!.errors).toBe(4);
  });
});
