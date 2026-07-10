# Deutsch-Atlas

An agent-authored German learning system: a wiki-like textbook, interactive exercises,
and FSRS flashcards — built as a static Astro site over a structured content base.

- **Content** lives in `content/` (MDX topics, YAML vocabulary and exercises) and is
  written by an agent following the rules in [CLAUDE.md](CLAUDE.md).
- **Progress** (exercise attempts, flashcard scheduling) lives in the browser
  (IndexedDB) and can be exported to `progress/*.json` — the agent reads those
  snapshots to generate drills targeting your weak spots.
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

## CI & deployment

GitHub Actions run on every push and pull request (`.github/workflows/ci.yml`:
validate → type-check → build). Pushes to `main` also deploy the site to GitHub
Pages (`.github/workflows/pages.yml`) at
<https://vitalyvorobyev.github.io/deutsch-textbook/> — enable **Settings →
Pages → Source: GitHub Actions** once for the repository. Learner progress
stays in the browser per origin; use Export/Import on the Fortschritt page to
move it between localhost and the deployed site.

## Structure

| Path | What |
| --- | --- |
| `content/topics/<level>/<id>.mdx` | Topic articles (the atlas nodes) |
| `content/vocab/<id>.yaml` | Vocabulary → flashcard decks |
| `content/exercises/<level>/<id>.yaml` | Exercise sets (mc, cloze, match, order, table) |
| `content/atlas.yaml` | Topic graph (levels, prerequisites) |
| `progress/` | Exported learner progress snapshots |
| `src/` | Astro site + React islands |
| `scripts/validate.ts` | Content validator |
