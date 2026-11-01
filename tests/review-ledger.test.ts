/**
 * The review ledger (ADR 0014): a review is pinned to the bytes it read, expires when they change,
 * refuses to cover bytes nobody saw, and keeps the owner's baseline across a hand-over.
 */
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  blobRevision,
  loadReviewLedger,
  recordReview,
  reviewedText,
  reviewLedgerProblems,
  reviewStatuses,
  REVIEW_LEDGER_FILE,
} from '@da/content/review-ledger';
import { repoRoot } from '@da/content/repo-root';

function checkout(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'review-ledger-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

describe('revisions', () => {
  test('a revision is the git blob hash, the one `git hash-object` prints', () => {
    const root = repoRoot();
    const git = spawnSync('git', ['hash-object', 'CLAUDE.md'], { cwd: root, encoding: 'utf8' });
    expect(blobRevision(readFileSync(join(root, 'CLAUDE.md')))).toBe(git.stdout.trim());
  });

  test('a committed revision reads back from git; an unknown one does not', () => {
    const root = repoRoot();
    const head = spawnSync('git', ['rev-parse', 'HEAD:CLAUDE.md'], { cwd: root, encoding: 'utf8' });
    expect(reviewedText(root, head.stdout.trim())).toContain('# Deutsch-Atlas');
    expect(reviewedText(root, '0'.repeat(40))).toBeUndefined();
    expect(reviewedText(root, 'HEAD')).toBeUndefined();
  });
});

describe('statuses', () => {
  test('no row is a draft; a row at the current bytes is its state; changed bytes expire it', () => {
    const root = checkout({ 'content/a.yaml': 'a: 1\n', 'content/b.yaml': 'b: 1\n' });
    expect(reviewStatuses(root, ['content/a.yaml'])[0]!.status).toBe('entwurf');

    expect(
      recordReview(root, { file: 'content/a.yaml', state: 'owner-reviewed', by: 'X' }).ok,
    ).toBe(true);
    recordReview(root, {
      file: 'content/b.yaml',
      state: 'claude-reviewed',
      by: 'Claude Code',
      note: 'n',
    });
    expect(reviewStatuses(root, ['content/a.yaml', 'content/b.yaml']).map((r) => r.status)).toEqual(
      ['owner-reviewed', 'claude-reviewed'],
    );

    writeFileSync(join(root, 'content/a.yaml'), 'a: 2\n');
    expect(reviewStatuses(root, ['content/a.yaml'])[0]!.status).toBe('geaendert');
  });

  test('a mark is refused when the file changed after it was opened', () => {
    const root = checkout({ 'content/a.yaml': 'a: 1\n' });
    const opened = blobRevision('a: 1\n');
    writeFileSync(join(root, 'content/a.yaml'), 'a: 2\n');
    const result = recordReview(root, {
      file: 'content/a.yaml',
      state: 'owner-reviewed',
      by: 'X',
      expectedRevision: opened,
    });
    expect(result.ok).toBe(false);
    expect(loadReviewLedger(root).entries).toEqual([]);
  });

  test("a hand-over keeps the owner's baseline, and the owner's next mark clears it", () => {
    const root = checkout({ 'content/a.yaml': 'a: 1\n' });
    recordReview(root, { file: 'content/a.yaml', state: 'owner-reviewed', by: 'X' });
    writeFileSync(join(root, 'content/a.yaml'), 'a: 2\n');
    recordReview(root, {
      file: 'content/a.yaml',
      state: 'claude-reviewed',
      by: 'Claude Code',
      note: 'n',
    });
    writeFileSync(join(root, 'content/a.yaml'), 'a: 3\n');
    recordReview(root, {
      file: 'content/a.yaml',
      state: 'claude-reviewed',
      by: 'Claude Code',
      note: 'm',
    });
    const [row] = loadReviewLedger(root).entries;
    expect(row!.since).toBe(blobRevision('a: 1\n'));
    expect(row!.revision).toBe(blobRevision('a: 3\n'));

    recordReview(root, { file: 'content/a.yaml', state: 'owner-reviewed', by: 'X' });
    expect(loadReviewLedger(root).entries[0]!.since).toBeUndefined();
  });
});

describe('ledger problems', () => {
  test('a row for a missing file, and two rows for one file', () => {
    const rev = blobRevision('a: 1\n');
    const row = (file: string) =>
      `  - file: ${file}\n    state: owner-reviewed\n    revision: ${rev}\n    by: X\n    at: 2026-11-01\n`;
    const root = checkout({
      'content/a.yaml': 'a: 1\n',
      [REVIEW_LEDGER_FILE]: `version: 1\nentries:\n${row('content/a.yaml')}${row('content/a.yaml')}${row('content/gone.yaml')}`,
    });
    const problems = reviewLedgerProblems(root);
    expect(problems.some((p) => p.includes('two rows for content/a.yaml'))).toBe(true);
    expect(problems.some((p) => p.includes('content/gone.yaml does not exist'))).toBe(true);
  });
});
