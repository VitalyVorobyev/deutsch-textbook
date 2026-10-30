# apps/tonwerk — Tonwerk (UI and engine)

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../../CLAUDE.md) applies too. The UI is `ui/` (React, vitest); the engine is `engine/` (Python, uv: `uv run ruff check .`, `uv run mypy`, `uv run pytest`). Making a scene or a narration has a skill each: `create-listening-scene` and `narrate-reading-text`.

## Commands

- `bun run tonwerk` — **Tonwerk**, the audio studio (`apps/tonwerk/ui`, :4340). It opens no files; everything comes from the local Python engine (`127.0.0.1:8765`) over a per-run bearer token. **QA is automatic, approval is not**, and publishing is the engine's (`scene publish-approved --yes`), never a button. → [`docs/apps/tonwerk.md`](../../docs/apps/tonwerk.md) · [`apps/tonwerk/engine/README.md`](../../apps/tonwerk/engine/README.md)
- **A scene project is the engine's only pipeline**: render, QA, approval and publishing all go through `scene/` and `graph/`; add no second project model or render path. The CLI is `serve`, `doctor`, `models list|fetch`, `sources import|list`, `voices create|list|demo|revoke`, `generate-character-demos` and the `scene` sub-app; every `--json` verb is a `json_verb`. → [`apps/tonwerk/engine/README.md`](engine/README.md)
- **A QA report belongs to one revision and one variant** (`scene_qa_reports`); read the report of the variant you act on, never another's. → [`apps/tonwerk/engine/README.md`](engine/README.md#the-store)
- **`uv sync` removes the Qwen and Stable Audio runtimes**; re-run `install-qwen.sh` / `install-stable-audio.sh` after it. → [`apps/tonwerk/engine/README.md`](engine/README.md#start)
