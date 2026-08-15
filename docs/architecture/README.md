# Architecture

- [`runtime-contracts.md`](runtime-contracts.md) — the compact engineering invariants behind
  `CLAUDE.md`'s runtime rules, with the source/test map. Read before changing anything in `src/lib/`.
- [`cloud-sync.md`](cloud-sync.md) — accounts and snapshot sync in operation: data homes, endpoints,
  cadence, setup, walkthroughs and the "when sign-in stops working" runbook. The decisions behind it
  are [ADR 0003](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md); read both before
  touching `worker/`, `src/lib/sync-remote.ts` or `scripts/progress-pull.ts`.
