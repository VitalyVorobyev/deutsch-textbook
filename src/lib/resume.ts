/**
 * Resume state for in-progress lessons (client-side only).
 *
 * Islands lose their React state on any page reload — mobile browsers discard
 * background tabs, and mid-session navigation (e.g. opening a topic article
 * from step 3) remounts everything. Surfaces persist just enough here to put
 * the learner back at the same lesson point.
 *
 * Entries are profile-scoped and expire at the end of the local day: resuming
 * a half-finished set days later would be pedagogically wrong — the set
 * should restart. localStorage is synchronous, so state survives even an
 * abrupt tab kill with no flush step.
 */
import { getActiveProfileId } from './profile';
import { localDateString } from './store';

interface Saved<T> {
  date: string;
  state: T;
}

function keyFor(surface: string): string {
  return `da:resume:${getActiveProfileId()}:${surface}`;
}

export function saveResume<T>(surface: string, state: T): void {
  try {
    const saved: Saved<T> = { date: localDateString(), state };
    localStorage.setItem(keyFor(surface), JSON.stringify(saved));
  } catch {
    // storage blocked or full — resume is best-effort
  }
}

export function loadResume<T>(surface: string): T | null {
  try {
    const raw = localStorage.getItem(keyFor(surface));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved<T>;
    if (saved.date !== localDateString()) {
      localStorage.removeItem(keyFor(surface));
      return null;
    }
    return saved.state;
  } catch {
    return null;
  }
}

export function clearResume(surface: string): void {
  try {
    localStorage.removeItem(keyFor(surface));
  } catch {
    // ignore
  }
}
