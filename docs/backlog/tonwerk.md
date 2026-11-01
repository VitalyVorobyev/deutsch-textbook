# Backlog · Tonwerk

The audio studio: UI and engine. The format and the ID rule are in the [backlog README](README.md).
The studio's contract is [ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md).

## Doing, in order

The owner has put the studio first and the learner integration after it. The roster and the editor
come first so that the course's audio is produced in the finished tool. Characters enter lessons
only after this queue
([proposal](../proposals/characters-and-stories.md)).

- **TON-4 · The rest of the timeline editor.** Mischung's timeline drags lines, events and beds,
  plans the draft through `POST …/plan`, previews it from the last render's stems and undoes inside
  the draft; its Pult sets each line's level, equalizer, room send and inserts and each bed's
  ducking. What the contract carries and no view edits yet: device overrides on a placement and
  room overrides on the scene.
  - **First step:** device overrides on a placement, in Szene beside the device picker, kept out
    of the document while they are neutral the way the Pult's fields are (`kanonisch`).
- **TON-5 · Produce, then wire into learning.** The learner hears browser TTS for 55 of 195
  `audio-comprehension` items and all 85 `listen` items, and no Lesetext has narration
  (`grep -rh "^ *recording:" content/exercises | wc -l` gives 140).
  After an answer, an `audio-comprehension` item already replays any one line, follows the
  transcript and plays slower; every published recording carries turn cues. The roster speaks
  through its designed voices on `qwen_tts_designed` (ADR 0013), and a dialogue publishes on its
  automatic QA with `scene publish-checked`.
  - **Production order:** the TTS-only items, then unstarted plan artifacts, then narrations,
    then recasting the 40 published dialogues from their presets to the roster.
  - **Learner app:** `listen` items may cut a turn from a recording instead of TTS.
  - **Narrations need a plan first.** No file lists which readings should be narrated, so
    Redaktion's census cannot show them as absences the way it shows planned scenes (ADR 0014).
    Plan them where the scenes are planned, before producing any.
  - **First step:** plan the 55 TTS-only items as recordings in `data/listening-plan.yaml`, the
    way the A2 Hören collections are planned.

## Open defects

- **P22-14 / P22-16 · Delivery timing.** Per-line lead and trail silence compound with
  `pause_after_ms` (~1.4 s dead air at a normal turn), and pace and pause do not vary by level.
  Both re-synthesise, so pay for them when the published dialogues are recast to the designed
  voices (TON-5). Measure words per second of voiced audio (the preset voice's median is 2.92 in the `voices-2026-10-31` run's `run.json`).
- **P22-10 · Twelve of the 40 published recordings miss their planned window.** The Bibliothek
  marks them *zu kurz* or *zu lang* (`ls-arbeit-beruf-01` runs 24 s against 40–50,
  `ls-lernen-zukunft-01` 44 s against 65–85). Fix the script, never the window, in the recast to
  the designed voices that re-synthesises them anyway (TON-5).
- **P22-15 · Tonwerk cannot author a `uk` half**, so the 246 hand-authored `uk` fields exist only
  in the published YAML. Add the column to the question editor and `uk` to `draft_prompt`.
- **P22-6 · Freesound URLs are matched by prefix** (`sources.py`). Parse the URL and require the
  sound-id segment to equal `sound_id`.
