# Changelog

All notable changes to Deutsch-Atlas are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Releases are cut by pushing a `vX.Y.Z` tag; the section below the matching version becomes the
GitHub Release notes.

## [Unreleased]

### Added

- **Delayed outcome probes.** Two, seven and twenty-one days after you learn a topic, the same
  competence is asked again — in a task you have not seen — and it opens the session, before
  review and training. A probe answered after twenty minutes of practice on the same material would
  measure the practice, not the interval. Ten A1 probe families, three parallel variants each.
  Fortschritt reports the results apart from practice accuracy, at the interval that *actually*
  elapsed rather than the one that was scheduled.
- **An extensive reader.** "Lena in Bremen" — a longer text meant to be read straight through for
  meaning, with sparse glosses and no line-by-line quiz. Readings now declare whether they are
  intensive or extensive, and the validator holds the two apart.
- **A reserved share of broad retrieval.** A quarter of every mixed session now goes to material you
  answered correctly a long time ago. Recency and weakness are the loudest signals, not the most
  informative ones, and they used to take the whole session.
- Local record/replay speaking practice with self-check and a required improved attempt; recordings
  never leave the current browser tab and never produce verified mastery.
- Actual response modes on new attempts, so progress distinguishes selected, written, listening and
  spoken activity from the curriculum outcome's intended skill.

### Changed

- **Typing a German sentence is graded honestly.** A one-letter slip in an otherwise correct
  sentence used to fail the item *and* be recorded as a failure of the grammar it was drilling. It
  is now shown as a spelling note and scored correct. Articles and pronouns are never forgiven this
  way — `den` for `dem` is a choice, not a slip.
- **A mistake is only blamed on the confusion it is actually about.** `Sie ist zu Hause gebliebt`
  was being logged as a *haben-sein* error although the auxiliary was right. Errors that cannot be
  attributed are now recorded as unattributed rather than mislabelled, because the weakness signal
  drives which drills you are given — and it had been sending them after confusions the learner did
  not have.
- **More writing, less picking.** Every topic's practice now has to include real sentence
  production, and multiple choice can no longer carry a topic. Thirty new production items.
- Open writing now uses a draft → checklist → revision loop and preserves both versions as
  unverified practice evidence.

### Fixed

- The dev server could overwrite a day's progress snapshot with an emptier one from any browser that
  happened to use the same profile name. It now refuses to shrink a snapshot and parks the incoming
  state in a conflict file instead of discarding it, and a refused sync is reported rather than
  silently swallowed.
- Writing drafts were shared between profiles on the same device.
- Reading comprehension answers were not recording their evidence quality or response mode.
- **Mixed training sometimes served two exercises from the same topic back to back.** Interleaving is
  the whole point of mixed training — meeting a rule out of its own context is what forces you to
  choose it rather than merely apply it — and a third of sessions were quietly failing to do it. The
  queue is now built so that consecutive items come from different topics whenever the session's
  composition allows it at all.

## [0.2.0] — 2026-07-12

The A1 release. Version 0.1.0 shipped the desktop shell; almost the entire course arrived after it.

### Added

- **A1 is complete.** Ten units, from Erste Schritte to Freizeit & Können. Each has a diagnostic
  pretest, a full bilingual article, a graded reading with in-place glosses, exercises across
  several task types, and its own vocabulary with reviewed Lautschrift.
- **Cumulative A1 checkpoint** (`/checkpoint/a1`) — one pass over the whole level across listening,
  reading, grammar and free production. Excluded from ordinary training; results appear on
  Fortschritt broken down by skill.
- **Full Goethe-A1 Wortliste coverage** — every headword on the official list is either taught as a
  flashcard or addressed as grammar. `bun scripts/coverage-a1.ts` reports the live figure.
- **Curriculum spine and Atlas** — `content/atlas.yaml` is the ordered teaching path plus the
  relationships between topics (prerequisites, `deepens`, `related`), with learner-facing "Ich
  kann …" outcomes per topic.
- **Alle Themen** — a new tab on Themen showing every topic in curriculum order with its measured
  status, the evidence behind it, and its next action. Expanding a row shows how the topic connects
  to the rest.
- **Über page** — the learning principles the course is built on, and an honest statement of how
  complete each CEFR level actually is. Every figure on it is measured from the content at build
  time.
- **Reading texts** on every topic — comprehensible input at the topic's own level.
- **`write` and `audio-comprehension` tasks.** Open writing is stored as unverified practice and
  never counted as a correct answer.
- Split licensing: MIT for the app, CC BY-SA 4.0 for the course material.

### Changed

- **Wiederholen no longer deals the same cards in the same order.** Ties are broken at random, and
  a word's two flashcards (recognition and production) can no longer land next to each other —
  seeing "Brot → bread" immediately before being asked to produce *Brot* turned a retrieval into a
  copy.
- Üben is one section (Wiederholen · Training · Wortschatz) instead of three separate pages.
- Heute teaches itself to a learner with no history instead of showing three zeros.
- Mixed training and fresh flashcards are gated on material the learner has actually opened, so
  automatic practice can never surface untaught content.

### Fixed

- **The recommended next lesson could be a topic already marked "Gemeistert".** The path advanced a
  topic only when every item of its practice set had been attempted, so deepening a topic — adding
  items to a set the learner had already finished — silently un-finished the lesson. The same gate
  hid the A1 checkpoint from a learner who had mastered all of A1.
- Marking a topic "gelernt" now moves the path along, and reopening a mastered topic brings it back
  until it is worked through again.
- The Fortschritt topic list counted a pretest as practice, so a topic could show "✓ Geübt" beside a
  "Neu" badge.

## [0.1.0] — 2026-07-11

### Added

- Desktop app (Tauri v2) for Windows, Linux and macOS, with automatic progress sync to a folder of
  your choosing.
- Local learner profiles — no accounts, no server. Several people can share a device with fully
  separate progress, and the browser's own databases are the source of truth for who has learned
  here.
- FSRS flashcards with typed production, Lautschrift (IPA) and tap-to-hear audio.
- Progress snapshots: export, and a non-destructive merge on import.

[0.2.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.2.0
[0.1.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.1.0
