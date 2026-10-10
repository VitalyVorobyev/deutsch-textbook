import { afterEach, beforeEach, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { get, update, type UseStore } from 'idb-keyval';
import { createManagedStore } from '../src/lib/managed-store';
import * as store from '../src/lib/store';
import * as journal from '../src/lib/write-journal';
import { Rating } from '../src/lib/srs';
import { __resetProfileStateCacheForTests } from '../src/lib/profile';
import { eventually } from './eventually';

let restore: (() => void) | undefined;
beforeEach(() => {
  store.__resetWriteQueueForTests();
  localStorage.clear();
  localStorage.setItem('da:profiles', JSON.stringify([{ id: 'transition-test', label: 'Test' }]));
  localStorage.setItem('da:profile', 'transition-test');
  __resetProfileStateCacheForTests();
});
afterEach(() => { restore?.(); store.__resetWriteQueueForTests(); localStorage.clear(); });

const entry = { date: '2026-09-17', reviewed: 1, trained: 1, ts: 1789660000000 };

test('session → cards preserves ordering through a real transaction stall, merge and replay', async () => {
  const manager = createManagedStore('transition', {
    // Margins as in managed-store.test.ts: the stalled transaction crosses any deadline, and
    // the writes behind it must not be the ones that miss theirs on a loaded runner.
    factory: () => factory, transactionMs: 100, abortMs: 250,
  });
  const factory = new IDBFactory();
  let starts = 0;
  let aborted = false;
  const handle: UseStore = (mode, callback) => manager.use(mode, (objectStore) => {
    if (++starts === 1) {
      objectStore.transaction.addEventListener('abort', () => { aborted = true; });
      const loop = () => {
        if (aborted) return;
        const request = objectStore.get('tick');
        request.onsuccess = loop;
        request.onerror = () => {};
      };
      loop();
      return new Promise<never>(() => {});
    }
    return callback(objectStore);
  });
  restore = store.__setCommitBatchForTests((key, apply) => update(key, apply, handle));
  const session = journal.logSessionDurably(entry);
  const first = journal.gradeCardDurably('card', Rating.Again, entry.ts + 1);
  const second = journal.gradeCardDurably('card', Rating.Good, entry.ts + 60000);
  const merged = store.mergeSnapshot({ version: 7, exportedAt: new Date().toISOString(),
    attempts: [], cards: {}, sessions: [entry], topics: {}, feedback: {} });
  const retry = journal.replayJournal();
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.all([session, first, second, merged, retry]);
  expect(aborted).toBe(true);
  expect(journal.journalPending()).toEqual([]);
  expect((await get<store.CardStates>('cards', manager.use))!.card!.reps).toBe(2);
  expect(await get('sessions', manager.use)).toEqual([entry]);

  // A page can die after commit but before journal removal. Relaunch replay is idempotent.
  journal.journalAppend({ kind: 'session', entry });
  journal.journalAppend({ kind: 'grade', cardId: 'card', grade: Rating.Good, ts: entry.ts + 60000 });
  await journal.replayJournal();
  expect(await get('sessions', manager.use)).toEqual([entry]);
  expect((await get<store.CardStates>('cards', manager.use))!.card!.reps).toBe(2);
  expect(journal.journalPending()).toEqual([]);
});

test('timed-out callers and manual retries share the same still-running write', async () => {
  let release: (() => void) | undefined;
  let commits = 0;
  restore = store.__setCommitBatchForTests(async (_key, apply) => {
    commits++;
    await new Promise<void>((resolve) => { release = resolve; });
    apply(undefined);
  });
  const first = journal.gradeCardDurably('card', Rating.Good, entry.ts, { deadlineMs: 5 });
  expect(await first).toBeNull();
  await journal.replayJournal({ deadlineMs: 5 });
  await journal.replayJournal({ deadlineMs: 5 });
  expect(commits).toBe(1);
  expect(journal.journalPending()).toHaveLength(1);
  release!();
  await eventually(() => journal.journalPending().length === 0);
  expect(journal.journalPending()).toEqual([]);
});

for (const name of ['AbortError', 'QuotaExceededError', 'InvalidStateError', 'UnknownError']) {
  test(`${name} retains the journal and blocks later grades from overtaking`, async () => {
    restore = store.__setCommitBatchForTests(async () => { throw new DOMException('storage unavailable', name); });
    journal.journalAppend({ kind: 'session', entry });
    journal.journalAppend({ kind: 'grade', cardId: 'card', grade: Rating.Good, ts: entry.ts });
    const result = await journal.replayJournal();
    expect(result.failed).toBe(2);
    expect(result.poisoned).toBe(0);
    expect(journal.journalPoisoned()).toEqual([]);
    expect(journal.journalPending()).toHaveLength(2);
  });
}

test('full quarantine retains the original operation instead of deleting evidence', async () => {
  localStorage.setItem('da:journal-poison:transition-test', JSON.stringify(Array.from({ length: journal.POISON_CAP }, () => ({ error: 'old', at: 1 }))));
  restore = store.__setCommitBatchForTests(async () => { throw new TypeError('invalid payload'); });
  journal.journalAppend({ kind: 'session', entry });
  const result = await journal.replayJournal();
  expect(result.failed).toBe(1);
  expect(journal.journalPending()).toHaveLength(1);
  expect(journal.journalPoisoned()).toHaveLength(journal.POISON_CAP);
});

test('a refused quarantine write leaves the original operation available for replay', async () => {
  journal.journalAppend({ kind: 'session', entry });
  restore = store.__setCommitBatchForTests(async () => { throw new TypeError('invalid payload'); });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  const storage = localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: storage.getItem.bind(storage),
    setItem: (key: string, value: string) => {
      if (key.startsWith('da:journal-poison:')) throw new DOMException('Full', 'QuotaExceededError');
      storage.setItem(key, value);
    },
  } });
  try {
    const result = await journal.replayJournal();
    expect(result.failed).toBe(1);
    expect(result.poisoned).toBe(0);
    expect(journal.journalPending()).toHaveLength(1);
    expect(journal.journalPoisoned()).toEqual([]);
  } finally { Object.defineProperty(globalThis, 'localStorage', original); }
});
