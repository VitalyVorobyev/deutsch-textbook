# Accounts and cloud sync — operations

The operational half: endpoints, data homes, cadence, testing, walkthroughs, setup and the
sign-in outage runbook. Read this before changing anything under `worker/`,
`src/lib/sync-remote.ts` or `scripts/progress-pull.ts`. The *decisions* — why the server stores
opaque bytes and never merges, why an unconditional PUT does not exist, why sign-in grants nothing
until owner approval, why pairing types a code, why `progress:pull` reads R2 over S3 — live in
[ADR 0003](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md).

## Where each piece of data lives

| Data | Home | Notes |
| --- | --- | --- |
| Attempts, cards, sessions, topics, feedback | **IndexedDB**, one database per local profile (`deutsch-atlas--<id>`) | The source of truth. Everything else is a copy. |
| Which profiles exist, which is active, explanation language, sync state | **localStorage** (`da:profiles`, `da:profile`, `da:lang:*`, `da:sync`) | Device-level, never uploaded. |
| Account, identities, sessions, device tokens | **D1** (`migrations/0001_init.sql`) | Four tables. No progress data of any kind. |
| The snapshot | **R2**, `snapshots/<accountId>/current.json.gz` | Plus `daily/<YYYY-MM-DD>.json.gz`, filed under the learner's local date. |
| The evidence read | `progress/<profile>/<date>.json` in the repo | Written by the dev middleware, the desktop folder sync, or `bun run progress:pull`. |

An account id is a UUID and is also the R2 prefix; it is shown on `/konto` because
`bun run progress:pull --account <id>` needs it when the bucket holds more than one learner.

**What the server can see.** D1 holds an email, a display name, a status, a role and opaque token
hashes. R2 holds gzip bytes it has never decompressed. There is no endpoint that reports how a
learner is doing, because nothing server-side has ever parsed a snapshot.

## The sync loop in operation

`/api/sync/snapshot` accepts a gzip blob (5 MiB byte cap), stores it in R2 under a conditional
PUT, and hands it back — it never parses, validates, migrates or merges. A write with neither
`If-Match` nor `If-None-Match: *` is refused with **428**; a lost race answers **412 with the
current etag**, and the client pulls, merges locally via `mergeSnapshot`
(`src/lib/store.ts:436` over `src/lib/snapshot-merge.ts`), and writes again (`syncNow`, up to
three rounds). GET answers 304 to a matching `If-None-Match`. The merge rules per field, and the
two regression-tested retry-loop failure modes, are in the
[ADR](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md).

## Offline

The desktop app and the installed PWA are unaffected by having no connection, because the cloud was
never in the write path: `logAttempt` writes IndexedDB and *then* schedules a sync.

- A failed sync is swallowed and retried on the next write (`runRemoteSync`). Nothing is queued and
  nothing needs to be — the snapshot is full state, so one successful sync catches up everything
  that happened while offline, however long that was.
- **A probe that failed on the network is not cached.** `getSession` memoizes per page load, and in
  the desktop shell a page load lasts as long as the app is open; caching "the request did not
  complete" would stop a laptop that started on a train from ever syncing again without a restart.
  Regression-tested.
- The desktop app additionally keeps its folder sync, which is unconditional and local. That is
  strictly better than the cloud for the agent loop, and it is why the folder backend was not
  replaced.

## Cadence: why remote is not 2.5 seconds

`DELAY_MS = 2500` is right for the local backends — they write a file on the same machine. Remote
uses **20 s of debounce and a 60 s floor**, plus the existing `pagehide` /
`visibilitychange:hidden` flush so nothing is lost to the floor.

The arithmetic, since it is the whole argument: at 113,814 gzipped bytes per push, a 30-minute
session on a 2.5 s debounce could fire ~100 times — roughly **11 MB of mobile upload for one day of
practice**. The floor also protects the pull: `ProfileSwitcher` triggers one sync per page load
(it is the one island mounted in the header of every page), and without a floor, browsing five
topics would be five full round trips.

A push whose body hashes the same as the last accepted one is skipped. That is not only an
optimisation: `mergeSnapshot` ends with `scheduleAutoSync()`, so pull → merge → push would
otherwise re-trigger itself.

## Accounts: self-serve sign-in, owner-granted storage

Anyone may sign in. A new account is created **`pending`**, and pending grants no storage at all —
`/api/sync/snapshot` answers 403 with `{"error":"pending"}` and the client renders it as a status
line, never as a broken app. The owner approves on `/konto`; the why is in the
[ADR](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md). `OWNER_EMAILS` is a Worker
secret, not a hand-written D1 row, and is re-applied on every sign-in.

### Which account a callback lands on

In order:

1. the existing `identities(provider, subject)` row — the ordinary returning learner;
2. a `users` row with the same **verified** email;
3. a new `pending` account.

Step 2 is why signing in with GitHub after Google finds the existing progress instead of minting a
second account the learner cannot tell apart. It is only sound **because the email is verified** —
Google's `email_verified`, GitHub's `/user/emails` `verified: true`. An unverified address is
refused outright (`?auth=email-unverified`), because the email is the linking key and an
unverified one would let anyone who can claim an address at a provider walk into someone else's
account.

### Sessions and CSRF

`__Host-da_session`, HttpOnly · Secure · SameSite=Lax · Path=/, rolling 90 days. Only
`sha256(token)` is stored, so a database read cannot be replayed as a session. The cookie **name**
varies with the scheme (`cookieName`) because `__Host-` requires `Secure` and a browser silently
drops a `__Host-` cookie without it — which would make `wrangler dev` on http://localhost unable to
hold a session at all.

The OAuth `state` is an HMAC-signed cookie rather than a D1 row: same guarantee, no write per
sign-in attempt and no sweeper for the attempts nobody completes. SameSite=Lax is correct even
though it must survive the redirect *from* the provider — that redirect is a top-level GET, which
Lax allows.

CSRF: SameSite=Lax already blocks cross-site writes carrying the cookie; state-changing routes also
check `Origin`. A request with **no** `Origin` is allowed, because non-browser clients do not send
one and they authenticate with a bearer token, which is not an ambient credential.

### Device tokens are sync-only

The Tauri webview is a different origin (`tauri://localhost`), so the session cookie cannot reach
it — no CORS configuration changes that for an HttpOnly same-site cookie. The desktop therefore
carries an explicit `Authorization: Bearer dat_…`, issued from a browser session on `/konto` and
shown exactly once (only its sha256 is stored). It goes through `@tauri-apps/plugin-http`, which is
Rust-side and exempt from CORS; the origin is allowlisted in `src-tauri/capabilities/default.json`.

**A device token grants sync and nothing else.** `/api/admin/*`, `/api/tokens` and account deletion
all require the cookie. One leaked paste must not be an administrative takeover, and a token that
could mint more tokens would be a self-renewing foothold.

The token sits in the desktop app's `localStorage`, which is a plain file on disk. That is a real
limitation and the reason revocation is one click on `/konto`.

### Pairing: how the token gets there

`worker/routes/pairing.ts` implements the shape of the **OAuth 2.0 Device Authorization Grant**
(RFC 8628), minus the OAuth — the why, including the typed-code anti-phishing argument, is in the
[ADR](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md). The desktop opens a pairing,
shows an eight-symbol code, and polls; the learner types that code on `/konto` in a browser where
they are already signed in. Two credentials doing two different jobs:

| | Who holds it | What it can do |
| --- | --- | --- |
| **device code** (`dpc_…`, 256 bits) | the desktop, never displayed | collect the token, once |
| **user code** (8 symbols, shown on both screens) | read by the learner | be approved, from a cookie session on an approved account |

The direction of travel is what makes this safe: the secret half never leaves the device that
generated it, and the half that travels between screens redeems nothing on its own.

`/api/pair/start` and `/api/pair/poll` are unauthenticated because they must be: the desktop has no
credential yet, which is the entire problem. Neither leaks anything — `start` returns codes it just
generated, and `poll` answers `pending` for every device code that is not both real and approved,
whether it was guessed or merely early.

What holds it together, each with a test that has been watched failing:

- **Approval is cookie-only.** A device token cannot approve a pairing, so one leaked token is not a
  self-renewing foothold — the same rule `/api/tokens` enforces.
- **Redeemed exactly once.** The token is minted at redemption and the row deleted in the same step,
  so no readable credential is ever at rest and a replayed device code gets nothing.
- **Status is re-read at redemption**, not trusted from the moment of approval — the two are
  separated by however long the desktop takes to poll.
- **First approver wins.** A second signed-in account cannot redirect a pairing that is already
  approved.
- **The per-account device cap applies**, so pairing is not a way around `/api/tokens`.
- **Polling faster than the interval is refused** with `slow-down` rather than served.
- Codes live **ten minutes**, and the alphabet omits every character pair a person confuses by eye
  (`0/O`, `1/I/L`, `5/S`, `8/B`, `Z`) — a mistyped symbol here is not a typo, it is a lookup against
  somebody else's pending request.

The old path is still there, behind a disclosure on both screens. It is the only one that works when
the two devices cannot both be looked at: a headless box, a VM, a machine reached over SSH.

## `bun run progress:pull`

The personalization loop is `bun run progress:audit`, which reads `progress/<profile>/<date>.json`
from disk. Once sync moves off this machine, something has to put a file there.

It reads the R2 object **directly over the S3 API** with the credentials already in the gitignored
`setenv.sh`, rather than through `/api/sync/snapshot` — the reasons are in the
[ADR](../adrs/0003-opaque-snapshot-sync-and-approval-accounts.md). The endpoint in `setenv.sh` is
**EU-jurisdiction** (`…eu.r2.cloudflarestorage.com`), so the bucket must be created with
`--jurisdiction eu` or those credentials cannot reach it.

It writes with the dev writer's refuse-to-shrink rule, parking a smaller snapshot in a sibling
`*.conflict-*.json` rather than overwriting or dropping it.

## Testing notes

`tests/worker-fakes.ts` backs D1 with **`bun:sqlite` loaded from the real
`migrations/0001_init.sql`**, not a hand-written fake. `ON CONFLICT DO UPDATE`, the `CHECK`
constraints and `ON DELETE CASCADE` are the parts of the schema most worth testing, and a fake
would have got them right by not having them.

Two things the happy-dom realm the suite runs in (`tests/setup-dom.ts`) does silently, both of
which produce tests that pass for the wrong reason:

- **`new Response(body, { headers })` drops `Set-Cookie`.** `worker/http.ts` therefore appends
  cookies after construction — portable in both realms, one behaviour to reason about.
- **`new Request(url, { headers: { cookie, origin } })` drops both.** `makeRequest` in the fakes
  sets them after construction. Without it every authenticated test would run anonymously.

Every mechanism in this document has been watched failing: deleting the approval gate, the 428, the
`If-None-Match` short-circuit, the HMAC comparison, the verified-email refusal, the byte cap, the
device-token boundary and refuse-to-shrink each turn a named test red.

One of those checks found a defect in the test rather than the code: the original "tampered state"
test passed with the HMAC comparison deleted, because a mangled base64 payload fails to parse
anyway. It now substitutes a payload that decodes to *valid* state under the original signature, so
only the HMAC can reject it.

## Walkthroughs

### Creating your own account and bringing your existing progress into it

The owner's account is not seeded by a migration; it is created by signing in, and `OWNER_EMAILS`
is what makes that first sign-in an approved owner rather than a pending learner.

1. Finish the setup below (D1, R2, both OAuth apps, six secrets, migrations). `OWNER_EMAILS` must
   contain the address you will sign in with.
2. On the device that already holds your progress, open **Fortschritt → Daten → Export** and keep
   the file. This is a safety net, not a required step — step 5 needs it only if you are moving to
   a different browser.
3. Open the profile menu in the header → **Anmelden**, and sign in. You should land on `/konto` as
   `Aktiv` with the **Eigentümer** marker. If it says *Wartet auf Freigabe*, `OWNER_EMAILS` did not
   match the verified email the provider returned — fix the secret and sign in again; it is
   re-applied on every sign-in.
4. Press **Verbinden · \<your profile\>**. This binds that local profile to the account. Because the
   profile already has attempts, it asks first: connecting merges the local history with whatever
   the account holds. On a fresh account it holds nothing, so this is a pure upload.
5. Only if you are on a *different* browser from the one with your history: **Fortschritt
   hochladen** and pick the exported file. It is merged into the local profile first and then
   pushed, so nothing is lost in either direction.
6. Confirm: `Zuletzt synchronisiert` gets a timestamp, and `bun run progress:pull --list` shows
   `snapshots/<your account id>/current.json.gz`.

A second device then needs only steps 3 and 4 — its first sync pulls the account state and merges
it into whatever that device had.

### Approving someone else

1. They open the site and sign in with Google or GitHub. An account is created for them
   **`pending`**, and nothing of theirs is stored server-side.
2. They see *Wartet auf Freigabe* on `/konto` and can keep learning; their progress stays on their
   device and uploads once you approve.
3. You open `/konto`. The **Nutzer** section lists every account, pending ones first.
4. **Freigeben** flips them to `approved` and their next sync uploads. **Sperren** stops an
   approved account syncing without touching what is already stored. **Entfernen** deletes the
   account, its sessions, its device tokens and its R2 objects.

You cannot suspend or delete your own account from that list — the API refuses it, because the only
surface that could undo it is the one you would be locking yourself out of. Use **Konto löschen**
on your own card if you really mean it.

### Connecting the desktop app

The desktop webview is a different origin, so it cannot receive the session cookie. Rather than
carrying a bearer token between machines, the app asks and you approve:

1. In the desktop app, open **Konto** → **Geräte** → **Verbinden**. It shows an eight-symbol code
   like `AC4K-MTQ9` and starts waiting.
2. On any device where you are signed in to the website, open `/konto` → **Geräte**, type that code
   and press **Weiter**.
3. Check that the code and device name on screen match what the app is showing, then **Freigeben**.
4. The desktop picks up its token within a few seconds and starts syncing.

Codes expire after ten minutes; if one does, start again in step 1. Revoke a connected device from
the website at any time. For a machine you cannot look at while you use the browser — a headless
box, a VM, an SSH session — **Gerätecode von Hand ausstellen** on the website still issues a `dat_…`
token to paste in directly.

## Setup

Bindings and secrets are listed in the header comment of `wrangler.toml`. Migrations are not
applied by the deploy:

```
bunx wrangler d1 migrations apply deutsch-atlas --remote
```

To exercise auth locally, register `http://localhost:8787/api/auth/{google,github}/callback` as a
second redirect URI with both providers, then `bun run build && bunx wrangler dev`. Under
`bun run dev` (Astro alone) there is no Worker, `/api/auth/session` 404s, and the client correctly
reports signed-out — which is why remote sync needs no environment flag.

## When sign-in stops working

Run the check before reasoning about it:

```
bun run deploy:smoke          # add --deep to also prove D1 and the migrations
```

Seven checks against the live origin, three of which fail together when the Worker has lost its
secrets. That is the failure this section exists for, and it has happened once.

**Symptom.** `/konto` shows its local-first paragraph and nothing else — no buttons, no error. Both
providers redirect to `?auth=provider-unavailable`, and `/api/auth/session` answers
`{"signedIn":false,"providers":[]}`. An empty `providers` array means the Worker could not configure
*any* provider; both failing at once points at the shared `SESSION_SECRET` rather than one client id.

**Diagnosis.** Two read-only commands settle it:

```
bunx wrangler secret list --name deutsch-textbook      # [] is the answer you are looking for
bunx wrangler versions list --name deutsch-textbook    # which version stopped carrying them
bunx wrangler versions view <id> --name deutsch-textbook
```

On 2026-08-03 that history read: version `02e21b05` (`Secret Change`) carried all six secrets plus
`DB`, `SNAPSHOTS` and `ASSETS`; version `c2f78b7e`, a build seven minutes later, carried **no
bindings at all**. A version with no `ASSETS` binding is a build of the pre-Worker, assets-only
`wrangler.toml`, which reached production while Workers Builds was still building every branch. It
replaced the whole binding set. Every build after it restored the three bindings from the current
file and had nothing to inherit for the secrets.

**Recovery needs no rebuild.** `bunx wrangler secret put <NAME> --name deutsch-textbook` creates a
version that inherits the deployed code and bindings, so sign-in returns as soon as the last of the
six lands. `SESSION_SECRET` may be re-minted freely — it signs only the short-lived OAuth state
cookie, so rotating it invalidates in-flight sign-ins and nothing else.

**Why the app no longer looks broken meanwhile.** `AccountPanel` renders an explicit "sign-in is not
available right now" line when `providers` is empty, instead of mapping over an empty list and
producing a page that ends mid-thought.
