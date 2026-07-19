# Changelog

All notable changes to Deutsch-Atlas are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Releases are cut by pushing a `vX.Y.Z` tag; the section below the matching version becomes the
GitHub Release notes.

## [0.4.0] — 2026-07-19

**A course that now speaks to Ukrainian learners, teaches the complete A2 grammar standard, and
has had every A1 and A2 grammar claim read by a human rather than merely accepted by a schema.**

### Added

- **The complete Ukrainian explanation half for A1 and A2.** All 266 content files that carry a
  Russian explanation now carry an idiomatic Ukrainian one too: articles, exercises, readings,
  vocabulary, checkpoints and supporting material. A single *Lernsprache* selector switches among
  English, Russian and Ukrainian while the German examples and course chrome stay visible.
- **The rest of the A2 grammar curriculum.** Adjective declension, `zu`-infinitives and
  `um … zu`, nominative and accusative relative clauses, conjunctional adverbs with inversion,
  `als` versus `wenn`, Futur I, dative reflexives, `man`/`jemand`/`niemand`, possession and
  receptive passive close the measured A2 standard from 20/30 to **30/30**. The new material has
  pretests, productive practice, readings, vocabulary and delayed probes rather than reference
  prose alone.
- **A linguistic QA gate for both completed levels.** Every one of the 22 A1 and 30 A2 grammar
  points has been checked across its EN/RU/UK teaching text, prompts, accepted answers, feedback
  and readings. The resulting ledgers distinguish structural coverage, corpus correctness and
  learner mastery instead of treating one as proof of another.
- **Seven focused reference pages:** cases and prepositions, pronominal `da`/`wo` words, verb
  forms, numbers/dates/time, sentence connections, meaning-contrast *Wortnetze*, and their index.
  The connector reference tells the full A2-to-B2 story in one place while labelling the level at
  which each form becomes a learning target.
- **Ten multilingual Wortnetze** for distinctions a dictionary translation tends to flatten:
  among them *kennen/wissen/können*, *machen/tun*, *denken/glauben/meinen*,
  *sagen/erzählen*, *sprechen/reden* and *wohnen/leben*. Compact reminders also appear on relevant
  vocabulary cards.
- **Five A2 Entdecken pieces** built around real language in context: Berlin's U-Bahn map,
  Pfand and waste sorting, the Deutschlandticket, the migration history of the Döner, and regional
  greetings from *Moin* to *Grüß Gott*. Opening them creates no review debt.
- **The Schreib-Assistent.** Open writing can request advisory hints before submission in both the
  browser and desktop app. Its suggestions remain visibly unverified and never become mastery
  evidence.
- A compact progress audit, a committed queue of grading rulings, catch-up pacing for overdue
  delayed probes, and targeted production drills for persistent dative, verb-form, location and
  noun-gender weaknesses.
- The official Goethe-B1 Wortliste manifest (3,416 headwords), ready to measure B1 coverage when
  B1 authoring begins.

### Changed

- **Grading now asks one honest question: right or not yet.** The exercise result surface uses two
  actions rather than a confidence scale, and open writing/speaking use a single-pass flow with
  optional repetition instead of requiring a ceremonial second attempt.
- **Punctuation and typography are presentation, not hidden answer keys.** Quotes, commas,
  sentence-final punctuation, apostrophes and dash variants no longer turn an otherwise correct
  target rendering into a grammar failure; actual words, endings and word order remain graded.
- Correct alternative renderings found in the grading-review queue and the two linguistic corpus
  passes are now accepted without weakening the focus being measured. Any scoring-contract change
  carries an item revision so old evidence is not silently reinterpreted.
- *Alle Themen* is quieter: mastered rows collapse into a persisted summary, practised rows show
  only what is still missing, and completed evidence is not repeated beside the mastery badge.
- Discovery content now supports provenance-checked images and clearly online-only external links.

### Fixed

- The delayed-probe step could re-grade the previous answer after advancing to the next item.
- Desktop writing assistance now uses Tauri's HTTP transport instead of relying on browser fetch
  behaviour inside the webview.
- Entdecken feedback buttons persisted a click without showing a pressed state.
- A long corpus pass corrected over-broad or false explanations around case, movement/location,
  adjective endings, comparisons, subordinate clauses, reflexive and prepositional verbs,
  imperatives, modal verbs, time expressions, negation, passive and register. It also removed
  underdetermined prompts that could record valid German as a false weakness.

## [0.3.0] — 2026-07-13

**A complete A2.** Sixteen units, a cumulative checkpoint, and every word of the
Goethe-Institut's A2 Wortliste — measured, not asserted.

### Added

- **All sixteen A2 units.** *Wohnen & Umzug*, *Reisen & Verkehr*, *Einkaufen & Reklamation*,
  *Gesundheit & Arzttermin*, *Arbeit & Beruf*, *Nebensätze & Pläne*, *Biografie & Erfahrungen*,
  *Freunde & Feste*, *Lernen & Verstehen*, *Ämter & Dienstleistungen* — each with a diagnostic
  pretest, a full article, a graded reading, listening, writing and speaking tasks, and a delayed
  probe that asks the same competence again weeks later.
- **The whole Goethe-A2 Wortliste.** All 1449 headwords: 1358 as flashcards, 91 taught as grammar
  in an article rather than drilled as vocabulary. That last number used to be a promise the course
  made to itself — now it is checked, and the build fails if a word the course claims to teach
  without a flashcard does not actually appear in an article, a reading or a practice item. Nine of
  those claims turned out to be false when the check was first run, including one at A1.
- **A cumulative A2 checkpoint** — twenty items across all sixteen units, offered only once the
  whole level is behind you, and never mixed into ordinary practice.
- **New cards are rationed by the day, not by the sitting.** Reloading the review page used to hand
  you fifteen more new words, and fifteen more after that — a debt the scheduler would then deliver
  faithfully for months. Fifteen a day is now fifteen a day, however many times you come back.
- **Three more long reads.** Lena finds work she actually wants, and goes to her first German
  party — read straight through, with the glosses closed.

- **Delayed outcome probes.** Two, seven and twenty-one days after you learn a topic, the same
  competence is asked again — in a task you have not seen — and it opens the session, before
  review and training. A probe answered after twenty minutes of practice on the same material would
  measure the practice, not the interval. Ten A1 probe families, three parallel variants each.
  Fortschritt reports the results apart from practice accuracy, at the interval that *actually*
  elapsed rather than the one that was scheduled.
- **Delayed probes for A2 as well.** Sixteen families, one per unit — production-led, not multiple
  choice. The six A2 topics that predated this release had none at all, so weeks of dative and
  Perfekt practice had produced no evidence that any of it survived; those families arm off the
  practice already in your log, so the first checks fell due immediately.
- **A2 can now be listened to, written and spoken.** Six A2 topics were built before the rest of the
  course was, and you had been practising them entirely by typing into boxes: no listening with the
  transcript hidden, no writing that gets revised, and no speaking at all. Every A2 unit now has
  a listening task, a writing task with a checklist and a second draft, a speaking task you record
  and replay, and exercises that make you *choose* the rule rather than apply the one you were just
  shown — with the whole set built around one real situation, so the listening, the writing and the
  speaking are the same story rather than six unrelated drills.
- **Lena's second episode.** A2's first long read: she has a bakery job that starts at five, an
  alarm at four, and a German course at six in the evening. Something has to give.
- **An A2 vocabulary figure that is measured rather than claimed.** The Über page reports A2 against
  the official Goethe-Institut A2 Wortliste, exactly as it already did for A1. The number is computed
  from the content, so it cannot flatter the course — and when this release began it read 51%.
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
  composition allows it at all. It also used to count two exercise files from the *same* topic as
  different topics, which let two dative questions sit side by side; the dative alone owns four such
  files.
- **The delayed checks could not have shown whether anything stuck.** A check is supposed to ask the
  same question again after two days, a week and three weeks, so that you can see what fades. They
  were instead asking a *different* question each time — word order at two days, verb endings at a
  week, negation at three weeks. Each skill was therefore tested exactly once, at exactly one delay,
  and nothing could be compared with anything. Every check was rewritten so its three versions test
  one skill in three different situations, and the result is the curve it was always meant to be.
  Caught before a single check had been answered, so no history was lost.
- **The delayed checks were also being made easier at exactly one interval.** Every check comes in
  three versions, one served after two days, one after a week, one after three weeks — and the
  middle one was a fill-in-the-gap while the other two asked you to build the whole sentence from
  nothing. The week-old result would have looked stronger than the others no matter what you
  actually remembered. All three versions now ask for the same kind of answer, so the only thing
  that changes between them is how long it has been.
- **A word-order variant could switch off the grading it was meant to be generous about.** When an
  exercise accepts more than one correct word order, the alternative often starts with the very word
  the exercise is grading — *am Samstag* becomes *Am Samstag*. The capital letter made the scorer stop
  recognizing it, so typing *Um* instead of *Am* was quietly forgiven as a typo rather than recorded as
  the mistake it is. Fixed, with a test that fails without the fix.
- **Four A2 can-dos were promised and never asked about.** *I can use the dative pronouns*, *…the
  dative prepositions*, *…verbs like helfen and gefallen* and *…the modal forms* were listed on the
  topic pages but tagged on no exercise, so they could never be marked as learned and no delayed
  check could ever fire on them. The exercises that had been drilling them all along are now tagged
  correctly, and a rule was added so a topic can no longer advertise a skill nothing measures.

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

[0.4.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.4.0
[0.3.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.3.0
[0.2.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.2.0
[0.1.0]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/v0.1.0
