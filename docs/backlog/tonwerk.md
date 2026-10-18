# Backlog · Tonwerk

The audio studio: UI and engine. The format and the ID rule are in the [backlog README](README.md).

- **P28-8 · `scripts/validate.ts` predates consented cloning and manifest v2.** Allow
  `voice_cloning_used: true` with a non-empty `consent_sha256` list, and check a v2 manifest's
  `version`/`scene_sha256`. Lands with the first real scene publish.
- **P28-3 · One `qa_json` per scene revision, but renders are per variant.** Key it by variant in
  `scene_revisions` before difficulty variants ship.
- **P28-4 · `renders/` has no reaper and no disk figure.** First a `renders du` figure in the
  dashboard, then a keep-last-N decision.
- **P28-2 · A scene ending on its last word has no reverb tail** (`afir` truncates at EOF). Pad the
  dialogue bus with silence ≥ the room's decay before convolution (`graph/render.py`).
- **P28-1 · Legacy `--json` CLI verbs can emit corrupted JSON** under a real engine (a banner on
  stdout). Apply `_only_json_on_stdout` (`scene/cli.py`) to the legacy verbs that survive, drop the
  rest.
- **P22-14 / P22-16 · Delivery timing.** Per-line lead and trail silence compound with
  `pause_after_ms` (~1.4 s dead air at a normal turn), and pace and pause do not vary by level.
  Both re-synthesise and invalidate approvals, so pay for them in one between-waves pass. Measure
  words per second of voiced audio (median 2.96).
- **P22-10 · Nothing compares a recording's length to its planned window**
  (`data/listening-plan.yaml` `duration_seconds`; `tools/listening-studio/authoring/audio_report.py`).
  Fix the script, never the window; start with `ls-lernen-zukunft-01` and `ls-arbeit-beruf-01`.
- **P22-20 · The Qwen download is unpinned** (`scripts/download-qwen3-tts.py` calls
  `snapshot_download` with no `revision`) while the loader accepts one revision only. Pass it.
- **P22-18 · `soundfile` is pinned at two versions** (`pyproject.toml`/`uv.lock` 0.13.1,
  `requirements-qwen-runtime.txt` 0.14.0). Pick one; do not refresh the committed manifests'
  `dependency_lock_sha256`.
- **P22-15 · The Studio cannot author a `uk` half**, so the 246 hand-authored `uk` fields exist only
  in the published YAML. Add the column to the question editor and `uk` to `draft_prompt`.
- **P22-5 · A rebuilt export keeps the previous revision's files.** Build into a clean directory.
- **P22-6 · Freesound URLs are matched by prefix** (`sources.py`). Parse the URL and require the
  sound-id segment to equal `sound_id`.
