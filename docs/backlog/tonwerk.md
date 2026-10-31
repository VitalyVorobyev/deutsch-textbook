# Backlog · Tonwerk

The audio studio: UI and engine. The format and the ID rule are in the [backlog README](README.md).
The studio's contract is [ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md).

## Doing, in order

The owner has put the studio first and the learner integration after it. The roster and the editor
come first so that the course's audio is produced in the finished tool. Characters enter lessons
only after this queue
([proposal](../proposals/characters-and-stories.md)).

- **TON-3 · Figuren and voice quality.** The installed `Qwen3-TTS-12Hz-0.6B-CustomVoice` has nine
  preset speakers and discards every `style` prompt (`supports_style = False` in
  `generative/qwen.py`).
  - **Voice comparison:** measured, waiting on the owner's blind listen. `atlas-listening evaluate
    voices --name voices-2026-10-31` spoke each roster character's three demo phrases and four
    shared lines on four candidates (84 takes each, 40 minutes, 8.3 GB peak RSS on the 24 GB Mac):

    | candidate | WER mean | Whisper misses | words/s | realtime factor | same-character min (median) | other-character similarity (median) |
    | --- | --- | --- | --- | --- | --- | --- |
    | preset 0.6B (current) | 0.004 | 0 | 2.92 | 1.01 | 0.917 | 0.773 |
    | preset 1.7B, style honoured | 0.034 | 2 | 2.70 | 1.25 | 0.910 | 0.700 |
    | designed voice → 0.6B clone | 0.001 | 0 | 3.57 | 1.19 | 0.922 | 0.490 |
    | designed voice → 1.7B clone | 0.000 | 0 | 3.47 | 1.69 | 0.938 | 0.475 |

    All 12 designed references passed Whisper on their first seed. The presets put three pairs on
    one speaker (lena/klara, mira/noa, david/paul), and noa, a child, on an adult voice; the 1.7B
    preset once ran away into 15 s of babble on a 5 s line. The clones run about 20% faster than the corpus
    median of 2.96 words/s, so a clone winner needs its `pace` retuned. The WavLM similarities are
    uncalibrated, so they rank and do not decide. **Next:** the owner listens to `listen/index.html`
    in the run folder, saves `choices.json`, and `atlas-listening evaluate reveal voices-2026-10-31
    --choices <file>` unblinds it. A designed-voice winner then needs a production decision (an ADR
    amending the evaluation-only policy in `docs/authoring/product-protection.md`) before any
    course audio uses it.
  - **Roster:** a card per character with portrait, legend, voice parameters, demo takes,
    consistency score and the scenes it is cast in, editable through the engine with a version
    bump. Its voice fields wait for the listen, because a designed voice is a reference clip, not a
    preset name.
  - **Takes:** render N seeds of a line and pick one.
- **TON-4 · The timeline editor.** The scene editor is forms, and its Mischung timeline is
  read-only (`apps/tonwerk/ui/src/views/Szene.tsx`). The scene contract and the renderer already
  carry speech gain, effects, ducking and room and device overrides (engine README, "Acoustics"),
  and Mischung's timeline draws each stem's waveform and plays a stem or the master from any
  point; no view edits the mixing fields yet.
  - **UI:** dragging on that timeline, fades, an inspector, a mixer strip, a Web
    Audio preview of stems, and undo inside the draft. It is built on `@vitavision/*` per
    [ADR 0011](../adrs/0011-shared-ui-from-vitavision-packages.md).
  - **First step:** the clip inspector for one speech entry (gain, effects, the takes), on the
    `@vitavision/ui` controls Tonwerk now uses.
- **TON-5 · Produce, then wire into learning.** The learner hears browser TTS for 115 of 195
  `audio-comprehension` items and all 85 `listen` items. No Lesetext has narration, and the 36 A2
  Hören scripts are unrecorded (`grep -rh "recording:" content/exercises | wc -l` gives 80).
  After an answer, an `audio-comprehension` item already replays any one line, follows the
  transcript and plays slower; every published recording carries turn cues.
  - **Production order:** A2 Hören, then TTS-only items, then unstarted plan artifacts, then
    narrations.
  - **Learner app:** `listen` items may cut a turn from a recording instead of TTS.
  - **First step:** publish the first A2 Hören scene end to end.

## Open defects

- **P28-8 · `scripts/validate.ts` predates consented cloning and manifest v2.** Allow
  `voice_cloning_used: true` with a non-empty `consent_sha256` list, and check a v2 manifest's
  `version`/`scene_sha256`. Lands with the first real scene publish (TON-5).
- **P22-14 / P22-16 · Delivery timing.** Per-line lead and trail silence compound with
  `pause_after_ms` (~1.4 s dead air at a normal turn), and pace and pause do not vary by level.
  Both re-synthesise and invalidate approvals, so pay for them in the TON-3 voice pass. Measure
  words per second of voiced audio (median 2.96).
- **P22-10 · Twelve of the 40 published recordings miss their planned window.** The Bibliothek
  marks them *zu kurz* or *zu lang* (`ls-arbeit-beruf-01` runs 24 s against 40–50,
  `ls-lernen-zukunft-01` 44 s against 65–85). Fix the script, never the window, in the TON-3 voice
  pass that re-synthesises them anyway.
- **P22-15 · Tonwerk cannot author a `uk` half**, so the 246 hand-authored `uk` fields exist only
  in the published YAML. Add the column to the question editor and `uk` to `draft_prompt`.
- **P22-6 · Freesound URLs are matched by prefix** (`sources.py`). Parse the URL and require the
  sound-id segment to equal `sound_id`.
