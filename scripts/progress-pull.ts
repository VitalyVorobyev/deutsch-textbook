/**
 * Pull a cloud snapshot into `progress/<profile>/<date>.json`.
 *
 * This is what keeps the personalization loop working once sync moves off this
 * machine: `bun run progress:audit` reads snapshots from disk, and this is how
 * they get there. Nothing else about the audit changes.
 *
 * **It reads R2 directly over the S3 API**, with the credentials already in the
 * gitignored `setenv.sh`, rather than through `/api/sync/snapshot`. That is one
 * fewer auth surface on the Worker, and it keeps working when the Worker does
 * not — a deploy that breaks sign-in must not also break the evidence read.
 *
 * Usage:
 *   source setenv.sh
 *   bun run progress:pull --profile vitaly
 *   bun run progress:pull --profile vitaly --account <id>       # several accounts in the bucket
 *   bun run progress:pull --profile vitaly --date 2026-08-01    # a specific day's copy
 *   bun run progress:pull --profile vitaly --list               # what is stored, write nothing
 *
 * Environment (all from setenv.sh except the last two, which have defaults):
 *   S3_KEY_ID, S3_KEY_SECRET, S3_ENDPOINT
 *   R2_BUCKET       default deutsch-atlas-progress
 *   DA_ACCOUNT_ID   default: the only account prefix in the bucket
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { SUPPORTED_SNAPSHOT_VERSIONS } from '../src/lib/snapshot-schema';

const DEFAULT_BUCKET = 'deutsch-atlas-progress';
const PREFIX = 'snapshots/';

interface Options {
  profile: string;
  account?: string;
  date?: string;
  list: boolean;
  out?: string;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { profile: '', list: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} needs a value.`);
      return value;
    };
    if (arg === '--profile') options.profile = next();
    else if (arg === '--account') options.account = next();
    else if (arg === '--date') options.date = next();
    else if (arg === '--out') options.out = next();
    else if (arg === '--list') options.list = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.list && !options.profile) throw new Error('Pass --profile <slug>.');
  if (options.profile && !/^[a-z0-9-]+$/.test(options.profile)) {
    throw new Error(`--profile must be a slug matching ^[a-z0-9-]+$, got "${options.profile}"`);
  }
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error(`--date must be YYYY-MM-DD, got "${options.date}"`);
  }
  return options;
}

function client(): Bun.S3Client {
  const accessKeyId = process.env.S3_KEY_ID;
  const secretAccessKey = process.env.S3_KEY_SECRET;
  const endpoint = process.env.S3_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      'Missing S3 credentials. Run `source setenv.sh` first (S3_KEY_ID, S3_KEY_SECRET, S3_ENDPOINT).',
    );
  }
  return new Bun.S3Client({
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket: process.env.R2_BUCKET ?? DEFAULT_BUCKET,
    // R2 ignores the region but the signature needs one.
    region: 'auto',
  });
}

/** Account ids present in the bucket, from the `snapshots/<id>/` prefixes. */
async function listAccounts(s3: Bun.S3Client): Promise<string[]> {
  const listed = await s3.list({ prefix: PREFIX, delimiter: '/' });
  const fromPrefixes = (listed.commonPrefixes ?? [])
    .map((entry) => entry.prefix.slice(PREFIX.length).replace(/\/$/, ''))
    .filter(Boolean);
  if (fromPrefixes.length > 0) return fromPrefixes;
  // Some S3 implementations omit commonPrefixes; derive them from the keys.
  const keys = (listed.contents ?? []).map((entry) => entry.key);
  return [...new Set(keys.map((key) => key.slice(PREFIX.length).split('/')[0]).filter(Boolean))] as string[];
}

async function resolveAccount(s3: Bun.S3Client, explicit?: string): Promise<string> {
  const chosen = explicit ?? process.env.DA_ACCOUNT_ID;
  if (chosen) return chosen;
  const accounts = await listAccounts(s3);
  if (accounts.length === 1) return accounts[0]!;
  if (accounts.length === 0) throw new Error('No snapshots in the bucket yet.');
  throw new Error(
    `The bucket holds ${accounts.length} accounts. Pass --account <id> (see /konto) or set DA_ACCOUNT_ID:\n  ` +
      accounts.join('\n  '),
  );
}

function snapshotKey(account: string, date?: string): string {
  return date
    ? `${PREFIX}${account}/daily/${date}.json.gz`
    : `${PREFIX}${account}/current.json.gz`;
}

interface MinimalSnapshot {
  version?: number;
  exportedAt?: string;
  attempts?: unknown[];
  cards?: Record<string, unknown>;
}

/**
 * Validate exactly as far as the audit does and no further.
 *
 * The point is to fail on "this is not a Deutsch-Atlas snapshot" before writing
 * a file the audit will choke on — not to re-implement `parseProgressSnapshot`,
 * which stays the single import boundary in the app.
 */
function assertSnapshot(parsed: MinimalSnapshot, source: string): asserts parsed is MinimalSnapshot & {
  version: number;
  attempts: unknown[];
} {
  if (
    !SUPPORTED_SNAPSHOT_VERSIONS.includes(parsed.version ?? 0) ||
    !Array.isArray(parsed.attempts) ||
    !parsed.cards ||
    typeof parsed.cards !== 'object'
  ) {
    const min = SUPPORTED_SNAPSHOT_VERSIONS[0];
    const max = SUPPORTED_SNAPSHOT_VERSIONS.at(-1);
    throw new Error(`Not a valid Deutsch-Atlas v${min}-v${max} progress snapshot: ${source}`);
  }
}

function localDate(d = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Write, refusing to shrink — the same rule the dev writer applies
 * (src/integrations/progress-writer.ts), for the same reason: a profile's
 * attempt log only grows within a day, so a smaller snapshot arriving under the
 * same name is a *different* learner state, not a save. It is parked beside the
 * file rather than dropped, so nothing is ever lost silently.
 */
export function writeSnapshot(target: string, body: string, attempts: number): 'written' | string {
  if (existsSync(target)) {
    const prior = JSON.parse(readFileSync(target, 'utf8')) as { attempts?: unknown[] };
    const had = Array.isArray(prior.attempts) ? prior.attempts.length : 0;
    if (attempts < had) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const parked = target.replace(/\.json$/, `.conflict-${stamp}.json`);
      writeFileSync(parked, body, 'utf8');
      return parked;
    }
  }
  writeFileSync(target, body, 'utf8');
  return 'written';
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const s3 = client();

  if (options.list) {
    const accounts = await listAccounts(s3);
    if (accounts.length === 0) {
      console.log('No snapshots stored yet.');
      return;
    }
    for (const account of accounts) {
      const listed = await s3.list({ prefix: `${PREFIX}${account}/` });
      const keys = (listed.contents ?? []).map((entry) => entry.key);
      console.log(`${account}  (${keys.length} object${keys.length === 1 ? '' : 's'})`);
      for (const key of keys.sort()) console.log(`  ${key.slice(PREFIX.length + account.length + 1)}`);
    }
    return;
  }

  const account = await resolveAccount(s3, options.account);
  const key = snapshotKey(account, options.date);

  const file = s3.file(key);
  if (!(await file.exists())) {
    throw new Error(`No object at ${key}. Run \`bun run progress:pull --list\` to see what is stored.`);
  }

  const compressed = Buffer.from(await file.arrayBuffer());
  const raw = gunzipSync(compressed).toString('utf8');
  const parsed = JSON.parse(raw) as MinimalSnapshot;
  assertSnapshot(parsed, key);

  const root = resolve(import.meta.dir, '..');
  const dir = join(root, 'progress', options.profile);
  mkdirSync(dir, { recursive: true });
  // The date the file is filed under is the snapshot's own export date, so a
  // pull done on Tuesday for Monday's state does not claim to be Tuesday's.
  const date = options.date ?? localDate(parsed.exportedAt ? new Date(parsed.exportedAt) : new Date());
  const target = options.out ? resolve(root, options.out) : join(dir, `${date}.json`);

  const attempts = parsed.attempts.length;
  const result = writeSnapshot(target, raw, attempts);

  const relative = target.startsWith(root) ? target.slice(root.length + 1) : target;
  if (result === 'written') {
    console.log(
      `${key}\n  → ${relative}  (${attempts} attempts, ${compressed.byteLength} B gzipped, ${raw.length} B raw)`,
    );
  } else {
    const parked = result.startsWith(root) ? result.slice(root.length + 1) : result;
    console.error(
      `Refused to shrink ${relative}: the pulled snapshot holds ${attempts} attempts, fewer than the file already there.\n` +
        `  Parked at ${parked} — compare them before replacing.`,
    );
    process.exitCode = 1;
  }
}

// Guarded so `tests/progress-pull.test.ts` can import the pure helpers without
// the script trying to reach R2 on import.
if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
