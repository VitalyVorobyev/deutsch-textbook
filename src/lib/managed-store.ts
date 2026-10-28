/** Owned IndexedDB connections: a retry must release its predecessor's transaction. */
import type { UseStore } from 'idb-keyval';

export class StorageRestartRequiredError extends Error {
  constructor() {
    super('Local storage could not recover; restart the app to replay pending progress');
    this.name = 'StorageRestartRequiredError';
  }
}
class RetryableStorageError extends Error {}

export interface StorageDiagnostic {
  phase: 'open' | 'transaction' | 'abort';
  waitedMs: number;
  attempts: number;
  /** `released`: the page entered the back/forward cache and its transactions were aborted. */
  outcome: 'retry' | 'restart-required' | 'recovered' | 'released';
}

export function createManagedStore(
  name: string,
  {
    factory = () => indexedDB,
    openMs = 2000,
    transactionMs = 10000,
    abortMs = 1000,
    report = (_entry: StorageDiagnostic) => {},
    lifecycle = typeof window === 'undefined' ? undefined : window,
    reload = () => location.reload(),
  }: {
    factory?: () => IDBFactory;
    openMs?: number;
    transactionMs?: number;
    abortMs?: number;
    report?: (entry: StorageDiagnostic) => void;
    /** Where `pagehide`/`pageshow` are heard; the window, or a stand-in in tests. */
    lifecycle?: EventTarget;
    reload?: () => void;
  } = {},
): { use: UseStore; reset: () => void; needsRestart: () => boolean } {
  let db: IDBDatabase | undefined;
  let opening: Promise<IDBDatabase> | undefined;
  let generation = 0;
  let blocked = false;
  let frozen = false;
  let released = false;
  const active = new Set<IDBTransaction>();

  // WebKit may keep a page it navigates away from in the back/forward cache instead of
  // destroying it. An IndexedDB commit is sent by the page, so a transaction live at that
  // moment is frozen with its lock held: every transaction the next page opens on this store
  // queues behind it until the cached page is evicted (30 min) or the app quits, and the
  // watchdog's abort of a queued transaction is never acknowledged. Abort it while the page
  // can still say so: the write journal replays grades, attempts and sessions on the next
  // page, and only an unjournaled write in flight at that instant (a topic mark) is lost.
  lifecycle?.addEventListener('pagehide', (event) => {
    if (!(event as PageTransitionEvent).persisted) return;
    frozen = true;
    if (active.size === 0) return;
    released = true;
    const attempts = active.size;
    for (const tx of active) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
    }
    report({ phase: 'abort', waitedMs: 0, attempts, outcome: 'released' });
    retire();
  });
  // A page restored from the cache holds callers whose operations were aborted or refused
  // above, and state another page may since have rewritten: start it afresh.
  lifecycle?.addEventListener('pageshow', (event) => {
    if (!(event as PageTransitionEvent).persisted) return;
    frozen = false;
    if (released) reload();
  });

  function retire() {
    generation++;
    db?.close();
    db = undefined;
    opening = undefined;
  }
  function open(): Promise<IDBDatabase> {
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    const epoch = generation;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory().open(name);
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        reject(new RetryableStorageError('Database open timed out'));
      }, openMs);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('progress'))
          request.result.createObjectStore('progress');
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        const connection = request.result;
        if (expired || epoch !== generation) {
          connection.close();
          reject(new RetryableStorageError('Obsolete database open'));
          return;
        }
        db = connection;
        connection.onversionchange = () => {
          connection.close();
          if (db === connection) retire();
        };
        connection.onclose = () => {
          if (db === connection) retire();
        };
        resolve(connection);
      };
    });
    opening = promise;
    void promise
      .finally(() => {
        if (opening === promise) opening = undefined;
      })
      .catch(() => {});
    return promise;
  }

  function transact<T>(
    connection: IDBDatabase,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => T | PromiseLike<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const tx = connection.transaction('progress', mode);
      active.add(tx);
      let finished = false;
      let committed = false;
      let timedOut = false;
      let valueReady = false;
      let value: T;
      let callbackError: unknown;
      let abortTimer: ReturnType<typeof setTimeout> | undefined;
      const settle = (error?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clearTimeout(abortTimer);
        active.delete(tx);
        if (error !== undefined) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(() => {
        timedOut = true;
        // A committed transaction cannot be aborted. Retrying its missing callback is safe
        // for our idempotent operations; it must not be mistaken for a rolled-back write.
        if (committed) {
          settle(new RetryableStorageError('Callback did not settle'));
          return;
        }
        abortTimer = setTimeout(() => {
          blocked = true;
          report({
            phase: 'abort',
            waitedMs: transactionMs + abortMs,
            attempts: 1,
            outcome: 'restart-required',
          });
          retire();
          // Keep this operation owned: the caller has its own deadline, but a late
          // complete event is still proof of a commit and must be allowed to confirm it.
          // All NEW operations fail fast through `blocked` above.
        }, abortMs);
        try {
          tx.abort();
        } catch {
          /* wait for complete/abort, then require restart */
        }
      }, transactionMs);
      tx.addEventListener('complete', () => {
        committed = true;
        if (valueReady) settle();
      });
      tx.addEventListener('abort', () => {
        settle(
          callbackError ??
            (timedOut
              ? new RetryableStorageError('Transaction watchdog aborted stalled write')
              : (tx.error ?? new DOMException('Transaction aborted', 'AbortError'))),
        );
      });
      // Install terminal handlers BEFORE issuing the first request. idb-keyval's update
      // itself only starts listening for abort after its read succeeds.
      try {
        Promise.resolve(callback(tx.objectStore('progress'))).then(
          (result) => {
            value = result;
            valueReady = true;
            if (committed) settle();
          },
          (error: unknown) => {
            callbackError = error;
            if (committed) settle(error);
            else {
              try {
                tx.abort();
              } catch {
                /* watchdog owns the terminal bound */
              }
            }
          },
        );
      } catch (error) {
        callbackError = error;
        try {
          tx.abort();
        } catch {
          /* watchdog owns the terminal bound */
        }
      }
    });
  }

  // A transaction opened between `pagehide` and the freeze would hold the lock again.
  function refuseWhileFrozen() {
    if (!frozen) return;
    released = true;
    throw new DOMException('Page is in the back/forward cache', 'AbortError');
  }

  const use: UseStore = async (mode, callback) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (blocked) throw new StorageRestartRequiredError();
      refuseWhileFrozen();
      let phase: StorageDiagnostic['phase'] = 'open';
      const started = Date.now();
      try {
        const connection = await open();
        refuseWhileFrozen();
        phase = 'transaction';
        const result = await transact(connection, mode, callback);
        if (attempt > 1)
          report({
            phase,
            waitedMs: Date.now() - started,
            attempts: attempt,
            outcome: 'recovered',
          });
        return result;
      } catch (error) {
        // Retrying on a cached page would only open another transaction to freeze.
        if (error instanceof StorageRestartRequiredError || frozen) throw error;
        const retryable =
          error instanceof RetryableStorageError ||
          (error instanceof Error &&
            ['AbortError', 'InvalidStateError', 'UnknownError'].includes(error.name));
        if (!retryable) throw error;
        report({
          phase,
          waitedMs: Date.now() - started,
          attempts: attempt,
          outcome: attempt === 3 ? 'restart-required' : 'retry',
        });
        retire();
        if (attempt === 3) {
          blocked = true;
          throw new StorageRestartRequiredError();
        }
      }
    }
    throw new StorageRestartRequiredError();
  };
  // Read retry timers must never replace a connection that owns a live write.
  return {
    use,
    needsRestart: () => blocked,
    reset: () => {
      if (active.size === 0 && !blocked) retire();
    },
  };
}
