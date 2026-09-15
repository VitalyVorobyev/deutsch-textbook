/**
 * "Your answers are not saved yet" alert.
 *
 * Mounted once in Base.astro. It owns two jobs, both sides of the same contract
 * (a stalled store must be loud, never silent — docs/adrs/0016-durable-progress-writes.md):
 *
 *   1. On launch, replay the write journal: ops a previous page view journaled but
 *      never confirmed into IndexedDB (a stalled write, an abrupt quit) are applied
 *      now; idempotency at the store layer makes replaying an op that actually
 *      landed a no-op. The result is reported, never discarded.
 *   2. Show the journal's state — in TWO tiers, which is ADR 0019's amendment.
 *
 * **Three ages, three answers.** Under `ALERT_GRACE_MS` an op is an ordinary IndexedDB round
 * trip and shows nothing. Between there and `ALERT_LATE_MS` it is slow but still inside the
 * write path's own retry budget: a calm amber line, no button, because a second attempt only
 * queues behind the first. Past `ALERT_LATE_MS` — the write deadline itself — the write path
 * has given up, so "not saved" is a fact: red, with a retry, and not dismissible, because
 * dismissing "your work is not saved" is how work gets lost politely.
 *
 * The tier boundary is IMPORTED from the store rather than chosen here. One flat 10 s grace
 * against a 45 s deadline meant a healthy 12 s write spent 35 seconds shouting at the learner
 * not to close the window, and a warning that cries wolf stops being read.
 */
import { useCallback, useEffect, useState } from 'react';
import { initExitFlush } from '../lib/autosync';
import { resolveProfileState } from '../lib/profile';
import { PERSISTENCE_DEADLINE_MS, runCardIdMigrationOnce } from '../lib/store';
import {
  JOURNAL_EVENT,
  journalOverflowed,
  journalPending,
  journalPoisoned,
  journalWriteBlocked,
  replayJournal,
  type JournalOp,
} from '../lib/write-journal';
import { useUiLang } from './hooks';
import { t } from '../lib/strings';

/** Ops younger than this are ordinary in-flight writes, and show nothing at all. */
export const ALERT_GRACE_MS = 10000;

/**
 * Past this an op has outlived the write path's OWN budget, so "not saved" is a fact rather
 * than a guess.
 *
 * **Imported, not typed as a number here.** Two unrelated constants in two files was the
 * defect: a 10 s grace against a 45 s deadline is how a slow-but-fine 12 s write spent 35
 * seconds telling the learner not to close the window, and a warning that cries wolf is one
 * the learner stops reading — which defeats the whole reason ADR 0016 made this alert
 * non-dismissible. The import is the fix; shortening the deadline now shortens the amber
 * window with it, by construction.
 */
export const ALERT_LATE_MS = PERSISTENCE_DEADLINE_MS;

function opTs(op: JournalOp): number {
  return op.kind === 'attempt' ? op.attempt.ts : op.ts;
}

/**
 * Split the journal into the two things it can hold.
 *
 * An op that survives a restart is by definition past its deadline, so it lands in `unsaved` —
 * correct, it genuinely was never confirmed.
 */
function classify(now = Date.now()): { saving: number; unsaved: number } {
  let saving = 0;
  let unsaved = 0;
  for (const op of journalPending()) {
    const age = now - opTs(op);
    if (age <= ALERT_GRACE_MS) continue; // an ordinary round trip
    if (age <= ALERT_LATE_MS) saving++; // slow, still inside its retry budget
    else unsaved++; // the deadline passed: genuinely not saved
  }
  return { saving, unsaved };
}

export default function PersistenceAlert() {
  const uiLang = useUiLang();
  // Lazy initial state, so ops journaled before this island mounted (a previous page view, an
  // abrupt quit) are on screen from the first paint rather than up to 3 seconds later. Safe to
  // read storage here: Base.astro mounts this `client:only`, so there is no server render to
  // disagree with.
  const [{ saving, unsaved }, setCounts] = useState(() => classify());
  const [poisoned, setPoisoned] = useState(() => journalPoisoned().length);
  const [blocked, setBlocked] = useState(() => journalWriteBlocked());
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const refresh = useCallback(() => {
    setCounts(classify());
    setPoisoned(journalPoisoned().length);
    setBlocked(journalWriteBlocked());
  }, []);

  // Launch replay: only once the profile gate has resolved 'ready' — before that
  // there is no store to replay into (getStore parks on 'first-run').
  useEffect(() => {
    // Desktop exit flush: armed from here because this island is on every page
    // (Base.astro), so the listener exists before the first close can happen.
    initExitFlush();
    let cancelled = false;
    void resolveProfileState().then((state) => {
      if (cancelled || state !== 'ready') return;
      if (journalPending().length > 0) {
        void replayJournal().then((result) => {
          // Report it. The old bare discard is why a replay could fail at every launch and
          // leave nothing behind but a red banner with no explanation.
          if (result.failed > 0 || result.poisoned > 0) {
            console.error('journal replay incomplete', result);
          }
          refresh();
        });
      }
      // The A1 card-id repair, from its one owner (store.ts explains why it is here and
      // not inside getStore). Un-awaited on purpose: no surface waits on a repair.
      void runCardIdMigrationOnce();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Observe journal changes; while anything is pending, re-check on a short
  // interval so an op crossing the grace age — or the deadline — flips the tier
  // without an event.
  useEffect(() => {
    window.addEventListener(JOURNAL_EVENT, refresh);
    const timer = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener(JOURNAL_EVENT, refresh);
      clearInterval(timer);
    };
  }, [refresh]);

  const retry = async () => {
    setRetrying(true);
    try {
      const result = await replayJournal();
      setRetryFailed(result.failed > 0);
      if (result.failed > 0) console.error('journal replay failed', result.error);
    } finally {
      setRetrying(false);
      refresh();
    }
  };

  // The red tier: past the write path's own deadline, or an op that can never be applied.
  // Not dismissible — dismissing "your work is not saved" is how work gets lost politely.
  if (unsaved > 0 || poisoned > 0 || blocked) {
    return (
      <div
        role="alert"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm shadow-lg dark:border-red-800 dark:bg-red-950">
          {unsaved > 0 && (
            <span className="font-medium text-red-800 dark:text-red-200">
              {unsaved} {t(unsaved === 1 ? 'persist.unsavedOne' : 'persist.unsavedMany', uiLang)}
            </span>
          )}
          {poisoned > 0 && (
            <span className="font-medium text-red-800 dark:text-red-200">
              {t(poisoned === 1 ? 'persist.unreplayableOne' : 'persist.unreplayableMany', uiLang)}
            </span>
          )}
          {blocked && (
            <span className="text-xs text-red-700 dark:text-red-300">
              {t('persist.storageBlocked', uiLang)}
            </span>
          )}
          {journalOverflowed() && (
            <span className="text-xs text-red-700 dark:text-red-300">
              {t('persist.overflow', uiLang)}
            </span>
          )}
          {retryFailed && (
            <span className="text-xs text-red-700 dark:text-red-300">
              {t('persist.retryFailed', uiLang)}
            </span>
          )}
          {unsaved > 0 && (
            <button
              type="button"
              onClick={() => void retry()}
              disabled={retrying}
              className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t('persist.retry', uiLang)}
            </button>
          )}
        </div>
      </div>
    );
  }

  // The calm tier: slow, but still inside the write path's retry budget. No button — a second
  // attempt only queues behind the first, because one readwrite transaction runs at a time.
  if (saving > 0) {
    return (
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
      >
        <div className="pointer-events-auto rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {saving} {t(saving === 1 ? 'persist.savingOne' : 'persist.savingMany', uiLang)}
        </div>
      </div>
    );
  }

  return null;
}
