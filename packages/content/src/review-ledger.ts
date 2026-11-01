/**
 * The review ledger (ADR 0014): who has read a material file, at which bytes.
 *
 * The ledger is `data/review-ledger.yaml`, one row per file. A row's `revision` is the git blob hash
 * of the bytes that were reviewed, computed here exactly as `git hash-object` does, so:
 *
 * - a review expires the moment its file changes: the current hash no longer matches, and the file
 *   reads as *changed since review* without anyone having to remember to reset anything;
 * - the reviewed text can be read back with `git cat-file` for a diff, whenever those bytes were
 *   ever committed. Reading an object is the only thing this module asks of git; it never stages,
 *   commits or checks anything out (ADR 0012).
 *
 * A file with no row is a draft. A row records a review someone performed; none is inferred.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { reviewLedgerSchema, type ReviewLedger, type ReviewLedgerEntry } from '@da/schema';
import type { ContentGraph } from './graph';
import { topicReviews, type TopicReview } from './topic-review';

export const REVIEW_LEDGER_FILE = join('data', 'review-ledger.yaml');

/** The name an `owner-reviewed` row carries: the course's human editor, as in the provenance. */
export const OWNER = 'Vitaly Vorobyev';

/**
 * Every file the review lifecycle covers: each element's file (a planned element is an absence
 * and has none of its own) and each topic manifest. Sorted, each once.
 */
export function reviewableFiles(graph: ContentGraph): string[] {
  const files = new Set<string>();
  for (const element of graph.elements) if (!element.planned) files.add(element.file);
  for (const topic of graph.topics.values()) files.add(topic.file);
  return [...files].sort();
}

/** What a file's review says right now. `geaendert`: reviewed once, changed since. */
export type ReviewStatus = 'entwurf' | 'claude-reviewed' | 'owner-reviewed' | 'geaendert';

export interface FileReview {
  file: string;
  status: ReviewStatus;
  /** The current bytes' blob hash; `undefined` when the file does not exist. */
  current?: string;
  /** The ledger row, when there is one. */
  entry?: ReviewLedgerEntry;
}

/** The git blob hash of some bytes: SHA-1 over `blob <length>\0` and the bytes, as git computes it. */
export function blobRevision(bytes: Buffer | string): string {
  const body = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
  return createHash('sha1').update(`blob ${body.length}\u0000`).update(body).digest('hex');
}

/** The current blob hash of a repo file, or `undefined` if it does not exist. */
export function fileRevision(root: string, file: string): string | undefined {
  const path = join(root, file);
  return existsSync(path) ? blobRevision(readFileSync(path)) : undefined;
}

export function loadReviewLedger(root: string): ReviewLedger {
  const path = join(root, REVIEW_LEDGER_FILE);
  if (!existsSync(path)) return { version: 1, entries: [] };
  return reviewLedgerSchema.parse(YAML.parse(readFileSync(path, 'utf8')));
}

/** The review status of each file, in the order given. */
export function reviewStatuses(root: string, files: readonly string[]): FileReview[] {
  const byFile = new Map(loadReviewLedger(root).entries.map((entry) => [entry.file, entry]));
  return files.map((file) => {
    const current = fileRevision(root, file);
    const entry = byFile.get(file);
    const status: ReviewStatus = !entry
      ? 'entwurf'
      : entry.revision === current
        ? entry.state
        : 'geaendert';
    return { file, status, ...(current ? { current } : {}), ...(entry ? { entry } : {}) };
  });
}

/** Each topic's review, derived from the ledger as it stands (see `./topic-review`). */
export function topicReviewStates(root: string, graph: ContentGraph): Map<string, TopicReview> {
  const topics = [...graph.topics.values()].map((topic) => ({ id: topic.id, file: topic.file }));
  return topicReviews(topics, graph.elements, reviewStatuses(root, reviewableFiles(graph)));
}

/** Ledger defects the validator reports: a row for a missing file, or two rows for one file. */
export function reviewLedgerProblems(root: string): string[] {
  let ledger: ReviewLedger;
  try {
    ledger = loadReviewLedger(root);
  } catch (error) {
    return [`${REVIEW_LEDGER_FILE}: ${error instanceof Error ? error.message : String(error)}`];
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of ledger.entries) {
    if (seen.has(entry.file))
      problems.push(`${REVIEW_LEDGER_FILE}: two rows for ${entry.file} — keep the latest only`);
    seen.add(entry.file);
    if (!existsSync(join(root, entry.file)))
      problems.push(`${REVIEW_LEDGER_FILE}: ${entry.file} does not exist — delete its row`);
  }
  return problems;
}

/**
 * The ledger as text: rows sorted by file, so two writers produce the same bytes for the same
 * content and a diff of the file shows only the rows that changed.
 */
export function serializeReviewLedger(ledger: ReviewLedger): string {
  const entries = [...ledger.entries].sort((a, b) => a.file.localeCompare(b.file));
  return (
    '# Who has read each material file, at which bytes (ADR 0014). Written by Redaktion and by\n' +
    '# `bun run review:claude`; a file with no row is a draft.\n' +
    YAML.stringify({ version: 1, entries }, { lineWidth: 0 })
  );
}

/**
 * Record a review of `file` at its current bytes, replacing any earlier row.
 *
 * `expectedRevision` is the revision the reviewer saw. When the file has changed since, the write
 * is refused: a mark must never cover bytes nobody read.
 */
export function recordReview(
  root: string,
  input: {
    file: string;
    state: ReviewLedgerEntry['state'];
    by: string;
    note?: string;
    expectedRevision?: string;
    at?: string;
  },
): { ok: true; entry: ReviewLedgerEntry } | { ok: false; error: string } {
  const current = fileRevision(root, input.file);
  if (!current) return { ok: false, error: `${input.file} does not exist` };
  if (input.expectedRevision && input.expectedRevision !== current)
    return {
      ok: false,
      error: `${input.file} changed since it was opened — reload and read again`,
    };
  const ledger = loadReviewLedger(root);
  const previous = ledger.entries.find((row) => row.file === input.file);
  // A hand-over keeps the owner's baseline: the revision the owner last accepted.
  const since =
    input.state === 'claude-reviewed' && previous
      ? previous.state === 'owner-reviewed'
        ? previous.revision
        : previous.since
      : undefined;
  const entry: ReviewLedgerEntry = {
    file: input.file,
    state: input.state,
    revision: current,
    by: input.by,
    at: input.at ?? new Date().toISOString().slice(0, 10),
    ...(input.note ? { note: input.note } : {}),
    ...(since && since !== current ? { since } : {}),
  };
  const entries = [...ledger.entries.filter((row) => row.file !== input.file), entry];
  const path = join(root, REVIEW_LEDGER_FILE);
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, serializeReviewLedger({ version: 1, entries }));
  renameSync(tmp, path);
  return { ok: true, entry };
}

/**
 * The text of a reviewed revision, read from git's object store — `undefined` when those bytes were
 * never committed (a review recorded on an uncommitted edit has nothing to diff against).
 */
export function reviewedText(root: string, revision: string): string | undefined {
  if (!/^[0-9a-f]{40}$/.test(revision)) return undefined;
  const run = spawnSync('git', ['cat-file', 'blob', revision], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return run.status === 0 ? run.stdout : undefined;
}
