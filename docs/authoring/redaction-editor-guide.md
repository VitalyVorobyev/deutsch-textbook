# Redaction: editor guide

Redaction is the local editorial workbench for Deutsch-Atlas. It reads and edits the selected
repository checkout directly; it does not keep a second content database. The current release is
appropriate for a **controlled macOS pilot** on existing `content/` and `data/` files. Keep normal
Git review and `bun run validate` in the publishing workflow.

## Start the workbench

### Browser development

From the repository root:

```sh
bun install
bun run redaktion
```

Open `http://localhost:4330`. The Vite process fixes the workspace to the checkout from which the
command was started.

### macOS desktop app

Build the application and DMG from the repository root:

```sh
bun run redaktion:desktop:build
```

The build writes the app and DMG below
`apps/redaktion/src-tauri/target/release/bundle/`. The local build is ad-hoc signed, not notarized;
a distributed build still needs the project Apple signing credentials.

On first launch, open **Einstellungen**, choose the Deutsch-Atlas checkout, and click **Checkout
öffnen**. A valid checkout contains `content/atlas.yaml`, `data/grammar-inventory.yaml`, and
`package.json`. Redaction remembers the selected path in its own application settings.

## Find the editorial answer

- **Übersicht** shows course size, review state, diagnostics and the current checkout.
- **Grammatikatlas** follows explicit grammar lines from A1 through C2. `nicht kartiert` means that
  no verified inventory source exists for that cell; it is not zero coverage.
- **Themen** opens a topic profile with outcomes, grammar, materials, references and findings.
- **Materialien** indexes exercises, vocabulary, readings, listening, articles, documents,
  discovery material and word networks. Search and filters are reflected in the URL.
- **Qualität** is the work queue. Read severity and scope before acting; the number of findings is
  not a quality score.
- **Referenzen** separates external source coverage from internal inventory coverage and teaching
  depth.

The global search sends a query to **Materialien**. Follow links from a grammar point to its focus
tag, topic, material and source rather than searching the repository by hand.

The arrow buttons beside the Redaction wordmark traverse the history created by links, filters and
search. They stay disabled when no app-local destination exists; a dead-end detail also links back
to its collection or owning topic.

In **Qualität**, `geprüft` and `Entwurf` are workflow facets, not severity labels. A profile finding
inside a reviewed topic is editorial debt; it is not a validator error and does not silently block
Save. `technisch blockierend` is reserved for a condition that the application really refuses.

## Edit an existing source

1. Open a source link from **Themen**, **Materialien**, or a grammar detail.
2. Read the editorial preview on the left and edit the exact YAML or MDX source on the right.
3. Click **Speichern**. Save is explicit; Redaction never writes on every keystroke.
4. Fix any file-local syntax or schema diagnostics. An invalid YAML/MDX file is not written.
5. Click **Korpus prüfen** after a meaningful edit. Cross-file problems may exist in a saved draft,
   but remain visible until resolved.
6. Review the resulting repository diff with Git before committing or opening a pull request.

Save uses the revision read when the editor was opened. If another program changes the file in the
meantime, Redaction refuses to overwrite it. Reload the source and merge the two versions
deliberately. Writes are atomic and limited to existing supported text files below `content/` and
`data/`; file creation, deletion, and moves remain repository operations.

When the buffer is dirty, links, filters, search and Back/Forward ask before leaving it. Cancelling
keeps the source and its unsaved text open; confirming discards the buffer and completes the
navigation. Closing or reloading the window remains guarded by the platform prompt.

The **GitHub** link is secondary provenance. It opens the corresponding source on `main`; it does
not replace the local preview, local edit, or review of the eventual branch diff.

## Mark a topic as reviewed

Do not change a topic manifest from `draft` to `reviewed` in the source textarea. Redaction rejects
that shortcut. Instead:

1. Save all draft changes.
2. Open the topic manifest source.
3. Click **Als geprüft markieren**.
4. Read every reported reason if the gate refuses the transition.

This action is a strict transaction: it checks the current revision, provenance, and the whole
corpus, and rolls back the status change on failure.

## Pilot safety checklist

Before each pilot session:

- start from a clean Git branch and confirm the checkout path in **Einstellungen**;
- keep one editor responsible for a file at a time;
- save one coherent change, then inspect `git diff`;
- run `bun run validate` before committing content;
- keep the topic as `draft` until the strict reviewed gate passes.

Do not rely on the current preview as pixel-identical proof of the learner experience. It exposes
source structure, answers, explanations, focus and outcomes, but the learner renderers have not yet
all been extracted into shared pure editor-mode components. Check consequential presentation
changes in the learner app too.

## Current boundaries

The first desktop release intentionally has no Git staging/commit/PR UI, comments, assignments,
file creation/deletion/moves, learner progress, grading queue, audio generation, or Listening
Studio. B2–C2 grammar cells remain source-led unknown territory. Windows and Linux packaging are
not release targets yet.

Before broad editorial adoption, complete the shared learner renderer fixtures, automated Tauri
workspace/save/watcher/security tests, dependency-aware cache invalidation, macOS signing and
notarization, and several more real-editor pilot sessions. The architecture and security boundary are
recorded in [ADR 0013](../adrs/0013-redaction-repository-workbench.md); milestones and acceptance
gates live in the [roadmap](../roadmap.md) and [backlog](../backlog.md).
