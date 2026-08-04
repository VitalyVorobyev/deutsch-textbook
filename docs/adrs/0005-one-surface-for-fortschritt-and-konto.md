# ADR 0005: One surface for Fortschritt and Konto

Status: accepted · 2026-08-04

Companion to [ADR 0004](0004-first-run-accounts-and-automatic-sync.md), which decides what is
offered and shown; this one decides *where*.

## Context

The learner's own data is split across two pages that were built at different times and answer
overlapping questions.

- **`/progress`** is in the navigation (`src/layouts/Base.astro:29`, one of seven links) and has
  three sub-tabs — Übersicht, Nachweise, **Daten**
  (`src/components/progress/ProgressPanel.tsx:47`–`:49`). Its own header comment says what each is
  for: "Übersicht is the at-a-glance state, Nachweise holds every measurement surface, Daten the
  export/import/sync controls" (`:38`–`:40`).
- **`/konto`** is deliberately *not* in the navigation, and the page says why in a comment worth
  quoting because it is the reasoning this ADR has to answer: "Accounts are optional in a
  local-first app, and a permanent nav slot would imply otherwise; the way in is the profile menu
  in the header" (`src/pages/konto.astro:6`–`:8`).

That reasoning is right about navigation and wrong about *pages*. The consequence today is a
learner-visible seam: two different places load a snapshot into this profile.

- The **Daten tab** exports and imports a snapshot file (`exportSnapshot` is imported at
  `src/components/progress/ProgressPanel.tsx:3`).
- **AccountPanel** has its own upload path — `upload(file)` at
  `src/components/account/AccountPanel.tsx:197`, its own help copy at `:62` ("Have an exported file
  from another browser? Load it here: it is merged into this profile and then uploaded") and its
  own button at `:409`.

Two upload paths with different copy, different result messages and different post-conditions is
one path more than the product has a question for. It is also two places to get the merge semantics
wrong, and merge semantics are exactly where a data-loss defect lives (ADR 0003's *Ersetzen* vs
merge distinction).

## Decision

### `/progress` absorbs account and sync

Everything on `/konto` — sign-in and sign-out, the connected profile, device pairing, the owner's
approval queue, the cloud copy and its deletion — moves onto the Fortschritt surface, as a tab
beside the existing three or merged into Daten. Fortschritt becomes the single answer to "what does
this app know about me, and where does it live".

### `/konto` becomes a redirect

The URL keeps working. It has been given out, it is the landing target of every OAuth callback, and
it is the page the pairing code is typed into — so it redirects to the merged surface rather than
404ing. Nothing new links to it.

### Navigation keeps only Fortschritt

The `/konto` comment's argument stands and this decision honours it: an optional account still gets
no permanent nav slot. It gets no *page* either — it becomes part of the surface that was already
in the nav for a different reason. The profile menu keeps its way in, now pointing at the merged
surface.

### The two snapshot-upload paths converge into one

One component owns "load a snapshot file into this profile", with one set of copy and one set of
outcomes. Whether the merged result is then pushed to the cloud is a property of the *account
state*, not of which button was pressed — which is the actual bug in having two: today the answer
depends on which page the learner happened to be on.

## Consequences

- **The nav count does not grow.** It stays at seven links, which matters because seven already
  horizontal-scrolls below 640 px (`src/layouts/Base.astro:103`, the `overflow-x-auto` /
  `sm:overflow-visible` pair) — see the mobile track and backlog **P24-7**.
- **One merge path means one place to get merge semantics right**, and one place to test them. The
  destructive *Ersetzen* import and the non-destructive merge stay distinguishable to the learner;
  they just stop being distinguishable by *which page they are on*.
- **`/konto` stays a working URL forever.** OAuth callbacks and pairing-code entry both land there;
  a redirect is cheap, and a dead link in an email or a bookmark is not.
- **The pending-account state now has one home**, which is what makes ADR 0004(c) implementable
  without repeating the copy in three places.
- **Cost accepted: Fortschritt gets bigger, and it is already the heaviest page class in the
  build.** `/progress` inlines 6.1 MB of HTML (backlog P23-1, measured with
  `find dist -name '*.html' -exec wc -c {} + | sort -rn`). The account surface is client-only and
  session-dependent (`client:only="react"`, `src/pages/konto.astro:18`), so it adds little static
  weight — but the merge must not become the reason a fifth tab of inlined data ships.
- **This ADR decides the shape, not the layout.** Tab vs merged-Daten, and the copy for each state,
  are a design pass: backlog **P24-3**.
