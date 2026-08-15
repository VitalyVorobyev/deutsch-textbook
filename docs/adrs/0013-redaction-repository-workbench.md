# ADR 0013: Redaktion is a repository-backed desktop workbench

Status: accepted · 2026-08-14

## Context

The first Redaktion UI was a browser-only report over `@da/content`. That foundation kept the
checked-out corpus as the source of truth, but the product stopped one layer too early: most rows
linked to GitHub instead of showing their source, only two scalar fields were editable, and a
binary “has findings” signal described all 49 topics equally. The grammar matrix grouped 98 points
into ten broad strands but could not show stable lines of development through A1–C2. Breadth,
practice depth and the completeness of an external reference list were visually easy to confuse.

The users are editors, authors, linguists and developers working on a checkout. They need to move
from a diagnostic to the exact source, inspect the rendered artifact, make a safe local edit and
see both local and corpus-level consequences. A GitHub page is useful provenance, but it cannot be
the primary editing surface for a local source tree.

## Decision

**Redaktion is a standalone Tauri application over one selected Deutsch-Atlas checkout.** It does
not share the learner shell or learner state. `@da/content` remains the only derived content model;
there is no editorial content database and no Python backend.

The static React frontend depends on a transport-neutral `CorpusClient`. Browser development uses
the existing Vite middleware. Desktop uses a persistent TypeScript/Bun sidecar compiled as a
standalone executable and exchanged over versioned JSONL-style request/response messages on stdio.
No localhost service is opened. Tauri exposes one narrow RPC command and a directory picker; it
does not grant the webview general filesystem or shell access.

The selected checkout must contain the repository sentinels. Reads and writes resolve both lexical
paths and symlinks and are limited to existing editorial text files below `content/` and `data/`.
Source writes are explicit, revision-checked, file-locally parsed and schema-checked, size-limited,
and atomically renamed in the target directory. A stale revision is a conflict, never a silent
overwrite. Cross-file-invalid drafts may be stored after local validation; `reviewed` remains a
strict transaction through the existing allowlisted writer and a full corpus validation.

Grammar levels use a separate `CefrLevel` contract (`A1`–`C2`) rather than widening the learner
runtime's supported levels. Every inventory point names a `GrammarTrack`; a track is the stable row
of the Grammatikatlas and a strand remains its coarser linguistic classification. Empty B2–C2 cells
say `nicht kartiert`; they are not inferred from internal data or filled without sources.

The product navigation is German and shared by all professional roles: Übersicht,
Grammatikatlas, Themen, Materialien, Qualität, Referenzen and Einstellungen. Visual language comes
from the learner app's warm stone/amber tokens, while density, split panes and persistent navigation
belong to the professional tool.

## Consequences

The browser build remains useful and read/write-capable during repository development, while the
same UI can work from an arbitrary valid checkout in a macOS app. GitHub links become secondary
actions beside local preview and source editing. Audio may be indexed and played, but recording,
generation and waveform approval stay in Listening Studio.

The sidecar is a privileged boundary and therefore costs more testing than a Vite plugin: path
traversal, symlink escape, request size, revision conflicts, process failure and packaging all need
explicit coverage. Compiled sidecar binaries are build artifacts and are not committed.

The first track migration is intentionally conservative: the ten existing strands each receive one
explicit track, so all 98 points are addressable without inventing a finer linguistic taxonomy.
Splitting those tracks is later source-led editorial work, not a mechanical UI change.

This decision does not add file creation, deletion or moves; comments, assignments, Git staging,
commits or pull requests; learner progress; grading queues; or Windows/Linux release support. It
also does not make an internal inventory a complete German standard. Coverage of the inventory,
alignment to external lists, teaching depth and unknown territory remain separate diagnostics.
