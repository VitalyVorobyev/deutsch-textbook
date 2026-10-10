import { describe, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { get, set } from 'idb-keyval';
import { createManagedStore, StorageRestartRequiredError, type StorageDiagnostic } from '../src/lib/managed-store';
import { eventually } from './eventually';

// The transaction and abort deadlines are what these tests drive, so they stay short. The open
// deadline is not (the late-open test builds its own store): at 20 ms the re-open after a
// retry missed it on a loaded Windows runner, added a second 'retry' event, and failed the
// v0.6.7 release build.
function fixture() {
  const factory = new IDBFactory();
  const events: StorageDiagnostic[] = [];
  const manager = createManagedStore('managed-test', {
    factory: () => factory, transactionMs: 20, openMs: 2000, abortMs: 20,
    report: (event) => events.push(event),
  });
  return { ...manager, factory, events };
}

/** Keep a REAL transaction active while withholding the application's request callback. */
function keepAlive(store: IDBObjectStore, running: () => boolean) {
  const next = () => {
    if (!running()) return;
    try {
      const req = store.get('tick');
      req.onsuccess = next;
      req.onerror = () => {};
    } catch { /* abort ended the transaction */ }
  };
  next();
}

describe('managed IndexedDB recovery', () => {
  test('aborts a stuck transaction before retrying; later writes can acquire the real lock', async () => {
    const { use, events } = fixture();
    let calls = 0;
    let aborted = false;
    await use('readwrite', (store) => {
      calls++;
      if (calls === 1) {
        store.put('must roll back', 'value');
        store.transaction.addEventListener('abort', () => { aborted = true; });
        keepAlive(store, () => !aborted);
        return new Promise<void>(() => {});
      }
      expect(aborted).toBe(true);
      store.put('recovered', 'value');
      return Promise.resolve();
    });
    await set('later', true, use);
    expect(await get('value', use)).toBe('recovered');
    expect(await get('later', use)).toBe(true);
    expect(calls).toBe(2);
    expect(events.map((e) => e.outcome)).toEqual(['retry', 'recovered']);
  });

  test('an abort that never finishes blocks retries and later writes until restart', async () => {
    const { use, events, needsRestart } = fixture();
    let stop: (() => void) | undefined;
    let running = true;
    let calls = 0;
    const write = use('readwrite', (store) => {
      calls++;
      const tx = store.transaction;
      const abort = tx.abort.bind(tx);
      stop = () => { running = false; abort(); };
      tx.abort = () => { throw new DOMException('Engine stuck', 'InvalidStateError'); };
      keepAlive(store, () => running);
      return new Promise<void>(() => {});
    });
    try {
      await eventually(needsRestart);
      expect(needsRestart()).toBe(true);
      await expect(set('later', true, use)).rejects.toBeInstanceOf(StorageRestartRequiredError);
      expect(calls).toBe(1);
      expect(events.at(-1)?.phase).toBe('abort');
    } finally {
      stop?.();
      await expect(write).rejects.toBeInstanceOf(StorageRestartRequiredError);
    }
  });

  test('a late completion during the abort grace confirms the committed value', async () => {
    const { use } = fixture();
    let running = true;
    let calls = 0;
    await use('readwrite', (store) => {
      calls++;
      store.transaction.abort = () => { setTimeout(() => { running = false; }, 5); };
      store.put('landed', 'value');
      keepAlive(store, () => running);
      return Promise.resolve();
    });
    expect(calls).toBe(1);
    expect(await get('value', use)).toBe('landed');
  });

  test('a completion after the abort budget still confirms the owned write', async () => {
    const { use, needsRestart } = fixture();
    let running = true;
    const write = use('readwrite', (store) => {
      store.transaction.abort = () => {};
      store.put('late', 'value');
      keepAlive(store, () => running);
      return Promise.resolve();
    });
    await eventually(needsRestart);
    expect(needsRestart()).toBe(true);
    running = false;
    await expect(write).resolves.toBeUndefined();
  });

  test('a missing callback after commit is bounded and retried idempotently', async () => {
    const { use, events } = fixture();
    let calls = 0;
    await use('readwrite', (store) => {
      store.put('same', 'value');
      return ++calls === 1 ? new Promise<void>(() => {}) : Promise.resolve();
    });
    expect(calls).toBe(2);
    expect(await get('value', use)).toBe('same');
    expect(events[0]?.phase).toBe('transaction');
  });

  test('expired open results are closed and cannot replace the new connection', async () => {
    const factory = new IDBFactory();
    const originalOpen = factory.open.bind(factory);
    let first: IDBOpenDBRequest | undefined;
    let calls = 0;
    factory.open = ((...args: Parameters<IDBFactory['open']>) => {
      const request = originalOpen(...args);
      if (++calls !== 1) return request;
      first = request;
      // Delay delivery to the manager, while letting IndexedDB create the real database.
      let handler: ((event: Event) => void) | null = null;
      Object.defineProperty(request, 'onsuccess', {
        set: (fn) => { handler = fn; }, get: () => null,
      });
      request.addEventListener('success', (event) => {
        setTimeout(() => handler?.(event), 60);
      });
      return request;
    }) as IDBFactory['open'];
    const { use } = createManagedStore('late-open', { factory: () => factory, openMs: 20 });
    await set('value', 'fresh', use);
    await eventually(() => {
      try { first!.result.transaction('progress'); return false; } catch { return true; }
    });
    expect(() => first!.result.transaction('progress')).toThrow();
    expect(await get('value', use)).toBe('fresh');
  });
});
