# Deutsch-Atlas

An agent-authored German learning system: a wiki-like textbook, interactive exercises,
and FSRS flashcards — built as a static Astro site over a structured content base,
also shipped as a desktop app for Windows, Linux, and macOS.

- **Content** lives in `content/` (MDX topics, YAML vocabulary and exercises) and is
  written by an agent following the rules in [CLAUDE.md](CLAUDE.md).
- **Profiles**: on first open the app asks for your name and creates a local
  profile (no accounts, no server); more profiles can be added from the header
  switcher, each with fully separate progress.
- **Progress** (exercise attempts, flashcard scheduling) lives in the browser
  (IndexedDB) and is recorded automatically as you practice. While `bun run dev`
  is running, every change also syncs to `progress/<profile>/<date>.json` in the
  repo — the agent reads those snapshots to generate drills targeting your weak
  spots. The desktop app does the same automatically (see below); on the deployed
  website use Export/Import on the Fortschritt page instead.
- **Explanations** are bilingual (English/Russian, toggle in the header); the German
  content itself is always visible.

## Usage

This project uses [Bun](https://bun.sh) as its package manager and task runner.

```sh
bun install
bun run dev        # the textbook at http://localhost:4321
bun run validate   # check all content against schemas and cross-references
bun run check      # astro type-check
bun run build      # static production build
```

## Desktop app

The site ships as an installable desktop app (a thin [Tauri v2](https://tauri.app)
shell around the same static build). Download installers from
[GitHub Releases](../../releases):

- **Windows**: `.exe` (NSIS) or `.msi`. SmartScreen may warn — *More info → Run anyway*.
- **Linux**: `.deb` (`sudo apt install ./deutsch-atlas_…_amd64.deb`) or `.AppImage`
  (`chmod +x`, then run). Text-to-speech needs `speech-dispatcher` with a German
  voice — without it, listening exercises degrade to silence.
- **macOS**: `.dmg`, unsigned — after moving the app to Applications run
  `xattr -cr /Applications/Deutsch-Atlas.app`, or right-click → Open
  (macOS 15+: System Settings → Privacy & Security → Open Anyway).

Progress in the app is saved permanently (webview IndexedDB) and additionally
auto-synced as snapshot files to a **sync folder** — by default the app data
directory, configurable on the Fortschritt page. Point it at your repo clone's
`progress/` folder and the agent personalization loop works exactly like under
`bun run dev`. The website and the app are separate storage origins: to carry
existing browser history into the app once, use Export there and Import here.

Local desktop development needs a [Rust toolchain](https://rustup.rs):

```sh
bun tauri dev      # desktop window against the dev server
bun tauri build    # installers in src-tauri/target/release/bundle/
```

## CI & deployment

GitHub Actions run on every push and pull request (`.github/workflows/ci.yml`:
validate → type-check → build). Pushes to `main` also deploy the site to GitHub
Pages (`.github/workflows/pages.yml`) at
<https://vitalyvorobyev.github.io/deutsch-textbook/> — enable **Settings →
Pages → Source: GitHub Actions** once for the repository. Learner progress
stays in the browser per origin; use Export/Import on the Fortschritt page to
move it between localhost and the deployed site.

Desktop installers are built and published by `.github/workflows/release.yml`
on every semver tag:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

Plain `vX.Y.Z` tags only (no `-beta` suffixes — the MSI installer requires
numeric versions). The tag version is stamped into the installers; the
`version` fields committed in `package.json`/`tauri.conf.json` are dev
placeholders.

## Structure

| Path | What |
| --- | --- |
| `content/topics/<level>/<id>.mdx` | Topic articles (the atlas nodes) |
| `content/vocab/<id>.yaml` | Vocabulary → flashcard decks |
| `content/exercises/<level>/<id>.yaml` | Exercise sets (mc, cloze, match, order, table) |
| `content/atlas.yaml` | Topic graph (levels, prerequisites) |
| `progress/` | Exported learner progress snapshots |
| `src/` | Astro site + React islands |
| `src-tauri/` | Desktop shell (Tauri v2) |
| `scripts/validate.ts` | Content validator |
