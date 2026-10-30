# ADR 0010: Editorial tools are separate applications over the checkout

Status: superseded by 0012 · 2026-10-30

## Context

The course is edited through two professional tools: Redaktion (reading the corpus, its diagnostics
and safe edits) and Tonwerk (making and approving listening audio). Both touch the same repository
the learner build reads, so a careless write path is a learner-facing defect. Neither is the
product, and neither may become a second source of truth ([ADR 0001](0001-repository-is-the-content-database.md)).

## Decision

**Each tool is its own application, sharing no shell and no learner state with the learner app.**
Their interface language is German, with no switcher.

**Redaktion reads and writes the checkout directly.** `@da/content` is its only content model; there
is no editorial database and no Python backend. The UI talks to a transport-neutral `CorpusClient`:
Vite middleware in development, and a compiled Bun sidecar over stdio in the Tauri app. No localhost
service is opened, and the webview gets one narrow RPC plus a folder picker, never general
filesystem or shell access. Writes are limited to existing text files under `content/` and `data/`.
They are explicit, revision-checked, schema-checked and atomically renamed. `reviewed` passes the
full validation gate.

**Tonwerk is a UI over a local engine, and the engine owns everything.** The Python engine
(`atlas-listening`) owns the database, the models, the renders and the publish path. It listens on
`127.0.0.1` only, behind a bearer token minted per run and never written to disk. The UI opens no
files and imports only the Scene contract from `@da/schema`. **QA is automatic; approval is a person
approving exact bytes; publishing is the engine's command, never a button.** A changed render makes
its approval stale.

## Consequences

- Each tool's privileged boundary (Redaktion's sidecar, Tonwerk's engine API) carries its own
  security tests: traversal, symlinks, sizes, conflicts, token refusal.
- Shared presentation comes from one UI system ([ADR 0011](0011-shared-ui-from-vitavision-packages.md)).
  Each tool's look is a theme, not a fork.
- Character and story work will need content-level identities that both tools and the learner
  app read. That is a future ADR ([proposal](../proposals/characters-and-stories.md)), not a
  Tonwerk-private data file.
