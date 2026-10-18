# worker/ — accounts and snapshot sync

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../CLAUDE.md) applies too.

## Invariant

- **The sync server stores opaque bytes and never merges.** `/api/sync/snapshot` (`worker/`) does not parse, validate or migrate a snapshot; merging is `mergeSnapshot` on the client. **An unconditional PUT does not exist** (no `If-Match`/`If-None-Match` → 428; a lost race → 412 → pull, merge, retry), and **signing in grants nothing** — a new account is `pending` until the owner approves it on `/konto`. A **device token grants sync only**, never admin, and **cannot approve a device pairing**. Pairing (`/api/pair/*`, RFC 8628's shape) is granted by a cookie session on an approved account, and the learner **types** the code rather than following a link. → [ADR 0007](../docs/adrs/0007-opaque-snapshot-sync-and-approval-accounts.md) · [`docs/architecture/cloud-sync.md`](../docs/architecture/cloud-sync.md)

## Commands

- `bun run progress:pull --profile <slug>` — fetch the cloud snapshot into `progress/<profile>/<date>.json`; needs `source setenv.sh` (R2 over S3). `--list`, `--account <id>`, `--date`. **It refuses to shrink an existing file** and parks the smaller state in `*.conflict-*.json` — investigate, never delete. → [`docs/architecture/cloud-sync.md`](../docs/architecture/cloud-sync.md)
- `bun run deploy:smoke` — seven checks against the live origin. **Run it after every deploy that touches `worker/` or `wrangler.toml`**: a config without `main` strips the Worker's secrets and every gate here stays green. `--deep` also proves D1 and is the only check that writes. → [`docs/architecture/cloud-sync.md`](../docs/architecture/cloud-sync.md#when-sign-in-stops-working)
