# Deutsch-Atlas

[![CI](https://github.com/VitalyVorobyev/deutsch-textbook/actions/workflows/ci.yml/badge.svg)](https://github.com/VitalyVorobyev/deutsch-textbook/actions/workflows/ci.yml)

A free, local-first app for learning German — a structured textbook, interactive
exercises, and spaced-repetition flashcards in one place. Explanations are
bilingual: every topic is written twice, in English and in Russian, and you can
switch between the two at any time. The German itself — examples, tables,
readings — is always visible.

There are no ads, no accounts, and no gamification. The design follows what
learning research actually supports: active recall, typed answers, spaced
review, interleaved practice, and immediate explanations when you get something
wrong.

## What's inside

- **A growing A1–A2 course.** The Themen page presents a clear, ordered
  Lernpfad with one recommended next action. A focused Zusammenhänge view shows
  a topic's direct prerequisites, unlocks, and deeper follow-ups without making
  the learner navigate a global dependency graph.
- **Interactive exercises on every topic** — multiple choice, fill-in-the-gap,
  matching, word order, tables, translation, open writing, and listening or
  reading comprehension. A wrong answer immediately shows a short explanation
  of the rule you tripped over, in English or Russian. Open production is saved
  locally and shown as practice without pretending it was automatically verified.
- **Flashcards with real recall.** Vocabulary becomes flashcards in both
  directions, scheduled by FSRS (a modern spaced-repetition algorithm). In the
  production direction you type the German — article included for nouns —
  instead of just flipping the card. Words come with pronunciation (IPA) and
  audio.
- **A ~15-minute guided daily session**: due flashcards first, then a short
  mixed-exercise workout, then a suggestion for what to read next.
- **Mixed training that targets your weak spots.** Exercises from different
  topics are interleaved, and the queue prioritizes what you recently got wrong
  and the specific confusions (dative pronouns, haben/sein, word order …) your
  error history shows.
- **An evidence-aware progress dashboard** with an activity heatmap, streak,
  per-topic completion, skill-mode coverage, and trends for each confusion the
  exercises measure. Automatically scored evidence and unverified production
  remain visibly distinct.

## Getting it

**Use it in the browser** — the site is deployed at
<https://vitalyvorobyev.github.io/deutsch-textbook/>. Nothing to install;
progress stays in your browser.

**Or install the desktop app** (Windows, Linux, macOS) from
[GitHub Releases](https://github.com/VitalyVorobyev/deutsch-textbook/releases):

- **Windows**: `.exe` (NSIS) or `.msi`. SmartScreen may warn — choose
  *More info → Run anyway*.
- **Linux**: `.deb` (`sudo apt install ./deutsch-atlas_…_amd64.deb`) or
  `.AppImage` (`chmod +x`, then run). Text-to-speech needs `speech-dispatcher`
  with a German voice; without one, audio-comprehension tasks fall back visibly
  to reading comprehension.
- **macOS**: `.dmg`, unsigned — after moving the app to Applications run
  `xattr -cr /Applications/Deutsch-Atlas.app`, or right-click → Open
  (macOS 15+: System Settings → Privacy & Security → Open Anyway).

**Or run it locally** with [Bun](https://bun.sh):

```sh
bun install
bun run dev   # http://localhost:4321
```

## Your data

Everything stays with you. On first open the app asks for a name and creates a
local profile — no account, no server, no tracking. Several people can share
one device, each with fully separate progress. Exercise attempts and flashcard
scheduling are stored in your browser (or in the desktop app's own storage) and
recorded automatically as you practice.

The Fortschritt (progress) page can export your progress as a JSON snapshot and
import it elsewhere — for example to move from the website to the desktop app.
Import merges by default, so nothing is overwritten without asking.

## Development

Deutsch-Atlas is a static [Astro](https://astro.build) site with React islands,
Tailwind CSS, and a thin [Tauri v2](https://tauri.app) shell for the desktop
build; all content lives in the repo as MDX and YAML, validated against Zod
schemas. Bun is the package manager and task runner.

| Command | What it does |
| --- | --- |
| `bun run dev` | dev server |
| `bun run validate` | validate all content against schemas and cross-references |
| `bun test` | domain regression tests |
| `bun run check` | type-check (`astro check`) |
| `bun run lint` | ESLint over `src/` and `scripts/` |
| `bun run build` | static production build |
| `bun tauri dev` / `bun tauri build` | desktop app (needs a [Rust toolchain](https://rustup.rs)) |

Before opening a pull request, run the complete gate:

```sh
bun run validate
bun test
bun run check
bun run lint
bun run build
```

Content authoring rules — bilingual voice, CEFR discipline, exercise and IPA
conventions — are in [CLAUDE.md](CLAUDE.md); direction lives in
[docs/roadmap.md](docs/roadmap.md) and [docs/backlog.md](docs/backlog.md).
Releases: push a `vX.Y.Z` tag and `.github/workflows/release.yml` builds and
publishes the installers.
