/**
 * The shared queue (ADR 0014), on a temporary tree: every fixture states the files and topics its
 * assertion depends on, and nothing here reads or writes the live queue.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ContentGraph } from '@da/content/graph';
import {
  QUEUE_FILE,
  addNote,
  closeEntry,
  fileEntry,
  firstTurn,
  loadQueue,
  ownerQueueAction,
  queueProblems,
} from '@da/content/queue';

let ROOT: string;
const SET = 'content/exercises/a1/t-praxis.yaml';
const GRAPH = { topics: new Map([['t', {}]]) } as unknown as ContentGraph;

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'da-queue-'));
  mkdirSync(join(ROOT, 'content/exercises/a1'), { recursive: true });
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, SET), 'items:\n  - id: i1\n  - id: i2\n');
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
const reset = () => rmSync(join(ROOT, QUEUE_FILE), { force: true });

describe('the shared queue', () => {
  test("who acts first: the owner's entries and Claude's findings wait for Claude", () => {
    expect(firstTurn('owner', 'question')).toBe('claude');
    expect(firstTurn('claude', 'finding')).toBe('claude');
    expect(firstTurn('claude', 'question')).toBe('owner');
    expect(firstTurn('claude', 'request')).toBe('owner');
  });

  test('a thread passes the turn back and forth, and closing deletes it', () => {
    reset();
    const filed = ownerQueueAction(ROOT, GRAPH, {
      action: 'file',
      type: 'question',
      target: { file: SET, item: 'i2' },
      text: 'Eindeutig?',
    });
    expect(filed).toMatchObject({ ok: true, entry: { id: 'q-0001', waiting: 'claude' } });
    expect(addNote(ROOT, { id: 'q-0001', from: 'claude', text: 'Ja.' })).toMatchObject({
      entry: { waiting: 'owner' },
    });
    ownerQueueAction(ROOT, GRAPH, { action: 'reply', id: 'q-0001', text: 'Warum?' });
    const entry = loadQueue(ROOT).entries[0]!;
    expect(entry.waiting).toBe('claude');
    expect(entry.thread.map((note) => note.from)).toEqual(['owner', 'claude', 'owner']);
    expect(closeEntry(ROOT, 'q-0001').ok).toBe(true);
    expect(loadQueue(ROOT).entries).toEqual([]);
  });

  test('ids grow from the highest one, and the file is written in id order', () => {
    reset();
    for (const text of ['a', 'b', 'c'])
      fileEntry(ROOT, { type: 'finding', target: { topic: 't' }, from: 'claude', text }, GRAPH);
    closeEntry(ROOT, 'q-0002');
    const next = fileEntry(ROOT, {
      type: 'finding',
      target: { topic: 't' },
      from: 'claude',
      text: 'd',
    });
    expect(next).toMatchObject({ entry: { id: 'q-0004' } });
    const text = readFileSync(join(ROOT, QUEUE_FILE), 'utf8');
    expect(text.indexOf('q-0001')).toBeLessThan(text.indexOf('q-0003'));
    expect(text.indexOf('q-0003')).toBeLessThan(text.indexOf('q-0004'));
  });

  test('a target must name something that exists', () => {
    reset();
    const refused = (target: Parameters<typeof fileEntry>[1]['target']) =>
      fileEntry(ROOT, { type: 'finding', target, from: 'owner', text: 'x' }, GRAPH);
    expect(refused({ topic: 'nope' })).toMatchObject({ ok: false, error: 'no topic "nope"' });
    expect(refused({ kind: 'roman' })).toMatchObject({ ok: false });
    expect(refused({ file: 'content/missing.yaml' })).toMatchObject({ ok: false });
    expect(refused({ file: SET, item: 'i9' })).toMatchObject({ ok: false });
    expect(refused({ topic: 't', kind: 'praxis' })).toMatchObject({ ok: false });
    expect(refused({ kind: 'praxis' })).toMatchObject({ ok: true });
  });

  test('the validator reports a target that has gone and a duplicated id', () => {
    reset();
    writeFileSync(
      join(ROOT, QUEUE_FILE),
      [
        'version: 1',
        'entries:',
        ...['q-0001', 'q-0001'].flatMap((id) => [
          `  - id: ${id}`,
          '    type: finding',
          '    target: { file: content/exercises/a1/gone.yaml }',
          '    waiting: claude',
          '    thread: [{ from: claude, at: 2026-11-01, text: x }]',
        ]),
      ].join('\n'),
    );
    const problems = queueProblems(ROOT, GRAPH);
    expect(problems.some((p) => p.includes('two entries with id q-0001'))).toBe(true);
    expect(problems.some((p) => p.includes('gone.yaml does not exist'))).toBe(true);
  });

  test('an empty text is refused', () => {
    reset();
    expect(
      ownerQueueAction(ROOT, GRAPH, {
        action: 'file',
        type: 'request',
        target: { topic: 't' },
        text: '  ',
      }),
    ).toMatchObject({ ok: false });
  });
});
