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

- **TON-6 · Recast from the character records.** Each cast member speaks through one roster voice
  that speaks nobody else, and the other roster voices speak the walk-on roles. No new voice is
  designed ([ADR 0018](../adrs/0018-the-twelve-roster-voices-are-the-whole-pool.md)). Every
  level-owned recording (checkpoints, placements, Prüfung sets) is cast that way. 33 topic
  recordings still break the rule and wait in `recast_pending` (`data/speaker-registry.yaml`).
  Each recast re-synthesises the recording and removes its entry, and the ceiling in
  `tests/characters.test.ts` drops with it. A recast revises the scene still held in the engine
  store. It adopts the walk-on voice for the breaking roles only, then renders, runs QA and
  publishes with `scene publish-checked --yes --repo <root>`. The script stays word for word.
  Converting a topic to a task set (CON-10) replaces its recordings, so a topic recording is worth
  recasting only when its conversion is far off. At least one third of each level's recorded
  listening time stays with walk-on voices (`bun run listening:inventory`; today A1 59%, A2 85%,
  B1 61%). First step: none until CON-10's order is set; then recast the topics it leaves for last.

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
- **TON-7 · No way to judge a batch by ear.** Whether two voices can be told apart, or a pause is
  too long, is the owner's judgement, and today it reaches the queue only through a Claude
  session. A Hörprobe view: play the published recordings in a queue, one key per verdict (gut,
  Tempo, Pausen, Stimme, Aussprache, Text) and a note, written to `data/redaktion-queue.yaml`.
  First step: the view over the 40 dialogues, before the delivery-timing change, so its verdicts
  can be compared after.
