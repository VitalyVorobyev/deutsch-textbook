# ADR 0003: Opaque snapshot sync and approval accounts

Status: accepted · reframed 2026-08-04 from `docs/cloud-sync.md`

The operational counterpart — endpoints, data homes, setup, testing notes, walkthroughs and the
sign-in outage runbook — is [`../architecture/cloud-sync.md`](../architecture/cloud-sync.md).

## Context

Deutsch-Atlas is local-first and stays local-first. Progress lives in a per-profile IndexedDB
database (`src/lib/store.ts`); an account adds **a copy in the cloud so a second device can pick it
up**, and nothing else. With no account the app is byte-for-byte the app it was before accounts
existed — `scheduleAutoSync` gained a third backend beside the dev writer and the desktop sync
folder, it did not replace them.

Three consequences worth stating, because each one is a thing a "normal" backend would do and this
one must not:

- **Signing out costs the learner nothing.** Their attempts, cards and sessions are on the device.
- **A pending account is a fully working app.** It just has no cloud copy yet.
- **The server cannot show anyone their progress.** It has never parsed it.

Three problems shape the design. Divergence is the normal case, not the exception: two devices,
both offline, both with a day of work, must both keep everything. The sign-in button is public on
a site whose R2 bucket the owner pays for, so an account must cost nothing until the owner grants
it storage. And the personalization loop (`bun run progress:audit`) reads
`progress/<profile>/<date>.json` from disk, so once sync moves off this machine something has to
keep putting a file there — and it must not share the Worker's failure modes.

## Decision

### The server stores opaque bytes and never merges

`/api/sync/snapshot` accepts a gzip blob, stores it in R2, and hands it back. It does not parse,
validate, migrate or merge it. Merging is `mergeSnapshot` (`src/lib/store.ts:436`) over
`src/lib/snapshot-merge.ts` — the same non-destructive union that has always backed Import, which
already unions attempts and sessions, keeps the more-advanced FSRS card state, and is
last-write-wins for topic overrides.

This is the decision everything else follows from. A server that validated snapshots would have
to ship in lockstep with the client, and a learner on an old build would be told their own
progress was invalid.

### Concurrency by R2's conditional PUT — and no unconditional PUT

The write is `env.SNAPSHOTS.put(key, body, { onlyIf: { etagMatches } })` — an atomic
compare-and-set at the storage layer. The loser gets `null` back, the route answers **412 with the
current etag**, and the client pulls, merges locally, and writes again (`syncNow`, up to three
rounds).

A `version` column in D1 would have meant a second write on every sync and a window between the
two in which they disagree. The etag is already there and is already atomic.

Two details that are easy to get wrong:

- **An unconditional PUT is not reachable.** A write with neither `If-Match` nor `If-None-Match: *`
  is refused with **428**. An unconditional write is precisely the operation that loses another
  device's day, so it does not exist as an API.
- **GET answers 304 to a matching `If-None-Match`.** This is what makes "has the other device
  written?" nearly free, which in turn is what lets the client ask on *every* sync. Without it, a
  device that only ever reads would never pull, because nothing would trigger a conflict.

### Merging is a client-side, non-destructive union

Handled entirely on the client by `src/lib/snapshot-merge.ts` — the same code that has always
backed Import.

| Field | Rule | Why |
| --- | --- | --- |
| `attempts` | union, keyed `setId\|itemId\|ts`, sorted by `ts` | An attempt is an event that happened. Two devices produce disjoint events. |
| `sessions` | union, keyed `date\|ts` | Same. |
| `cards` | per card id, keep the **more advanced** FSRS record: later `last_review`, then higher `reps`, then higher `stability` | Losing a review means re-learning a word the learner knows. Keeping the advanced one at worst delays a review. |
| `topics[id].readAt` | max | "Opened at least once" is monotone. |
| `topics[id].manual` | newest `manualAt` wins | A self-rating is a statement about now. |
| `topics[id].placement` | higher `score` wins | Matches `setTopicPlacement`: a merge must never produce a state the writer itself would have refused. |
| `feedback[id]` | newest `ts` wins | Same reasoning. |
| `goal` | newest `setAt` wins | Same. |

### Signing in grants nothing: approval accounts

Anyone may sign in. A new account is created **`pending`**, and pending grants no storage at all —
`/api/sync/snapshot` answers 403 with `{"error":"pending"}`. The owner approves on `/konto`.

This is what makes a public sign-in button safe on a site with an owner-paid R2 bucket: **the
abuse surface of an unapproved account is one D1 row.** No object is ever written for it.

`OWNER_EMAILS` is a Worker secret, not a hand-written D1 row, and is re-applied on every sign-in.
A wiped, restored or freshly created database therefore cannot lock the owner out of the only
surface that could let them back in.

Cross-provider account linking rides on the **verified** email only — an unverified address is
refused outright, because the email is the linking key and an unverified one would let anyone who
can claim an address at a provider walk into someone else's account. (The full callback-landing
order is in the operational doc.)

### Device tokens are sync-only; pairing means typing a code

**A device token grants sync and nothing else.** `/api/admin/*`, `/api/tokens` and account
deletion all require the cookie — and a device token **cannot approve a device pairing**. One
leaked paste must not be an administrative takeover, and a token that could mint more tokens
would be a self-renewing foothold.

The first pairing design made the learner read a 43-character bearer credential off one screen and
type it into another. That is not a security control, it is a transcription task — and what is
being transcribed ends up in a clipboard, a note, or a screenshot. `worker/routes/pairing.ts`
replaces it with the shape of the **OAuth 2.0 Device Authorization Grant** (RFC 8628), minus the
OAuth: the desktop opens a pairing, shows an eight-symbol code, and polls; the learner types that
code on `/konto` in a browser where they are already signed in. The secret half (the device code)
never leaves the device that generated it, and the half that travels between screens (the user
code) redeems nothing on its own.

**The learner types the code; they do not follow a link that carries it.** That is the documented
mitigation for this grant's one real weakness — an attacker starts their own pairing, talks a
victim into approving it, and walks away with a token on the victim's account. A code that has to
be read off the device in front of you does not travel in a message, and the approval screen shows
the code and the device label so it can be compared before anything is granted.

### `bun run progress:pull` reads R2 over S3, not the API

It reads the R2 object **directly over the S3 API** with the credentials already in the gitignored
`setenv.sh`, rather than through `/api/sync/snapshot`. Two reasons: it adds no auth surface to the
Worker, and it keeps working when the Worker does not — a deploy that breaks sign-in must not also
break the evidence read.

## Consequences

- **A snapshot v8 needs no Worker deploy.** `src/lib/snapshot-schema.ts` stays the single import
  boundary and the single place versions are known.
- **The Worker cannot implement refuse-to-shrink.** The dev writer
  (`src/integrations/progress-writer.ts:89`) refuses a snapshot with *fewer* attempts than the file
  it would replace, because within a day the log only grows. Counting attempts means parsing. The
  protection here is instead the conditional PUT plus the client-side merge, with the per-day R2
  object as the net underneath. `scripts/progress-pull.ts` **does** implement refuse-to-shrink,
  because it writes into `progress/` where the audit reads.
- **Size is a byte cap, not a shape check.** 5 MiB of gzip. Measured headroom: the largest real
  snapshot is `wc -c progress/vitaly/2026-08-03.json` = **1,141,842** bytes, which `gzip -9` takes
  to **113,814** — so the cap is 44× the live corpus. `tests/worker-sync.test.ts` pins the figure
  separately from the test that exercises it, because a test that builds its body from
  `MAX_SNAPSHOT_BYTES + 1` moves with the constant and cannot fail when it is raised.
- **The client gzips rather than the server**, because the bytes that matter are the learner's
  mobile data, not ours. `CompressionStream` is present in every browser this PWA targets; where it
  is absent, remote sync self-disables and says so rather than uploading ten times the payload.
- **Two failure modes in the 412 retry loop are real**, were both live in the first implementation
  of this branch, and are now regression-tested in `tests/sync-remote.test.ts`:
  - **Adopting the etag a 412 hands back.** The retry's pull is then a 304 against that etag, so
    the merge never happens and the retry's PUT overwrites the other device. The fix is to
    *forget* the etag so the retry pulls unconditionally.
  - **Hashing the exported body to detect "nothing changed".** `exportSnapshot` stamps a fresh
    `exportedAt` on every call, so the hash never matched and every sync re-uploaded ~114 KB. The
    hash is taken over the content with `exportedAt`/`profile` removed.
- **What the merge does not do, stated plainly:**
  - **Deletions do not propagate.** The merge is a union. Nothing in the app deletes an attempt, a
    session or a card, so there is nothing to propagate today — but *Ersetzen* (destructive
    import) and *Profil löschen* are local operations, and the next sync will pull the account's
    copy back. Deleting for real means `Cloud-Kopie löschen` on `/konto`.
  - **There are no vector clocks and no CRDT.** The scalar fields above are last-write-wins on a
    timestamp the *client* wrote. Two devices with badly skewed clocks editing the same topic's
    self-rating in the same window can resolve to the earlier one. Everything that actually
    accumulates — attempts, sessions, cards — is order-independent, so this affects a handful of
    small fields and never the evidence.
  - **Merges are silent.** There is no conflict UI, because there is no question a learner could
    usefully answer: both devices' work is kept.
  - **A merge is not a rebase.** `mergeSnapshot` is additive, so a snapshot with an unknown field
    is dropped rather than carried — `mergeTopics` rebuilds its output from the fields it knows.
    Extending `TopicProgress` without extending that function loses data silently; the warning is
    on the function.
- **The server can show nobody their progress**, ever — there is no endpoint that reports how a
  learner is doing, because nothing server-side has ever parsed a snapshot. D1 holds an email, a
  display name, a status, a role and opaque token hashes; R2 holds gzip bytes it has never
  decompressed.
- The mechanics that implement all of this — data homes, sessions and CSRF, the pairing endpoint
  guarantees (each with a test that has been watched failing), cadence, offline behaviour, setup
  and the recovery runbook — live in
  [`../architecture/cloud-sync.md`](../architecture/cloud-sync.md).
