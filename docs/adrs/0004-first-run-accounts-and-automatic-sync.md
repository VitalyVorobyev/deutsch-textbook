# ADR 0004: Accounts at first run, sync already automatic, cloud recommended

Status: accepted · 2026-08-04

Builds on [`0003-opaque-snapshot-sync-and-approval-accounts.md`](0003-opaque-snapshot-sync-and-approval-accounts.md),
which stays in force unchanged: this ADR decides what the *learner* is offered and shown, not what
the server does. The operational half is
[`../architecture/cloud-sync.md`](../architecture/cloud-sync.md).

## Context

**Sync is already automatic, and the repo's own prose has been describing it as if it were not.**
Measured 2026-08-04 by reading the sources:

- `scheduleAutoSync()` (`src/lib/autosync.ts:42`) is called at the end of **ten** write paths in
  `src/lib/store.ts` (`:144`, `:182`, `:201`, `:227`, `:291`, `:317`, `:343`, `:373`, `:463`,
  `:480`) — every attempt, session, card grade, topic override and goal write schedules a sync.
- The remote leg runs on a **20-second debounce** (`REMOTE_DELAY_MS = 20_000`,
  `src/lib/autosync.ts:32`) with a **60-second floor** between uploads (`:34`), so a run of answers
  becomes one upload rather than a hundred.
- Leaving the page **flushes** rather than losing the pending write: `pagehide` is wired at
  `src/lib/autosync.ts:61`, with `keepalive` letting the request outlive the document.
- The other direction is covered too: **one cloud pull per page load** — `pullOncePerLoad`
  (`src/components/ProfileSwitcher.tsx:47`, called at `:74`).
- **"Jetzt synchronisieren"** (`src/lib/strings.ts:264`, wired at
  `src/components/account/AccountPanel.tsx:371`) calls `forceSync()`
  (`src/lib/sync-remote.ts:464`), which drops the stored last-upload hash and runs `syncNow()`
  immediately — so the learner sees a push happen even when the merge is a no-op. It is a *force*
  button; the debounced automatic path does not need it.

So the decision in front of us was never "build automatic sync". It is that a learner has no way
to find out any of the above. Three gaps, all measured the same day:

1. **The first-run gate never mentions accounts.** `src/components/FirstRunGate.tsx` is 189 lines
   and contains no occurrence of *Konto*, *account*, *Anmelden*, *sign*, *OAuth* or *cloud*
   (`grep -n "Konto\|account\|Anmeld\|sign\|OAuth\|Cloud\|cloud" src/components/FirstRunGate.tsx`
   returns nothing). A learner who sets up on a phone and later opens the desktop app has no
   reason to expect their progress to travel, and no offer to make it travel.
2. **Both OAuth providers are already implemented** — `PROVIDER_IDS = ['google', 'github']`
   (`worker/auth/providers.ts:17`), with implementations at `:89` and `:136` and the registry at
   `:199`. The only surface offering them is `/konto`, which is deliberately out of the navigation
   (`src/pages/konto.astro:6`).
3. **Sync is invisible when it works.** The only visible sync affordance is the force button, so
   the app's honest state — *everything you have done is uploaded; the last upload was N minutes
   ago* — is never stated, and pressing the button is the only way to find out.

The forces pulling the other way are all in ADR 0003 and none of them move: the app must remain
fully usable with no account, an unapproved account must cost the owner nothing, and nothing may
create a profile before discovery has run.

## Decision

### (a) The first-run gate offers optional sign-in

`FirstRunGate` gains an **optional** Google/GitHub sign-in offer beside the local path. Optional
means the local path stays the first-class, one-click route and carries no warning, no asterisk and
no "you will lose your progress" framing — which would be false.

No Worker change is required for this: both providers exist, and the flow is the one `/konto`
already drives. The one thing that may need Worker work is `returnTo` handling, so a learner who
signs in *from the gate* lands back in the gate rather than on `/konto`.

### (b) An OAuth display name may prefill the profile-name field and nothing more

This is the existing CLAUDE.md rule — *there is no default profile and no name is ever assumed* —
restated here because the first-run offer is exactly where it would be broken. A returning display
name may sit in the name field as a prefilled, fully editable value. It may not create a profile,
select one, or skip the discovery step.

### (c) Pending approval is communicated, never a blocker

A new account is `pending` until the owner approves it on `/konto` (ADR 0003), and pending grants
no storage: `/api/sync/snapshot` answers 403. The learner-facing rule is that this state is
**stated plainly and changes nothing about the app**. The copy already exists and is the right
copy — "keep learning, everything is saved on this device and will be uploaded once the account is
approved" (`src/components/account/AccountPanel.tsx:33`); the decision is that it must appear
wherever the pending state is reachable, including the first-run gate and the profile menu, and
that no surface gates, dims or delays local work while an account is pending.

### (d) Cloud sync is the recommended path in learner-facing copy

Not the required path and not the default state — the recommended one. A second device is the
normal case for this learner (desktop app plus browser), and the honest recommendation for a
local-first app whose data lives in one browser profile's IndexedDB is: sign in so there is a
second copy. Export/import stays as the account-free route and is never described as the primary
one.

### (e) Sync status becomes visible; the force button is demoted

Last-sync state moves into the **profile menu** — the surface a learner already opens to switch
profiles and pick a Lernsprache — read from `readSyncState` (`src/lib/sync-remote.ts`, already
consumed by `src/components/progress/ProgressPanel.tsx:18`). "Jetzt synchronisieren" stays, as a
secondary escape hatch for the case where the learner is about to close the laptop and wants
certainty, not as the mechanism the learner is expected to operate.

## Consequences

- **(a)–(e) need no server-side redesign.** The providers, the session, the approval queue, the
  conditional PUT and the 403-on-pending are all shipped. The only plausible Worker change in this
  whole ADR is `returnTo` handling for a sign-in that starts somewhere other than `/konto`.
- **The local-first invariants keep holding, and each one is a thing this change could have
  broken.** No default profile; nothing created before discovery has run; the last remaining
  profile cannot be deleted; an OAuth display name prefills and nothing more. A first-run gate that
  signed a learner in *and* created a profile named after their Google account would violate three
  of the four at once.
- **Recommending the cloud raises the cost of the pending state**, which is why (c) is part of the
  same decision rather than a follow-up. If the copy recommends signing in and the account then
  sits pending with no explanation, the recommendation reads as a broken feature.
- **Making sync status visible makes a silent failure loud** — which is the point, and a direct
  descendant of the 2026-08-03 outage where sign-in was dead for four hours with every gate green
  (`bun run deploy:smoke` exists because of it). A learner looking at "last sync: 3 days ago" is a
  better detector than any check that runs in this repo.
- **This ADR decides copy and placement, not layout.** Where the merged account/progress surface
  lives is [ADR 0005](0005-one-surface-for-fortschritt-and-konto.md); the implementation work is
  backlog **P24-1** (first-run sign-in and pending UX) and **P24-2** (sync-status visibility,
  demoted force button).
- **What it deliberately does not do:** it does not make an account required for any feature, does
  not move any evidence server-side, does not add a second sync trigger, and does not change what
  the server stores. The server still holds opaque bytes it has never parsed.
