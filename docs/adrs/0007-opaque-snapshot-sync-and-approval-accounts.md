# ADR 0007: Sync stores opaque snapshots, and an account grants nothing until approved

Status: accepted · 2026-10-18

## Context

A learner uses two devices: the desktop app and a browser. Both are offline at times, and both
accumulate a day of work, so divergence is the normal case. The sign-in button is public on a site
whose storage the owner pays for. And the personalization loop needs a snapshot file on the
owner's machine that keeps arriving even when the Worker is broken.

## Decision

**The server stores opaque bytes and never merges.** `/api/sync/snapshot` stores and returns a
gzip blob in R2 and never parses, validates or migrates it. Merging is `mergeSnapshot` on the
client — the same non-destructive union as Import: attempts and sessions are unioned, the more
advanced FSRS card wins, and scalar fields are newest-wins.

**There is no unconditional write.** A PUT needs `If-Match` or `If-None-Match: *` (otherwise 428).
A lost race answers 412, and the client pulls, merges and retries. GET answers 304 to a matching
etag, so asking "has the other device written?" is nearly free.

**Signing in grants nothing.** A new account is `pending` and has no storage until the owner
approves it. Owners come from a Worker secret, re-applied on every sign-in. Account linking rides on
a verified email only.

**A device token grants sync and nothing else.** It cannot administer, mint tokens or approve a
pairing. Pairing follows RFC 8628's shape: the learner *types* the code shown on the device into a
signed-in browser; no link carries it.

**The learner sees it, and is never blocked by it.** Sign-in is offered at first run and is
optional; an OAuth display name may only prefill the profile name. A pending account changes
nothing about the app. Sync status is visible in the profile menu. Account and sync live on
Fortschritt → Daten, and `/konto` stays a working redirect for callbacks and pairing.

**The evidence read bypasses the Worker.** `bun run progress:pull` reads R2 over S3 and refuses to
shrink an existing file.

## Consequences

- A snapshot version bump needs no Worker deploy; `src/lib/snapshot-schema.ts` is the one
  boundary.
- Deletions do not propagate: the merge is a union, and deleting for real is *Cloud-Kopie löschen*.
- There are no vector clocks. Two skewed clocks can resolve a self-rating to the older value; the
  accumulating evidence is order-independent and unaffected.
- The server can show nobody their progress, because it has never parsed any.
- Operations, endpoints and the sign-in runbook: [`../architecture/cloud-sync.md`](../architecture/cloud-sync.md).
