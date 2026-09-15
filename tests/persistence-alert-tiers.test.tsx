/**
 * `PersistenceAlert`'s two tiers (ADR 0019).
 *
 * One flat 10 s grace against a 45 s write deadline meant a healthy-but-slow 12 s write spent
 * 35 seconds showing `Antworten noch nicht gespeichert — Fenster nicht schließen`, and then
 * vanished with nothing wrong. A warning that cries wolf stops being read, which is precisely
 * what ADR 0016 was protecting against when it made this alert non-dismissible.
 *
 * So: nothing under the grace, a calm line while the write path still has budget left, and the
 * red banner only once the deadline it names has actually passed. The boundary is imported from
 * the store, so the two constants can never drift apart again — which is pinned here too.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import PersistenceAlert, { ALERT_GRACE_MS, ALERT_LATE_MS } from '../src/components/PersistenceAlert';
import { PERSISTENCE_DEADLINE_MS } from '../src/lib/store';
import { Rating } from '../src/lib/srs';
import { journalAppend } from '../src/lib/write-journal';
import { __resetProfileStateCacheForTests } from '../src/lib/profile';

// NO profile registry on purpose, so `resolveProfileState()` answers 'first-run' and the
// component's launch effect never starts a replay. A replay here would be a live promise chain
// outliving the test: it resolves in whatever file bun runs next, calling that file's mocked
// `updateCardState` and failing an assertion nowhere near this one. These tests are about what
// the alert RENDERS; the replay has its own coverage in tests/write-journal.test.ts.
beforeEach(() => {
  localStorage.clear();
  __resetProfileStateCacheForTests();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  __resetProfileStateCacheForTests();
});

/** Journal a grade that pressed its button `ageMs` ago. */
function journalAged(cardId: string, ageMs: number) {
  journalAppend({ kind: 'grade', cardId, grade: Rating.Good, ts: Date.now() - ageMs });
}

describe('the alert tiers', () => {
  test('the late boundary IS the write deadline, so the two cannot drift apart', () => {
    expect(ALERT_LATE_MS).toBe(PERSISTENCE_DEADLINE_MS);
    expect(ALERT_GRACE_MS).toBeLessThan(ALERT_LATE_MS);
  });

  test('an op inside the ordinary round trip renders nothing at all', () => {
    journalAged('a::card::de-x', 1000);
    const { container } = render(<PersistenceAlert />);
    expect(container.textContent).toBe('');
  });

  test('an op past the grace but inside its retry budget renders the calm line, with no button', () => {
    journalAged('a::card::de-x', ALERT_GRACE_MS + 5000);
    render(<PersistenceAlert />);
    expect(screen.getByRole('status').textContent).toContain('wird noch gespeichert');
    expect(screen.queryByRole('alert')).toBeNull();
    // No retry: a second attempt only queues behind the first, because the store runs one
    // readwrite transaction at a time.
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('an op past the write deadline renders the red banner with a retry', () => {
    journalAged('a::card::de-x', ALERT_LATE_MS + 5000);
    render(<PersistenceAlert />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('noch nicht gespeichert');
    expect(screen.getByRole('button').textContent).toContain('Jetzt erneut versuchen');
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('neither tier offers a way to dismiss it (ADR 0016)', () => {
    journalAged('a::card::de-x', ALERT_LATE_MS + 5000);
    const { container } = render(<PersistenceAlert />);
    const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('Jetzt erneut versuchen');
  });

  test('a confirmed write clears the banner without the learner pressing anything', () => {
    // The last link of the ADR 0019 chain: a write that lands after its deadline calls
    // `confirmOp` -> `journalRemove` -> `writeOps` -> `notify()`, and THIS listener is what
    // turns that into a banner that disappears on its own. Without it the red bar would sit
    // there until the next navigation, which is how it looked permanent in the first place.
    journalAged('a::card::de-x', ALERT_LATE_MS + 5000);
    render(<PersistenceAlert />);
    expect(screen.getByRole('alert')).toBeTruthy();

    act(() => {
      localStorage.setItem('da:journal:local', '[]'); // the id getActiveProfileId() falls back to
      window.dispatchEvent(new CustomEvent('da:journal'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('the tiers count separately: one slow write and one failed write', () => {
    journalAged('slow::card::de-x', ALERT_GRACE_MS + 1000);
    journalAged('dead::card::de-x', ALERT_LATE_MS + 1000);
    render(<PersistenceAlert />);
    // The red tier wins the surface, and reports only the ops that genuinely missed the deadline.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('1 Antwort noch nicht gespeichert');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
