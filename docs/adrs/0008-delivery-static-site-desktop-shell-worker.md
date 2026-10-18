# ADR 0008: The course ships as a static site, a thin desktop shell and one Worker

Status: accepted · 2026-10-18

## Context

The course has to run on a phone in a browser, as an installed desktop app and offline on both,
while one person operates it. Every server-side component is something that can be down at the
moment the learner opens the app. Delivery choices therefore decide how much of the learner's day
depends on infrastructure.

## Decision

**The learner app is a static Astro build, base-path-agnostic, with React islands for state.** All
content is build-time data. The same `dist/` serves the web (behind the Worker) and the desktop.

**The desktop app is a thin Tauri shell over the same build.** It adds a sync folder, an exit flush
and an HTTP transport for the local writing assistant. Every Tauri API is called behind `isTauri()`,
and the learning model never forks by platform. Releases are cut per batch from a `vX.Y.Z` tag.

**One Cloudflare Worker serves the assets, accounts (D1) and snapshot sync (R2).** It holds no
learner model ([ADR 0007](0007-opaque-snapshot-sync-and-approval-accounts.md)). A deploy touching
the Worker is followed by `bun run deploy:smoke`.

**Pages never inline the corpus.** Session pages fetch two content-hashed files
(`data/cards-<hash>.json`, `data/sets-<hash>.json`). The service worker precaches them for offline
use. An island never mounts on a file that has not arrived, and CI fails any page over 1.5 MB.

## Consequences

- The learner app stays at the repository root. Astro needs its content collections under the
  project root, and moving the app into `apps/` failed in the build (recorded beside `workspaces`
  in `package.json`).
- A broken Worker breaks sign-in and sync, never learning. The app keeps working on local state.
- The writing assistant (a local Ollama model) exists only where `http://localhost` is reachable:
  dev, any `http:` origin and the desktop app. It self-hides everywhere else.
