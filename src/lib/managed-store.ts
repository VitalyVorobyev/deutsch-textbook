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
  outcome: 'retry' | 'restart-required' | 'recovered';
}

export function createManagedStore(
  name: string,
  {
    factory = () => indexedDB,
    openMs = 2000,
    transactionMs = 10000,
    abortMs = 1000,
    report = (_entry: StorageDiagnostic) => {},
  }: {
    factory?: () => IDBFactory;
    openMs?: number;
    transactionMs?: number;
    abortMs?: number;
    report?: (entry: StorageDiagnostic) => void;
  } = {},
): { use: UseStore; reset: () => void; needsRestart: () => boolean } {
  let db: IDBDatabase | undefined;
  let opening: Promise<IDBDatabase> | undefined;
  let generation = 0;
  let blocked = false;
  const active = new Set<IDBTransaction>();

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

  const use: UseStore = async (mode, callback) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (blocked) throw new StorageRestartRequiredError();
      let phase: StorageDiagnostic['phase'] = 'open';
      const started = Date.now();
      try {
        const connection = await open();
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
        if (error instanceof StorageRestartRequiredError) throw error;
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
