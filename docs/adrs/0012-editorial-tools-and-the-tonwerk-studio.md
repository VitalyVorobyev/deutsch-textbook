# ADR 0012: Editorial tools are separate applications over the checkout, and Tonwerk is one studio whose shell owns its engine

Status: accepted · 2026-10-30

## Context

The course is edited through two professional tools: Redaktion (reading the corpus, its diagnostics
and safe edits) and Tonwerk (making and approving listening audio). Both touch the same repository
the learner build reads, so a careless write path is a learner-facing defect. Neither is the
product, and neither may become a second source of truth ([ADR 0001](0001-repository-is-the-content-database.md)).

[ADR 0010](0010-editorial-tools-are-separate-apps.md) separated the tools but left Tonwerk hard to
use. Running it meant starting two processes and pasting a token again after every restart. Its
editor was a set of forms. Two generations of pipeline sat side by side, and the scene generation
had published nothing. The owner wants one studio: built with one command, started as one app or
one browser tab, with a character roster, a library of everything it made, and a timeline editor.
The studio exists to improve what the learner hears.

## Decision

**Each tool is its own application, sharing no shell and no learner state with the learner app.**
Their interface language is German, with no switcher.

**Redaktion reads and writes the checkout directly.** `@da/content` is its only content model. It
has no editorial database and no Python backend.

- The UI talks to a transport-neutral `CorpusClient`. In development that is Vite middleware; in
  the Tauri app it is a compiled Bun sidecar over stdio.
- No localhost service is opened. The webview gets one narrow RPC plus a folder picker, never
  general filesystem or shell access.
- Writes are limited to existing text files under `content/` and `data/`. They are explicit,
  revision-checked, schema-checked and atomically renamed.
- `reviewed` passes the full validation gate.

**Tonwerk is a UI over a local engine, and the engine owns everything.** The Python engine
(`atlas-listening`) owns the database, the models, the renders and the publish path. It listens on
`127.0.0.1` only, behind a bearer token it mints per run and never writes to disk. The UI opens no
files and imports only the Scene contract from `@da/schema`.

**The shell owns the engine's lifecycle.**

- **Desktop app:** a Tauri app starts the engine from the checkout's own environment on a free
  port. It receives the token over a handshake and hands it to the webview in-process. It stops
  the engine on quit.
- **Browser mode:** one command starts the engine and opens a tab with a single-use launch code.
  The tab exchanges the code once for the token and keeps the token in session storage.
- Pasting a token is a fallback, not the normal way in.

**A scene is the only description of audio the engine renders.** Every recording, including those
published before scenes existed, is a scene project. There is no second pipeline.

**Every edit is non-destructive.** Timing, mix, effects, voice and the chosen take are all
parameters of a scene revision, and the engine renders the bytes from that revision. A preview in
the UI may approximate a render. Only an engine render can be checked or approved.

**QA is automatic; approval is a person approving exact bytes; publishing is the engine's command,
never a button.** A changed render makes its approval stale.

**The library keeps everything.** Scenes can be grouped, forked and archived, but not deleted
once anything depends on them. Renders may be reaped, because a revision reproduces them. The bytes
an approval names are never reaped.

## Consequences

- Each tool's privileged boundary carries its own security tests: traversal, symlinks, sizes,
  conflicts, token refusal. For Tonwerk that now includes launch-code reuse.
- The desktop app is not a self-contained installer. It needs the checkout, `uv`, `ffmpeg` and the
  model weights. Real synthesis runs only on Apple Silicon. Freezing the engine's Python and ML
  runtimes would buy portability no user needs, and it would break on every model upgrade.
- The non-destructive rule makes the editor slower than a waveform editor: every edit is a
  re-render. The render graph's node cache is what keeps that affordable.
- Shared presentation comes from one UI system ([ADR 0011](0011-shared-ui-from-vitavision-packages.md)).
  Each tool's look is a theme, not a fork.
- Character and story work will need content-level identities that both tools and the learner app
  read. That is a future ADR ([proposal](../proposals/characters-and-stories.md)), not a
  Tonwerk-private data file.
