# Backlog · Tonwerk

The audio studio: UI and engine. The format and the ID rule are in the [backlog README](README.md).
The studio's contract is [ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md).

## Doing, in order

The owner has put the studio first and the learner integration after it. The roster and the editor
come first so that the course's audio is produced in the finished tool. Characters enter lessons
after this queue, cast from the character records
([ADR 0016](../adrs/0016-lessons-are-tasks-and-a-cast-carries-them.md)).

- **TON-5 · Produce, then wire into learning.** Every one of the 243 `audio-comprehension`
  items plays a recording (`grep -rh "^ *recording:" content/exercises | wc -l` gives 243), and
  every recording the listening plan names is published; all 85 `listen` items still speak in the
  browser's voice, and no Lesetext has narration.
  After an answer, an `audio-comprehension` item already replays any one line, follows the
  transcript and plays slower; every published recording carries turn cues. The roster speaks
  through its designed voices on `qwen_tts_designed` (ADR 0013), and a dialogue publishes on its
  automatic QA with `scene publish-checked`.
  - **Production order:** narrations, then recasting the 40 published dialogues from their
    presets to the roster.
  - **Learner app:** `listen` items may cut a turn from a recording instead of TTS.
  - **Narrations need a plan first.** No file lists which readings should be narrated, so
    Redaktion's census cannot show them as absences the way it shows planned scenes (ADR 0014).
    Plan them where the scenes are planned, before producing any.
  - **First step:** the narration plan: which Lesetexte are narrated, in which voice, beside the
    scene plan.

- **TON-6 · A walk-on voice pool, and casting from character records.** ADR 0016 binds each cast
  member to one roster voice that speaks for nobody else. The unnamed roles (*Durchsage*, *Kundin*,
  *Beamter*, …) then need voices outside the cast. Today the 12 roster voices play every role,
  about 160 speaker names in all (`grep -h "^- [A-ZÄÖÜ]" content/listening/*/*.yaml | sort -u`).
  At least one third of each level's recorded listening seconds stays with walk-on voices.
  First step: count each level's recorded seconds by role, named or unnamed, to size the pool.
  Then design the walk-on voices on `qwen_tts_designed`.

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
