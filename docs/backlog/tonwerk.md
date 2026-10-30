# Backlog · Tonwerk

The audio studio: UI and engine. The format and the ID rule are in the [backlog README](README.md).
The studio's contract is [ADR 0012](../adrs/0012-editorial-tools-and-the-tonwerk-studio.md).

## Doing, in order

The owner has put the studio first and the learner integration after it. The roster, the library
and the editor come first so that the course's audio is produced in the finished tool. Characters
enter lessons only after this queue
([proposal](../proposals/characters-and-stories.md)).

- **TON-1 · One command, one app.** Running the studio means two processes and a token pasted after
  every restart, and the engine binds a fixed port (`docs/apps/tonwerk.md` "Start it").
  - **Engine:** `serve --port 0 --no-browser`, a JSON handshake line, a single-use launch code
    exchanged at `POST /api/session`, `doctor` results over the API, and `HF_HUB_OFFLINE=1` for
    the whole process.
  - **Shell:** a Tauri app in `apps/tonwerk/src-tauri/`, modelled on Redaktion's. It starts the
    engine from the checkout and stops it on quit.
  - **Root scripts:** `bun run tonwerk:start` for browser mode, `bun run tonwerk:app` for the
    `.app`.
  - **First step:** the handshake and launch code in `cli.py serve` and `web.py`, with the
    reuse-refusal test.
- **TON-2 · Bibliothek.** Nothing lists everything the studio has made: scenes, published
  recordings, narrations and sounds, with what uses each one. The registry join in
  `api/registry.py` already holds most of it.
  - One library view with collections, archiving, forking, transcript search and a disk figure.
    It replaces the Szenen list.
  - A keep-last-N render reaper.
  - **First step:** extend `data/listening-plan.yaml` so a plan entry may belong to a collection
    instead of a unit. Today every id is `ls-<unit>-01`, which is what blocks the 36 A2 Hören
    scripts (CON-5).
- **TON-3 · Figuren and voice quality.** The installed `Qwen3-TTS-12Hz-0.6B-CustomVoice` has nine
  preset speakers and discards every `style` prompt (`supports_style = False` in
  `generative/qwen.py`).
  - **Voice comparison:** compare the 1.7B CustomVoice, a designed synthetic reference per
    character through the Base (clone) model, and the current baseline. Measure Whisper WER,
    speaker-identity consistency across lines and scenes, and words per second, then a blind
    A/B listening by the owner.
  - **Roster:** a card per character with portrait, legend, voice parameters, demo takes,
    consistency score and the scenes it is cast in, editable through the engine with a version
    bump.
  - **Takes:** render N seeds of a line and pick one.
  - **First step:** the comparison script over the demo phrases in
    `data/listening-characters.yaml`.
- **TON-4 · The timeline editor.** The scene editor is forms, and its Mischung timeline is
  read-only (`apps/tonwerk/ui/src/views/Szene.tsx`). Per line there is no gain or effect, ambience
  has no ducking, and a scene can only name a room or device.
  - **Scene v2:** speech gain and an effect chain, ambience `duck_db`, and rooms and devices as
    `{ref, overrides}`.
  - **Engine endpoints:** per-node peaks and stems.
  - **UI:** a canvas multitrack timeline with drag, fades, an inspector, a mixer strip, a Web
    Audio preview of stems, and undo inside the draft. It is built on `@vitavision/*` per
    [ADR 0011](../adrs/0011-shared-ui-from-vitavision-packages.md).
  - **First step:** the v2 contract in `packages/schema` and `scene/model.py`, with the v1→v2
    conversion.
- **TON-5 · Produce, then wire into learning.** The learner hears browser TTS for 115 of 195
  `audio-comprehension` items and all 85 `listen` items. No Lesetext has narration, and the 36 A2
  Hören scripts are unrecorded (`grep -rh "recording:" content/exercises | wc -l` gives 80).
  Recordings play whole, with no per-turn cues.
  - **Production order:** A2 Hören, then TTS-only items, then unstarted plan artifacts, then
    narrations.
  - **Cues:** `scene/publish.py` writes measured turn cues into the listening YAML.
  - **Learner app:** `AudioComprehension.tsx` gets a follow-along transcript with tap-to-replay
    and a slower replay after the answer, and `listen` items may cut a turn from a recording.
  - **First step:** publish the first A2 Hören scene end to end.

## Open defects

- **P28-8 · `scripts/validate.ts` predates consented cloning and manifest v2.** Allow
  `voice_cloning_used: true` with a non-empty `consent_sha256` list, and check a v2 manifest's
  `version`/`scene_sha256`. Lands with the first real scene publish (TON-5).
- **P28-4 · `renders/` has no reaper and no disk figure.** Part of TON-2.
- **P22-14 / P22-16 · Delivery timing.** Per-line lead and trail silence compound with
  `pause_after_ms` (~1.4 s dead air at a normal turn), and pace and pause do not vary by level.
  Both re-synthesise and invalidate approvals, so pay for them in the TON-3 voice pass. Measure
  words per second of voiced audio (median 2.96).
- **P22-10 · Nothing compares a recording's length to its planned window**
  (`data/listening-plan.yaml` `duration_seconds`). Fix the script, never the window; start with
  `ls-lernen-zukunft-01` and `ls-arbeit-beruf-01`. Belongs in the TON-2 library row.
- **P22-15 · Tonwerk cannot author a `uk` half**, so the 246 hand-authored `uk` fields exist only
  in the published YAML. Add the column to the question editor and `uk` to `draft_prompt`.
- **P22-6 · Freesound URLs are matched by prefix** (`sources.py`). Parse the URL and require the
  sound-id segment to equal `sound_id`.
