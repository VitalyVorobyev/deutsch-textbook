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

- **A complete A1, and A2 in progress.** All ten A1 units are authored — from
  Erste Schritte to Freizeit & Können — each with a diagnostic pretest, a full
  article, a graded reading and its own vocabulary. A cumulative **A1
  checkpoint** measures the level end to end, and every headword on the
  Goethe-Institut's A1 Wortliste is covered. A2 is six topics of core grammar
  so far: a strong start, not yet the whole level. The Über page states exactly
  how far each level goes, with figures measured from the content itself.
- **Themen shows the course three ways** — an ordered Lernpfad with one
  recommended next action, an Atlas of how the topics relate, and *Alle Themen*:
  every topic in curriculum order with the status you have earned on it.
- **Interactive exercises on every topic** — multiple choice, fill-in-the-gap,
  matching, word order, tables, translation, open writing, speaking, and
  listening or reading comprehension. A wrong answer immediately shows a short
  explanation of the rule you tripped over, in English or Russian. Speaking
  tasks record and replay in the browser, and nothing is uploaded. Open
  production is saved locally and shown as practice without pretending it was
  automatically verified.
- **Flashcards with real recall.** Vocabulary becomes flashcards in both
  directions, scheduled by FSRS (a modern spaced-repetition algorithm). In the
  production direction you type the German — article included for nouns —
  instead of just flipping the card. Words come with pronunciation (IPA) and
  audio.
- **Delayed checks that ask what actually stuck.** Two, seven and twenty-one
  days after you learn something, the app asks about it again — in a fresh
  variant, never the item you already practised, so the answer has to come from
  the rule rather than from remembering the question. A due check opens the
  daily session, before any review or practice: taken afterwards, it would
  measure the warm-up instead of the interval.
- **A ~15-minute guided daily session**: up to three of those delayed checks if
  any are due, then due flashcards, then a short mixed-exercise workout, then a
  suggestion for what to read next.
- **Reading you work through, and reading you just read.** Each topic has a
  short glossed text with comprehension questions. Alongside them, *Lena in
  Bremen* is a longer, easier story — sparse glosses, one question about the
  gist — meant to be read straight through for meaning, which is the kind of
  reading that builds fluency rather than testing it.
- **Mixed training that targets your weak spots.** Exercises from different
  topics are interleaved, and the queue prioritizes what you recently got wrong
  and the specific confusions (dative pronouns, haben/sein, word order …) your
  error history shows. A quarter of every session is nevertheless reserved for
  material you last answered *correctly*, longest ago — otherwise the loudest
  problems would crowd out everything you are quietly forgetting.
- **An evidence-aware progress dashboard** with an activity heatmap, streak,
  per-topic completion, skill-mode coverage, delayed-check results kept apart
  from your practice accuracy, and trends for each confusion the exercises
  measure. Automatically scored evidence and unverified production remain
  visibly distinct.

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
| `bun run gen:ipa` | fill missing Lautschrift on vocabulary entries (needs `espeak-ng`) |
| `bun scripts/coverage.ts A1` | Goethe Wortliste coverage report (`A1` or `A2`) |
| `bun tauri dev` / `bun tauri build` | desktop app (needs a [Rust toolchain](https://rustup.rs)) |

Before opening a pull request, run the complete gate — the same one CI runs:

```sh
bun run validate
bun test
bun run check
bun run lint
bun run build
```

Content authoring rules — bilingual voice, CEFR discipline, exercise and IPA
conventions — are in [CLAUDE.md](CLAUDE.md).

## Licence

The application (`src/`, `scripts/`, `src-tauri/`) is MIT — see
[LICENSE](LICENSE). The course material in `content/` — articles, exercises,
readings and vocabulary — is Creative Commons **BY-SA 4.0**, see
[content/LICENSE](content/LICENSE): use and adapt it freely, with credit, under
the same licence.
