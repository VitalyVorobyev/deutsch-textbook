# Redaktion: the editorial workbench

Redaktion reads and edits the checked-out repository directly. There is no second content database
and no import step: what you see is the working tree, and what you save is a file Git will show you
in `git diff`.

Reach for it when the question is *editorial* rather than textual — what does this topic actually
teach, which outcomes have evidence, where does this focus tag come from, what is the queue of
findings. For a one-line fix in a file you already have open, a text editor plus `bun run validate`
is still faster.

The interface language is German, with no switcher.

## Start it

### In the browser

From the repository root:

```sh
bun install
bun run redaktion       # http://localhost:4330
```

The Vite process fixes the workspace to the checkout it was started from — there is nothing to
select.

### As a desktop app

```sh
bun run redaktion:desktop          # run it
bun run redaktion:desktop:build    # build the .app and .dmg
```

The build writes below `apps/redaktion/src-tauri/target/release/bundle/`. It is ad-hoc signed, not
notarized; a distributed build needs the project's Apple signing credentials.

**On first launch, open Einstellungen, choose the Deutsch-Atlas checkout, and click *Checkout
öffnen*.** A valid checkout contains `content/atlas.yaml`, `data/grammar-inventory.yaml` and
`package.json`. Redaktion remembers the path in its own application settings.

## Find the editorial answer

- **Übersicht** — course size, review state, diagnostics and the current checkout.
- **Grammatikatlas** — explicit grammar lines from A1 through C2. `nicht kartiert` means no verified
  inventory source exists for that cell; it is not zero coverage.
- **Themen** — a topic profile: outcomes, grammar, materials, references and findings.
- **Materialien** — exercises, vocabulary, readings, listening, articles, documents, discovery
  material and word networks. Search and filters are reflected in the URL.
- **Qualität** — the work queue. Read severity and scope before acting; the number of findings is
  not a quality score. `geprüft` and `Entwurf` are workflow facets, not severity labels: a profile
  finding inside a reviewed topic is editorial debt, not a validator error, and does not block Save.
  `technisch blockierend` is reserved for a condition the application really refuses.
- **Referenzen** — external source coverage, internal inventory coverage and teaching depth, kept
  apart.
- **Einstellungen** — the checkout.

The global search sends its query to **Materialien**. Follow links from a grammar point to its focus
tag, topic, material and source rather than grepping the repository by hand. The arrow buttons
beside the wordmark traverse the history those links create; they stay disabled when there is no
app-local destination, and a dead-end detail links back to its collection or owning topic.

## Review one topic's learning activities

This is the normal first editorial pass. It replaces counting YAML files or adding their item
totals.

1. Run `bun run activity:audit`. It names core-band exceptions, topics without productive
   application, and dense topics. These are review queues, not scores.
2. In **Themen**, open the topic. The activity panel distinguishes **Grundübung**, **Vertiefen**,
   **Anwenden**, **Aufgaben** and **Gezielt wiederholen**. A Grundübung and a productive Anwendung
   are required; the other three are optional.
3. Open **Elemente**. Read `Funktion`, `Stufe` and `Medium` separately — a short listening artifact
   may be a task at transfer, and "listening" is not its purpose.
4. Open each source and ask what single learner job the set performs, which outcomes it gives
   evidence for, and whether its support matches the stage. A file that exists only because of
   repository history should be merged, reclassified or retired.
5. Keep the core to 8–15 scaffolded items and move free productive retrieval into Anwendung. Do not
   inflate a two-question audio check to reach eight; ask instead whether the recording and its
   questions form a complete comprehension task.
6. If an item moves between files, update its probe `arming:` keys and any grading-decision key.
7. Save, run **Korpus prüfen**, then rerun `bun run activity:audit`. The pass is done when the
   architecture is coherent and the validator is green — not when every topic has the same number of
   files.

The durable contract and its trade-offs are in [ADR 0002](../adrs/0002-topic-manifests-and-learning-activities.md).

## Edit a source

1. Open a source link from **Themen**, **Materialien** or a grammar detail.
2. Read the preview on the left and edit the exact YAML or MDX on the right. Articles, Entdecken
   pieces, exercise sets, reading texts and vocabulary decks have a preview; every other file is
   data whose clearest form is its source, so the source takes the full width. In a reading the
   glosses stand open beside their phrases, and a deck lists each word with its forms, translation
   and example. For an article, switch between **EN**, **RU**, **UK** and **DE** above the preview; every button says
   whether all, some or none of the article's explanation blocks support that language. German
   examples do not manufacture a DE translation status.
3. In an exercise set, use the same language switch and inspect every prompt, model answer, accepted
   alternative, explanation, focus, outcome, key token and revision. This is editor mode: answers
   are deliberately disclosed and no attempt or progress record is written.
4. Click **Speichern**. Save is explicit; Redaktion never writes on a keystroke.
5. Fix any file-local syntax or schema diagnostics. An invalid YAML/MDX file is not written.
6. Click **Korpus prüfen** after a meaningful edit. Cross-file problems may exist in a saved draft
   and stay visible until resolved.
7. Review the resulting diff with Git before committing.

Save uses the revision read when the editor was opened. If another program changed the file in the
meantime, Redaktion refuses to overwrite it — reload the source and merge the two deliberately.
Writes are atomic and limited to existing supported text files below `content/` and `data/`;
creating, deleting and moving files remain repository operations.

When the buffer is dirty, links, filters, search and Back/Forward ask before leaving it. Cancelling
keeps the source and its unsaved text open; confirming discards the buffer and completes the
navigation. Closing or reloading the window is guarded by the platform prompt.

The **GitHub** link is secondary provenance. It opens the corresponding source on `main`; it does
not replace the local preview, the local edit, or review of the eventual branch diff.

## Review what Claude changed

**Prüfen** is your inbox. It lists every file Claude handed over, each with a note on what to look
at, and every file you reviewed before that has changed since.

1. Open an entry and click **Diff zeigen**. The diff starts at the version you last accepted; a file
   you never reviewed shows whole.
2. Read it, and open the file from its path if you want the full context.
3. Click **Als geprüft markieren**. The mark covers exactly the version you read: if the file
   changed after you opened it, the mark is refused and you read again.

Any file's source page has the same button, so you can also mark a file you came across yourself.
A mark rebuilds nothing, so a review pass is quick. Marks are written to `data/review-ledger.yaml`;
commit that file like any other.

## Review a topic

A topic is reviewed when you have marked every file it owns — the manifest, the article and each
exercise set, reading and deck — at its current version. Nobody sets it by hand, and it lapses on
its own when one of those files changes or the topic gains a new one. Learners see a topic as a
draft until then.

1. Open the topic. Next to its status, **Prüfen** lists all its files with their state.
2. Work through the ones not yet marked, as above.

Marking a B1 topic writes nothing into its authorship-provenance record: that record describes
decisions you made, not what you read ([ADR 0015](../adrs/0015-review-is-reading-provenance-is-decisions.md)).

## Tell Claude something

Anything you notice while reading — a wrong fact, an item that rejects good German, a wish, a
question — goes to Claude as an **Anliegen**, on the exact place it concerns:

1. On a source page or a topic page, click **Anliegen an Claude**.
2. Choose **Befund**, **Wunsch** or **Frage**; on an exercise set or a reading you can also pick
   the one item it is about. Write it in any language, and click **Ablegen**.
3. Claude reads every new Anliegen at the start of its next session. It fixes the problem and closes
   the entry in that pull request, or answers you.
4. Answers wait in **Prüfen → Anliegen**, and the topic or source page shows the thread too. Reply,
   which hands it back to Claude, or click **Erledigt**.

Entries are written to `data/redaktion-queue.yaml`; commit that file like the review ledger. Prüfen
also lists, folded away, the smaller findings Claude filed for itself; they are fixed the next time
their files are edited.

## Before each session

- start from a clean Git branch and confirm the checkout path in **Einstellungen**;
- keep one editor responsible for a file at a time;
- save one coherent change, then inspect `git diff`;
- run `bun run validate` before committing content;
- mark a file reviewed only after reading the version on screen.

## What it deliberately does not do

No Git staging, commit or PR UI; Prüfen reads old versions from Git but writes only the ledger. No
comments or assignments. No file creation, deletion or moves.
No learner progress, no grading queue, no audio generation — audio is [Tonwerk's](tonwerk.md).
B2–C2 grammar cells remain source-led unknown territory, and Windows and Linux packaging are not
release targets.

The preview renders the Atlas article hierarchy, Markdown tables, emphasis, links and quotes, and
never executes MDX imports or JavaScript expressions. All current custom component names are
allowlisted; `SentenceRail` has its full editor rendering and the other semantic figures use a named
editor representation, so check consequential image composition and custom-figure layout in the
learner app.

The architecture and security boundary are recorded in
[ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md); remaining milestones live in the
[roadmap](../roadmap.md) and [backlog](../backlog/redaktion.md).
