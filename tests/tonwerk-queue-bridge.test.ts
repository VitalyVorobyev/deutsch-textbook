/**
 * The Tonwerk engine reaches the shared queue (ADR 0014) by running `queue-bridge.ts` with one JSON
 * request on stdin. On a temporary tree, never the live queue: a filed verdict must come back out
 * of the queue's own reader as the owner's finding on the recording's record.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQueue } from '@da/content/queue';

const BRIDGE = join(import.meta.dir, '..', 'apps', 'tonwerk', 'scripts', 'queue-bridge.ts');
const RECORD = 'content/listening/b1/ls-hoerprobe-01.yaml';
let ROOT: string;

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'da-queue-bridge-'));
  mkdirSync(join(ROOT, 'content/listening/b1'), { recursive: true });
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, RECORD), 'id: ls-hoerprobe-01\n');
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function ask(request: unknown): { ok: boolean; [key: string]: unknown } {
  const run = Bun.spawnSync(['bun', BRIDGE, ROOT], { stdin: Buffer.from(JSON.stringify(request)) });
  expect(run.exitCode).toBe(0);
  return JSON.parse(run.stdout.toString()) as { ok: boolean };
}

test("a verdict lands as the owner's finding, in the format the queue reader parses", () => {
  const filed = ask({
    action: 'file',
    type: 'finding',
    target: { file: RECORD },
    text: 'Hörprobe: Pausen, Stimme. Lena und Frau Kern klingen gleich',
  });
  expect(filed).toMatchObject({ ok: true, entry: { id: 'q-0001' } });

  expect(loadQueue(ROOT).entries).toEqual([
    {
      id: 'q-0001',
      type: 'finding',
      target: { file: RECORD },
      waiting: 'claude',
      thread: [
        {
          from: 'owner',
          at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          text: 'Hörprobe: Pausen, Stimme. Lena und Frau Kern klingen gleich',
        },
      ],
    },
  ]);
  expect(ask({ action: 'list' })).toMatchObject({ ok: true, entries: [{ id: 'q-0001' }] });
});

test('a record that does not exist is refused, and Tonwerk cannot close or answer', () => {
  expect(
    ask({
      action: 'file',
      type: 'finding',
      target: { file: 'content/listening/b1/fehlt.yaml' },
      text: 'x',
    }),
  ).toMatchObject({ ok: false });
  expect(ask({ action: 'close', id: 'q-0001' })).toEqual({
    ok: false,
    error: 'action is list or file',
  });
  expect(loadQueue(ROOT).entries.map((entry) => entry.id)).toEqual(['q-0001']);
});
