# Deutsch-Atlas

An AI-assisted, human-directed and edited German learning system by Vitaly Vorobyev:
wiki-like textbook + interactive exercises + FSRS flashcards. A1, A2 and B1 are authored and their
denominators closed: Wortliste 673/673 · 1449/1449 · 3416/3416, internal grammar 28/28 · 46/46 ·
32/32, DTZ structures 93/93 · 300/300 · 164/164, Themen 70/70 and Sprachhandlungen 38/41 (the
three left — interkulturelle Begegnung, Wissensdivergenz, Gefühle ausdrücken — want a topic of
their own). The learner (Vitaly) aims at B2. Explanations are bilingual **EN + RU**, with an
optional **UK** half and, from B1 onward, an optional German-medium half. The repo is both the
knowledge base (`content/`) and the Astro site that renders it.

**This file is the root of a layered rule set.** It holds what applies everywhere: the map, the
gates, the PR and release cycle, and the cross-cutting rules. Each working directory has its own
`CLAUDE.md`, which Claude Code loads when you work there: [`content/`](content/CLAUDE.md),
[`data/`](data/CLAUDE.md), [`src/`](src/CLAUDE.md), [`packages/`](packages/CLAUDE.md),
[`worker/`](worker/CLAUDE.md), [`apps/redaktion/`](apps/redaktion/CLAUDE.md) and
[`apps/tonwerk/`](apps/tonwerk/CLAUDE.md). Every enforced rule has its imperative in exactly one of
them, in one line; the reasoning lives in the companion doc named beside it. **A one-line rule you
do not understand is a rule to go read**, not a rule to guess at. The full doc map is
[`docs/README.md`](docs/README.md); recurring jobs have skills in `.claude/skills/`.

## Before you do X, read Y

| If you are… | Read first |
| --- | --- |
| writing or revising a **topic article** (`## Erklärung` structure, paragraph size, `Kurz gesagt`, the native-language prose-review loop) | [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md) |
| authoring or editing an **exercise item** (any type, `key_tokens`, item mix, placement sets, vocab entries) | [`docs/authoring/item-authoring.md`](docs/authoring/item-authoring.md) |
| choosing or adding a **`focus` tag** | [`docs/authoring/focus-tags.md`](docs/authoring/focus-tags.md) |
| changing anything in **`src/lib/`** | [`docs/architecture/runtime-contracts.md`](docs/architecture/runtime-contracts.md) |
| adding to **`packages/`** or **`apps/redaktion`**, or asking the corpus a new question | [`docs/architecture/content-graph.md`](docs/architecture/content-graph.md) |
| using **Redaktion** or **Tonwerk** | [`docs/apps/redaktion.md`](docs/apps/redaktion.md) · [`docs/apps/tonwerk.md`](docs/apps/tonwerk.md) |
| touching **`worker/`**, `src/lib/sync-remote.ts` or `scripts/progress-pull.ts` (accounts, approval, snapshot sync) | [`docs/architecture/cloud-sync.md`](docs/architecture/cloud-sync.md) |
| reading or writing an **ADR**, making an **architecture decision**, or opening a direction still under discussion | [`docs/adrs/README.md`](docs/adrs/README.md) · [`docs/proposals/README.md`](docs/proposals/README.md) |
| shipping a **new topic**, or writing a **drill from learner progress** | [`docs/authoring/authoring-checklists.md`](docs/authoring/authoring-checklists.md) |
| running a **topic-quality pass**, or checking a unit against the **unit gate** | [`docs/authoring/content-quality-audit.md`](docs/authoring/content-quality-audit.md) |
| drafting or reviewing **B1.4+**, or adding a generated/simulated asset | [`.claude/skills/authorship-provenance/SKILL.md`](.claude/skills/authorship-provenance/SKILL.md) · [`docs/authoring/product-protection.md`](docs/authoring/product-protection.md) |
| touching a **coverage figure** (Wortliste `~`, grammar inventory, `/about`) | [`docs/authoring/coverage-instruments.md`](docs/authoring/coverage-instruments.md) |
| hand-editing a vocab **`ipa`** | [`docs/authoring/lautschrift.md`](docs/authoring/lautschrift.md) |
| authoring **Entdecken** material or adding a **document** | [`docs/authoring/future-content-directions.md`](docs/authoring/future-content-directions.md) |
| deciding **what a unit owns** and what it may not touch, with which frozen identities | [`docs/curriculum/a2-b1.md`](docs/curriculum/a2-b1.md) |
| adding a **grammar-inventory row**, a `claims:` citation or an external **Strukturenliste** | [`data/strukturenlisten/README.md`](data/strukturenlisten/README.md) · [ADR 0004](docs/adrs/0004-completeness-is-evidence-contracts.md) |
| writing or changing **any document** — developer or user-facing | [`docs/README.md`](docs/README.md) |
| committing, opening a **PR**, answering a review or **merging** | the `pr-cycle` skill |
| cutting a **release** (only when the owner asks) | the `cut-release` skill |
| shipping a **new topic or unit** end to end | the `ship-topic` skill |
| writing or translating an **explanation half** from the German | the `german-first-translation` skill |
| looking for the **system map** or **the queue** | [`docs/overview.md`](docs/overview.md) · [`docs/backlog/`](docs/backlog/README.md) |

## The workspace

| Path | What it is |
| --- | --- |
| `content/`, `data/` | the corpus and its instruments — the content database ([ADR 0001](docs/adrs/0001-repository-is-the-content-database.md)) |
| `src/`, `src-tauri/`, `public/` | the learner app (Astro at the root, on purpose) and its desktop shell |
| `packages/` | `@da/schema`, `@da/grading`, `@da/content`, `@da/ui`, `@da/renderers` |
| `apps/redaktion/` | the editorial workbench |
| `apps/tonwerk/ui/`, `apps/tonwerk/engine/` | the audio studio: React UI and Python engine |
| `worker/` | the Cloudflare Worker: assets, accounts (D1, `worker/migrations/`), snapshot sync (R2) |
| `scripts/`, `tests/`, `tools/` | CLIs and instruments, the Bun test suite, build helpers |
| `docs/` | developer docs: overview, roadmap, backlog, ADRs, proposals ([map](docs/README.md)) |
| `sources/` | verbatim public-domain source texts |
| `progress/` | learner snapshots — **local only, gitignored** |

## Commands

**Bun** is the package manager and task runner (`bun install`, `bun run <script>`).

- `bun run dev` — dev server
- `bun run validate` — content validation (**run after every content change; it must pass before you are done**)
- `bun test` — domain regression tests
- `bun run check` — TypeScript 7 `tsc` over the root and Worker projects, then `.astro` diagnostics on TypeScript 6 (`tools/astro-check`, until `@astrojs/check` supports 7)
- `bun run lint` — Oxlint (`.oxlintrc.json`), with `--deny-warnings`: a warning fails it too
- `bun run fmt` / `bun run fmt:check` — Oxfmt (`.oxfmtrc.json`) over code and JSON only; `content/`, `data/`, MDX, Astro, Markdown and YAML stay hand-formatted, and the generated `packages/schema/schemas/` is byte-compared by the engine's tests
- `bun run build` — production build (also type-checks content against schemas)
- `bun run review:gate` — read-only merge gate: non-draft PR, green CI, no unresolved actionable threads, no outstanding change request. **It waits for no reviewer** — merge when it passes; a later review is answered in its threads.
- Content instruments, importers and app commands are in the `CLAUDE.md` of the directory they serve.
- `bun tauri dev` / `bun tauri build` — desktop app (Tauri v2 shell in `src-tauri/`; needs Rust). Release: push a plain `vX.Y.Z` tag and `.github/workflows/release.yml` builds Windows, Linux and macOS installers. **One release per batch, never per PR**: a PR writes its CHANGELOG lines under `## [Unreleased]`, bumps no version and pushes no tag; the release PR folds them into one heading, bumps `package.json`, `tauri.conf.json` and `Cargo.toml`, and is tagged when the owner calls it. Keep the site base-path-agnostic, and call Tauri JS APIs only behind `isTauri()` (`src/lib/syncdir.ts`).

## Rules that apply everywhere

### Language discipline
- German orthography must be perfect: ä/ö/ü/ß always (never ae/oe/ue/ss), nouns capitalized.
- Russian and English explanation text must be complete and idiomatic — never machine-translation-ese, never transliteration.
- **A half that mirrors a sibling half's rhetoric sentence-for-sentence is a calque, and no gate can see it.** Diagnose with the `textbook-text-reviewer` skill, repair with `textbook-text-editor`. → [`docs/authoring/article-prose.md`](docs/authoring/article-prose.md)
- **CEFR discipline**: in a topic at level X, German examples and exercise items use only grammar and vocabulary at or below X. An A2 article must be fully readable by an A2 learner.
- Every German example sentence gets EN and RU translations.

### Claims written into this repo

Every published figure here is earned rather than asserted, and **the same bar applies to prose**,
where no check can help:

- **A number in prose carries the command that produces it.** Where no command exists, say how it was counted.
- **A fixture proves the mechanism; only the corpus gives the magnitude.** Never let an example you wrote decide a trade-off.
- **An unmeasured deferral is a claim too.** Measure before deferring.
- **A conclusion you just reversed is more suspect, not less.** Measure it again before writing it down.
- **A new rule is not verified until you have watched it fail.** Break it deliberately, once per rule.
- **An estimate you gave is a claim you owe a correction on.** Report the miss.
- **A pasted or generated source document is an outline, never an inventory.** Check it against `data/grammar-inventory.yaml`, the Goethe Wortliste and a reference grammar before authoring from it — its gaps are the first thing to look for.

**Never write a literal NUL byte into source.** It is valid TypeScript, so every gate passes, but
`file` then reports the source as `data` and grep, ripgrep and editor search skip it silently. Use
the escape in a template literal; `tests/source-hygiene.test.ts` fails on any tracked file containing
one.

### Documents → [`docs/README.md`](docs/README.md)

- **A developer doc states the current contract, the current queue or how to do a job — never history.** Delete a finished backlog entry, a closed-finding ledger or a dated pass log; `git log` is the archive. ADRs are the exception and are superseded, never edited.
- **User documents (README, CHANGELOG, NOTICE, `docs/apps/`, `/about`, `/install`) and developer documents never restate each other.** Link across; copy nothing. A CHANGELOG entry says what a learner sees; a tooling-only release gets one plain line.

### Review rounds end when a round finds nothing material

- **Material means it changes what the learner sees, does, or is measured on** — a false fact taught, an item that rejects correct German, an outcome with no task in its mode, a mechanism that mis-measures. Everything else is a backlog line, not an edit.
- **Fix the finding, not the neighbourhood.** Grepping a false *claim* to its other instances is in scope; adding the item you wish existed is next round's findings, authored by you.
- **Precedent settles marginal calls.** When shipped units at the same level do not do the thing, it is a backlog item and the PR merges.
- **Push back when a finding is wrong.** Check the claim against the corpus and say no with the reason.
- **A reply is a verdict, a fix and its scope.** Not an essay.
