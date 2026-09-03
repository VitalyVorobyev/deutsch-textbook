/**
 * "Your answers are not saved yet" alert.
 *
 * Mounted once in Base.astro. It owns two jobs, both sides of the same contract
 * (a stalled store must be loud, never silent — docs/adrs/0016-durable-progress-writes.md):
 *
 *   1. On launch, replay the write journal: ops a previous page view journaled but
 *      never confirmed into IndexedDB (a stalled write, an abrupt quit) are applied
 *      now; idempotency at the store layer makes replaying an op that actually
 *      landed a no-op.
 *   2. While the journal holds ops older than a grace period, show a persistent
 *      red alert with a retry button. Not dismissible: dismissing "your work is
 *      not saved" is how work gets lost politely.
 *
 * The grace period exists because every durable write sits in the journal for the
 * milliseconds of its ordinary IndexedDB round trip — the alert is for writes that
 * are LATE, not for writes in flight.
 */
import { useCallback, useEffect, useState } from 'react';
import { initExitFlush } from '../lib/autosync';
import { resolveProfileState } from '../lib/profile';
import { runCardIdMigrationOnce } from '../lib/store';
import {
  JOURNAL_EVENT,
  journalOverflowed,
  journalPending,
  replayJournal,
  type JournalOp,
} from '../lib/write-journal';
import { useUiLang } from './hooks';
import { t } from '../lib/strings';

/** Ops younger than this are ordinary in-flight writes, not an incident. */
export const ALERT_GRACE_MS = 10000;

function opTs(op: JournalOp): number {
  return op.kind === 'attempt' ? op.attempt.ts : op.ts;
}

function lateOps(now = Date.now()): number {
  return journalPending().filter((op) => now - opTs(op) > ALERT_GRACE_MS).length;
}

export default function PersistenceAlert() {
  const uiLang = useUiLang();
  const [late, setLate] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(() => setLate(lateOps()), []);

  // Launch replay: only once the profile gate has resolved 'ready' — before that
  // there is no store to replay into (getStore parks on 'first-run').
  useEffect(() => {
    // Desktop exit flush: armed from here because this island is on every page
    // (Base.astro), so the listener exists before the first close can happen.
    initExitFlush();
    let cancelled = false;
    void resolveProfileState().then((state) => {
      if (cancelled || state !== 'ready') return;
      if (journalPending().length > 0) void replayJournal().then(refresh);
      // The A1 card-id repair, from its one owner (store.ts explains why it is here and
      // not inside getStore). Un-awaited on purpose: no surface waits on a repair.
      void runCardIdMigrationOnce();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Observe journal changes; while anything is pending, re-check on a short
  // interval so an op crossing the grace age flips the alert on without an event.
  useEffect(() => {
    window.addEventListener(JOURNAL_EVENT, refresh);
    const timer = setInterval(() => {
      if (journalPending().length > 0) refresh();
      else setLate(0);
    }, 3000);
    return () => {
      window.removeEventListener(JOURNAL_EVENT, refresh);
      clearInterval(timer);
    };
  }, [refresh]);

  if (late === 0) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await replayJournal();
    } finally {
      setRetrying(false);
      refresh();
    }
  };

  return (
    <div role="alert" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm shadow-lg dark:border-red-800 dark:bg-red-950">
        <span className="font-medium text-red-800 dark:text-red-200">
          {late} {t(late === 1 ? 'persist.unsavedOne' : 'persist.unsavedMany', uiLang)}
        </span>
        {journalOverflowed() && (
          <span className="text-xs text-red-700 dark:text-red-300">{t('persist.overflow', uiLang)}</span>
        )}
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {t('persist.retry', uiLang)}
        </button>
      </div>
    </div>
  );
}
